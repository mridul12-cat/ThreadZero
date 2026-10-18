import { COOLDOWN_SECONDS, type Proposal } from "./contract";
import { validateProposal } from "./domain";
import type { CalendarContext } from "../parser/context";

export class MagicRequestError extends Error {
  constructor(
    message: string,
    readonly retryAfter?: number,
  ) {
    super(message);
  }
}

const fallback =
  " Use the local parser instead; your workspace was not changed.";
function statusMessage(status: number): string {
  switch (status) {
    case 404:
      return "Magic’s API endpoint was not found (404)." + fallback;
    case 405:
      return (
        "Magic’s API does not accept this request method (405)." + fallback
      );
    case 401:
      return (
        "Groq authentication failed (401). The server’s Groq API key needs attention." +
        fallback
      );
    case 429:
      return (
        "Magic’s request limit or Groq quota is busy or exhausted (429). Try later." +
        fallback
      );
    case 500:
      return "Magic’s server could not process the request (500)." + fallback;
    case 503:
      return (
        "Magic’s server is not configured or is temporarily unavailable (503)." +
        fallback
      );
    case 504:
    case 408:
      return "Magic Untangle timed out. No retry was sent." + fallback;
    case 400:
    case 413:
    case 415:
      return (
        "Magic could not accept this brain dump. Check its length and try again." +
        fallback
      );
    case 403:
      return (
        "Magic could not authorize this request. Submit it from the ThreadZero app." +
        fallback
      );
    default:
      return (
        "Groq returned an invalid response or could not be reached." + fallback
      );
  }
}

export async function requestMagicProposal(
  source: string,
  context: CalendarContext,
  signal: AbortSignal,
  fetcher: typeof fetch = fetch,
): Promise<Proposal> {
  let response: Response;
  try {
    response = await fetcher("/api/untangle", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: source, consent: true, ...context }),
      signal,
    });
  } catch (error) {
    if (signal.aborted) throw error;
    throw new MagicRequestError(
      "Magic could not connect because of a network failure." + fallback,
    );
  }
  // Check status before content type: Vercel startup errors and missing routes can be plain text or HTML.
  if (!response.ok)
    throw new MagicRequestError(
      statusMessage(response.status),
      response.status === 429
        ? Math.min(
            86400,
            Math.max(
              COOLDOWN_SECONDS,
              Number(response.headers.get("Retry-After")) || COOLDOWN_SECONDS,
            ),
          )
        : undefined,
    );
  if (!response.headers.get("Content-Type")?.includes("application/json"))
    throw new MagicRequestError(
      "Magic’s API returned a page instead of a JSON proposal. Check the deployment’s API routing." +
        fallback,
    );
  try {
    const data = (await response.json()) as { proposal?: unknown };
    return validateProposal(data.proposal, { source, ...context });
  } catch (error) {
    if (signal.aborted) throw error;
    throw new MagicRequestError(
      "Magic returned an invalid proposal." + fallback,
    );
  }
}
