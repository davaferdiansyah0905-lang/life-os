// All "wall clock" values in the app are local strings in the configured timezone
// (default Asia/Jakarta): dates "YYYY-MM-DD", times "HH:mm", datetimes "YYYY-MM-DDTHH:mm".
// They compare correctly as strings, which keeps calculations simple and timezone-safe.

let TZ = "Asia/Jakarta";
let FORMAT_12H = false;

export function setTimezone(tz: string) {
  try {
    new Intl.DateTimeFormat("en-CA", { timeZone: tz });
    TZ = tz;
  } catch {
    TZ = "Asia/Jakarta";
  }
}
export function getTimezone() {
  return TZ;
}
export function setTimeFormat(f: "24h" | "12h") {
  FORMAT_12H = f === "12h";
}

const pad = (n: number) => String(n).padStart(2, "0");

const partsCache = new Map<string, Intl.DateTimeFormat>();
function fmt(tz: string) {
  let f = partsCache.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat("en-CA", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    });
    partsCache.set(tz, f);
  }
  return f;
}

export function zonedParts(d: Date = new Date()) {
  const p: Record<string, string> = {};
  for (const x of fmt(TZ).formatToParts(d)) p[x.type] = x.value;
  const hour = p.hour === "24" ? "00" : p.hour;
  return { y: p.year, m: p.month, d: p.day, hh: hour, mm: p.minute, ss: p.second };
}

export function todayKey(d: Date = new Date()) {
  const p = zonedParts(d);
  return `${p.y}-${p.m}-${p.d}`;
}
export function nowHM(d: Date = new Date()) {
  const p = zonedParts(d);
  return `${p.hh}:${p.mm}`;
}
export function nowLocal(d: Date = new Date()) {
  return `${todayKey(d)}T${nowHM(d)}`;
}
export function nowMinutes(d: Date = new Date()) {
  const p = zonedParts(d);
  return Number(p.hh) * 60 + Number(p.mm);
}

// ── Date key arithmetic (UTC-based, no DST surprises) ──
export function keyToUTC(key: string) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}
export function utcToKey(dt: Date) {
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
}
export function addDays(key: string, n: number) {
  const dt = keyToUTC(key);
  dt.setUTCDate(dt.getUTCDate() + n);
  return utcToKey(dt);
}
export function addMonths(key: string, n: number) {
  const [y, m] = key.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1 + n, 1));
  return utcToKey(dt);
}
export function diffDays(a: string, b: string) {
  // a - b in days
  return Math.round((keyToUTC(a).getTime() - keyToUTC(b).getTime()) / 86400000);
}
export function dayOfWeek(key: string) {
  return keyToUTC(key).getUTCDay(); // 0 = Sunday
}
export function startOfWeek(key: string) {
  const dow = dayOfWeek(key);
  const delta = dow === 0 ? -6 : 1 - dow; // Monday start
  return addDays(key, delta);
}
export function startOfMonth(key: string) {
  return key.slice(0, 8) + "01";
}
export function endOfMonth(key: string) {
  return addDays(addMonths(startOfMonth(key), 1), -1);
}
export function daysInMonth(key: string) {
  return Number(endOfMonth(key).slice(8, 10));
}
export function startOfYear(key: string) {
  return key.slice(0, 4) + "-01-01";
}
export function rangeKeys(from: string, to: string) {
  const out: string[] = [];
  let k = from;
  let guard = 0;
  while (k <= to && guard++ < 4000) {
    out.push(k);
    k = addDays(k, 1);
  }
  return out;
}

// ── Time-of-day helpers ──
export function toMin(hm: string) {
  if (!hm) return 0;
  const [h, m] = hm.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}
