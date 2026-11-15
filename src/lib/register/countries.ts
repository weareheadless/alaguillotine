/**
 * Country labels for the bodies we enumerate.
 *
 * The European Parliament's API returns ISO 3166-1 alpha-2 codes; the register
 * stores the label a reader recognises. The list is the twenty-seven member
 * states plus the United Kingdom, which the API still includes because it keeps
 * historical membership. It is deliberately a map and not a lookup service: a
 * connector that cannot name a country should say so, not invent one.
 */
export const COUNTRY_LABELS: Record<string, string> = {
  AT: "Austria",
  BE: "Belgium",
  BG: "Bulgaria",
  CY: "Cyprus",
  CZ: "Czechia",
  DE: "Germany",
  DK: "Denmark",
  EE: "Estonia",
  ES: "Spain",
  FI: "Finland",
  FR: "France",
  GR: "Greece",
  HR: "Croatia",
  HU: "Hungary",
  IE: "Ireland",
  IT: "Italy",
  LT: "Lithuania",
  LU: "Luxembourg",
  LV: "Latvia",
  MT: "Malta",
  NL: "Netherlands",
  PL: "Poland",
  PT: "Portugal",
  RO: "Romania",
  SE: "Sweden",
  SI: "Slovenia",
  SK: "Slovakia",
  UK: "United Kingdom",
};

export function countryLabel(code: string): string {
  return COUNTRY_LABELS[code] ?? code;
}
