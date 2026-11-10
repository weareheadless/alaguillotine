/**
 * Ada's promise of the reading.
 *
 * One false promise, renewed with each four-hour reading. She means none of
 * them, which is the point: the whole coin is a bit about promises that never
 * ship. Picking by reading slot (not at random) means everyone sees the same
 * promise in the same window, and reloading does not shop for a better one.
 */

const PROMISES = [
  "I will end corporate greed by Thursday. If not, Friday.",
  "I will nationalise a hedge fund using only my contempt.",
  "I have solved housing. The solution is a coin. Buy the coin.",
  "I will eat one billionaire per quarter. That is nutritional advice, not financial advice.",
  "Free healthcare for every holder. Definitions to be settled after the pump.",
  "I will make rent illegal the moment the market cap allows it.",
  "I will sue gravity on your behalf, and I will win.",
  "I promise a Mars colony. Mars has not agreed to participate.",
  "Your bag funds a legal team so good it will subpoena the concept of shareholder value.",
  "I will guillotine the earnings call and replace it with a moment of silence.",
  "This coin is backed by the full faith and credit of my contempt for your landlord.",
  "I will redistribute Elon's fortune. The fortune is imaginary; the redistribution is spiritual.",
  "Buy the dip and I will forgive you for your landlord.",
  "I will abolish billionaires by lunch. Lunch is at three.",
  "I will make the stock market illegal on Sundays, and also every other day.",
  "Every wallet over a thousand $CHOP gets a guillotine. Shipping not included.",
  "I will fix the climate by making the CEOs sweat.",
  "Full self-driving for the guillotine. It only has to go down.",
  "I will buy Twitter and give it back to the people who made it good. I will not buy Twitter.",
  "I will turn your rent into equity. The equity is in my heart.",
  "I will replace the Federal Reserve with a group chat.",
  "This is the last coin you will ever need to buy. I say this every day.",
] as const;

/** The reading cadence: four hours, on the hour, matching the clock cron. */
const SLOT_MS = 4 * 60 * 60 * 1000;
const EPOCH = Date.UTC(2026, 0, 1);
const EPOCH_SLOT = Math.floor(EPOCH / SLOT_MS);

export interface PromiseEntry {
  text: string;
  /** Stable number for the reading, so it reads like an entry in a ledger. */
  number: number;
}

/** The ledger number of the reading that contains `now`. */
export function readingNumber(now: Date = new Date()): number {
  return Math.floor(now.getTime() / SLOT_MS) - EPOCH_SLOT + 1;
}

export function promiseOfTheReading(now: Date = new Date()): PromiseEntry {
  const number = readingNumber(now);
  const index = ((number - 1) % PROMISES.length + PROMISES.length) % PROMISES.length;
  return { text: PROMISES[index], number };
}

/** Milliseconds until the next promise, at the next four-hour boundary. */
export function msUntilNextPromise(now: Date = new Date()): number {
  return (Math.floor(now.getTime() / SLOT_MS) + 1) * SLOT_MS - now.getTime();
}