export function fromMin(min: number) {
  const m = Math.max(0, Math.min(1440, Math.round(min)));
  return `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
}
export function roundUpTo(min: number, step: number) {
  return Math.ceil(min / step) * step;
}
export function durationLabel(minutes: number) {
  const m = Math.max(0, Math.round(minutes));
  const h = Math.floor(m / 60);
  const r = m % 60;
  if (h && r) return `${h}j ${r}m`;
  if (h) return `${h} jam`;
  return `${r} mnt`;
}
export function hoursLabel(minutes: number) {
  const h = minutes / 60;
  return `${h % 1 === 0 ? h : h.toFixed(1).replace(".", ",")} jam`;
}

/** Display a HH:mm in the user's chosen format. */
export function fmtTime(hm: string) {
  if (!hm) return "";
  if (!FORMAT_12H) return hm;
  const total = toMin(hm);
  const h = Math.floor(total / 60) % 24;
  const m = total % 60;
  const suffix = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${pad(m)} ${suffix}`;
}

const LONG = new Intl.DateTimeFormat("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
const MED = new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const SHORT = new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", timeZone: "UTC" });
const WEEKDAY = new Intl.DateTimeFormat("id-ID", { weekday: "long", timeZone: "UTC" });
const WEEKDAY_SHORT = new Intl.DateTimeFormat("id-ID", { weekday: "short", timeZone: "UTC" });
const MONTH_YEAR = new Intl.DateTimeFormat("id-ID", { month: "long", year: "numeric", timeZone: "UTC" });
const MONTH_SHORT = new Intl.DateTimeFormat("id-ID", { month: "short", timeZone: "UTC" });

export const fmtDateLong = (key: string) => LONG.format(keyToUTC(key));
export const fmtDate = (key: string) => MED.format(keyToUTC(key));
export const fmtDateShort = (key: string) => SHORT.format(keyToUTC(key));
export const fmtWeekday = (key: string) => WEEKDAY.format(keyToUTC(key));
export const fmtWeekdayShort = (key: string) => WEEKDAY_SHORT.format(keyToUTC(key)).replace(".", "");
export const fmtMonthYear = (key: string) => MONTH_YEAR.format(keyToUTC(key));
export const fmtMonthShort = (key: string) => MONTH_SHORT.format(keyToUTC(key)).replace(".", "");

/** "YYYY-MM-DDTHH:mm" → readable */
export function fmtDateTime(local: string) {
  if (!local) return "";
  const [d, t] = local.split("T");
  return `${fmtDate(d)}${t ? ", " + fmtTime(t) : ""}`;
}

/** Minutes between two local datetimes (b - a). */
export function minutesBetween(a: string, b: string) {
  const [da, ta = "00:00"] = a.split("T");
  const [db, tb = "00:00"] = b.split("T");
  return diffDays(db, da) * 1440 + toMin(tb) - toMin(ta);
}

/** Relative description of a deadline from now. */
export function relativeDeadline(deadline: string, now: string = nowLocal()) {
  const mins = minutesBetween(now, deadline);
  const abs = Math.abs(mins);
  let txt: string;
  if (abs < 60) txt = `${abs} menit`;
  else if (abs < 1440) txt = `${Math.round(abs / 60)} jam`;
  else txt = `${Math.round(abs / 1440)} hari`;
  return mins < 0 ? `terlambat ${txt}` : `${txt} lagi`;
}

export function greeting(minutes: number = nowMinutes()) {
  if (minutes < 4 * 60) return { text: "Selamat Malam", en: "Good Evening", icon: "Moon" as const };
  if (minutes < 11 * 60) return { text: "Selamat Pagi", en: "Good Morning", icon: "Sunrise" as const };
  if (minutes < 15 * 60) return { text: "Selamat Siang", en: "Good Afternoon", icon: "Sun" as const };
  if (minutes < 18 * 60) return { text: "Selamat Sore", en: "Good Afternoon", icon: "Sunset" as const };
  return { text: "Selamat Malam", en: "Good Evening", icon: "Moon" as const };
}

/** Day number since epoch in the configured timezone — used for daily rotation. */
export function dayNumber(key: string = todayKey()) {
  return Math.floor(keyToUTC(key).getTime() / 86400000);
}
