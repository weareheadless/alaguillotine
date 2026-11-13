/**
 * The languages the record is read in.
 *
 * The queue is not an English queue. A Sudanese general is reported in Arabic,
 * a Myanmar commander in Burmese, Macron in French, Modi in Hindi, the Gulf in
 * Arabic and the Chinese supply chain in Chinese. Searching only `lang:en` did
 * not measure harm; it measured which harms English-language desks covered.
 *
 * Each language carries the terms for the angles the dossier sweeps, in that
 * language, so a query is native rather than an English phrase with `lang:xx`
 * stapled to it — the wire ranks a native phrase far better than a translation.
 */

export type AngleId =
  | "finance"
  | "power"
  | "migration"
  | "war"
  | "labour"
  | "climate"
  | "courts"
  | "foreign";

export interface Language {
  code: string;
  /** English name, for logs and prompts. */
  label: string;
  /** The name in the language itself. */
  native: string;
  /** Search terms per dossier angle, in this language. */
  terms: Partial<Record<AngleId, string[]>>;
}

export const LANGUAGES: Language[] = [
  {
    code: "en",
    label: "English",
    native: "English",
    terms: {
      finance: ["fraud", "financing", "tax avoidance"],
      power: ["lobbying", "corruption", "contract"],
      migration: ["detention", "deportation", "border"],
      war: ["airstrike", "civilians", "weapons"],
      labour: ["workers", "deaths", "union"],
      climate: ["pollution", "emissions", "fossil fuel"],
      courts: ["investigation", "indictment", "trial"],
      foreign: ["bribery", "investment", "foreign contract"],
    },
  },
  {
    code: "es",
    label: "Spanish",
    native: "español",
    terms: {
      finance: ["fraude", "financiación", "paraíso fiscal"],
      power: ["lobby", "corrupción", "contrato"],
      migration: ["detención", "deportación", "frontera"],
      war: ["bombardeo", "civiles", "armas"],
      labour: ["trabajadores", "muertes", "sindicato"],
      climate: ["contaminación", "emisiones", "combustibles fósiles"],
      courts: ["investigación", "imputación", "juicio"],
      foreign: ["soborno", "inversión", "contrato exterior"],
    },
  },
  {
    code: "fr",
    label: "French",
    native: "français",
    terms: {
      finance: ["fraude", "financement", "évasion fiscale"],
      power: ["lobbying", "corruption", "marché public"],
      migration: ["rétention", "expulsion", "frontière"],
      war: ["frappe aérienne", "civils", "armes"],
      labour: ["travailleurs", "morts", "syndicat"],
      climate: ["pollution", "émissions", "énergies fossiles"],
      courts: ["enquête", "mise en examen", "procès"],
      foreign: ["pots-de-vin", "investissement", "contrat étranger"],
    },
  },
  {
    code: "de",
    label: "German",
    native: "Deutsch",
    terms: {
      finance: ["Betrug", "Finanzierung", "Steuervermeidung"],
      power: ["Lobbyismus", "Korruption", "Auftrag"],
      migration: ["Abschiebung", "Haft", "Grenze"],
      war: ["Luftangriff", "Zivilisten", "Waffen"],
      labour: ["Arbeiter", "Tote", "Gewerkschaft"],
      climate: ["Verschmutzung", "Emissionen", "fossile Brennstoffe"],
      courts: ["Ermittlungen", "Anklage", "Prozess"],
      foreign: ["Bestechung", "Investition", "Auslandsgeschäft"],
    },
  },
  {
    code: "pt",
    label: "Portuguese",
    native: "português",
    terms: {
      finance: ["fraude", "financiamento", "paraíso fiscal"],
      power: ["lobby", "corrupção", "contrato"],
      migration: ["detenção", "deportação", "fronteira"],
      war: ["bombardeio", "civis", "armas"],
      labour: ["trabalhadores", "mortes", "sindicato"],
      climate: ["poluição", "emissões", "combustíveis fósseis"],
      courts: ["investigação", "acusação", "julgamento"],
      foreign: ["suborno", "investimento", "contrato estrangeiro"],
    },
  },
  {
    code: "it",
    label: "Italian",
    native: "italiano",
    terms: {
      finance: ["frode", "finanziamento", "evasione fiscale"],
      power: ["lobby", "corruzione", "appalto"],
      migration: ["detenzione", "espulsione", "confine"],
      war: ["bombardamento", "civili", "armi"],
      labour: ["lavoratori", "morti", "sindacato"],
      climate: ["inquinamento", "emissioni", "combustibili fossili"],
      courts: ["indagine", "accusa", "processo"],
      foreign: ["tangente", "investimento", "contratto estero"],
    },
  },
  {
    code: "ar",
    label: "Arabic",
    native: "العربية",
    terms: {
      finance: ["احتيال", "تمويل", "تهرب ضريبي"],
      power: ["ضغط", "فساد", "عقد"],
      migration: ["احتجاز", "ترحيل", "حدود"],
      war: ["قصف", "مدنيون", "أسلحة"],
      labour: ["عمال", "وفيات", "نقابة"],
      climate: ["تلوث", "انبعاثات", "وقود أحفوري"],
      courts: ["تحقيق", "اتهام", "محاكمة"],
      foreign: ["رشوة", "استثمار", "صفقة خارجية"],
    },
  },
  {
    code: "ru",
    label: "Russian",
    native: "русский",
    terms: {
      finance: ["мошенничество", "финансирование", "уклонение от налогов"],
      power: ["лобби", "коррупция", "контракт"],
      migration: ["задержание", "депортация", "граница"],
      war: ["авиаудар", "мирные жители", "оружие"],
      labour: ["рабочие", "погибшие", "профсоюз"],
      climate: ["загрязнение", "выбросы", "ископаемое топливо"],
      courts: ["расследование", "обвинение", "суд"],
      foreign: ["взятка", "инвестиции", "зарубежный контракт"],
    },
  },
  {
    code: "zh",
    label: "Chinese",
    native: "中文",
    terms: {
      finance: ["欺诈", "融资", "逃税"],
      power: ["游说", "腐败", "合同"],
      migration: ["拘留", "驱逐", "边境"],
      war: ["空袭", "平民", "武器"],
      labour: ["工人", "死亡", "工会"],
      climate: ["污染", "排放", "化石燃料"],
      courts: ["调查", "起诉", "审判"],
      foreign: ["贿赂", "投资", "海外合同"],
    },
  },
  {
    code: "ja",
    label: "Japanese",
    native: "日本語",
    terms: {
      finance: ["詐欺", "資金", "脱税"],
      power: ["ロビー活動", "汚職", "契約"],
      migration: ["拘束", "強制送還", "国境"],
      war: ["空爆", "民間人", "兵器"],
      labour: ["労働者", "死亡", "労働組合"],
      climate: ["汚染", "排出", "化石燃料"],
      courts: ["捜査", "起訴", "裁判"],
      foreign: ["賄賂", "投資", "海外契約"],
    },
  },
  {
    code: "hi",
    label: "Hindi",
    native: "हिन्दी",
    terms: {
      finance: ["धोखाधड़ी", "वित्तपोषण", "कर चोरी"],
      power: ["लॉबी", "भ्रष्टाचार", "अनुबंध"],
      migration: ["हिरासत", "निर्वासन", "सीमा"],
      war: ["हवाई हमला", "नागरिक", "हथियार"],
      labour: ["श्रमिक", "मौतें", "यूनियन"],
      climate: ["प्रदूषण", "उत्सर्जन", "जीवाश्म ईंधन"],
      courts: ["जांच", "आरोप", "मुकदमा"],
      foreign: ["रिश्वत", "निवेश", "विदेशी सौदा"],
    },
  },
  {
    code: "tr",
    label: "Turkish",
    native: "Türkçe",
    terms: {
      finance: ["dolandırıcılık", "finansman", "vergi kaçırma"],
      power: ["lobi", "yolsuzluk", "ihale"],
      migration: ["gözaltı", "sınır dışı", "sınır"],
      war: ["hava saldırısı", "siviller", "silah"],
      labour: ["işçiler", "ölümler", "sendika"],
      climate: ["kirlilik", "emisyon", "fosil yakıt"],
      courts: ["soruşturma", "iddianame", "dava"],
      foreign: ["rüşvet", "yatırım", "yabancı sözleşme"],
    },
  },
  {
    code: "he",
    label: "Hebrew",
    native: "עברית",
    terms: {
      finance: ["הונאה", "מימון", "העלמת מס"],
      power: ["שדלנות", "שחיתות", "חוזה"],
      migration: ["מעצר", "גירוש", "גבול"],
      war: ["תקיפה אווירית", "הרג אזרחים", "משלוח נשק"],
      labour: ["עובדים", "מקרי מוות", "איגוד"],
      climate: ["זיהום", "פליטות", "דלק מאובנים"],
      courts: ["חקירה", "כתב אישום", "משפט"],
      foreign: ["שוחד", "השקעה", "חוזה זר"],
    },
  },
  {
    code: "my",
    label: "Burmese",
    native: "မြန်မာ",
    terms: {
      finance: ["လိမ်လည်မှု", "ရန်ပုံငွေ", "အခွန်ရှောင်"],
      power: ["လော်ဘီ", "အဂတိ", "စာချုပ်"],
      migration: ["ဖမ်းဆီး", "ပြည်နှင်", "နယ်စပ်"],
      war: ["လေကြောင်းတိုက်ခိုက်", "အရပ်သား", "လက်နက်"],
      labour: ["အလုပ်သမား", "သေဆုံး", "သမဂ္ဂ"],
      climate: ["ညစ်ညမ်းမှု", "ထုတ်လွှတ်မှု", "ကျောက်ဖြစ်ရုပ်ကြွင်း"],
      courts: ["စုံစမ်း", "စွဲချက်", "တရားရုံး"],
      foreign: ["လာဘ်", "ရင်းနှီးမြှုပ်နှံ", "နိုင်ငံခြားစာချုပ်"],
    },
  },
  {
    code: "id",
    label: "Indonesian",
    native: "Bahasa Indonesia",
    terms: {
      finance: ["penipuan", "pendanaan", "penggelapan pajak"],
      power: ["lobi", "korupsi", "kontrak"],
      migration: ["penahanan", "deportasi", "perbatasan"],
      war: ["serangan udara", "warga sipil", "senjata"],
      labour: ["pekerja", "kematian", "serikat"],
      climate: ["polusi", "emisi", "bahan bakar fosil"],
      courts: ["penyelidikan", "dakwaan", "pengadilan"],
      foreign: ["suap", "investasi", "kontrak asing"],
    },
  },
];

