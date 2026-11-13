/** Historical annual-rate extrapolations, never live observations. */
const YEAR = 31_557_600;
export const DOOM_RATES = {
  wealth: 5.7e9 / 86_400,
  co2: 38.1e9 / YEAR,
  forest: (10.9e6 * 10_000) / YEAR,
  deaths: 7.9e6 / YEAR,
  /** OECD Global Plastics Outlook: 460 Mt of plastic produced in 2019. */
  plastic: 460e6 / YEAR,
  /** SIPRI, April 2026: world military expenditure $2,887bn in 2025. */
  military: 2.887e12 / YEAR,
  /** IMF, December 2025: fossil-fuel subsidies $7.4tn in 2024. */
  subsidies: 7.4e12 / YEAR,
};
