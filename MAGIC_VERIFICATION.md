# Initial Magic Untangle verification — 18 October 2026

This records the first integration. See [REFINEMENT_VERIFICATION.md](REFINEMENT_VERIFICATION.md) for current task types, nullable durations, prompt/schema, graph layout, compact review and results.

## Delivered

Optional Groq reasoning via same-origin `/api/untangle`, a native Vercel Node function and Vite development middleware. The key is read only by the server. `.env.local` was not edited, displayed or committed. Git ignore patterns now correctly ignore environment **files**, rather than only directories.

The existing capture design, mascot, graph algorithms, recommendation engine, larger connection handles and local parser remain. Added a consent-gated Magic button, bounded loading/cancel/cooldown UX, editable AI tasks/goals/questions, explained explicit/inferred proposals, dotted unconfirmed connections, solid accepted connections and quota-to-local fallback. All relationships require acceptance before affecting readiness.

Workspaces migrate with empty defaults for new fields. AI results append rather than replace; user edits, current drafts, completion and existing accepted edges are preserved. Rejected suggestions are retained as decisions. Invalid schema/graphs are rejected atomically without changing saved work.

## Observed results

| Check | Result |
| --- | --- |
| Strict TypeScript typecheck | Passed |
| ESLint | Passed |
| Unit/domain/server/route tests | **53 passed**, 1 optional live test skipped |
| Explicitly enabled live Groq smoke test | **1 passed**; one real request, no automatic retry |
| Desktop/mobile browser regression suite | **22 passed**, 2 optional local-ASR cases skipped |
| Accessibility regression | Passed on capture, review, map, focus, voice controls and settings, desktop/mobile |
| Production build | Passed |
| Client secret scan | Passed: no configured credential values, credential variable names or Groq provider endpoint in `dist/` |
| Formatting | Passed |

Normal tests never make a real Groq request. Browser tests mock `/api/untangle`, including 429 and consent behavior. The separate live test used server environment variables from the original `.env.local` and `openai/gpt-oss-20b`. Credentials and provider error payloads were not printed. No new package dependency was needed.

The live example recognized a cat winning a Nobel Prize as an aspirational goal, identified buying tuna → feeding as explicit, and did not claim tuna is a prerequisite for research funding. This verifies one real structured-output response and its graph semantics, not arbitrary semantic correctness.

## Files changed or added

- `api/untangle.ts`, `vercel.json`: Vercel routing/runtime configuration and bounded request adapter.
- `server/untangle.ts`: strict Groq HTTP request, prompt, request/response validation, timeouts and sanitized failures.
- `server/rate-limit.ts`: local cooldown/day cap and atomic distributed Redis budget.
- `src/magic/contract.ts`, `domain.ts`, `MagicCapture.tsx`: shared strict contract, graph validation/reconciliation, consent and cloud UI.
- `src/App.tsx`, `src/components/ThreadMap.tsx`, `src/styles/app.css`: preserved product flow with review context and dotted connection overlays.
- `src/storage/types.ts`, `store.ts`: backward-compatible proposal metadata, goals/questions and validated goal references.
- `vite.config.ts`, `tsconfig.json`, `eslint.config.js`, `package.json`, `.gitignore`: server development path, checking/scripts and environment file protection.
- `src/tests/magic-fixture.ts`, `magic.test.ts`, `server/untangle.test.ts`, `route.test.ts`, `groq.live.test.ts`, `e2e/magic.spec.ts`: meaningful domain, service, Vercel adapter and browser tests.
- `scripts/groq-smoke.mjs`, `verify-client-secrets.mjs`: explicit live test and credential-safe production scan.
- `README.md`, `ARCHITECTURE.md`, `VERIFICATION.md`, `MAGIC_UNTANGLE.md`, this report: updated privacy/setup/deployment documentation. Existing screenshot artifacts were refreshed by the regression suite.

## Run and deployment

```sh
npm run dev             # reads existing server .env.local
npm run build
npm run test:secrets
npm run test:groq       # optional: consumes one real request
```

Exact server environment variables for Vercel:

```text
GROQ_API_KEY
GROQ_MODEL=openai/gpt-oss-20b
UPSTASH_REDIS_REST_URL
UPSTASH_REDIS_REST_TOKEN
```

No `VITE_` secret variables. Set these in Vercel project settings for the intended environments and redeploy the repository. The Vercel function accesses `process.env`; a mocked route integration test verified the server credential reaches only the provider Authorization header and never the client response.

**The deployed route fails closed without the Redis variables.** It does not fall back to per-instance counters on Vercel. Configure a dedicated free-plan Upstash database and use a free-plan Groq project. The atomic budget permits one global reservation per 65 seconds and at most 20/day; errors count. Provider calls are capped at 1,800 completion tokens and have a 20-second timeout. Account-wide provider quotas may be exhausted by other applications; 429 offers the classic parser. No paid-plan upgrade or automatic provider retry is implemented.

## Not verified

- A hosted Vercel deployment and real Redis Lua execution. Those require the user's deployment/account configuration; no infrastructure was created or published.
- Groq/hosting/Redis account billing settings or resistance to arbitrary function-invocation flooding. Keep accounts on free plans and use available access/edge controls for public events. Rate counters reserve inference budget; they do not make all hosting traffic free.
- Vercel CLI local emulation, broad model semantic accuracy and alternate model live behavior.
- Voice behavior was not changed; its physical-microphone and native-recognition verification limits remain.

See [MAGIC_UNTANGLE.md](MAGIC_UNTANGLE.md) for the full manual smoke procedure, exact safeguards, consent language, budget details and primary documentation links.