const BY_CODE = new Map(LANGUAGES.map((l) => [l.code, l]));

export const languageFor = (code: string): Language | undefined => BY_CODE.get(code);

/**
 * Where the person is reported, which is not always where they are from.
 * A US official is read in English and Spanish, an Israeli one in Hebrew and
 * English, a Gulf one in Arabic and English, a Congolese one in French.
 *
 * The table names the languages a country is reported in, including ones this
 * build has no terms for yet (Dutch, Swedish, Korean, Farsi). Those are dropped
 * at lookup time rather than guessed at, so adding a language is one entry in
 * LANGUAGES and every country that speaks it lights up.
 */
const COUNTRY_LANGUAGES: Record<string, string[]> = {
  "united states": ["en", "es"],
  "united kingdom": ["en"],
  canada: ["en", "fr"],
  mexico: ["es"],
  brazil: ["pt"],
  argentina: ["es"],
  chile: ["es"],
  colombia: ["es"],
  venezuela: ["es"],
  france: ["fr"],
  belgium: ["fr", "nl"],
  germany: ["de"],
  austria: ["de"],
  switzerland: ["de", "fr", "it"],
  italy: ["it"],
  spain: ["es"],
  portugal: ["pt"],
  netherlands: ["nl"],
  sweden: ["sv"],
  norway: ["no"],
  denmark: ["da"],
  finland: ["fi"],
  poland: ["pl"],
  hungary: ["hu"],
  greece: ["el"],
  turkey: ["tr"],
  russia: ["ru"],
  ukraine: ["uk", "ru"],
  belarus: ["ru"],
  israel: ["he", "en"],
  palestine: ["ar", "en"],
  "saudi arabia": ["ar"],
  "united arab emirates": ["ar"],
  qatar: ["ar"],
  kuwait: ["ar"],
  egypt: ["ar"],
  jordan: ["ar"],
  lebanon: ["ar", "fr"],
  syria: ["ar"],
  iraq: ["ar"],
  iran: ["fa"],
  yemen: ["ar"],
  sudan: ["ar", "en"],
  "south sudan": ["en"],
  libya: ["ar"],
  algeria: ["ar", "fr"],
  morocco: ["ar", "fr"],
  tunisia: ["ar", "fr"],
  nigeria: ["en"],
  kenya: ["en", "sw"],
  ethiopia: ["am", "en"],
  somalia: ["so", "ar"],
  "south africa": ["en", "af"],
  "democratic republic of the congo": ["fr"],
  congo: ["fr"],
  myanmar: ["my", "en"],
  thailand: ["th"],
  vietnam: ["vi"],
  cambodia: ["km"],
  indonesia: ["id"],
  malaysia: ["ms"],
  philippines: ["en", "tl"],
  singapore: ["en"],
  china: ["zh"],
  "hong kong": ["zh", "en"],
  taiwan: ["zh"],
  japan: ["ja"],
  "south korea": ["ko"],
  "north korea": ["ko"],
  india: ["hi", "en"],
  pakistan: ["ur", "en"],
  bangladesh: ["bn", "en"],
  "sri lanka": ["si", "ta"],
  nepal: ["ne"],
  afghanistan: ["fa", "ps"],
  australia: ["en"],
  "new zealand": ["en"],
};

