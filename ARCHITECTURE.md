# Architecture

## 1. State partition

Two stores exist and they never overlap. Mixing them is the single most common way this class of project loses framerate, so the boundary is enforced structurally, not by convention.

### `lib/state/telemetryBus.ts` — per-frame data

A module-level `Float32Array` with named offsets (`lib/state/telemetryOffsets.ts`), plus a plain subscriber list. Positions, joint angles, torques, velocities, stability margin, FPS — anything written inside `useFrame` — lives here. `writeTelemetry`/`writeTelemetrySingle` are non-allocating; `subscribeTelemetry(callback, hz)` fires on a fixed interval (default 10 Hz) rather than per frame, via a single shared `setInterval` ticker, not one timer per subscriber.

**Why not zustand for this:** calling `set()` on a zustand store at 60 Hz notifies every subscriber and defeats the purpose, even with typed-array values — the store slice's reference changes, so React re-renders. "Transient" in zustand means subscribing *outside* React via `store.subscribe(selector, cb)`, not passing typed arrays through `set()`. HUD components read telemetry via `useTelemetry(offset, length, hz)` (`lib/state/useTelemetry.ts`), which subscribes at a throttled rate and only calls `setState` when the read slice actually changed.

### `lib/state/missionStore.ts` — discrete, event-driven data

A `zustand` store with `subscribeWithSelector`. Holds the staged proposal, approval status, mechanism states, the mission log, the exploration grid, the facility seed, autonomy mode, and the rendering quality toggle — anything that changes on a discrete event (a tool call, an approval, a mechanism override), not every frame.

**Verification:** every `useFrame` callback in the codebase was audited for `useMissionStore`/`.set(` calls; none exist. HUD components that read live telemetry never subscribe to the store per frame — they poll `telemetryBus` on an interval instead.

## 2. The WebMCP tool contract

Every tool in `lib/webmcp/tools/` conforms to this shape (`lib/webmcp/types.ts`):

```ts
interface ToolDescriptor<TArgs = any> {
  name: string;
  description: string;      // read by an LLM deciding what to call next — see below
  inputSchema: { type: 'object'; properties?: ...; required?: string[]; ... };
  outputSchema?: { ... };
  execute: (args: TArgs) => Promise<ToolResult> | ToolResult;
}
```

- The handler property is `execute`, not `handler`.
- `execute` always returns `{ content: [{ type: 'text', text: JSON.stringify(...) }], isError?: boolean }` — never a bare object. `lib/webmcp/responses.ts` provides `formatSuccessResponse`/`formatFailureResponse` so no handler hand-builds the envelope.
- `inputSchema` is JSON Schema with every field described and every closed value space expressed as `enum`. The schema is a hint to the calling model, not an enforcement boundary — every handler validates its arguments again at runtime (`lib/webmcp/schemas.ts` provides a shared `validateSchema`, used directly by `get_system_status`; the others validate inline because their guards double as the source of structured rejection reasons).
- **No stub handlers.** Every registered tool mutates or reads real state. If a capability isn't built, its tool isn't registered — a handler that returns `{ success: true }` without touching anything is worse than an absent tool, because the agent believes the world changed.

### Registration lifecycle

`lib/webmcp/register.ts`:

```ts
export function resolveModelContext(): ModelContext | null {
  if (typeof window === 'undefined') return null;
  if (!window.isSecureContext) return null;     // [SecureContext] — undefined on http
  return (navigator as any).modelContext ?? (document as any).modelContext ?? null;
}
```

Registration is lifetime-scoped to the page (`app/page.tsx`, `useEffect`): tools register on mount and unregister on unmount via `unregisterTool`, so hot reload and remounting never throw a duplicate-name error, and unmounted state never leaks a callable tool.

### Structured failure is a feature

Tools return typed outcomes, never thrown exceptions across the tool boundary:

```json
{ "status": "OK", "...": "..." }

{ "status": "REJECTED_STABILITY",
  "reason": "Predicted stability margin 0.41 is below the 0.60 safety threshold.",
  "recoverable": true,
  "suggested_action": "Retry with gait_profile CAUTIOUS_STEP." }

{ "status": "BLOCKED_GEOMETRY",
  "reason": "Corridor E is sealed by laser_gate_02.",
  "recoverable": true,
  "suggested_action": "Call override_facility_mechanism with mechanism_id laser_gate_02 and command DEACTIVATE, then re-stage." }
```

`tests/hardening.test.ts` fuzzes every registered tool with null/undefined args, wrong types, missing required fields, unknown enums, and out-of-range numerics, asserting none of them ever throw — a thrown exception across this boundary is always a bug, confirmed by six real ones found and fixed this way (see the decision log below).

### Descriptions are prompts

A tool description is read by a language model deciding what to call next, so it states what to do when the call fails, not just what the tool does. Compare the weak version ("Stages a kinematic trajectory") with what's actually shipped on `stage_locomotion_plan` — it names the exact next call and under what condition. This is the difference between a one-call demo and the multi-step loop described in the README.

## 3. The Human Authority Gate

`missionStore.approvalStatus` is the single source of truth for whether a staged proposal can execute, driven only by `autonomyMode`/`safetyThreshold` — fields the operator sets via the HUD (`AuthorityGateHUD.tsx`), never by a tool argument. `stage_locomotion_plan` stages a proposal and lets the store alone decide `PENDING_APPROVAL` vs `APPROVED`; `execute_staged_proposal` re-reads `approvalStatus` and returns `GATE_LOCKED` if it isn't `APPROVED`. See §4 below for why this used to be bypassable and no longer is.

