import type { AdContent } from "./content";
import { EXECUTION_HOURS, nextExecutionSlot } from "./schedule";

/**
 * Execution notices, in the register of every other ad on the site.
 *
 * The blade has a timetable now, so the machine advertises it like a product
 * launch: a confirmed slot, a reminder to arrive early, and the same deadpan
 * corporate voice that sells the coin.
 */

export interface RuntimeAd extends AdContent {
  /** An announcement, not a product pitch. Keeps it out of the cookie slot. */
  notice?: boolean;
  href?: string;
}

const clock = (hour: number) => `${String(hour).padStart(2, "0")}:00`;

export function executionAds(now: number = Date.now()): RuntimeAd[] {
  const slot = nextExecutionSlot(now);
  const time = new Date(slot).toISOString().slice(11, 16);
  const hours = EXECUTION_HOURS.map(clock).join(" / ");

  return [
    {
      title: "PUBLIC EXECUTION NOTICE",
      body: `The ${time} UTC blade is confirmed. Attendance is mandatory for everyone who can still be drafted.`,
      cta: "SEE THE LINE",
      href: "/next-in-line",
      notice: true,
    },
    {
      title: "YOUR CALENDAR, BUT WORSE",
      body: `Next blade ${time} UTC. Please arrive fifteen minutes early for security theatre.`,
      cta: "RSVP",
      href: "/next-in-line",
      notice: true,
    },
    {
      title: "DUE PROCESS™ REMINDER",
      body: `The guillotine runs at ${hours} UTC. Daylight saving is a conspiracy by the living.`,
      cta: "CHECK THE CLOCK",
      href: "/next-in-line",
      notice: true,
    },
  ];
}