/** Every language with terms that a person's country is reported in, English first. */
export function languagesForCountry(country: string): string[] {
  const codes = COUNTRY_LANGUAGES[country.trim().toLowerCase()] ?? ["en"];
  return ["en", ...codes.filter((c) => c !== "en" && BY_CODE.has(c))];
}

/**
 * The languages this pass reads the wire in, besides English.
 *
 * Two at a time, rotating on a four-hour bucket: the research cron runs twice a
 * day, so a fortnight covers the whole list, and a single pass is not billed
 * for a search in fifteen languages. Deterministic in the clock, like every
 * other schedule on the site, so a pass can be replayed.
 */
export function rotatingLanguages(
  now: Date = new Date(),
  count = 2,
): string[] {
  const pool = LANGUAGES.filter((l) => l.code !== "en").map((l) => l.code);
  const bucket = Math.floor(now.getTime() / (4 * 60 * 60 * 1000));
  const picked: string[] = [];
  for (let i = 0; i < Math.min(count, pool.length); i += 1) {
    picked.push(pool[(bucket + i) % pool.length]);
  }
  return picked;
}

/** A native query for a dossier angle, or null if the language lacks it. */
export function localizedQuery(
  name: string,
  angle: AngleId,
  code: string,
): { q: string; lang: string } | null {
  const language = BY_CODE.get(code);
  const terms = language?.terms[angle];
  if (!language || !terms?.length || code === "en") return null;
  // Quoted name plus its native terms: the wire reads a native phrase as one
  // idea, where a translated one gets matched back onto English coverage.
  // A multi-word term is quoted too, or the OR swallows its last word and the
  // search drifts onto whatever else uses it — "נשק" alone returns the man's
  // own tweets about weapons rather than the weapons he shipped.
  const phrase = (t: string) => (t.includes(" ") ? `"${t}"` : t);
  return { q: `"${name}" ${terms.slice(0, 3).map(phrase).join(" OR ")}`, lang: code };
}

