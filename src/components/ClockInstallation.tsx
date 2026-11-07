"use client";

import { DoomsdayClock, useClock } from "./DoomsdayClock";
import { RageStack } from "./RageStack";

/**
 * The installation: one reading, one blade, one stack.
 * The fetch lives here so the dial and the stack can never disagree.
 */
export function ClockInstallation() {
  const { state, pulls, pull } = useClock();

  return (
    <>
      <DoomsdayClock state={state} pulls={pulls} />
      <RageStack items={state.items} onPull={pull} />
    </>
  );
}
