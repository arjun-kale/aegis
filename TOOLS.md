# Tool Reference

Every tool below is registered from `lib/webmcp/register.ts` (`ACTIVE_TOOLS`) and lives in its own file under `lib/webmcp/tools/`. All ten are exercised through the fallback console (see README) exactly as an agent would call them.

Every successful response is wrapped `{ status: 'OK', ...payload }`. Every failure is `{ status: '<CODE>', reason, recoverable, suggested_action?, ...details }` with `isError: true` — never a thrown exception. Codes below are the tool's own `status` field, distinct from the outer `isError` flag.

---

## `get_system_status`
**Read-only. Always safe.**

Query real-time 3D runtime performance and WebMCP connectivity.

**Input:** `{ verbose?: boolean }`

**Example:** `{ "verbose": true }`

**Success payload:** `fps`, `frame_time_ms`, `scene_object_count`, `mesh_count`, `webmcp_active`, `timestamp`, `status_summary` (`OPTIMAL` / `ACCEPTABLE` / `DEGRADED`), plus `diagnostics` (triangles, draw calls, geometries, textures) when `verbose: true`.

**Failure statuses:**
| Status | Cause | Recovery |
|---|---|---|
| `INVALID_ARGUMENT` | `verbose` is present but not a boolean | Omit it or pass a real boolean |

---

## `get_robot_telemetry`
**Read-only. Always safe.**

Full-body telemetry: pose, 10 joint angles, 6 joint torques, thermal headroom, `stability_margin`, battery SOC, active faults, stance state. No arguments — ignores whatever is passed.

**Input:** `{}`

**Failure statuses:** none — always returns `OK`.

---

## `scan_spatial_environment`
**Read-only, mutates the exploration grid only (marks cells `scanned`).**

Line-of-sight LIDAR/optical scan around the robot's current position. Returns detected obstacles, mechanisms, terrain features, and — the important part — **unexplored frontier coordinates**, which is what gives an agent a reason to keep exploring.

**Input:** `{ scan_mode: 'fast' | 'high_res', range_m: number }` (both required, 1.0–25.0 m)

**Example:** `{ "scan_mode": "high_res", "range_m": 15 }`

**Success payload:** `scan_origin`, `range_m`, `scan_mode`, `total_scanned_cells`, `newly_discovered_cells`, `obstacles[]`, `mechanisms[]`, `terrain_features[]`, `unexplored_frontiers[]`.

**Failure statuses:**
| Status | Cause | Recovery |
|---|---|---|
| `INVALID_PARAMETER` | `range_m` missing or not a finite number | Pass a numeric `range_m` |
| `OUT_OF_BOUNDS` | `range_m` > 25 m or < 1 m | Retry within `[1.0, 25.0]` |

---

## `evaluate_gait_feasibility`
**Read-only, dry-run. Never mutates robot pose or world state.**

Simulates a candidate path + gait profile through the stability and torque model without staging anything. Useful for an agent to check a route before committing to `stage_locomotion_plan`.

**Input:** `{ path: [number, number, number][] (≥2 waypoints), gait_profile: 'CAUTIOUS_STEP' | 'DYNAMIC_BALANCE' | 'HIGH_CLEARANCE' }`

**Example:** `{ "path": [[0,0,0],[4,0,0],[8,0,0]], "gait_profile": "CAUTIOUS_STEP" }`

