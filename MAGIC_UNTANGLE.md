# Magic Untangle — Groq integration

Magic Untangle is optional. The original local parser, voice transcription, graph algorithms, ranking, mascot and navigation remain available. Clicking the local **Untangle my thoughts** button never calls Groq.

## Local setup

The existing `.env.local` is read by Vite's **server configuration only**. It was not modified. Start or restart the dev server after changing server environment variables:

```sh
npm ci
npm run dev
```

Required server variables:

```dotenv
GROQ_API_KEY=<your Groq free-plan API key>
GROQ_MODEL=openai/gpt-oss-20b
```

`GROQ_MODEL` defaults to `openai/gpt-oss-20b`. The allowlist also permits `openai/gpt-oss-120b`, which supports the same strict output mode and documented base free-plan token limits. Other models fail closed until their strict-output support and budgets are reviewed. There are no `VITE_` credentials, public key fields or browser provider calls.

The Vite dev middleware serves `/api/untangle` locally. `npm run preview` is a **static** preview and does not run the API; the local parser still works there. Use `npm run dev` or `vercel dev` for the full application. Native Vercel local emulation is not verified; the built-in Vite API path is verified.

## How to use

1. Enter up to 1,500 characters / 3,000 UTF-8 bytes, then click **Magic Untangle**.
2. Read the notice: “Magic Untangle sends your text to Groq for AI processing. Your saved tasks remain on this device.”
3. Explicitly choose **Send this text to Groq**, or **Stay local** to use the deterministic parser.
4. Review editable task candidates, larger goals and questions. Waiting conditions are excluded from actionable recommendations.
5. Every suggested connection, including an explicit one, needs confirmation. Its explanation and explicit/inferred label appear in Review. Unconfirmed connections appear dotted on the map and are excluded from readiness/ranking. Accepted connections are solid and use the existing graph engine.
6. Edit titles/effort/deadlines and manually modify dependencies with existing controls. Reject a suggestion if it does not fit.

Results append to the latest workspace, never replace it. Existing titles, notes, completion and effort are preserved. Retry de-duplicates by original model task ID plus source, or normalized title. Rejected connections are remembered by mapped endpoints. Models can use different IDs or wording on later runs, so a genuinely different proposal can still create a duplicate for manual review. Undo restores the pre-append workspace. Draft edits made during an in-flight request are preserved. No existing task list, microphone audio, or hidden workspace context is transmitted.

## Vercel deployment and exact environment variables

`api/untangle.ts` is a native Node Vercel Function; `vercel.json` declares the Vite build and `dist` output. The function reads `process.env` at runtime. Do not upload `.env.local` or copy its values into browser configuration.

In Vercel → Project Settings → Environment Variables, set:

| Variable | Required | Purpose |
| --- | --- | --- |
| `GROQ_API_KEY` | Yes | Groq free-plan key, server-only |
| `GROQ_MODEL` | Optional | `openai/gpt-oss-20b` by default |
| `UPSTASH_REDIS_REST_URL` | For the deployed API | HTTPS REST URL of a dedicated free-plan Upstash Redis database |
| `UPSTASH_REDIS_REST_TOKEN` | For the deployed API | Server-only token for that database |

Set these for each intended Vercel environment (Production, Preview and Development as needed), then redeploy. Create the Redis database on its **free plan**, with no paid auto-upgrade. No Redis infrastructure or account was created by this implementation.

**Safe default:** the deployed function always requires the distributed budget, regardless of whether Vercel's automatic system variables are enabled. With only Groq variables configured on Vercel, it returns a friendly 503 and makes **no Groq call**. Local development works with just the two existing Groq variables. This deliberate production gate prevents claiming that a per-instance memory counter protects a scaled public function.

A single atomic Redis Lua script enforces a global rolling 65-second cooldown and 20 request reservations per UTC day. Failed provider requests count. The limiter's service call has a three-second timeout and fails closed on missing configuration, Redis errors or invalid responses. Counters contain no text, IP addresses or transcripts. An endpoint flood can consume the small shared budget and deny other users service; it cannot bypass the budget by changing IP or restarting a function. For a public event, also use deployment access protection or edge firewall controls available to your plan to protect Redis/function invocation quotas. The application does not promise unlimited free hosting under arbitrary traffic.

Use a dedicated Groq free-plan project/key. There is **no billing/upgrade API call**, no automatic paid-tier fallback and no automatic retry. Application code cannot establish your account's billing plan; retaining a free account and free infrastructure is a deployment responsibility. Shared organization activity can exhaust quotas earlier, in which case the route returns 429 and offers the local parser.

