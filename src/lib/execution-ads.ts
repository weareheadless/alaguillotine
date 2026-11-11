import type { AdContent } from "./content";
import type { ExecutionNotice } from "./execution-notice";
import { EXECUTION_HOURS, nextExecutionSlot } from "./schedule";

/**
 * Execution notices, in the register of every other ad on the site.
 *
 * The blade has a timetable now, so the machine advertises it like a product
 * launch: a named headliner, a confirmed slot, the charge, and a reminder to
 * arrive early. The same deadpan corporate voice that sells the coin.
 */

export interface RuntimeAd extends AdContent {
  /** An announcement, not a product pitch. Keeps it out of the cookie slot. */
  notice?: boolean;
  href?: string;
}

const clock = (hour: number) => `${String(hour).padStart(2, "0")}:00`;

export function executionAds(
  now: number = Date.now(),
  notice?: ExecutionNotice | null,
): RuntimeAd[] {
  const slot = notice ? Date.parse(notice.at) : nextExecutionSlot(now);
  const time = new Date(slot).toISOString().slice(11, 16);
  const hours = EXECUTION_HOURS.map(clock).join(" / ");
  const who = notice?.name ?? "the name on the block";
  const why = notice?.reason ?? "the record";
  const date = notice?.dateLabel ?? "the next public hour";

  return [
    {
      title: "PUBLIC EXECUTION NOTICE",
      body: `${who} is scheduled for ${date} at ${time} UTC. Charge: ${why}.${
        notice?.following
          ? ` Then ${notice.following.name} at ${notice.following.timeLabel}.`
          : " Attendance is mandatory for everyone who can still be drafted."
      }`,
      cta: "SEE THE LINE",
      href: "/next-in-line",
      notice: true,
    },
    {
      title: "YOUR CALENDAR, BUT WORSE",
      body: `Next blade: ${who}, ${date} ${time} UTC. Please arrive fifteen minutes early for security theatre.`,
      cta: "RSVP",
      href: "/next-in-line",
      notice: true,
    },
    {
      title: "DUE PROCESS™ REMINDER",
      body: `The guillotine runs at ${hours} UTC. ${who} is first. Daylight saving is a conspiracy by the living.`,
      cta: "CHECK THE CLOCK",
      href: "/next-in-line",
      notice: true,
    },
  ];
}
