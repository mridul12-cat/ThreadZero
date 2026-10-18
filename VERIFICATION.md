# Baseline verification — 18 October 2026

This records the original local-only build. The later optional Groq extension changes cloud/API requirements only for Magic Untangle. See [MAGIC_VERIFICATION.md](MAGIC_VERIFICATION.md) and [MAGIC_UNTANGLE.md](MAGIC_UNTANGLE.md) for the current integration and results.

## Delivered

The working application is in this directory. It is a static React/TypeScript app with no required server, authentication, paid APIs or API keys. Capture, editable review, confirmed dependency editing, interactive graph/list, deterministic recommendation, focus, non-destructive scenarios, persistence, JSON backup, example project, and original SVG Pip are implemented.

Voice has real microphone capture and local-only native/Whisper paths. Actual production-worker inference was verified with a synthetic audio fixture. Physical microphone end-to-end compatibility remains unverified, as described below.

## Results actually observed

| Check | Result |
| --- | --- |
| `npm run typecheck` | Passed, strict TypeScript |
| `npm run lint` | Passed, no errors or warnings |
| `npm test` | **36 passed**, 2 files |
| Production desktop/mobile Playwright suite | **16 passed**, 2 opt-in ASR cases skipped |
| Opt-in real local ASR production-worker smoke test | **1 passed**, real synthetic speech inference |
| Axe accessibility checks | Passed for capture, review, map, focus, voice controls, and settings on desktop/mobile, with reduced motion |
| 360px layout | Screenshot and no-horizontal-overflow checks passed for map/focus; capture screenshot reviewed |
| `npm run build` | Passed |
| `npm audit --audit-level=moderate` | **0 vulnerabilities** reported |

The standard Playwright command skips the network/model-download smoke test intentionally. That test was explicitly enabled separately against the production bundle. Mobile runs emulate Chromium at phone dimensions; they are not physical iOS/Safari verification.

The build emits two harmless warnings about third-party Zod purity annotations, which Rollup removes. It successfully produces the application, lazy graph/voice chunks, speech worker, and local WASM runtime. The initial application JavaScript is about 365 kB uncompressed / 113 kB gzip. React Flow is a separate lazy chunk; the ~553 kB speech worker and ~27 MB WASM binary are not required to use text capture. Model weights are downloaded only on explicit Whisper transcription.

## Automated coverage

- Directed edge convention; self/missing/duplicate edge rejection; cycles; transitive diamond de-duplication; multi-prerequisite gating; blockers; completion unlocks; external waits; empty/disconnected graphs; deterministic layout and ties; effort/deadline ranking.
- Obligation/action parsing, newline/conjunction handling, before/after/until suggestions, ambiguous notes, duplicate handling, source preservation, dates, bad input and informal waiting language.
- Completion/delay simulations derive new objects and do not mutate the real workspace; exact immediate unlocks and coarse deadline risk.
- Runtime import validation rejects invalid versions, malformed schemas, duplicate IDs, cycles and missing endpoints.
- Native local-only capability gates; unavailable English pack; permission/no-device messages; actual resource cleanup; mocked recording/worker error recovery; empty results never become success; editable transcript confirmation; late microphone permission results released after cancellation.
- Text → review → dependency editing → map → focus; completion/recommendation recalculation; reload persistence; example loading; non-destructive preview/exit; confirmed scenario application; undo; export and JSON re-import; malformed import retains existing draft; voice permission error and text recovery; keyboard shortcut; phone layout.
- Screenshots in `screenshots/` cover capture/map/focus at desktop and 360px mobile widths.

## Real local ASR evidence

Environment: macOS 27.0.1, ARM64, Playwright Chromium 156.0.8078.4, production bundle, Transformers.js 4.3.1, `onnx-community/whisper-tiny.en`, q8 CPU/WASM.

The synthetic WAV fixture was generated locally and is included at `e2e/fixtures/local-speech.wav`. The real browser decoded it, resampled it to mono 16 kHz, downloaded the model and ran the production worker. Actual transcript:

> I need to choose a topic. I have to email my teacher tomorrow.

The test asserted “topic” and “teacher” in the result and observed no POST, PUT or PATCH requests. This demonstrates real local inference, not canned transcription. Initial run including browser startup/loading took approximately 20 seconds; no generalized timing promise is made.

A headless fake-microphone attempt remained at permission; the successful test bypassed MediaRecorder and fed the decoded fixture directly to the worker. It therefore does **not** verify physical microphone permissions/capture or native recognition. The browser-native availability check is an explicit user action, avoiding automatic speech-service activation on opening the panel.

Reproduction commands and the physical-device checklist are in [VOICE_TESTING.md](VOICE_TESTING.md).

## Remaining incomplete or unverified

- Physical microphone → MediaRecorder → transcript on a real supported browser/device. No physically tested voice configuration is claimed.
- Browser-native on-device language-pack installation and actual recognition. Capability gates are unit tested only.
- WebGPU acceleration is not implemented; Whisper uses CPU/WASM.
- Full offline startup/cache completeness is not implemented or promised. No service worker; model caches can be evicted.
- Screen-reader testing, physical touch devices, Safari/Firefox ASR, formal WCAG certification, and 100-task browser performance benchmarking remain unverified. Automated axe checks do not substitute for these.
- Layout is a deterministic layered layout rather than a crossing-minimizing layout. Long chains require zoom/pan; the text list provides filtering and full editing. Dragged coordinates are not persisted.
- Ranking refreshes on state changes/reload, without a midnight timer. Delay warnings show downstream deadlines within seven days; they are not duration-based scheduling predictions.
- Browser confirm/prompt dialogs are used for destructive replacement, task addition and scenario application. Undo is a single snapshot, not an arbitrary historical undo stack.
- No hosted deployment was performed. Deployment-ready static output is in `dist/`.

## Run, production and demo

```sh
npm ci
npm run dev
```

Open http://127.0.0.1:5173. Production:

```sh
npm run build
npm run preview
```

Deploy `dist/` to a static HTTPS host with JavaScript module workers/WASM MIME support. No environment variables or backend are required. Test microphone permissions and model fetches on the final origin before using voice in a public demo.

90-second sequence: capture text or verified voice (0–25s), edit/confirm tasks and connections (25–40s), explore the example map (40–55s), complete a prerequisite and show recalculation (55–70s), preview and exit What If (70–85s), end in Focus (85–90s). The full script and deployment guidance are in [README.md](README.md).
