import type { FeedMessage } from "./types";
import { DEFAULT_CONTENT } from "./content";

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

export function generateMockMessages(count: number, authors: string[], texts: string[]): FeedMessage[] {
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
      text: texts[Math.floor(seededRandom(seed * 3) * texts.length)],
      author_name: authors[Math.floor(seededRandom(seed * 5) * authors.length)],
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
export function getDemoMessages(
  authors = DEFAULT_CONTENT.demoMessages.authors,
  texts = DEFAULT_CONTENT.demoMessages.texts
): FeedMessage[] {
  return generateMockMessages(42, authors, texts);
}
