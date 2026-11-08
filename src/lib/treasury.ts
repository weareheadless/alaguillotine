/**
 * The fund, as the chain sees it.
 *
 * The site never holds money and never signs anything. It shows a public
 * address and what is in it. Spending happens from a wallet the site cannot
 * touch, and every grant is posted with its receipt in the forum.
 *
 * Balances are read in the browser: the official public RPC blocks datacenter
 * egress, so a Worker-side read would either fail or lie. The forum strip is
 * read server-side from the forum's public API.
 */

export const FUND_WALLET =
  process.env.NEXT_PUBLIC_SOLANA_RECEIVER_WALLET ||
  "HA4ms5uXaT23EQ5Xp28RcQLNSBkR6Vwg7rH21HhAMuQG";

export const CHOP_MINT =
  process.env.NEXT_PUBLIC_CHOP_MINT ||
  "6gup5Cper6pmfNfsGps3MizgpsG3q6uvzobGdUFapump";

export const CHOP_DECIMALS = Number(
  process.env.NEXT_PUBLIC_CHOP_DECIMALS || "6",
);

/**
 * The fund's associated token account for $CHOP.
 *
 * Deterministic from FUND_WALLET + CHOP_MINT, so it never changes. Reading it
 * directly keeps the balance read a plain `getAccountInfo` instead of the
 * indexed `getTokenAccountsByOwner`, which the free public nodes refuse.
 */
export const CHOP_ACCOUNT = "5Xfyf4iuUm8wXuozyupgtwa7EZ2A7eFTK7gPXPQ7YduQ";
