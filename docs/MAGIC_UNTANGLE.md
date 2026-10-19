# Magic Untangle

Magic Untangle is optional. The local parser, voice transcription, graph algorithms, ranking, Pip and navigation remain available without Groq. **Untangle my thoughts** never calls Groq.

## Local setup

From the repository root:

```sh
npm ci
cp -n .env.example .env.local  # create only if no local file exists
npm run dev
```

Edit the local file privately with server-only values:

```dotenv
GROQ_API_KEY=<your Groq free-plan API key>
GROQ_MODEL=openai/gpt-oss-20b
```

Vite's server configuration reads the non-public environment variables and serves `/api/untangle` through development middleware. Restart after changing variables. No `VITE_` credentials, public key fields or browser provider calls are used. `GROQ_MODEL` defaults to `openai/gpt-oss-20b`; the allowlist also permits `openai/gpt-oss-120b`. Other models fail closed until strict-output support and budgets are reviewed. Alternate-model live behavior is unverified, and account-specific quotas can differ.

`npm run preview` is a static preview and does not run the API. Use `npm run dev` or Vercel's development environment for the full application. `vercel dev` has not been verified. [Testing](TESTING.md#vercel-api-evidence) records actual production-builder and hosted-route evidence.

## Consent and review

1. Enter up to 1,500 characters / 3,000 UTF-8 bytes and click **Magic Untangle**.
2. Read the privacy notice and explicitly choose **Send this text to Groq**, or **Stay local** for deterministic parsing.
3. Review editable tasks first, suggested connections next, and collapsed bigger hopes/questions. Goals are separate from executable tasks. External events are excluded from actionable recommendations.
4. Expand connections to inspect their evidence and reasoning. Every proposal needs confirmation; only source-supported explicit prerequisites can be bulk confirmed. Inferred links require individual review. Dotted map proposals do not affect readiness; accepted solid connections use the deterministic graph engine.
5. Edit task titles, estimates, dates and dependencies, or reject a suggestion. Rejection is remembered for the mapped endpoints. Undo restores the pre-append workspace.

The submitted text, explicit local date and IANA timezone are sent through the same-origin API. Microphone audio, the existing task list and hidden workspace context are never submitted. User content is separate from the system prompt and is treated as untrusted. Output is not executed or rendered as HTML; markup/code-fence content is rejected and React renders other text safely.

Results append to the latest workspace. Existing titles, notes, completion, effort, accepted edges and draft edits made during a request are preserved. Repeated proposals de-duplicate by original model task ID plus source, or normalized title. Different IDs/wording on later requests may still create a duplicate for manual review. These later user-initiated requests are distinct from automatic retries, which are not implemented.

## Vercel deployment

Deploy the repository root. [`vercel.json`](../vercel.json) selects Vite, `npm run build`, `dist` and a 30-second function duration. [`api/untangle.ts`](../api/untangle.ts) is a native Node function, separate from static Vite output, reusing [`server/untangle.ts`](../server/untangle.ts). There is no Express process, SPA catch-all rewrite or `.vercelignore` excluding the API. Runtime ESM imports use explicit `.js` extensions; `tsconfig.api.json` checks NodeNext resolution during typecheck/build.

Set variables in Vercel → Project Settings → Environment Variables for each intended Production, Preview or Development environment, then redeploy:

| Variable                   | Required           | Purpose                                                  |
| -------------------------- | ------------------ | -------------------------------------------------------- |
| `GROQ_API_KEY`             | Yes for Magic      | Server-only Groq key                                     |
| `GROQ_MODEL`               | Optional           | Defaults to `openai/gpt-oss-20b`                         |
| `UPSTASH_REDIS_REST_URL`   | For deployed Magic | HTTPS REST URL of a dedicated free-plan Upstash database |
| `UPSTASH_REDIS_REST_TOKEN` | For deployed Magic | Server-only Redis token                                  |

The function reads `process.env` at runtime. `.env.local` is ignored and is not a substitute for Vercel settings; never upload it or put its values into browser configuration. No Redis account or infrastructure was created by the implementation. The core local experience still works without these variables.

**Production fails closed when the shared budget is unavailable**, regardless of whether automatic Vercel system variables are enabled. With only Groq variables configured, Magic returns JSON 503 without calling Groq. Local development uses an in-memory limiter and needs only the Groq variables. The last recorded production inference attempt hit this gate; [the dated evidence](TESTING.md#vercel-api-evidence) does not establish the current deployment configuration.

## Security, budget and failures

- One atomic Redis Lua reservation enforces a global rolling 65-second cooldown and at most 20 requests per UTC day; failed provider calls count. The Redis call has a three-second timeout and fails closed on missing configuration, service errors or invalid responses. Counters contain no text, IP addresses or transcripts.
- The JSON request is limited to 12 KB, including the 1,500-character / 3,000-byte text limit. Each accepted request makes one Groq call, capped at 3,600 completion tokens with low reasoning effort. Provider timeout: 20 seconds; client wait: 25 seconds; Vercel function: 30 seconds.
- The strict schema requires every field and `additionalProperties: false`, with nullable optional values. Zod/domain validation runs on the server and again in the browser. Missing references, duplicate IDs/edges, self-links and cycles reject the proposal atomically; existing saved work is retained. AI IDs map to normal UUIDs.
- Source-backed `ACTION` / `WAITING_EVENT` classification, nullable estimates, distinct deadline/schedule evidence and evidence/confirmation metadata support human review; they do not prove semantic correctness. Existing accepted graphs and pending decisions are checked before append.
- Errors use fixed sanitized messages and `Cache-Control: no-store`. No text, responses, provider errors, headers or credentials are logged. Frontend handling distinguishes 404, 405, Groq authentication 401, 429 with bounded `Retry-After`, 500/503, timeout, network failure, cancellation and malformed success responses. Raw upstream errors are not displayed; local fallback stays available.
- Cross-origin browser requests are rejected as defense in depth. This is not authentication or a replacement for distributed limiting. Client cooldown is only a UX cue.
- A flood can exhaust the shared budget and deny service to other users; changing IP or restarting a function does not bypass the Redis reservation. Use access protection or edge firewall controls available to the deployment plan for public events. Inference reservations do not bound all Redis/function/hosting traffic costs.
- Use dedicated free-plan Groq and Redis resources without paid auto-upgrade. There is no billing/upgrade API call, alternate paid-tier fallback or automatic retry. The app cannot verify billing settings or promise unlimited free hosting. Other organization usage may exhaust Groq quota earlier; 429 offers local parsing.

Commands, optional live tests, manual deployment checks, historical evidence and unverified behavior are centralized in [TESTING.md](TESTING.md).

Primary references: [Groq strict structured outputs](https://console.groq.com/docs/structured-outputs), [Groq organization rate limits](https://console.groq.com/docs/rate-limits), [Vercel Node functions](https://vercel.com/docs/functions/runtimes/node-js), [Vite on Vercel](https://vercel.com/docs/frameworks/frontend/vite).
