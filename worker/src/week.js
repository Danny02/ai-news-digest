/**
 * ISO-8601 week helpers. Pure, UTC-only, no Date parsing of locale strings.
 *
 * A week key is `GGGG-Www` (ISO week-numbering year, not calendar year — they
 * differ in late December and early January, which is exactly when a naive
 * implementation puts an issue on a page nobody links to).
 */

const DAY = 86400000;
const WEEK_KEY_RE = /^(\d{4})-W(\d{2})$/;
export const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isValidDate(s) {
  return typeof s === "string" && DATE_RE.test(s) && toUTC(s) !== null;
}

export function isValidWeekKey(s) {
  const m = typeof s === "string" && WEEK_KEY_RE.exec(s);
  if (!m) return false;
  const week = Number(m[2]);
  return week >= 1 && week <= weeksInYear(Number(m[1]));
}

function toUTC(isoDate) {
  const [y, m, d] = isoDate.split("-").map(Number);
  const t = Date.UTC(y, m - 1, d);
  const back = new Date(t);
  // Rejects 2026-02-30 and friends, which Date.UTC silently rolls over.
  if (back.getUTCFullYear() !== y || back.getUTCMonth() !== m - 1 || back.getUTCDate() !== d) {
    return null;
  }
  return t;
}

function fmt(t) {
  return new Date(t).toISOString().slice(0, 10);
}

// Thursday decides which ISO year a week belongs to.
function thursdayOf(t) {
  const d = new Date(t);
  const mondayIndex = (d.getUTCDay() + 6) % 7;
  return t + (3 - mondayIndex) * DAY;
}

function firstThursdayOf(isoYear) {
  return thursdayOf(Date.UTC(isoYear, 0, 4));
}

function weeksInYear(isoYear) {
  const diff = firstThursdayOf(isoYear + 1) - firstThursdayOf(isoYear);
  return Math.round(diff / (7 * DAY));
}

/** "2026-08-14" -> "2026-W33" */
export function weekKeyOf(isoDate) {
  const t = toUTC(isoDate);
  if (t === null) throw new RangeError(`not a calendar date: ${isoDate}`);
  const thu = thursdayOf(t);
  const isoYear = new Date(thu).getUTCFullYear();
  const week = 1 + Math.round((thu - firstThursdayOf(isoYear)) / (7 * DAY));
  return `${isoYear}-W${String(week).padStart(2, "0")}`;
}

/** "2026-W33" -> "2026-08-10" (the Monday) */
export function mondayOf(weekKey) {
  const m = WEEK_KEY_RE.exec(weekKey);
  if (!m) throw new RangeError(`not a week key: ${weekKey}`);
  const thu = firstThursdayOf(Number(m[1])) + (Number(m[2]) - 1) * 7 * DAY;
  return fmt(thu - 3 * DAY);
}

/** Shift a week key by n weeks. shiftWeek("2026-W01", -1) === "2025-W52". */
export function shiftWeek(weekKey, n) {
  const t = toUTC(mondayOf(weekKey));
  return weekKeyOf(fmt(t + n * 7 * DAY));
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2026-W33" -> "10-16 Aug 2026" (or "29 Jun - 5 Jul 2026" across a boundary). */
export function weekLabel(weekKey) {
  const start = new Date(toUTC(mondayOf(weekKey)));
  const end = new Date(start.getTime() + 6 * DAY);
  const sameMonth = start.getUTCMonth() === end.getUTCMonth();
  const left = sameMonth
    ? `${start.getUTCDate()}`
    : `${start.getUTCDate()} ${MONTHS[start.getUTCMonth()]}`;
  return `${left}\u2013${end.getUTCDate()} ${MONTHS[end.getUTCMonth()]} ${end.getUTCFullYear()}`;
}

/** Today in UTC as YYYY-MM-DD. The digest day is defined in UTC, everywhere. */
export function todayUTC(now = Date.now()) {
  return new Date(now).toISOString().slice(0, 10);
}
