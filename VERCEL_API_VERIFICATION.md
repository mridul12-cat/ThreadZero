# Vercel Magic Untangle repair — 18 October 2026

## Diagnosis

The deployed `https://thread-zero-sigma.vercel.app/api/untangle` returned HTTP 500, `Content-Type: text/plain`, and `x-vercel-error: FUNCTION_INVOCATION_FAILED` for both GET and an empty invalid POST. This is a function invocation failure, not a missing endpoint. No valid brain dump was sent and no Groq quota was used by these probes.

The frontend previously checked content type before status, turning every non-JSON error into the misleading “Magic needs its API server” message.

The existing function used extensionless relative imports with `"type": "module"`. Native Node cannot resolve those imports after TypeScript emits JavaScript. This was reproduced against the original Git commit using the actual `@vercel/node` 24.0.3 production builder: its `nodejs24.x` artifact failed to load with `ERR_MODULE_NOT_FOUND` for `server/untangle`. The repaired artifact loads successfully. The hosted stack trace was not available; the observed hosted failure and the reproduced source-level startup bug are recorded separately.

## Changes

- Explicit `.js` relative imports throughout the existing function's runtime dependency chain. Vite and TypeScript resolve these to the TypeScript sources during development; emitted Node ESM imports resolve to JavaScript.
- Added `tsconfig.api.json` with NodeNext resolution, checked by both `npm run typecheck` and `npm run build`, so bundler-only module resolution cannot conceal this regression.
- Kept the existing Node request/response adapter and shared Groq service. The system prompt, model selection, schema, normalization, token budget, input limits, timeouts and distributed production budget gate are unchanged.
- Frontend errors now distinguish 404, 405, 401, 429, 500/503, server timeout, network failure, malformed/non-JSON success, and user cancellation. Raw upstream error bodies are never displayed. The local-parser action remains available.
- Groq authentication/permission failures return a sanitized HTTP 401 rather than an undifferentiated 502.

## Routing and settings

The existing `vercel.json` is correct and was retained: Vite, `npm run build`, output `dist`, and a 30-second duration for `api/untangle.ts`. Vercel builds root `api/` functions separately from the static Vite output. There is no SPA catch-all rewrite, `.vercelignore`, Express dependency or persistent backend process. The tracked function entry remains `/api/untangle`; the browser uses that same-origin path.

Deploy from the repository root. Set server-only `GROQ_API_KEY` and the configured `GROQ_MODEL` in the intended Vercel environment, then redeploy. The existing production budget gate also needs `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`; missing configuration returns JSON 503 and makes no provider request. No services or accounts were added. `.env.local` is ignored, was not changed, and is not a substitute for Vercel project variables.

## Verification

- **83 unit/integration tests passed**, one opt-in live test skipped. Added a separate native-Node process that compiles the function, imports emitted ESM, and serves actual HTTP requests with mocked Groq/Redis. Covers success, method rejection, missing key, malformed/schema-invalid/oversized requests, missing route, rate limit, authentication, invalid model output and timeout.
- **35 desktop/mobile browser tests passed**, three intentional opt-in/mobile-canvas skips. Covers the real Vite GET route returning JSON 405, production text-error messages, and working deterministic fallback after 404/500/429.
- TypeScript (including NodeNext), lint, production build, formatting and browser-output secret scan passed.
- Actual Vercel builder: original artifact fails native import; repaired artifact loads as a function. Temporary builder tooling and artifacts are outside the repository.
- Vercel CLI was not installed, so `vercel dev` was not run. The actual production builder and native HTTP tests were used instead. No live Groq requests were needed for this repair.

After deployment, GET `/api/untangle` should return JSON 405 with `Allow: POST`, proving the function loaded. An empty JSON POST should return JSON 400 when the Groq configuration is present, or JSON 503 when it is missing. Both probes avoid provider usage. A valid inference additionally requires correct production credentials and shared-budget configuration.

## Hosted verification after push

Vercel successfully deployed commit `b12ac57`. The production URL then returned JSON **405** for GET and JSON **400** for an invalid POST, with no `FUNCTION_INVOCATION_FAILED` header. This confirms that the function startup failure is repaired in the actual deployment.

One valid synthetic request (“Buy tuna before feeding the cat”) returned JSON **503** from the existing shared-budget gate. This occurred before Groq inference, so no provider request was made. The gate could not use its configured Redis service; without access to the Vercel environment or Redis account, missing variables, invalid credentials and service failure cannot be distinguished. The next required step is to check Production `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN`, retain the free-plan service, and redeploy if variables change. The protection was not removed or replaced with an unsafe per-instance counter. Successful hosted inference remains unverified until this configuration is corrected.

References: [Vercel Node functions](https://vercel.com/docs/functions/runtimes/node-js), [Vite on Vercel](https://vercel.com/docs/frameworks/frontend/vite). These document the root API convention and separate frontend/function deployment; the import failure above was established by execution.
