# Intelligence, graph and UX refinement — 18 October 2026

## Changes

- Tasks now have an explicit `ACTION` or `WAITING_EVENT` classification. Goals remain separate entities. External events require their own received/completed confirmation (`eventResolvedAt`); completing a request/reminder never completes an external event. User-marked unavailable actions remain a separate condition.
- `estimatedMinutes` is nullable throughout capture, AI, persistence, ranking, review, map and Focus. No 25-minute default remains. Exact source-backed durations or user-entered values are retained, including recovery when the model omits a stated duration; model guesses without evidence are discarded. Unknown time is labeled honestly or omitted on compact nodes.
- Groq receives a local reference date and IANA timezone. Deadline and scheduled-start evidence are distinct. The deterministic resolver handles today/tomorrow and weekday rollover; “next Thursday” means Thursday in the next ISO calendar week. An undated “before the exam” stays unknown and requests clarification.
- The prompt explicitly separates necessity, chronology, relatedness, independent tasks, external events and goals. Both ends of an explicit prerequisite must become separate candidates. Output quotes are checked against actual source text. Unsupported explicit evidence is downgraded; temporal/related links are excluded from prerequisite proposals. All proposals remain unconfirmed.
- Review now presents **Your threads**, a compact **Suggested connections** list, and collapsed **Bigger hopes & questions**. Added bulk confirmation of source-supported explicit connections, selection/rejection, undo, expandable reasoning/quotes, editable/dismissible/addable goals and a concise count summary. Inferences are never bulk approved.
- The map uses Dagre 3.1.1 for connected branches and packs independent tasks separately. Larger fixed-height cards, clear arrows, cluster backgrounds, readable initial zoom, explicit overview/reset/first-thread/path controls, transitive highlighting and slight unrelated-task fading improve navigation. Dragged positions survive edits/selection during the current map session. The mobile/list editor remains available. Enlarged connection dots have explicit CSS specificity so React Flow's lazy-loaded styles cannot shrink them.
- Ranking is still deterministic. Unknown time contributes a neutral 7.5 effort points, not a fake short duration. An optional available-time filter removes only known estimates that exceed the budget; unknown durations remain and are not promised to fit. Scheduled-future work, external events, completed work, unavailable actions and tasks with unfinished prerequisites are excluded. Rankings refresh on edits, once a minute and on window focus.
- Added three explicitly labeled preset examples in **Settings → Explore reasoning examples**. They run the real graph/review algorithms but do not make an AI call. Science Fair was reconstructed from the prompt's details because no science-fair dump existed in the repository; it is not presented as the user's saved project.

## Data migration

Existing version-1 workspaces remain readable. Old `action`/`waiting` kinds migrate to typed classifications, with reminder/request misclassifications repaired. Existing completed external events retain their historical completion as received. Old effort values without provenance are reset to unknown; a unique matching source clause with an explicit duration can be recovered, and explicitly marked user estimates are retained. Existing titles, notes, task status, goals, connections and edits remain. Export a backup when moving workspace data between builds.

## Verification

Final result counts are recorded below after the completed checks. The ordinary suite contains no live Groq requests. The separate optional smoke test uses only the synthetic demonstration inputs, never a saved brain dump, and spaces calls by at least 65 seconds.

- Unit/integration suite: **72 passed**, one optional live test skipped.
- Desktop/mobile Playwright suite: **29 passed**, three intentional skips: two opt-in local-ASR cases and the mobile canvas test (mobile uses the equivalent list).
- Strict TypeScript, lint, production build, client secret scan and formatting passed.
- Existing axe accessibility regressions passed for the core screens. New browser tests cover compact review/collapse, bulk/undo, rejection, goal editing, optional estimates, external-event receipt, independent threads, path selection, reset/fit controls and readable handle/card sizes.
- Algorithm tests cover all actual multi-prerequisite gates, disconnected layouts, non-overlapping node rectangles, 100 independent-node layout, directed ordering, transitive highlighting, non-destructive simulation, source evidence, neutral ranking and timezone/year/week boundaries.

### Optional live Groq probes

All three synthetic scenarios passed live probes with the configured server-side model:

- **Cat Nobel Prize:** four tasks, one buy-tuna → feed-cat prerequisite, a separate Nobel goal and independent research/email work; no invented durations.
- **Unrelated tasks:** four tasks, no goals or dependencies, all independently actionable.
- **Science Fair:** twelve tasks with separate action/event classifications; the final targeted probe passed, including the source-stated 45-minute calculus estimate and no other invented durations. The reminder does not resolve diagram receipt.

The final combined three-case run passed Cat and Unrelated but exposed the science duration omission. After adding deterministic source-clause recovery and regression coverage, the targeted science probe passed separately (18 October, 15:44 local). This is not a claim that a final combined live suite passed in one run. Earlier probes also exposed a truncated long science response at the smaller output ceiling; the richer output now has a 3,600-token cap. No automatic provider retry was introduced.

Final local regression checks additionally caught and fixed a leading-deadline fallback-parser regression. Dates and durations are now scoped to their own task clauses while “By Friday, finish slides” retains its deadline.

Visual artifacts: `screenshots/refined-map-desktop.png` and `screenshots/refined-review-mobile.png`. Browser tests exercise the preset scenarios through the actual UI, independently of model output.

## Preserved security and budget controls

`.env.local` was not modified. The configured Groq model is retained. Credentials remain server-side, with a production-output secret scan. There are no new paid services, databases or authentication. The existing production distributed budget gate remains unchanged.

The richer strict output has a **3,600 completion-token ceiling** (reasoning effort low), rather than the original 1,800. A smaller ceiling caused the long science example to be rejected. Input is still limited to 1,500 characters / 3,000 UTF-8 bytes; the server provider timeout remains 20 seconds. Calls remain globally spaced by 65 seconds and capped at 20/day. No automatic retry, alternate paid tier or upgrade exists. Organization quotas may be exhausted by other usage; 429 still falls back to the local parser. Keeping Groq and rate-limit infrastructure on free plans remains a deployment responsibility.

## Limits

Evidence and action-title checks are conservative heuristics, not a semantic proof. The LLM can still misinterpret text, omit work or produce invalid/truncated output. Whole invalid graph/schema proposals are rejected without modifying the workspace. Inferred edges still need a person to confirm them.

Long graphs deliberately require pan/zoom or a selected-path/list view rather than shrinking all text by default. “Fit entire map” is an explicit overview and may make labels small. Node titles are visually capped at three lines; full titles remain available in details and accessible text. Custom positions are not persisted across leaving the map. Geometry was tested for 100 tasks; broad hardware/browser performance certification was not performed.

Actual Vercel deployment, real Redis execution, physical mobile/screen-reader audits and the earlier physical-microphone voice limitations remain unverified. The voice implementation was not changed.
