# Testing and verification

This is the single verification reference for ThreadZero. Commands run from the repository root. Ordinary tests mock Groq; real inference/model downloads are opt-in. Historical observations below are dated evidence, not fresh certification of a deployed service.

- [Commands](#commands)
- [Coverage and protected behavior](#coverage-and-protected-behavior)
- [Historical results](#historical-results)
- [Live Groq evidence](#live-groq-evidence)
- [Local speech evidence](#local-speech-evidence)
- [Manual voice checks](#manual-voice-checks)
- [Vercel API evidence](#vercel-api-evidence)
- [Manual deployment checks](#manual-deployment-checks)
- [Known limitations](#known-limitations)
- [Documentation cleanup verification](#documentation-cleanup-verification)

## Commands

Requires the Node/npm setup in [README](../README.md). Install dependencies only when needed:

```sh
npm ci
npm run dev
```

Open [localhost](http://127.0.0.1:5173). The dev server includes the Magic API; the static preview does not.

```sh
npm run typecheck       # application plus NodeNext API checks
npm run lint
npm test                # unit/domain/server/route tests; live Groq skipped
npm run build
npm run test:secrets    # inspect dist without printing configured secrets
npm run format:check
npx playwright install chromium  # once, if Chromium is not installed
npm run test:e2e        # desktop and emulated mobile; provider mocked
npm run preview        # static production output, no Magic API
```

The production-runtime unit test compiles the API into a temporary directory, imports emitted ESM in a separate native-Node process, and serves real loopback HTTP requests with synthetic Groq/Redis responses. It needs permission to listen on localhost. It does not contact those providers.

### Optional Groq smoke test

```sh
npm run test:groq
THREADZERO_GROQ_SCENARIO=science npm run test:groq
```

The full command makes up to three small synthetic cat, unrelated-chores and science requests, spaced by at least 65 seconds. Select `science`, `cat` or `independent` for one case. It reads server environment variables, skips without a key, makes no automatic retry and suppresses credentials/raw provider responses. It consumes real free quota; ordinary tests never enable it automatically. Use the configured model and dedicated free-plan resources; billing status cannot be verified by this script.

### Optional production-worker speech test

In separate terminals, build/serve the static production bundle, then run the opt-in test:

```sh
npm run build
npm run preview -- --port 4173
```

```sh
THREADZERO_ASR_SMOKE=1 THREADZERO_BASE_URL=http://127.0.0.1:4173 npm run test:e2e -- --grep 'real local Whisper' --project desktop
```

This test downloads model assets and feeds the synthetic [WAV fixture](../e2e/fixtures/local-speech.wav) directly to the production worker after browser decoding/resampling. `THREADZERO_AUDIO_FIXTURE` can override the fixture path. It does not verify physical microphone capture. Default browser runs skip both opt-in ASR cases.

## Coverage and protected behavior

| Area                        | Assertions and evidence                                                                                                                                                                                                                                                                                                                                                 |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Graph and ranking           | Directed prerequisites; self/missing/duplicate edge rejection; cycles; topological order; diamond reachability counted once; all prerequisites required; independent/disconnected graphs; stable scoring/ties; deadlines, priorities, neutral unknown duration and available-time filtering; transitive selected paths                                                  |
| Layout                      | Dagre component ordering, independent packing, non-overlapping rectangles, 100 independent-task geometry, readable cards/handles and fit/reset/path controls; no broad hardware performance claim                                                                                                                                                                       |
| Tasks and parsing           | Reminders stay ACTION; WAITING_EVENT needs its own receipt confirmation; completing a reminder does not receive a diagram; source evidence, nullable duration migration, explicit durations, clause-scoped dates/estimates, local-timezone/week/year rollover and undated-event clarification; malformed input, notes, duplicate handling and informal waiting language |
| Review and reconciliation   | Tasks first, hopes/questions collapsed; explicit-only bulk confirmation; inferred proposals remain pending; rejection, undo, goal editing/addition/dismissal; edits, drafts and confirmed edges survive append/retry/view switches; invalid proposals do not change saved work                                                                                          |
| Persistence and simulations | Invalid versions/schemas/IDs/endpoints/cycles rejected; IndexedDB reload; JSON export/import; malformed imports preserve drafts; scenario calculations do not mutate real tasks; preview/exit, confirmed application and undo; exact immediate availability versus coarse deadline warnings                                                                             |
| API and security            | Consent, request/body/byte bounds, strict schema/model output, source validation, missing key, unsupported model, malformed/truncated/cyclic proposal, provider failures, timeout, bounded rate limits, sanitized errors and no automatic retries; server-only credential wiring; fail-closed Redis reservations                                                        |
| Production and fallback     | Native emitted ESM loads; actual HTTP success, method 405, missing key 503, malformed/schema-invalid 400, oversized 413, missing route 404, rate limit 429, authentication 401, invalid model 502 and timeout 504; Vite route JSON 405; frontend handles plain-text/HTML errors; deterministic fallback after 404/500/429                                               |
| Voice                       | Local-only native capability gates, unavailable English pack, permission/no-device messages, actual resource cleanup, mocked recording/worker recovery, empty results rejected, editable transcript, cancellation and late-permission track release; real synthetic worker inference is separate evidence below                                                         |
| UI and accessibility        | Capture → review → map/list → Focus; completion/recommendation recalculation, examples, keyboard shortcuts, no horizontal overflow, reduced motion; axe on capture/review/map/focus/voice/settings at desktop/mobile sizes                                                                                                                                              |

Implementation references: [architecture](ARCHITECTURE.md), [Magic contract/domain](../src/magic/), [graph](../src/graph/), [ranking](../src/ranking/engine.ts), [storage schemas](../src/storage/types.ts), [unit tests](../src/tests/), [server tests/adapter](../server/), [API entry](../api/untangle.ts), [browser tests](../e2e/), and [smoke/secret scripts](../scripts/). App/review/map styling, server development middleware, `tsconfig.api.json` and the package/config files provide the corresponding UI/runtime integration. No new package was needed for the initial Magic integration; Dagre 3.1.1 was added during refinement.

### Migration and reasoning findings

Version-1 workspaces remain readable. New AI metadata originally defaulted to empty values. Later migration repairs legacy `action`/`waiting` classifications, including actionable reminders, retains historical completion of old external events as received, and preserves titles, notes, status, goals, edges and edits. Legacy effort without provenance becomes unknown unless a unique explicit source clause can recover it; explicitly marked user estimates remain. Export a backup when moving data between builds.

The refinement introduced separate goals; `ACTION` / `WAITING_EVENT`; independent unavailable flags; nullable estimates; separate deadline/scheduled-start evidence with local date/timezone; evidence categories; source-supported explicit versus inferred proposals; compact bulk/undo review; and goals that can be edited, added or dismissed. Quotes are checked against submitted text; unsupported explicit claims are downgraded, and temporal/related links are excluded from prerequisites. These checks are conservative heuristics, not proof of necessity.

The Dagre map replaced the baseline layered presentation with connected-branch clustering and independent-task packing. Larger fixed-height cards, golden first-action emphasis, clear arrows, soft cluster backgrounds, slight unrelated-path fading and an explicit handle CSS specificity fix improve readability. Titles are capped at three visual lines; full titles remain accessible in details/text. Ordinary edits/selection preserve session drag positions; topology changes/reset reflow. Rankings now refresh on edits, each minute and window focus; unknown effort scores neutral 7.5, and known estimates above the time filter are excluded without promising that unknowns fit. These supersede baseline claims about layered layout and state-change-only refresh.

Regression fixes additionally retained the deadline in “By Friday, finish slides” while keeping dates and durations scoped to their own local-parser clauses. The science case exposed omitted/paraphrased duration evidence; deterministic matching-source-clause recovery fixed it without converting quantities such as “20 questions” into minutes.

Screenshots are retained in [screenshots](../screenshots/), including [refined desktop map](../screenshots/refined-map-desktop.png) and [mobile review](../screenshots/refined-review-mobile.png). Core capture/map/focus screenshots cover desktop and 360px mobile widths; browser tests exercise actual preset review/graph behavior independently of model output. Mobile tests emulate Chromium phone dimensions, not physical iOS/Safari.

## Historical results

All rows below were recorded on **18 October 2026**, at different development stages. They are preserved from the five superseded reports rather than presented as current totals. ASR and Groq live checks were run separately from ordinary suites.

| Stage / original report                                   | Unit/integration         | Desktop/mobile browser             | Additional recorded results                                                                                                                                                                                             |
| --------------------------------------------------------- | ------------------------ | ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Local baseline — `VERIFICATION.md`                        | 36 passed, two files     | 16 passed; two opt-in ASR skips    | One real local-ASR smoke passed; strict typecheck, lint (no errors/warnings), build, axe/reduced-motion and 360px overflow checks passed; `npm audit --audit-level=moderate` reported zero vulnerabilities at that time |
| Initial Magic — `MAGIC_VERIFICATION.md`                   | 53 passed; one live skip | 22 passed; two ASR skips           | One live Groq request passed; typecheck, lint, build, formatting, core-screen axe and client-secret scan passed                                                                                                         |
| Intelligence/UX refinement — `REFINEMENT_VERIFICATION.md` | 72 passed; one live skip | 29 passed; three intentional skips | Typecheck, lint, build, format, client-secret scan and axe passed; three scenario probes passed as described below                                                                                                      |
| Vercel API repair — `VERCEL_API_VERIFICATION.md`          | 83 passed; one live skip | 35 passed; three intentional skips | NodeNext, lint, build, format and client-secret scan passed; actual Vercel builder/native import and hosted route checks passed; inference hit the budget gate                                                          |

The three browser skips in later runs were two opt-in ASR cases plus the mobile canvas case; mobile uses the equivalent list. Historical dependency audit results are not a current vulnerability assessment.

Baseline build measurements were approximately 365 kB initial application JavaScript uncompressed / 113 kB gzip, a lazy React Flow chunk, a ~553 kB speech worker and ~27 MB WASM runtime. These are baseline measurements, not current bundle budgets. Text capture does not require the lazy voice/graph path; model weights are requested only on explicit Whisper transcription. Rollup emitted two non-fatal third-party Zod purity-annotation warnings and removed the annotations; the build succeeded.

The early Magic implementation had a **1,800-token** completion ceiling. A smaller subsequent ceiling also truncated/rejected the long science output. The later **3,600-token** cap with low reasoning effort supersedes those values. Input bounds, 20-second provider timeout, global 65-second spacing and 20/day reservation cap remained. No provider retries or paid-tier fallback were introduced.

## Live Groq evidence

The initial integration used server-side `.env.local` variables and `openai/gpt-oss-20b` for one real request, with no automatic retry. It recognized the Nobel aspiration and explicit buy-tuna → feed dependency, without claiming tuna was a prerequisite for research funding. This was evidence for that one structured response, not general semantic accuracy.

Later synthetic probes covered:

- **Cat Nobel Prize:** four tasks, one buy-tuna → feed-cat prerequisite, separate Nobel goal, independent research/professor email, no invented durations.
- **Unrelated tasks:** four independent actionable chores, no dependencies or goals.
- **Science Fair:** twelve tasks, separate reminder action and diagram-receipt event, multiple project branches with independent math/personal work, the explicit 45-minute calculus estimate and no other invented durations. The reminder does not resolve diagram receipt.

The combined three-case run passed Cat and Unrelated but exposed the science duration omission. After source-clause recovery and regression coverage were added, the final **targeted science probe passed separately at 15:44 local on 18 October**. There was no final combined all-green live run. Earlier probes also exposed the truncated long output that led to the higher completion cap. Ordinary tests remain network-free with respect to inference; they use synthetic fixtures/mocks and never saved brain dumps.

Settings → Explore reasoning examples contains labeled preset Science Fair, Cat Nobel Prize and Unrelated Tasks. Presets run real graph/review algorithms without an AI call. Science Fair was reconstructed from prompt details because no existing science dump was present; it is not represented as a user's saved project.

Security evidence from the integration/refinement/repair stages: `.env.local` was not modified, displayed or committed; Git ignore patterns protect environment files (not only directories); client scans found no configured credential values, server credential names or Groq endpoint in `dist/`. Mocked Vercel wiring verified credentials reach only the provider Authorization header, not client responses. Provider error payloads were suppressed. Existing configured models and server-only key handling were retained. No paid service, database account, authentication service or Redis infrastructure was provisioned; production nevertheless depends on externally configured Redis. See [the safeguards](MAGIC_UNTANGLE.md#security-budget-and-failures).

## Local speech evidence

On 18 October, the production worker completed real synthetic speech inference on **macOS 27.0.1 ARM64, Playwright Chromium 156.0.8078.4, Transformers.js 4.3.1, `onnx-community/whisper-tiny.en`, q8 CPU/WASM**.

The locally generated English [WAV](../e2e/fixtures/local-speech.wav) is synthetic speech, not a recording of a person. The browser decoded it, resampled to mono 16 kHz, downloaded model resources and ran the actual production worker. Output:

> I need to choose a topic. I have to email my teacher tomorrow.

Assertions checked “topic” and “teacher”; no POST, PUT or PATCH requests were observed. Startup/loading and inference took approximately 20 seconds on that run, not a generalized performance promise. A headless fake-microphone attempt stalled at permission. The successful test bypassed MediaRecorder and fed decoded audio directly to the worker, so physical microphone permissions/capture and native recognition are **not** established. Mocked recording/worker unit tests do not establish transcription quality. Native availability is checked by explicit user action, avoiding automatic speech-service activation on opening the panel.

## Manual voice checks

These checklists are reproduction procedures, not claims that every step has passed.

### Whisper CPU path

1. Run `npm run dev` on a desktop browser, visit localhost, open DevTools Network. Use a current Chromium browser with microphone, MediaRecorder, WebAssembly, Web Audio, module workers and adequate memory. Keep any extensions that modify microphone/network requests disabled during testing.
2. Click **Speak instead**. Read first-run download/privacy information; select local Whisper.
3. Click **Start recording**, allow the microphone. Speak: “I need to choose a topic. I have to email my teacher tomorrow.” Confirm timer increases and UI indicates recording.
4. Stop. Confirm the browser microphone indicator switches off immediately. Observe honest download file progress and then local transcription. Audio/transcript must never appear in network requests. Requests should be GETs for application assets, model/config/tokenizer weights and ONNX runtime binaries.
5. Confirm actual recognized words appear. Edit the transcript, delete a word, and choose **Use these thoughts**. Confirm text joins the editor and remains editable. Untangle into candidate tasks.
6. Record again; cancel while processing. Verify worker termination, microphone release and that no late transcript appears. Retry successfully.
7. Deny microphone access; confirm an explanatory failure and no false success. Disconnect the microphone and retry. Test a silent recording, device interruption, and blocked model downloads.
8. Test reload/model caching. Disconnect network only after resources are loaded; record again. If it fails, report the exact missing cached asset. Offline shell startup is not implemented and should not be claimed.
9. Use a long recording, max two minutes, and check UI responsiveness and memory. Processing has a four-minute timeout; shorter recordings are recommended on slower devices.

### Native on-device English

1. Use a browser exposing `SpeechRecognition.processLocally` and static `available`/`install` methods. If unsupported, confirm the engine is absent and the app never invokes remote speech.
2. If the English pack is downloadable, use the install button; deny/interrupt installation and test recovery.
3. After local availability is confirmed, choose **Browser on-device English** and record with network disabled after app startup. Confirm actual interim/final words; Stop; edit and confirm.
4. Monitor network to confirm no audio transmission. Test permission denial, silence, cancellation and recognition errors. The app must never fall back to remote recognition.

Record browser version, OS, hardware, chosen engine, network/cache state, model download size, duration, success/failure and transcript accuracy. Only then list that exact configuration as manually supported.

## Vercel API evidence

On 18 October, `https://thread-zero-sigma.vercel.app/api/untangle` returned HTTP 500, `text/plain`, and `x-vercel-error: FUNCTION_INVOCATION_FAILED` for GET and an empty invalid POST. This established an invocation failure rather than a missing endpoint. No valid brain dump or Groq call was involved in those probes. The frontend's content-type-first check incorrectly turned non-JSON errors into “Magic needs its API server.”

The original function used extensionless relative imports with `"type": "module"`. The actual **`@vercel/node` 24.0.3** production builder emitted a `nodejs24.x` artifact that failed native import with **`ERR_MODULE_NOT_FOUND`** for `server/untangle`. The repaired artifact loaded as a function. The hosted stack trace was unavailable; the source-level reproduction and observed hosted symptom are separate evidence.

The repair added explicit `.js` runtime imports and the NodeNext check in [`tsconfig.api.json`](../tsconfig.api.json). The existing Node adapter, shared Groq service, prompt, model selection, schema, normalization, token/input budgets, timeouts and production limiter were preserved. Client errors became status-specific; Groq authentication/permission failures map to sanitized 401 instead of generic 502. Temporary builder tooling/artifacts stayed outside the repository. Vercel CLI was not installed, so `vercel dev` was not run; actual builder/native HTTP tests were used instead.

Vercel successfully deployed [repair commit `b12ac57`](https://github.com/mridul12-cat/ThreadZero/commit/b12ac5741193cfb3353e4f03e4fe5ceac3ccd88f). The hosted route then returned JSON **405** for GET and JSON **400** for an invalid POST, without the invocation-failure header. The function startup fix was therefore verified in the actual deployment.

One valid synthetic “Buy tuna before feeding the cat” request returned JSON **503** from the shared-budget gate, before Groq inference. Without environment/Redis access, the report could not distinguish missing variables, invalid credentials and service failure. The owner subsequently stated that no Upstash database was configured. No code change removing that gate was made. Successful hosted inference and actual Redis/Lua execution remain unverified by these records; deployment settings may have changed since. The cleanup makes no new hosted/provider call.

The existing [`vercel.json`](../vercel.json) uses Vite, `npm run build`, `dist` and a 30-second native function duration. Root `api/untangle.ts` is tracked separately from static output. There is no SPA catch-all rewrite, `.vercelignore`, Express dependency or persistent backend process. The function reads server `process.env`; `.env.local` is not a substitute for production variables. Production still fails closed without working shared-budget configuration, rather than silently using per-instance counters. Deployment setup lives in [Magic Untangle](MAGIC_UNTANGLE.md#vercel-deployment).

References: [Vercel Node functions](https://vercel.com/docs/functions/runtimes/node-js) and [Vite on Vercel](https://vercel.com/docs/frameworks/frontend/vite) document the API convention and separate frontend/function deployment. The import-failure claim above comes from execution, not an inferred documentation guarantee.

## Manual deployment checks

1. Deploy the repository root with the four server variables documented in [Magic Untangle](MAGIC_UNTANGLE.md#vercel-deployment). Use dedicated free-plan resources without automatic paid upgrades. Preserve worker/WASM MIME support and allow the model asset hosts; a strict CSP must permit workers, model resources and WebAssembly compilation. Microphones require HTTPS or localhost. Static `dist/` hosting supports the local experience only.
2. GET `/api/untangle`: expect JSON **405** with `Allow: POST`. POST empty JSON: expect **400** when the Groq key/model configuration is present, or **503** when configuration is missing. Neither probe reaches inference or uses Groq quota.
3. Submit one harmless cat example through consent: “I want my cat to win a Nobel Prize. I need to buy tuna before feeding her. I also need to research cat intelligence and email a university professor.” This consumes real quota if the budget gate permits it. Never paste secrets into a brain dump.
4. Inspect Network: text goes to the same-origin API. The browser has no Groq key/provider request and sends no audio, saved task list or hidden workspace context. Model/runtime download GETs must contain no audio/transcript.
5. Confirm editable tasks, a separate Nobel goal, buy-tuna → feed-cat, and independent research/email unless actual necessity is established. Review evidence, confirm a connection and inspect solid versus dotted map edges and readiness.
6. Request again inside 65 seconds: expect **429** without another Groq call. In a test deployment, temporarily remove the Redis token: expect **503** before provider usage. Revert test environment changes afterward. These are manual checks, not claims of verified live Redis behavior.
7. Run the physical voice checklist on the final origin before relying on microphone input in a public demonstration. Record exact browser/device outcomes.

## Known limitations

- LLM output can misclassify, omit or truncate work. Evidence/action-title checks and exact-source recovery are conservative heuristics, not semantic proof. Whole malformed schema/graph proposals are rejected atomically. Inferred dependencies need a person to confirm them; broad model accuracy and alternate-model live behavior remain unverified.
- The classic local parser is a limited English pattern parser, not an LLM. Local parsing/voice do not require a backend/key; optional Magic requires its server and production budget configuration.
- Physical microphone → MediaRecorder → transcript, browser-native language-pack installation/recognition, cache reuse, Safari/Firefox ASR and physical touch/iOS configurations remain unverified. Target desktop Chromium needs microphone, MediaRecorder, WebAssembly, Web Audio, module workers and enough memory; native recognition additionally needs the experimental local APIs and installed English pack. No fallback to remote speech is used.
- Voice is English-only and capped at two minutes; processing is bounded by four minutes. There is no WebGPU path. Model/runtime downloads use Hugging Face/ONNX asset hosts (roughly 75–150 MB model resources plus ~27 MB bundled WASM); actual byte/file progress comes from the loader, not simulated percentages. Audio/transcript is not uploaded. Tracks stop at recording end/cancel, chunks are discarded, workers terminate after result/error/cancel and recordings are not persisted.
- Full offline startup/cache completeness is not implemented or promised: no service worker, optional model caches can be evicted. Models are not bundled into capture UI; to remove model caches as well as workspace data, clear origin storage/browser caches.
- IndexedDB is scoped to this browser origin; changing origins/ports, private browsing, clearing data or eviction can remove tasks. JSON export is the portable backup. Preferences use localStorage; storage failures show notices and leave the session usable. There is no account/cloud sync or telemetry.
- Formal WCAG certification, physical screen-reader testing and 100-task browser/hardware performance benchmarking remain unverified. Automated axe/geometry checks do not replace these. Higher contrast is a preference, not certification; narrow phones use the equivalent task list.
- Long graphs require pan/zoom, a selected path or list view; explicit “Fit entire map” may shrink labels. Custom drag positions are session-only. Undo is one snapshot rather than a full version history. Browser confirm/prompt dialogs handle destructive replacement, manual task addition and scenario application. There are no background notifications or multiple projects beyond the active workspace.
- Simulation is non-destructive until applied, not a scheduling model. Delay warnings flag downstream deadlines within seven days and do not predict schedules from estimated durations. Potential downstream impact does not mean a completion immediately unlocks every descendant.
- Last recorded hosted inference was blocked by the shared-budget gate, although deployment and route startup were verified. Real Redis/Lua execution, Vercel CLI emulation, firewall/account limits, billing-plan state and protection against arbitrary hosting/Redis invocation floods remain unverified. No new infrastructure/account was provisioned. Application limits do not guarantee unlimited free service; shared organization activity can exhaust provider quota sooner.

## Documentation cleanup verification

The cleanup on **19 October 2026** consolidates the former root `VERIFICATION.md`, `MAGIC_VERIFICATION.md`, `REFINEMENT_VERIFICATION.md`, `VERCEL_API_VERIFICATION.md` and `VOICE_TESTING.md`. Architecture and Magic setup moved under `docs/`; feature/setup details have one authoritative home. The newer README commit `15ce22c` and its removal of the demo script are preserved. Historical results, unique technical findings, reproduction commands, security evidence and known limitations are retained above.

Fresh checks after consolidation:

| Check                                       | Cleanup result — 19 October 2026                                                                                        |
| ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Unit/integration (`npm test`)               | **83 passed**, one optional live-Groq test skipped                                                                      |
| Desktop/mobile browser (`npm run test:e2e`) | **35 passed**, three intentional skips (two opt-in ASR cases and mobile canvas)                                         |
| TypeScript, including NodeNext              | Passed                                                                                                                  |
| ESLint                                      | Passed                                                                                                                  |
| Production build                            | Passed; existing third-party Zod annotation warnings remain non-fatal                                                   |
| Browser-output secret scan                  | Passed; configured secrets, server credential names and provider endpoint absent                                        |
| Code and Markdown formatting                | Passed                                                                                                                  |
| Documentation links                         | 50 local file/directory/heading links passed; five public HTTP links returned 200; localhost exercised by browser tests |
| Preservation review                         | Non-Markdown tracked files and `.env.local` match their pre-cleanup content; generated screenshot differences restored  |

No live Groq, ASR-download or hosted-deployment recheck was part of this documentation-only cleanup. These results do not establish current dependency-audit, billing, Redis or physical-microphone status. No commit or push was made.
