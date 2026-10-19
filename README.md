# ThreadZero

**Every tangled thought has a first thread.**

A local-first productivity prototype built with React, TypeScript, Vite, React Flow, IndexedDB, and browser-local speech transcription. The classic local experience needs no backend, accounts, API keys, paid services, or analytics.

**Current refinement:** reminders and external receipts are separate, unknown time stays unknown, Review has bulk explicit confirmation, and the map has clustered layouts and readable navigation. Explore Science Fair, Cat Nobel Prize and Unrelated Tasks in Settings → Explore reasoning examples. These are labeled preset examples.

**Optional Magic Untangle is now available:** it sends explicitly submitted text to Groq through a server-side API after a privacy confirmation. Saved tasks stay local. The original deterministic parser remains available. See [MAGIC_UNTANGLE.md](MAGIC_UNTANGLE.md) for setup, the Vercel environment variables, distributed abuse controls and verification. Cloud inference uses a Groq free-plan key; browser-local voice is unchanged.

## Problem and solution

A brain dump can mix tasks, hopes, reminders, external events and prerequisites, making it hard to choose where to start. ThreadZero turns that text into editable tasks and suggested connections. You confirm the dependencies; deterministic graph rules then identify what is ready and explain a practical first action. External events remain unresolved until you confirm receipt, and unknown durations stay unknown.

## Tech stack

React 19, TypeScript, Vite, React Flow, Dagre, IndexedDB via `idb`, Zod, Lucide icons and custom CSS. Optional voice transcription uses Transformers.js and local Whisper in a browser worker. Optional Groq inference runs through a server-side Node API, with a Vercel Function for deployment and an existing Upstash Redis budget gate for production. Vitest, Testing Library, Playwright and axe cover validation and UI flows.

## Run locally

Requires Node.js 22.12+ (tested with Node 25.5) and npm.

```sh
npm ci
npm run dev
```

Open http://127.0.0.1:5173. Use localhost or HTTPS for microphone access.

```sh
npm test
npm run lint
npm run typecheck
npm run test:e2e
npm run build
npm run preview
```

Playwright needs a Chromium installation (`npx playwright install chromium`). The app can be used before downloading a speech model.

## Environment setup

The local parser, task graph, Focus mode and What If? simulations work without credentials. To enable optional Groq Magic Untangle, create a local environment file **only if one does not already exist**:

```sh
cp -n .env.example .env.local
```

Edit `.env.local` privately and replace the placeholder:

```ini
GROQ_API_KEY=your_groq_api_key_here
GROQ_MODEL=openai/gpt-oss-20b
```

Restart `npm run dev` after changing these variables. They are read only by server-side code. Never prefix credentials with `VITE_`, paste them into the UI, or commit `.env.local`. Git ignores local environment files; `.env.example` contains placeholders only. `npm run preview` serves the static build and does not run the Groq API.

## What it does

- Autosaved multiline capture with Cmd/Ctrl+Enter extraction.
- Editable task review, notes, manual additions, deletion and merging.
- Optional Groq Magic Untangle with explicit privacy consent and source-backed, editable task suggestions.
- Confirm/reject suggested dependencies; manual prerequisites and drag connections.
- Directed acyclic graph validation, deduplicated reachability, automatic layered layout, pan/zoom and accessible list editing.
- Transparent deterministic next-action ranking; focus, start, skip, complete and undo.
- **What If? simulations:** non-destructive completion/delay scenarios, with explicitly confirmed application.
- IndexedDB persistence, validated JSON import/export, deletion, recent activity.
- Interactive ten-task **The Presentation Panic** example, protected by replacement confirmation and undo.
- Original SVG Pip, local system fonts, responsive mobile task lists, reduced motion and contrast preferences.

## Parsing is not AI

Task extraction uses explicit action phrases, sentence/newline splitting, a small verb vocabulary, a few dependency patterns, and relative English dates. It does not understand arbitrary meaning. Ambiguous fragments become notes. Candidate connections never affect readiness until confirmed. Dates recognize today, tomorrow, and `by/due/on <weekday>`; specific dates can be edited manually. Estimated time defaults to unknown (`estimatedMinutes: null`); only explicit source durations or user-confirmed estimates are stored. Priority defaults to normal. Deadlines and scheduled starts are separate.

Speech transcription is a separate optional machine-learning feature, executing on the device. It supplies editable text to exactly the same deterministic task parser. The classic local flow sends neither typed thoughts nor audio to an application server. Magic Untangle is a separate opt-in cloud action for the text you explicitly submit.

## Voice implementation and compatibility

English only, maximum two minutes per recording.

1. **Native on-device speech:** feature-detects `processLocally` and `SpeechRecognition.available({langs:['en-US'], processLocally:true})`. Recognition starts only after availability is confirmed; `processLocally` is explicitly true. Downloadable packs have an explicit installation action. Default remote Web Speech recognition is never used.
2. **Local Whisper fallback:** actual microphone capture through MediaRecorder, browser decoding, mono resampling to 16 kHz through OfflineAudioContext, then an isolated Web Worker running Transformers.js 4.3 and `onnx-community/whisper-tiny.en` with q8 WASM/CPU inference. The model uses the Apache-2.0 license. GPU acceleration is not implemented in this version, favoring a single CPU-compatible path.

