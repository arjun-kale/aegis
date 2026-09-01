# Demo Script

Target: under three minutes, with audio. Record at 1600×900+ so the HUD text is legible. Use a WebMCP-capable browser if one is available; otherwise drive the identical loop through the fallback console (open it before recording — see README) and narrate that substitution explicitly in the first ten seconds so it doesn't read as a missing feature.

| Time | Beat | What to say | What to show |
|---|---|---|---|
| 0:00–0:20 | State the problem | "A human operator and a browser-resident AI agent jointly command a bipedal robot through an unmapped facility. Neither can finish the mission alone — the agent can't move the robot without approval, and the human can't solve inverse kinematics by hand." | Wide shot of the loaded scene: facility, robot, HUD. Point at the `MANUAL_APPROVAL` gate pill. |
| 0:20–0:35 | One instruction | "I'll give it one instruction: map the east wing and reach extraction without tripping the laser grid." | Type/speak the instruction into the agent (or narrate it while driving the console manually). |
| 0:35–1:05 | The agent scans and tries | Narrate as it happens: `scan_spatial_environment` returns unexplored frontiers and a blocked corridor; `stage_locomotion_plan` toward extraction comes back `BLOCKED_GEOMETRY`. | Zoom on the **Tool Call Log** — the rejection should be visibly styled differently from a success. |
| 1:05–1:25 | Real recovery, not a script | "It reads the rejection, sees `suggested_action` names the exact mechanism, and calls `override_facility_mechanism` to disarm it — then re-stages, and this time gets `PENDING_APPROVAL`." | Show the mechanism state flip in the Facility panel, then the ghost trajectory reveal for the re-staged proposal. |
| 1:25–1:45 | Human authority, for real | "Nothing moves until I approve it." Click **Approve Route**. | The Authority Gate banner transitioning `PENDING_APPROVAL` → `APPROVED` → `EXECUTING`; the robot walking the approved path. |
| 1:45–2:10 | Exploded engineering view | "While it walks, here's the second inspection mode — joint torque and thermal stress, live." | Open the exploded view (F6 or the header button), let a couple of joints show amber/red emissive glow near their rated limits. |
| 2:10–2:35 | Export the artifact | "The session output isn't a demo — it's a mission plan a robotics team would actually keep." | Open **Export / Replay** (F7), show the JSON with waypoints, gaits, mechanism overrides, approval timestamps, and the facility seed. Download it. |
| 2:35–2:55 | Close | "Kinematic, not physics-driven — deterministic on purpose. Static stability margin, not full ZMP — named accurately in the code and the tool output. Everything here is calibrated, not oversold." | Cut back to the wide shot. |

## Notes for the recorder

- The rejection-then-recovery beat (0:35–1:25) is the single most important 50 seconds in the video — it's the project's actual thesis. Don't rush it.
- If narrating over the fallback console instead of a live agent, say so once, plainly, near 0:20 ("I'm driving this through the fallback console, which calls the identical `execute()` handlers a WebMCP agent would") — then never apologize for it again.
- Keep the Tool Call Log panel open and visible for the entire middle section; it's what makes the protocol legible to someone who's never seen WebMCP before.