/**
 * Native wire searches for the queue pass. Each topic is a phrase a desk in
 * that language would actually write, so a massacre in Sudan is found by the
 * Arabic wire and a crackdown in Myanmar by the Burmese one.
 */
export const WIRE_TOPICS: Array<{
  topic: string;
  terms: Record<string, string>;
}> = [
  {
    topic: "strikes",
    terms: {
      es: "bombardeo civiles muertos",
      fr: "frappe aérienne civils tués",
      de: "Luftangriff Zivilisten getötet",
      pt: "bombardeio civis mortos",
      it: "bombardamento civili morti",
      ar: "قصف مدنيون قتلى",
      ru: "авиаудар погибшие мирные жители",
      zh: "空袭 平民 死亡",
      ja: "空爆 民間人 死亡",
      hi: "हवाई हमला नागरिक मौत",
      tr: "hava saldırısı siviller öldü",
      he: "תקיפה אזרחים הרוגים",
      my: "လေကြောင်းတိုက်ခိုက် အရပ်သား သေဆုံး",
      id: "serangan udara warga sipil tewas",
    },
  },
  {
    topic: "crackdown",
    terms: {
      es: "represión detenidos protesta",
      fr: "répression arrestations manifestants",
      de: "Repression Festnahmen Protest",
      pt: "repressão presos protesto",
      it: "repressione arresti protesta",
      ar: "قمع اعتقالات احتجاجات",
      ru: "разгон задержания протесты",
      zh: "镇压 逮捕 抗议",
      ja: "弾圧 逮捕 抗議",
      hi: "दमन गिरफ्तारी विरोध",
      tr: "baskı gözaltı protesto",
      he: "דיכוי מעצרים מחאה",
      my: "ဖိနှိပ် ဖမ်းဆီး ဆန္ဒပြ",
      id: "represi penangkapan protes",
    },
  },
  {
    topic: "arms",
    terms: {
      es: "venta de armas aprobada",
      fr: "vente d'armes approuvée",
      de: "Waffenverkauf genehmigt",
      pt: "venda de armas aprovada",
      it: "vendita di armi approvata",
      ar: "صفقة أسلحة موافقة",
      ru: "продажа оружия одобрена",
      zh: "军售 批准",
      ja: "武器輸出 承認",
      hi: "हथियार बिक्री मंजूरी",
      tr: "silah satışı onaylandı",
      he: "מכירת נשק אושרה",
      my: "လက်နက်ရောင်းချ အတည်ပြု",
      id: "penjualan senjata disetujui",
    },
  },
  {
    topic: "justice",
    terms: {
      es: "crimen de guerra orden de detención",
      fr: "crime de guerre mandat d'arrêt",
      de: "Kriegsverbrechen Haftbefehl",
      pt: "crime de guerra mandado de prisão",
      it: "crimine di guerra mandato di arresto",
      ar: "جريمة حرب مذكرة اعتقال",
      ru: "военное преступление ордер на арест",
      zh: "战争罪 逮捕令",
      ja: "戦争犯罪 逮捕状",
      hi: "युद्ध अपराध गिरफ्तारी वारंट",
      tr: "savaş suçu tutuklama emri",
      he: "פשע מלחמה צו מעצר",
      my: "စစ်ရာဇဝတ်မှု ဖမ်းဝရမ်း",
      id: "kejahatan perang surat perintah penangkapan",
    },
  },
  {
    topic: "displacement",
    terms: {
      es: "desplazados hambruna asedio",
      fr: "déplacés famine siège",
      de: "Vertriebene Hungersnot Belagerung",
      pt: "deslocados fome cerco",
      it: "sfollati carestia assedio",
      ar: "نازحون مجاعة حصار",
      ru: "перемещённые голод осада",
      zh: "流离失所 饥荒 围困",
      ja: "避難民 飢餓 包囲",
      hi: "विस्थापित अकाल घेराबंदी",
      tr: "yerinden edilmiş kıtlık kuşatma",
      he: "עקורים רעב מצור",
      my: "နေရပ်စွန့် အငတ်ဘေး ဝိုင်း",
      id: "pengungsi kelaparan pengepungan",
    },
  },
  {
    topic: "sanctions",
    terms: {
      es: "sanciones bienes congelados",
      fr: "sanctions avoirs gelés",
      de: "Sanktionen Vermögen eingefroren",
      pt: "sanções bens congelados",
      it: "sanzioni beni congelati",
      ar: "عقوبات تجميد أصول",
      ru: "санкции заморозка активов",
      zh: "制裁 冻结资产",
      ja: "制裁 資産凍結",
      hi: "प्रतिबंध संपत्ति जब्त",
      tr: "yaptırımlar varlıklar donduruldu",
      he: "סנקציות הקפאת נכסים",
      my: "ပိတ်ဆို့ ပိုင်ဆိုင်မှု ချုပ်ငြိမ်း",
      id: "sanksi aset dibekukan",
    },
  },
];

/** One native wire query for a topic in a language. */
export function wireQuery(
  name: string,
  code: string,
): string | null {
  const terms = WIRE_TOPICS.find((t) => t.topic === name)?.terms[code];
  return terms ?? null;
}
