/**
 * What a stored figure is worth, and in what.
 *
 * The desk holds figures as written: "$10B+" was stored as 10 with the unit
 * "USD billions", "£670M" as 670 with "million GBP". Reading the number without
 * the unit drew ten dollars where the record said ten billion, and left a page
 * that looked empty. So the unit is read here, once, and never guessed at
 * again.
 *
 * A figure whose unit is not money (deaths, workers, percent) returns null: it
 * does not belong on the money axis, and mixing it in is the oldest lie in the
 * form.
 */

const SCALES: Array<[RegExp, number]> = [
  [/\btrillion\b/i, 1e12],
  [/\bbillion(s)?\b/i, 1e9],
  [/\bbn\b/i, 1e9],
  [/\bcrore\b/i, 1e7],
  [/\bmillion(s)?\b/i, 1e6],
  [/\blakh\b/i, 1e5],
  [/\bthousand\b/i, 1e3],
];

/** The currency a unit string names, in its three-letter form. */
const CURRENCIES: Array<[RegExp, string]> = [
  [/\bUSD\b|\bdollars?\b|\$/i, "USD"],
  [/\bEUR\b|\beuros?\b|€/i, "EUR"],
  [/\bGBP\b|\bpounds?\b|£/i, "GBP"],
  [/\bILS\b|\bshekels?\b|₪/i, "ILS"],
  [/\bINR\b|\brupees?\b/i, "INR"],
  [/\bAED\b|\bdirhams?\b/i, "AED"],
  [/\bUAH\b|\bhryvnia\b/i, "UAH"],
  [/\bRUB\b|\brubles?\b/i, "RUB"],
  [/\bMXN\b|\bpesos?\b/i, "MXN"],
  [/\bYER\b|\brials?\b/i, "YER"],
];

const NON_MONEY = /\b(deaths?|people|persons?|soldiers?|casualties|workers|vessels|strikes|children|years?|percent|%|counts?|tons?)\b/i;

export interface Money {
  /** In base units of the currency. */
  amount: number;
  currency: string;
}

export function moneyOf(value: number | null | undefined, unit: string): Money | null {
  if (value == null || !Number.isFinite(value)) return null;
  const u = String(unit ?? "").trim();
  if (!u || NON_MONEY.test(u)) return null;

  let currency = "USD";
  let named = false;
  for (const [re, code] of CURRENCIES) {
    if (re.test(u)) {
      currency = code;
      named = true;
      break;
    }
  }
  // A bare "$" or "€" in the unit counts as named; a unit that is only a scale
  // ("billion") inherits the dollar, which is what the desk stores by default.
  if (!named && !SCALES.some(([re]) => re.test(u))) return null;

  let scale = 1;
  for (const [re, factor] of SCALES) {
    if (re.test(u)) {
      scale = factor;
      break;
    }
  }
  return { amount: value * scale, currency };
}

/** The currency most of these figures are in, or null when there are none. */
export function dominantCurrency(units: string[]): string | null {
  const counts = new Map<string, number>();
  for (const u of units) {
    const m = moneyOf(1, u);
    if (!m) continue;
    counts.set(m.currency, (counts.get(m.currency) ?? 0) + 1);
  }
  let best: string | null = null;
  let n = 0;
  for (const [cur, c] of counts) {
    if (c > n) {
      best = cur;
      n = c;
    }
  }
  return best;
}

export function currencySign(currency: string): string {
  if (currency === "EUR") return "€";
  if (currency === "GBP") return "£";
  if (currency === "ILS") return "₪";
  if (currency === "INR") return "₹";
  return "$";
}

export function formatMoney(amount: number, currency: string): string {
  const sign = currencySign(currency);
  const v = Math.abs(amount);
  if (v >= 1e12) return `${sign}${(amount / 1e12).toFixed(v >= 1e13 ? 0 : 1)}T`;
  if (v >= 1e9) return `${sign}${(amount / 1e9).toFixed(v >= 1e10 ? 1 : 2)}B`;
  if (v >= 1e6) return `${sign}${Math.round(amount / 1e6)}M`;
  if (v >= 1e3) return `${sign}${Math.round(amount / 1e3)}k`;
  return `${sign}${Math.round(amount)}`;
}
