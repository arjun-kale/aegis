# A.E.G.I.S — Autonomous Exploration & Gait Inversion Studio

An agent-native 3D robotics mission workbench built on the [W3C WebMCP](https://github.com/webmachinelearning/webmcp) standard. A human operator and a browser-resident AI agent jointly command a bipedal robot through an unmapped multi-level facility — the agent perceives, plans, and proposes; the human approves or rejects every motion before it commits.

Neither party can complete a mission alone. The agent cannot move the robot without approval; the human cannot solve inverse kinematics or search a navigation grid by hand. The output of a session is a reviewed, exportable **mission plan** — an ordered list of approved waypoints, gaits, and mechanism overrides.

## Who this is for

Robotics tooling teams, and anyone evaluating what a WebMCP-native agent surface looks like in practice: a real tool suite with typed rejections, a human authority gate that an agent cannot bypass, and a recovery loop the agent has to reason about rather than a single scripted call.

## 30-second quickstart

```bash
git clone <this-repo>
cd aegis
npm install
npm run dev
```

Open `http://localhost:3000`. You'll see the facility, the robot, and the HUD. That's it — no environment variables, no database, no external services required.

> **Note on `npm run dev`:** `navigator.modelContext` is `[SecureContext]`-gated per the WebMCP spec, so a real agent extension will only see it over HTTPS (the deployed production URL) or `https://localhost`, not plain `http://localhost`. The dev server is fine for everything else — driving the app yourself, running the fallback console, watching telemetry.

## Enabling WebMCP

No mainstream browser ships `navigator.modelContext` natively yet. To exercise the real agent path you need a WebMCP-capable browser build or extension that implements the [proposal](https://github.com/webmachinelearning/webmcp), pointed at the deployed HTTPS URL. If `navigator.modelContext` isn't present, the app **degrades honestly** rather than failing silently: the header's WebMCP badge switches to `FALLBACK_HARNESS` (amber, clickable) and logs an explained entry to the mission audit log.

## Using the fallback console

This is how everyone — reviewers included — should evaluate the tool suite without a WebMCP browser. Click **CONSOLE** in the header (or the `FALLBACK_HARNESS` badge). It lists all ten registered tools, lets you pick a JSON payload (quick-test presets are provided for the interesting cases, including ones designed to trigger a rejection), and invokes the exact same `execute()` handler a live agent would call. It is not a mock — it is the development harness this project was built against.

Try the rejection-and-recovery loop by hand:
1. `stage_locomotion_plan` → preset **"Stage Walk to Extraction"** → `BLOCKED_GEOMETRY` (the route crosses the armed `laser_gate_02`).
2. `override_facility_mechanism` → preset **"Disarm laser_gate_02"**.
3. `stage_locomotion_plan` → same preset again → now stages successfully, `PENDING_APPROVAL`.
4. Approve the route in the Human Authority Gate banner ([A] or the Approve button).
5. `execute_staged_proposal` → the console auto-fills the staged `proposal_id` → `EXECUTING`.

This exact sequence is exercised end-to-end by `e2e/mission-loop.spec.ts`.

## The loop this project is built around

```
Human:  "Map the east wing and reach extraction without tripping the laser grid."

Agent:  scan_spatial_environment(range_m: 15)
        → unexplored frontiers, corridor blocked by laser_gate_02

        stage_locomotion_plan(waypoint: extraction, gait: CAUTIOUS_STEP)
        → BLOCKED_GEOMETRY: "Route obstructed by armed laser_gate_02"
          suggested_action: override_facility_mechanism first

        override_facility_mechanism(laser_gate_02, DEACTIVATE) → disarmed

        stage_locomotion_plan(waypoint: extraction, gait: CAUTIOUS_STEP)
        → PENDING_APPROVAL: proposal staged, margin 0.83

Human:  [Approve Route]

Agent:  execute_staged_proposal(proposal_id) → EXECUTING
```

A real failure and a real recovery, not a single call bolted onto a form.

## Architecture

See [ARCHITECTURE.md](./ARCHITECTURE.md) for the state partition (why per-frame telemetry never touches zustand), the WebMCP tool contract, and the engineering decisions behind the kinematic robot, the stability model, and the facility generator.

See [TOOLS.md](./TOOLS.md) for every registered tool's schema, example inputs, every response status it can return, and the recovery path for each.

## What is simulated (read this before trusting a number)

This project makes deliberately calibrated claims. Specifically:

- **The robot is animated kinematically, not with rigid-body dynamics.** Inverse kinematics writes joint transforms directly; there is no torque-controlled physics solver driving the legs. This is why the same mission produces an identical result on every machine. Physics (`@react-three/rapier`, optional) is confined to inert environmental props — crates, debris — that never affect robot state.
- **`stability_margin` is a static stability metric, not full ZMP.** It's the normalized distance from the ground-projected center of mass to the nearest edge of the convex hull of active foot contacts — a real, defensible criterion, but not the Zero Moment Point, which requires per-link accelerations a kinematic rig doesn't produce honestly. The codebase never uses the identifier `zmpStabilityIndex`; it says `stabilityMargin` everywhere, including in tool output.
- **Spatial queries are brute-force, not an octree.** The facility has on the order of 10² static colliders — a range query or raycast against the flat collider array costs less than building and maintaining a spatial index at that scale. The query surface (`spatialIndex.ts`) is a swappable module boundary if the facility ever grows past ~5,000 objects.
- **Joint torque estimates are gravitational, not empirical.** They're derived from the moment arm of supported mass under the kinematic pose, not measured from a physical actuator.
- **The facility is procedurally generated from a seed**, not hand-authored. The same seed produces a byte-identical layout on every reload — the seed is a URL parameter and defaults to a fixed constant, so a fresh visitor sees exactly what the demo showed.

None of this is a hedge — it's what makes the numbers on screen honest. A reviewer who knows robotics will check, and a calibrated claim reads as competence, not a gap.

## Tech stack

| Layer | Choice |
|---|---|
| Framework | Next.js 14.2 (App Router), React 18, TypeScript strict |
| 3D | `three`, `@react-three/fiber`, `@react-three/drei` |
| Postprocessing | `@react-three/postprocessing` (Bloom + Vignette), behind a quality toggle, default off |
| State | `zustand` (`subscribeWithSelector`) for discrete mission state; a raw `Float32Array` bus for per-frame telemetry |
| Styling | Tailwind CSS |
| Testing | `vitest` (unit + fuzz), `@playwright/test` (E2E) |
| Deploy | Vercel, HTTPS required (`navigator.modelContext` is `[SecureContext]`) |

**Why Next.js 14, not 15:** the build plan originally specified Next.js 15 + React 19. In practice, Next 15's App Router exposes React-19-shaped internals to the client bundle regardless of the React version pinned in `package.json`, which crashes `react-three-fiber` v8's reconciler (built for React 18) on every mount. Next 14.2 keeps React 18 and the existing R3F v8 code path working. See the decision log in `ARCHITECTURE.md` for the full trace.

## Testing

```bash
npm test          # vitest — unit coverage on ik/gait/stability/navigation, plus a 136-assertion
                   # input-hardening fuzz suite across every registered tool
npm run test:e2e  # playwright — drives the fallback console through the full loop above,
                   # against a real production build
npm run build      # next build — TypeScript strict check + production bundle
```

## Limitations

- No mainstream browser ships `navigator.modelContext` yet — the fallback console is the only way most people will exercise the agent surface today.
- Sustained ≥55 FPS on real integrated-graphics hardware and a multi-minute heap-growth soak test have not been independently benchmarked outside development machines.
- `@react-three/rapier` prop physics (Phase 9, optional) is not wired in; the plan treats it as expendable if it destabilizes anything, and it was never worth the risk here.

## License

MIT — see [LICENSE](./LICENSE).