**Success payload (note — infeasibility is `status: 'OK'` with `feasible: false`, not an error status; it's a real answer, not a rejection):** `feasible`, `estimated_margin_min`, `max_torque_nm`, `failure_reason` (present only when `feasible: false`), `gait_profile`, `waypoints_count`, `total_path_distance_m`.

Feasibility fails when: the path crosses an armed/impassable mechanism; `DYNAMIC_BALANCE` is requested on a >~15° incline (insufficient double-support duration); or the simulated minimum stability margin drops below `0.20` or peak torque exceeds `220 N·m`.

**Failure statuses:**
| Status | Cause | Recovery |
|---|---|---|
| `INVALID_PARAMETER` | `path` has fewer than 2 waypoints, or `path` is missing/not an array | Provide ≥2 waypoints |
| `INVALID_PARAMETER` | A waypoint is not a 3-element finite-number array | Fix the malformed waypoint |
| `INVALID_PARAMETER` | `gait_profile` is not one of the three enum values | Use `CAUTIOUS_STEP`, `DYNAMIC_BALANCE`, or `HIGH_CLEARANCE` |

---

## `query_facility_state`
**Read-only. Always safe.**

Snapshot of every mechanism's state, active alarms, power status, and extraction-route passability (computed live via A*). No arguments.

**Input:** `{}`

**Success payload:** `facility_seed`, `mechanisms[]`, `power_status`, `active_alarms[]`, `extraction_route_status` (`OPEN`/`BLOCKED`/`UNKNOWN`), `extraction_route_blocked_by?`, `extraction_point`.

**Failure statuses:** none — always returns `OK`.

---

## `stage_locomotion_plan`
**Never mutates robot pose.** Stages a proposal in the Human Authority Gate; approval status is decided entirely by the store's `autonomyMode`/`safetyThreshold` (operator-controlled — a tool argument cannot force approval).

Runs A* against the facility nav grid, simulates the requested gait, computes the minimum predicted stability margin along the route, and either stages a ghost path or returns a structured rejection.

**Input:** `{ target_waypoint: [x, y, z], gait_profile: 'CAUTIOUS_STEP' | 'DYNAMIC_BALANCE' | 'HIGH_CLEARANCE' }`

**Example:** `{ "target_waypoint": [18, 2.5, 19], "gait_profile": "CAUTIOUS_STEP" }`

**Success payload:** `proposal_id`, `status` (`PENDING_APPROVAL` or `APPROVED`, per `autonomyMode`), `target_waypoint`, `gait_profile`, `path_summary` (waypoint count, distance, duration), `predicted_min_margin`, `required_mechanisms[]`.

**Failure statuses:**
| Status | Cause | Recovery |
|---|---|---|
| `INVALID_PARAMETER` | `target_waypoint` missing/not a 3-element array, or unknown `gait_profile` | Fix the argument |
| `BLOCKED_GEOMETRY` | Route passes through an armed/impassable mechanism | `suggested_action` names the exact mechanism — call `override_facility_mechanism` on it, then re-stage |
| `UNREACHABLE_DESTINATION` | No walkable path exists to the target at all | Choose a destination inside the facility's corridors |

---

## `execute_staged_proposal`
**The Human Authority Gate enforcement point.** Strictly requires `approvalStatus === 'APPROVED'` before committing motion.

**Input:** `{ proposal_id: string }`

**Example:** `{ "proposal_id": "prop-abc123-xy9z" }`

**Success payload:** `proposal_id`, `status` (`EXECUTING`), `message`, `target_waypoint`, `gait_profile`, `waypoints_count`, `estimated_duration_s`.

**Failure statuses:**
| Status | Cause | Recovery |
|---|---|---|
| `INVALID_PARAMETER` | `proposal_id` missing or not a string | Pass the `proposal_id` from a `stage_locomotion_plan` response |
| `PROPOSAL_NOT_FOUND` | No staged proposal matches the given id (or nothing is staged) | Call `stage_locomotion_plan` first |
| `GATE_LOCKED` | Proposal exists but `approvalStatus` is still `PENDING_APPROVAL` | Wait for the operator to approve in the HUD, or for `AUTO_APPROVE_SAFE` policy to clear it — an agent cannot clear this itself |
| `PROPOSAL_REJECTED` | The operator rejected the staged proposal | `rejection_reason` is included — adjust waypoints/gait and stage a revised proposal |

---

## `override_facility_mechanism`
**Genuinely mutates world state** — mechanism status and, transitively, nav-grid passability.

**Input:** `{ mechanism_id: 'laser_gate_01' | 'laser_gate_02' | 'freight_lift_01' | 'sealed_door_01', command: 'DEACTIVATE' | 'ACTIVATE' | 'RAISE' | 'LOWER' | 'DIVERT_POWER' | 'SEAL', authorization_code?: string }`

**Example:** `{ "mechanism_id": "laser_gate_02", "command": "DEACTIVATE" }`

`sealed_door_01` additionally requires `authorization_code` (one of a small fixed set of valid facility codes) for `DIVERT_POWER`.

**Success payload:** `mechanism_id`, `previous_state`, `new_state`, `passable`, `message`.

**Failure statuses:**
| Status | Cause | Recovery |
|---|---|---|
| `INVALID_PARAMETER` | `mechanism_id` or `command` missing or not a string | Fix the argument |
| `MECHANISM_NOT_FOUND` | Unknown `mechanism_id` | `suggested_action` lists every valid id — agents will occasionally hallucinate ids, so the error always enumerates the real ones |
| `AUTHORIZATION_REQUIRED` | `sealed_door_01` + `DIVERT_POWER` without a valid `authorization_code` | Supply a valid code |
| `INVALID_COMMAND` | `command` isn't in that mechanism's allowed set (e.g. `RAISE` on a laser gate) | `suggested_action` lists the mechanism's allowed commands |

---

## `set_exploded_engineering_view`
**Purely visual. Safe without approval — never touches robot pose or trajectory.**

Drives the exploded engineering disassembly view and returns live per-subsystem torque/thermal readouts for inspection.

**Input:** `{ disassembly_factor: number (0.0–1.0), part_filter?: 'ALL' | 'LEGS' | 'ARMS' | 'HEAD' | 'TORSO' }`

**Example:** `{ "disassembly_factor": 0.6, "part_filter": "LEGS" }`

**Success payload:** `disassembly_factor`, `part_filter`, `active_parts_count`, `subsystems[]` (per-part id, name, rated torque/temp, current load, thermal headroom), `message`.

**Failure statuses:**
| Status | Cause | Recovery |
|---|---|---|
| `INVALID_PARAMETER` | `disassembly_factor` missing, non-numeric, or outside `[0.0, 1.0]` | Pass a float in range |
| `INVALID_PARAMETER` | `part_filter` present but not one of the five enum values | Use `ALL`, `LEGS`, `ARMS`, `HEAD`, or `TORSO` |

---

## `get_mission_plan`
**Read-only. Always safe.**

Returns the accumulated mission plan — conforms to the same `AegisMissionPlanV1` schema used by the export/import feature (§9), so an agent can self-summarize its own work using the identical source of truth a human would export.

**Input:** `{ include_execution_history?: boolean }` (default `true`)

**Success payload:** `mission_plan` — `schema_version`, `exported_at`, `facility_seed`, `mission_metadata`, `target_waypoint`, `waypoints[]`, `mechanism_states`, `execution_history[]` (omitted when `include_execution_history: false`).

**Failure statuses:** none — always returns `OK`.

---

## Input hardening

Every tool above survives `null`/`undefined` arguments, wrong types, missing required fields, unknown enum values, and out-of-range numerics without throwing — verified by a 136-assertion fuzz suite (`tests/hardening.test.ts`) run against every registered tool with a shared matrix of malformed payloads, plus targeted regression tests for six specific bugs this suite found and fixed (see `ARCHITECTURE.md` §4).