## Bounds and failures

- Maximum text: 1,500 characters and 3,000 UTF-8 bytes; total JSON request at most 12 KB.
- One Groq call per accepted request; `max_completion_tokens: 3600`, `reasoning_effort: low`.
- 20-second provider timeout; 30-second Vercel function duration; 25-second client wait limit.
- Global 65-second request spacing and 20 requests/day; client cooldown is only an additional UX cue.
- 429 respects a bounded `Retry-After`; provider errors, 503, timeout, invalid/truncated JSON and invalid graphs expose only fixed sanitized messages.
- No logs of text, responses, provider errors, headers or credentials. Responses use `Cache-Control: no-store`.
- Cross-origin browser requests are rejected. This is defense in depth, not authentication or distributed rate limiting.
- Groq strict JSON Schema requires every field and `additionalProperties: false`, with nullable optional values. Zod validation and graph validation run again on the server and in the browser/domain layer. Invalid graph proposals are rejected as a whole without applying partial state.

The strict contract covers actions/waits, goals, questions, summary and explained explicit/inferred edges. Source text is untrusted content in a separate user message. Output is never executed or rendered as HTML. Markup/code-fence content is rejected; React renders other text safely. Graph validators reject missing IDs, self links, duplicate edges and cycles. Proposed task IDs are mapped to normal UUIDs. Existing accepted graphs and pending decisions are checked before append.

## Verification and smoke tests

```sh
npm run typecheck
npm run lint
npm test                 # mocked provider only; live test skipped
npm run test:e2e         # mocked provider only; no Groq quota consumed
npm run build
npm run test:secrets     # inspects dist against server secrets without printing them
npm run test:groq        # OPT-IN: up to three spaced requests using server env
```

`test:groq` makes up to three small requests using the cat, unrelated-chores and science samples, spaced by at least 65 seconds. Set `THREADZERO_GROQ_SCENARIO=science` (or `cat`/`independent`) to select one. It does not retry and does not print credentials or raw provider responses. Without a key it prints a skip message. It consumes your real free quota; normal tests remain mocked. Normal tests never opt in automatically.

The initial cat live test passed on 18 October 2026 with the configured key and `openai/gpt-oss-20b`: it found the Nobel goal, an explicit buy-tuna → feed dependency, and no tuna → research dependency. This is evidence for this example, not a promise of semantic correctness on all text.

A secret scan passed against the built browser output: no configured credential values, server credential names or Groq provider URL were present. `.env.local` remains unchanged and `.env*` files are ignored by Git.

Verified locally: strict server/domain validation, mocked Vercel route wiring, cloud consent, preservation during a request, explicit/inferred review, dotted versus accepted edges, quota-to-local fallback, and existing desktop/mobile flows. See [MAGIC_VERIFICATION.md](MAGIC_VERIFICATION.md) for final counts.

Not verified: actual hosted Vercel deployment, a real Upstash database/Lua execution, Vercel firewall/account limits and Groq billing-plan status. The existing voice verification limits are unchanged.

### Manual deployed smoke test

1. Deploy with the four variables above. Use a free Groq account and free Redis plan.
2. Open the same harmless cat example and submit once through the privacy notice.
3. Inspect Network: the browser sends text to same-origin `/api/untangle`; no Groq key/provider request appears in browser JavaScript or headers. No audio is submitted.
4. Confirm tasks remain editable, the Nobel goal is separate, and the only tuna connection concerns feeding.
5. Confirm one connection; view solid versus dotted map edges and deterministic readiness.
6. Submit again inside 65 seconds: it must receive 429 with no extra Groq call. Temporarily remove the Redis token in a test deployment: it must return 503 without provider usage.
7. Never paste real secrets into the brain dump while testing.

Primary documentation: [Groq strict structured outputs](https://console.groq.com/docs/structured-outputs), [Groq organization rate limits](https://console.groq.com/docs/rate-limits), [Vercel Node functions](https://vercel.com/docs/functions/runtimes/node-js). Account-specific limits can differ from documented defaults.

## Current reasoning and review refinement

The strict contract now uses `ACTION` / `WAITING_EVENT`, nullable `estimatedMinutes`, source evidence for durations/deadlines/schedules, and evidence category/confirmation metadata per proposal. The browser submits the explicit local date and IANA timezone alongside the chosen text. Review keeps tasks first and hopes/questions collapsed; only source-supported explicit links can be bulk confirmed. See REFINEMENT_VERIFICATION.md for the current migration, UI, layout and live-test results.
