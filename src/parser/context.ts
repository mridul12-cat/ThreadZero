export interface CalendarContext {
  today: string;
  timeZone: string;
}
export function calendarContext(
  now = new Date(),
  timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone,
): CalendarContext {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const get = (kind: string) => parts.find((p) => p.type === kind)!.value;
  return { today: `${get("year")}-${get("month")}-${get("day")}`, timeZone };
}
export function parseMinutes(text: string): number | null {
  const matches = [
    ...text.matchAll(/\b(\d+(?:\.\d+)?)\s*(minutes?|mins?|hours?|hrs?)\b/gi),
  ];
  if (matches.length !== 1) return null;
  const value = Number(matches[0][1]) * (/^h/i.test(matches[0][2]) ? 60 : 1);
  return Number.isInteger(value) && value >= 1 && value <= 1440 ? value : null;
}
export function statedDuration(
  title: string,
  source: string,
): { minutes: number; evidence: string } | null {
  const canonical = (text: string) =>
    text
      .toLowerCase()
      .replace(
        /\b(study|studying|revise|revising|review|reviewing|revision)\b/g,
        "study",
      );
  const ignored = new Set([
    "the",
    "and",
    "for",
    "with",
    "from",
    "about",
    "minutes",
    "minute",
    "hours",
    "hour",
    "task",
  ]);
  const words = (canonical(title).match(/[a-z]{3,}/g) ?? []).filter(
    (w) => !ignored.has(w),
  );
  if (!words.length) return null;
  const clauses = source
    .split(/[!?;\n,]|(?<!\d)\.(?!\d)|\band\b/i)
    .map((s) => s.trim())
    .filter(Boolean);
  const matches = clauses.flatMap((evidence) => {
    const minutes = parseMinutes(evidence);
    return minutes !== null &&
      words.every((w) => canonical(evidence).includes(w))
      ? [{ minutes, evidence }]
      : [];
  });
  return matches.length === 1 ? matches[0] : null;
}
export function resolveDate(
  text: string,
  context: CalendarContext,
): string | null {
  const base = new Date(context.today + "T12:00:00Z");
  if (
    /\b(before|after)\s+(?:the\s+)?(?:exam|meeting|event|presentation)\b/i.test(
      text,
    )
  )
    return null;
  const absolute = text.match(/\b\d{4}-\d{2}-\d{2}\b/);
  if (absolute)
    return !isNaN(Date.parse(absolute[0])) &&
      new Date(absolute[0]).toISOString().slice(0, 10) === absolute[0]
      ? absolute[0]
      : null;
  let days = 0;
  if (/\btomorrow\b/i.test(text)) days = 1;
  else if (/\btoday\b/i.test(text)) days = 0;
  else {
    const match = text.match(
      /\b(?:(next|this)\s+)?(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/i,
    );
    if (!match) return null;
    const day = [
      "sunday",
      "monday",
      "tuesday",
      "wednesday",
      "thursday",
      "friday",
      "saturday",
    ].indexOf(match[2].toLowerCase());
    days = (day - base.getUTCDay() + 7) % 7;
    if (match[1]?.toLowerCase() === "next") {
      const currentMondayOffset = (base.getUTCDay() + 6) % 7;
      days = 7 - currentMondayOffset + ((day + 6) % 7);
    } else if (match[1]?.toLowerCase() === "this" && day < base.getUTCDay())
      return null;
  }
  base.setUTCDate(base.getUTCDate() + days);
  return base.toISOString().slice(0, 10);
}
export function parseDeadline(
  text: string,
  context: CalendarContext,
): string | null {
  return /\b(?:by|due|deadline|no later than|before)\b/i.test(text)
    ? resolveDate(text, context)
    : null;
}
export function isActionTitle(title: string) {
  return /^(?:(?:I\s+)?(?:need to|have to|should|must)\s+)?(?:remind|email|call|request|ask|order|buy|send|follow up|contact|message|chase|nudge)\b/i.test(
    title.trim(),
  );
}
export function isEventTitle(title: string) {
  return /^(?:wait(?:ing)?\s+(?:for|on)|receive|await|arrival of|approval (?:from|received))\b/i.test(
    title.trim(),
  );
}
export const effortLabel = (minutes: number | null) =>
  minutes === null ? "Time not estimated" : `${minutes} min`;
