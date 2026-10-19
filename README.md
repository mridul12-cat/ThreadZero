# ThreadZero

**Every tangled thought has a first thread.**

ThreadZero turns a tangled brain dump into editable tasks, a dependency map and a clear next action. Confirm suggested connections, explore what becomes possible, and focus on one ready task at a time.

The core experience is local-first: no account or API key is needed. Optional **Magic Untangle** sends explicitly submitted text to Groq through a server-side API after consent.

## Features

- **Brain dumping:** capture thoughts as text or optional English voice input, then review extracted tasks.
- **Magic Untangle:** AI-assisted tasks, goals and explained dependency suggestions, with a deterministic local parser available as fallback.
- **Thread map:** clustered, directed task graphs with confirmed prerequisites, path highlighting and an accessible mobile/list view.
- **Honest readiness:** reminders remain actions; external events need separate receipt confirmation. Unknown durations stay unknown.
- **Focus mode:** deterministic next-action ranking using deadlines, priorities, downstream work and optional time estimates.
- **What If? simulations:** preview completion or delay without changing saved work; apply explicitly and undo.
- **Local persistence:** IndexedDB autosave, editable tasks/goals, JSON backup/import and labeled examples, with Pip the cat.

## Run locally

Requires Node.js 22.12+ and npm; previously tested with Node 25.5.

```sh
npm ci
npm run dev
```

Open [localhost](http://127.0.0.1:5173). Use localhost or HTTPS for microphone access.

For optional Groq processing, create `.env.local` only if it does not already exist:

```sh
cp -n .env.example .env.local
```

Privately replace the placeholder `GROQ_API_KEY`; `GROQ_MODEL` defaults to `openai/gpt-oss-20b`. Restart the dev server after changes. Never commit credentials or prefix them with `VITE_`.

```sh
npm test
npm run typecheck
npm run lint
npm run build
npm run preview
```

`preview` serves the static build without the Magic API. Browser tests use `npm run test:e2e` and require Chromium (`npx playwright install chromium`). See [testing](docs/TESTING.md) for coverage, dated evidence and opt-in smoke tests.

## Stack

React 19, TypeScript, Vite, React Flow, Dagre, IndexedDB (`idb`), Zod, Lucide and custom CSS. Voice uses browser-local recognition or Transformers.js/Whisper CPU/WASM. Magic uses a Node API and Groq; its deployed shared-budget gate requires Upstash Redis. Tests use Vitest, Testing Library, Playwright and axe.

## Privacy and limitations

- Tasks stay in this browser origin; there is no account sync. Clearing or evicting storage can erase them, so export JSON backups. No telemetry is configured.
- Magic sends the submitted text plus local reference date/timezone to Groq after consent. It does not submit audio or the saved task list. AI suggestions need review; the local English parser has limited pattern-based understanding.
- Voice is English-only, up to two minutes. Model downloads require network access and may total roughly 75–150 MB plus the bundled approximately 27 MB WASM runtime. Physical microphone end-to-end behavior and native language-pack installation remain unverified. Full offline startup is not promised.
- Large maps require navigation or list view; dragged positions last for the current map session. Automated accessibility checks do not establish formal WCAG certification or physical-device support.

## Deployment

Build with `npm run build`; static hosts can serve `dist/` for the local experience. For Magic, import the repository root into Vercel using the included Vite configuration. Set server-only `GROQ_API_KEY`, optional `GROQ_MODEL`, and the existing `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` budget-gate variables, then deploy. Never upload `.env.local`.

The API fails closed with JSON 503 when its shared budget is unavailable. It reserves one request per 65 seconds, up to 20/day; provider quotas may be lower. Hosting/provider billing plans remain a deployment responsibility. The last recorded hosted route checks passed, while inference was blocked by the budget gate; this cleanup does not reverify deployment settings.

## Documentation

- [Architecture](docs/ARCHITECTURE.md): data model, graph rules, ranking and application limits.
- [Magic Untangle](docs/MAGIC_UNTANGLE.md): environment setup, consent, API safeguards and Vercel deployment.
- [Testing](docs/TESTING.md): commands, historical results, live-test evidence, manual checks and known limitations.
