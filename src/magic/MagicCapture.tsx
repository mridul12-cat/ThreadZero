import { useEffect, useRef, useState } from "react";
import { Sparkles, ShieldCheck, X } from "lucide-react";
import { COOLDOWN_SECONDS } from "./contract";
import { calendarContext, type CalendarContext } from "../parser/context";
import { MagicRequestError, requestMagicProposal } from "./request";
import type { Proposal } from "./contract";
export default function MagicCapture({
  text,
  onProposal,
  onLocal,
  disabled,
}: {
  text: string;
  onProposal: (
    proposal: Proposal,
    source: string,
    context: CalendarContext,
  ) => void;
  onLocal: () => void;
  disabled: boolean;
}) {
  const [consent, setConsent] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [remaining, setRemaining] = useState(0);
  const dialog = useRef<HTMLDialogElement>(null),
    controller = useRef<AbortController | null>(null),
    working = useRef(false),
    until = useRef(0);
  useEffect(() => () => controller.current?.abort(), []);
  useEffect(() => {
    if (consent) dialog.current?.showModal();
    else dialog.current?.close();
  }, [consent]);
  useEffect(() => {
    if (!remaining) return;
    const t = setInterval(
      () =>
        setRemaining(
          Math.max(0, Math.ceil((until.current - Date.now()) / 1000)),
        ),
      1000,
    );
    return () => clearInterval(t);
  }, [remaining]);
  function cooldown(seconds: number) {
    until.current = Date.now() + seconds * 1000;
    setRemaining(seconds);
  }
  async function run() {
    if (working.current || Date.now() < until.current) return;
    working.current = true;
    setConsent(false);
    setBusy(true);
    setError("");
    const source = text;
    const abort = new AbortController();
    controller.current = abort;
    let timedOut = false;
    const timeout = setTimeout(() => {
      timedOut = true;
      abort.abort();
    }, 25000);
    cooldown(COOLDOWN_SECONDS);
    try {
      const context = calendarContext();
      const proposal = await requestMagicProposal(
        source,
        context,
        abort.signal,
      );
      onProposal(proposal, source, context);
    } catch (e) {
      if (e instanceof MagicRequestError && e.retryAfter)
        cooldown(e.retryAfter);
      setError(
        abort.signal.aborted
          ? timedOut
            ? "Magic Untangle timed out. Your workspace was not changed."
            : "Magic was cancelled. Your workspace was not changed."
          : e instanceof Error
            ? e.message
            : "Magic is unavailable. Your workspace was not changed.",
      );
    } finally {
      clearTimeout(timeout);
      working.current = false;
      controller.current = null;
      setBusy(false);
    }
  }
  return (
    <div className="magic-capture">
      <button
        className="button secondary magic-button"
        disabled={
          disabled ||
          !text.trim() ||
          text.trim().length > 1500 ||
          busy ||
          remaining > 0
        }
        onClick={() => setConsent(true)}
      >
        <Sparkles size={16} />
        {busy
          ? "Finding a little clarity…"
          : remaining > 0
            ? `Magic rests · ${remaining}s`
            : "Magic Untangle"}
      </button>
      {busy && (
        <button
          className="text-button"
          onClick={() => controller.current?.abort()}
        >
          Cancel Magic
        </button>
      )}
      <p className="magic-hint">
        Optional Groq AI · sends only the text you submit
        {text.trim().length > 1500
          ? " · shorten to 1,500 characters for Magic"
          : ""}
      </p>
      {error && (
        <div className="magic-error" role="alert">
          <p>{error}</p>
          <button className="text-button" onClick={onLocal}>
            Use the local parser instead <ShieldCheck size={14} />
          </button>
        </div>
      )}
      <dialog
        ref={dialog}
        className="settings-dialog magic-dialog"
        aria-labelledby="magic-consent-title"
        onCancel={() => setConsent(false)}
      >
        <div className="spread">
          <span className="eyebrow">A LITTLE MAGIC, WITH YOUR SAY</span>
          <button
            className="icon-button"
            aria-label="Close Magic privacy notice"
            onClick={() => setConsent(false)}
          >
            <X size={18} />
          </button>
        </div>
        <h2 id="magic-consent-title">Untangle with Groq?</h2>
        <p>
          Magic Untangle sends your text to Groq for AI processing. Your saved
          tasks remain on this device.
        </p>
        <p>
          Only the current brain dump, local reference date and timezone are
          submitted. Microphone audio and your existing task list are never
          sent. AI suggestions can be wrong; you decide what belongs.
        </p>
        <div className="button-row">
          <button
            className="button secondary"
            onClick={() => {
              setConsent(false);
              onLocal();
            }}
          >
            Stay local
          </button>
          <button className="button primary" onClick={() => void run()}>
            <Sparkles size={16} /> Send this text to Groq
          </button>
        </div>
      </dialog>
    </div>
  );
}
