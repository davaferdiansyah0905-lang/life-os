import { CURRENCIES } from "./constants";

let CURRENCY = "IDR";
export function setCurrency(code: string) {
  CURRENCY = CURRENCIES.some((c) => c.code === code) ? code : "IDR";
}
export function getCurrency() {
  return CURRENCY;
}

const cache = new Map<string, Intl.NumberFormat>();
function nf(key: string, make: () => Intl.NumberFormat) {
  let f = cache.get(key);
  if (!f) {
    f = make();
    cache.set(key, f);
  }
  return f;
}

/** Full money format, e.g. "Rp25.000". */
export function money(n: number, opts: { sign?: boolean } = {}) {
  const c = CURRENCIES.find((x) => x.code === CURRENCY) ?? CURRENCIES[0];
  const digits = c.code === "IDR" ? 0 : 2;
  const f = nf(`m-${c.code}`, () =>
    new Intl.NumberFormat(c.locale, { style: "currency", currency: c.code, minimumFractionDigits: digits, maximumFractionDigits: digits }),
  );
  const v = Number.isFinite(n) ? n : 0;
  const s = f.format(Math.abs(v)).replace(/ /g, "");
  if (opts.sign) return (v < 0 ? "−" : "+") + s;
  return v < 0 ? "−" + s : s;
}

/** Compact money, e.g. "Rp1,2 jt". */
export function moneyShort(n: number) {
  const v = Number.isFinite(n) ? n : 0;
  const abs = Math.abs(v);
  const neg = v < 0 ? "−" : "";
  if (CURRENCY !== "IDR") {
    const c = CURRENCIES.find((x) => x.code === CURRENCY) ?? CURRENCIES[0];
    return neg + new Intl.NumberFormat(c.locale, { style: "currency", currency: c.code, notation: "compact", maximumFractionDigits: 1 }).format(abs);
  }
  const fmt1 = (x: number) => (Math.round(x * 10) / 10).toLocaleString("id-ID");
  if (abs >= 1e9) return `${neg}Rp${fmt1(abs / 1e9)} M`;
  if (abs >= 1e6) return `${neg}Rp${fmt1(abs / 1e6)} jt`;
  if (abs >= 1e3) return `${neg}Rp${fmt1(abs / 1e3)} rb`;
  return `${neg}Rp${abs.toLocaleString("id-ID")}`;
}

export function num(n: number, digits = 0) {
  return (Number.isFinite(n) ? n : 0).toLocaleString("id-ID", { maximumFractionDigits: digits, minimumFractionDigits: 0 });
}

export function pct(n: number, digits = 0) {
  return `${num(Number.isFinite(n) ? n : 0, digits)}%`;
}

/** Parse a user-typed amount like "25.000", "25,000", "Rp 25.000,50", "25rb", "1,5jt". */
export function parseAmountInput(raw: string): number {
  if (!raw) return 0;
  let s = String(raw).toLowerCase().replace(/rp|idr|\s/g, "");
  let mult = 1;
  if (/(jt|juta)$/.test(s)) {
    mult = 1_000_000;
    s = s.replace(/(jt|juta)$/, "");
  } else if (/(rb|ribu|k)$/.test(s)) {
    mult = 1_000;
    s = s.replace(/(rb|ribu|k)$/, "");
  }
  if (mult > 1) {
    s = s.replace(",", ".");
    const v = parseFloat(s);
    return Number.isFinite(v) ? Math.round(v * mult) : 0;
  }
  return normalizeNumber(s);
}

/** Normalize Indonesian/English formatted numbers into a number. */
export function normalizeNumber(s: string): number {
  let x = s.replace(/[^\d.,-]/g, "");
  if (!x) return 0;
  const lastDot = x.lastIndexOf(".");
  const lastComma = x.lastIndexOf(",");
  if (lastDot >= 0 && lastComma >= 0) {
    // the later separator is the decimal separator
    if (lastComma > lastDot) x = x.replace(/\./g, "").replace(",", ".");
    else x = x.replace(/,/g, "");
  } else if (lastComma >= 0) {
    // "25,000" (thousands) vs "25,5" (decimal)
    const decimals = x.length - lastComma - 1;
    x = decimals === 3 || (x.match(/,/g)?.length ?? 0) > 1 ? x.replace(/,/g, "") : x.replace(",", ".");
  } else if (lastDot >= 0) {
    const decimals = x.length - lastDot - 1;
    x = decimals === 3 || (x.match(/\./g)?.length ?? 0) > 1 ? x.replace(/\./g, "") : x;
  }
  const v = parseFloat(x);
  return Number.isFinite(v) ? Math.round(v * 100) / 100 : 0;
}

export function uid(prefix = "") {
  const rnd =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().replace(/-/g, "").slice(0, 16)
      : Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
  return prefix + rnd;
}

export function cn(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(" ");
}

export function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

export function normalizeKey(s: string) {
  return (s || "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
