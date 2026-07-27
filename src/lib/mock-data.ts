import type { FeedMessage } from "./types";

const FAKE_AUTHORS = [
  "CryptoBro420",
  "DiamondHands99",
  "ElonSimp69",
  "MoonLambo",
  "Anonymous Whale",
  "DogeFather",
  "SatoshisGhost",
  "WenLambo",
  "NGMI_bro",
  "PaperHandsDetector",
  "BasedChad",
  "StonksOnlyUp",
  "RugPullSurvivor",
  "HODL_4_Life",
  "WAGMI_FREN",
];

const MESSAGE_TEXTS = [
  "Elon tweeting about Doge again like it's 2021 💀",
  "Bro really paid $44B just to ruin a website lmao",
  "Can't wait for the Cybertruck to get recalled again",
  "Imagine simping for a guy who can't even spell his kid's name right",
  "Falcon 9 landing was cool. Everything else about him is embarrassing.",
  "Dude really thinks he's Tony Stark but he's just a rich 4chan user",
  "$420.69 well spent to say F you Elon 🫡",
  "The hyperloop was literally just a tunnel with Teslas in it. We got scammed.",
  "How many failed predictions until people stop listening?",
  "Bought Twitter, fired everyone, broke it. Genius move.",
  "His fanboys defending him in the replies are more entertaining than Netflix",
  "Remember when he called that diver a pedo? Peak billionaire behavior.",
  "Just watched a Cybertruck get stuck in 1 inch of snow. Space-grade engineering.",
  "Bro tweets 'interesting' 40 times a day and thinks he's a philosopher",
  "Neuralink: putting chips in monkey brains. What could go wrong?",
  "The Boring Company sounds like a euphemism for Elon's personality",
  "Solar roof tiles: promised 2016, delivered: bankruptcy",
  "His best product is convincing people he's a genius",
  "FSD coming 'next year' — every year since 2015",
  "You can buy a blue check but you can't buy self-awareness",
  "Optimus robot: $20K for a glorified Roomba that can wave",
  "My portfolio is down but at least I'm not an Elon simp",
  "Dude names his kid X Æ A-12 and expects us to take him seriously",
  "Stock went up? Genius. Stock went down? Short sellers. Never his fault.",
  "The only thing he's successfully launched recently is a bad take",
  "Mars colony by 2024... wait 2026... wait 2030...",
  "This message cost me money and I regret nothing 🍿",
  "Flamethrowers, submarines, cave rescues — bro thinks he's Batman",
  "His Twitter feed reads like a midlife crisis in real time",
  "If he spent half as much on R&D as he does on memes we'd have flying cars",
  "Every Tesla I see now just makes me think of that awkward SNL appearance",
  "SpaceX engineers deserve the credit. Elon just RTs the animations.",
  "Bro said 'funding secured' and the SEC still lets him tweet. Wild.",
  "His entire personality is just 'look at this cool thing my employees made'",
  "420.69 SOL to tell Elon what we really think. Worth every lamport.",
];

function randInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateId() {
  return Array.from({ length: 20 }, () =>
    "abcdef0123456789"[Math.floor(Math.random() * 16)]
  ).join("");
}

// Deterministic seed based on index so it's stable across renders
function seededRandom(seed: number) {
  const x = Math.sin(seed * 9301 + 49297) * 233280;
  return x - Math.floor(x);
}

export function generateMockMessages(count: number): FeedMessage[] {
  const messages: FeedMessage[] = [];

  for (let i = 0; i < count; i++) {
    const seed = i;
    const isPaid = i < Math.floor(count * 0.2); // First 20% are paid
    const daysAgo = Math.floor(seededRandom(seed * 7) * 7);
    const hoursAgo = Math.floor(seededRandom(seed * 13) * 23);
    const minsAgo = Math.floor(seededRandom(seed * 17) * 59);
    const created = new Date();
    created.setDate(created.getDate() - daysAgo);
    created.setHours(created.getHours() - hoursAgo);
    created.setMinutes(created.getMinutes() - minsAgo);

    messages.push({
      $id: generateId(),
      text: MESSAGE_TEXTS[Math.floor(seededRandom(seed * 3) * MESSAGE_TEXTS.length)],
      author_name: FAKE_AUTHORS[Math.floor(seededRandom(seed * 5) * FAKE_AUTHORS.length)],
      author_id: null,
      amount_paid: isPaid ? Math.floor(seededRandom(seed * 11) * 416) + 5 + 0.69 : 0,
      is_shadowbanned: seededRandom(seed * 19) < 0.05, // 5% shadowbanned
      parent_id: null,
      created_at: created.toISOString(),
    });
  }

  // Sort: paid by amount desc, then by date desc
  return messages.sort((a, b) => {
    if (a.amount_paid !== b.amount_paid) return b.amount_paid - a.amount_paid;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });
}

// Generate a stable set of demo messages
let _cachedMessages: FeedMessage[] | null = null;
export function getDemoMessages(): FeedMessage[] {
  if (!_cachedMessages) {
    _cachedMessages = generateMockMessages(42);
  }
  return _cachedMessages;
}