The initial model/runtime download uses Hugging Face and ONNX Runtime asset hosts. Budget roughly 75–150 MB for model resources plus the approximately 27 MB bundled WASM runtime; exact files and byte progress come from the loader, not simulated percentages. Download requests contain no audio or transcript. Browser model caching is enabled but can be evicted. Full offline operation is **not verified or promised**, and the application shell has no service worker. Do not rely on offline startup.

**Target configurations:** current desktop Chromium on localhost/HTTPS, with MediaRecorder, WebAssembly, AudioContext, module workers, and enough memory for Whisper. Native recognition additionally requires the experimental on-device APIs and installed English pack. Other browsers may run the CPU path if they provide those APIs.

**Verified local inference:** the production worker transcribed an actual synthetic WAV speech fixture in Chromium 156 on macOS using q8 CPU/WASM. The returned text matched “I need to choose a topic. I have to email my teacher tomorrow.” The test observed no POST, PUT or PATCH requests. This exercised real decoding, resampling, model download and inference, not a mocked transcript.

**Verification limit:** physical microphone-to-transcript capture, model cache reuse, and native language-pack installation are not manually verified. A headless fake-microphone attempt did not resolve its permission request; the successful real-ASR test fed the audio fixture directly to the production worker. See [VOICE_TESTING.md](VOICE_TESTING.md).

Microphone tracks are stopped at recording end/cancel, recordings are not persisted, temporary chunks are discarded, workers are terminated after a result/error/cancel, and in-flight inference is bounded by a four-minute timeout. Cancel and retry are available. Text remains fully functional if voice fails.

## Privacy and data durability

Data is saved only in this browser origin's IndexedDB. Clearing site data, browser eviction, changing origins/ports, or private browsing can remove it. JSON export is the portable backup. Storage failures produce visible notices and leave the current session usable. Imports are size-limited, schema-validated and graph-validated before replacing anything. No telemetry is configured. Optional Magic Untangle sends only explicitly submitted text to Groq through the server API after consent; local parsing and voice inference remain local. Preferences are in localStorage. Raw recordings are never saved.

Model caches are managed by the browser/Transformers.js separately from workspace deletion. To remove downloaded models as well, clear this origin's storage and browser caches.

## Deploy

```sh
npm ci
npm run build
```

For the classic experience, deploy the contents of `dist/` to any static HTTPS host. For Magic Untangle, deploy the repository to Vercel with `api/untangle.ts` and the server environment variables documented in [MAGIC_UNTANGLE.md](MAGIC_UNTANGLE.md). Static-only hosting does not run the Magic API; the local parser remains fully available. Serve JavaScript module workers and `.wasm` files with appropriate MIME types; allow the browser to fetch model and ONNX runtime assets. Do not add analytics or server-side transcription. A strict CSP must allow the model asset hosts, worker scripts, and WebAssembly compilation; the production WASM runtime is bundled in dist/assets. Test the actual host using the voice checklist; microphone access requires HTTPS. Build artifacts can be previewed with `npm run preview`.

### Vercel

1. Import this GitHub repository into Vercel and select the Vite framework. The included `vercel.json` specifies `npm run build`, `dist`, and the Node API function.
2. In Project Settings → Environment Variables, add server-only `GROQ_API_KEY` and `GROQ_MODEL`. For the deployed Magic API, also set `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` for a dedicated free-plan database. Never upload `.env.local`.
3. Deploy or redeploy after setting variables. Without the production budget-gate variables, Magic returns a safe 503 without calling Groq; the local experience still works.
4. Follow the deployed smoke checklist in [MAGIC_UNTANGLE.md](MAGIC_UNTANGLE.md), including consent, quota handling, and confirmed versus suggested dependencies. Actual hosted Vercel and Redis execution have not been verified.

## Known limitations

- Groq may misinterpret, omit or reject tasks. Suggestions need review; malformed output does not replace saved work. The local fallback is a limited English pattern parser.
- Magic accepts at most 1,500 characters / 3,000 UTF-8 bytes and enforces a shared 65-second cooldown and 20 requests/day. Account quotas can be lower. No automatic paid upgrade or provider retry is implemented.
- Voice is English-only and limited to two-minute recordings. Physical microphone capture, native language-pack installation and reliable offline startup remain unverified; see the voice details above.
- Data stays in the current browser origin and can be lost if site storage is cleared or evicted. Export JSON for backups; there is no account sync.
- Large maps require navigation or list view. Dragged map positions last only for the current map session. Mobile uses accessible task lists.
- Free-plan hosting and provider billing settings are deployment responsibilities. This repository does not promise unlimited free cloud usage.