## 4. Decision log

These are the load-bearing calls made during this build, and why. Treat them as settled unless the reasoning below no longer holds.

**Kinematic locomotion, not rigid-body dynamics.** A torque-controlled biped in a physics engine oscillates, drifts, or ragdolls, and every hour spent tuning solver parameters is an hour not spent on the agent layer the product is actually about. Kinematic control is deterministic — the same mission produces the same result on every machine. `@react-three/rapier` is confined to inert props; the robot never becomes a `RigidBody`.

**Procedural robot hierarchy, not a rigged GLTF.** `lib/robot/rig.ts` defines the joint hierarchy as data (parent, offset, segment length, rotation limits); `Robot.tsx` reads it into nested `THREE.Group`s. IK writes quaternions onto those transforms directly — no asset to source or license, no bone-matrix debugging, and the exploded engineering view (Phase 8) is trivial because every part is already a discrete node with a known parent.

**Static stability margin, described accurately.** See the README's "what is simulated" section. The short version: name the metric what it is in code and in tool output, because reviewers who know robotics will check.

**Brute-force spatial queries, not an octree.** At ~10² colliders, building and maintaining a spatial index costs more per frame than it saves. `lib/world/spatialIndex.ts` is a deliberately swappable module boundary if that assumption stops holding.

**Standard materials with emissive driving, not custom GLSL.** Thermal/stress visualization interpolates `emissive`/`emissiveIntensity` on `meshStandardMaterial` from joint torque. Visually indistinguishable from a custom shader at a fraction of the surface area, and it survives material/lighting changes without recompilation.

**Next.js 14.2, not 15 (deviation from the original plan).** The build plan specified Next.js 15 + React 19. Package.json instead pinned React 18.3.1 against Next 15 — an inconsistency that went unnoticed through Phases 0–9 because nothing in the test suite or build process actually renders the Canvas in a browser (`vitest` runs in a `node` environment; `next build` only typechecks and prerenders static shells). The first thing that ever opened the app in a real browser was the Phase 10 Playwright E2E harness, which immediately hit:

```
TypeError: Cannot read properties of undefined (reading 'ReactCurrentOwner')
  at $$$reconciler (react-reconciler/cjs/react-reconciler.development.js:498)
  at createRenderer (@react-three/fiber/dist/events-*.esm.js)
```

Root cause: Next 15's App Router client bundle exposes React-19-shaped internals to code running in it, regardless of the React version declared in `package.json`. `react-reconciler@0.27.0` (the version `@react-three/fiber` v8 depends on, built for React 18's internals shape) crashes the instant its module evaluates, which happens at import time — so the canvas never rendered, in any phase, until this was found and fixed. This is a documented upstream incompatibility ([vercel/next.js#71836](https://github.com/vercel/next.js/issues/71836), [pmndrs/react-three-fiber#3398](https://github.com/pmndrs/react-three-fiber/issues/3398)); the two remediations are downgrading Next to a version that doesn't bundle React-19 internals, or upgrading the whole stack to React 19 + R3F v9. This project took the smaller, lower-risk path: **downgrade to Next 14.2.35**, which keeps React 18 and every existing R3F v8 component untouched. `next.config.ts` became `next.config.mjs` because TypeScript config files require Next 15.

**Human Authority Gate bypass, found and closed.** `stage_locomotion_plan` originally accepted an agent-supplied `auto_approve_if_margin_above` argument and used it to call `store.setApprovalStatus('APPROVED')` directly — independent of `autonomyMode`, which defaults to `MANUAL_APPROVAL` and is the only field the human-facing HUD toggle controls. An agent could self-approve any proposal by passing a low threshold, defeating the entire "cannot commit motion without approval" premise the product is built around. Fixed by deleting the parameter; approval status is now read back from the store after `stageProposal()`, which itself only ever consults `autonomyMode`/`safetyThreshold`. Regression-tested in `tests/actionToolsAndGate.test.ts`.

## 5. Directory layout

```
app/
  layout.tsx, page.tsx            # shell; dynamic-imports Viewport with ssr:false
components/
  viewport/                       # Canvas root, robot, facility, ghost trajectory,
                                   # postprocessing effects, error boundary
  hud/                            # telemetry, approval gate, tool call log, mission export,
                                   # dev harnesses (IK/gait/facility), fallback console
lib/
  robot/                          # rig.ts (data), ik.ts (pure), gait.ts (pure),
                                   # stability.ts (pure), locomotion.ts, kinematics.ts
  world/                          # generator.ts (seeded), navigation.ts (A*, pure),
                                   # spatialIndex.ts (swappable), mechanisms.ts, exploration.ts,
                                   # missionExport.ts
  webmcp/                         # register.ts, tools/ (one file per tool), schemas.ts,
                                   # responses.ts, types.ts
  state/                          # missionStore.ts (zustand), telemetryBus.ts (Float32Array),
                                   # telemetryOffsets.ts, useTelemetry.ts
tests/                            # vitest — unit + the input-hardening fuzz suite
e2e/                              # playwright — the real §0 loop, driven through the UI
```
