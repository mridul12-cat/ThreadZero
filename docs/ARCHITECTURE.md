# Architecture

## Data and state

[`src/storage/types.ts`](../src/storage/types.ts) defines Zod runtime schemas and TypeScript task/workspace types. Stable UUIDs identify tasks. Edges store source prerequisite and target dependent. Candidate edges are separate from confirmed edges. Task status, explicit ACTION/WAITING_EVENT classification and user-marked unavailability are separate. External receipt requires its own eventResolvedAt confirmation. Goals are separate entities. App state is centralized in React; graph/ranking/scenario calculations are derived. IndexedDB saves are debounced by 350 ms after hydration to avoid overwriting persisted data with the initial empty state.

Imports validate version, size, schema, unique IDs, endpoints, self edges, duplicates and acyclicity. Workspace limits are 500 tasks and 10,000 edges. The UI is intended primarily for 50–100 tasks. No synthetic performance claim is made.

## Deterministic graph engine

[`src/graph/engine.ts`](../src/graph/engine.ts): A → B means A must finish before B can start. A new edge is rejected if the source is reachable from the target. Iterative traversal uses a Set so diamond paths count each descendant once. Kahn's topological sort still detects cycles. The map uses Dagre for each connected component, then deterministic shelf/grid packing for separate branches and independent tasks. Proposed edges may inform visual positioning but never readiness. Selection highlights all transitive prerequisites and downstream dependents; unrelated tasks fade slightly. Readable initial zoom is bounded; explicit overview and path/list navigation handle large graphs. Node deletion removes incident edges and recomputes availability.

Readiness requires unfinished ACTION status, no unavailable flag, a scheduled start no later than today, and all prerequisites actually complete. WAITING_EVENT nodes are never executable recommendations. Completed nodes remain in the graph for context. An external event is resolved through an explicit received/completed action; completing a predecessor never resolves it. The separate unavailable flag can be cleared on ordinary actions.

## Recommendation

[`src/ranking/engine.ts`](../src/ranking/engine.ts) ranks only ready tasks:

- Deadline: 50 points overdue, 40 within one day, 28 within three days, 14 within seven days, otherwise zero.
- Priority: low 0, normal 8, high 20.
- Unique unfinished descendants: 6 each, capped at 24.
- Effort: max(0, 15 − minutes/4); unknown estimatedMinutes contributes a neutral 7.5 points. Numeric values require explicit source/user provenance.
- Ties: ascending creation timestamp, then ID.

Deadlines are interpreted at local end of day. Rankings update on workspace edits, a one-minute clock refresh and window focus. An optional available-time filter excludes known durations above the budget but retains unknowns without promising a fit. Explanations expose readiness, effort, descendants, deadline and explicit priority. A descendant is potential downstream impact, not a claim that one completion unlocks all descendants immediately.

## Parser

[`src/parser/extract.ts`](../src/parser/extract.ts) preserves source text, splits basic punctuation/newlines, normalizes leading obligation phrases and bullets, recognizes action verbs, de-duplicates identical normalized titles, and preserves unrecognized fragments as notes. Explicit before/after/until patterns produce candidate edges. User confirmation is required. Effort is unknown unless explicitly stated; priority defaults to normal. Calendar context uses an explicit local date/timezone for AI requests. Deadlines and planned starts are distinct; undated event deadlines request clarification. The classic parser uses no LLM or semantic inference. Neither local parsing nor the optional Magic layer automatically verifies a dependency.

## Scenarios

[`src/simulation/engine.ts`](../src/simulation/engine.ts) creates fresh task objects and changes only the selected task in derived state. It computes exact immediate availability, remaining unavailable tasks, unique downstream impact, the next recommendation, and a coarse deadline warning for downstream tasks due within seven days. This is not a scheduling model. Exiting clears derived state. Applying a completion/waiting change requires browser confirmation and supports undo.

## Voice

[`src/voice/native.ts`](../src/voice/native.ts) rejects remote-only recognition. `VoicePanel.tsx` owns one recording/inference session at a time, native language pack checks, actual microphone capture, recording timer, browser audio decode/resampling, editable transcripts and cleanup. `asr.worker.ts` lazily loads Transformers.js and a q8 Whisper model, runs CPU/WASM inference, reports actual asset loading events and never calls a cloud inference API. Worker isolation avoids blocking the main UI. Models are optional network downloads, not bundled into the capture UI.

Native detection requires `processLocally` plus `SpeechRecognition.available({langs:['en-US'], processLocally:true})`; recognition starts only after confirmed local availability, and downloadable packs require an explicit install action. Default remote Web Speech recognition is never used. The fallback captures with MediaRecorder, browser-decodes audio and resamples through OfflineAudioContext to mono 16 kHz before q8 inference with `onnx-community/whisper-tiny.en` (Apache-2.0). WebGPU is not implemented; the single CPU/WASM path favors compatibility. The download notice, actual file/byte progress, optional cache and network/privacy limits are documented in [Testing](TESTING.md#known-limitations).

## Accessibility and limits

Semantic headings, labels, status announcements, visible focus, native modal focus handling, keyboard navigation, keyboard form dependency editing, an equivalent map list, state text/icons, and reduced-motion preferences. Narrow phones automatically use the list instead of the canvas. Pip can be disabled. Higher contrast is an optional preference, not a certified WCAG audit. Browser confirm/prompt dialogs are used for destructive actions, manual additions and simulation application.

Graph nodes are draggable and connections can be added by handles or text controls. Node data refreshes on edits while dragged positions survive selection and ordinary data changes. Topology changes and Reset layout reflow the graph; custom positions remain session-only. Undo restores the most recent operation snapshot, not a full version-control history. Major actions are logged; every keystroke is intentionally not logged. There are no projects beyond the active workspace, background notifications or accounts. The optional Magic layer adds a server API without changing local graph computation.

## Optional Groq reasoning layer

Magic Untangle adds `src/magic/` for the strict contract, graph-domain validation and append-only reconciliation, and consent/cooldown UI. `server/untangle.ts` handles bounded Groq HTTP requests, sanitized failures and strict validation. `server/rate-limit.ts` provides atomic Redis reservations for deployed use; `api/untangle.ts` is the Vercel Node adapter. Vite serves the same core locally and reads non-public environment variables only in server config. Validation, readiness and deterministic ranking remain independent of AI; dotted proposals are a separate React Flow overlay, not actual graph constraints. Older workspaces default new metadata to empty values on validation. See [Magic Untangle](MAGIC_UNTANGLE.md) for deployment and privacy requirements.

## Current regression report

[Testing and verification](TESTING.md) records typed external-event behavior, nullable duration migration, evidence checks, bulk review, clustered layout, ranking weights, labeled scenarios and actual test results. The free-tier safety gate and server-only environment handling remain unchanged; completion output is capped at 3,600 tokens to accommodate evidence-bearing science responses.
