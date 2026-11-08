/**
 * The resistance lives in the forum, not in a local account.
 *
 * The forum takes no email, a human approves every signup, and one account
 * works across every thread and every fund proposal. There is nothing to sign
 * up for on this site any more.
 */
export function AuthButtons() {
  return (
    <a
      href="/forum"
      className="flex cursor-pointer items-center gap-2 border-2 border-black bg-spiteCrimson px-2 py-1 md:px-4 md:py-2 text-xs md:text-sm font-mono font-bold text-sheetWhite shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] md:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all hover:bg-black hover:text-hypeNeon active:translate-x-1 active:translate-y-1 active:shadow-none"
    >
      <svg
        className="h-3 w-3 md:h-4 md:w-4"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <circle cx="12" cy="8" r="4" />
        <path d="M20 21a8 8 0 1 0-16 0" />
      </svg>
      <span className="hidden xl:inline">Join the Resistance</span>
      <span className="inline xl:hidden">Join</span>
    </a>
  );
}