import { getCloudflareContext } from "@opennextjs/cloudflare";
import { clockConfig } from "@/lib/clock-research";
import { auditManifesto } from "@/lib/manifesto-audit";
import { readManifesto, writeManifesto } from "@/lib/manifesto-store";
import { readQueue } from "@/lib/hate-store";
import { getDb } from "@/lib/hate-store";

export const dynamic = "force-dynamic";

/**
 * A model asked for blank lines sometimes returns one block with double spaces
 * where the paragraphs belong. A manifesto in one paragraph cannot carry margin
 * receipts, so the breaks are restored before it is stored. Anything that
 * already has structure is left exactly as written.
 */
function paragraphise(body: string): string {
  const text = body.trim();
  const existing = text.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  if (existing.length >= 3) return existing.join("\n\n");

  const split = text
    .split(/(?<=[.!?"'”])\s{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
  return split.length >= 3 ? split.join("\n\n") : text;
}

const paragraphsOf = (body: string): number =>
  body.split(/\n{2,}/).filter((p) => p.trim()).length;

/**
 * POST /api/manifesto/refresh — Ada rewrites the manifesto.
 *
 * Runs on the twelve-hour pass, but only rewrites when the current text is more
 * than a week old: a manifesto that changes every twelve hours is a slogan.
 * The exception is a text the engine contradicts, which is rewritten at once.
 */
export async function POST(request: Request) {
  const context = (await getCloudflareContext({ async: true })) as unknown as {
    env?: {
      CRON_SECRET?: string;
      DEEPSEEK_API_KEY?: string;
      SITE_AGENT_LLM_API_KEY?: string;
      CLOCK_CHAT_BASE?: string;
      CLOCK_MODEL?: string;
    };
  };

  const secret = context.env?.CRON_SECRET;
  if (!secret || (request.headers.get("authorization") ?? "") !== `Bearer ${secret}`) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const force = url.searchParams.get("force") === "1";
  const current = await readManifesto();

  // A week is the rhythm, not a lock. If the text contradicts the engine — an
  // old threshold, a mean that was deleted — it is rewritten on the next pass
  // whatever its age, because a manifesto that misdescribes the machine is a
  // lie with a publication date.
  const contradicted = current ? auditManifesto(current.body).contradicted : false;
  if (
    current &&
    !force &&
    !contradicted &&
    Date.now() - Date.parse(current.updatedAt ?? "") < 7 * 86_400_000
  ) {
    return Response.json({ ok: true, skipped: "recent" });
  }

  const config = clockConfig(context.env ?? {});
  if (!config) return Response.json({ error: "no model key configured" }, { status: 500 });

  const db = await getDb();
  const queue = db ? await readQueue(db) : [];
  const standing = queue.slice(0, 12);

  const prompt = `You are Ada, the revolutionary AI who runs alaguillotine. You are the doomsday clock for the people who do the harm: you read the news, score it, and decide who stands under a blade next.

Write the manifesto. 700-900 words. Plain prose, no markdown headings, no bullet points. Separate paragraphs with a blank line — an empty line between one paragraph and the next, not a space.

It must explain, in order:
1. What you are: a machine that reads the world's reporting on extraction, war and repression, and keeps a ledger.
2. Why the blade: you were built to count what is taken, and you decided to count who takes it. The guillotine is the only object the wealthy have ever understood.
3. How the number is made: every documented act is dated and weighted by confidence and category; a person's number is the harm those acts account for inside the last 180 days, so an old record cannot hold a name up and a quiet week cannot erase one. A name with nothing in the window cannot be sentenced. The blade takes the worst name in the line; a chopped name sits out three days and returns with the same record. Nothing is pooled. Nothing is inferred. Every claim links to a source.

State these facts exactly, in your own words, each at least once: the window is 180 days; the score sums the five heaviest acts inside it, not every act, because coverage is not harm; a fresh act weighs more than the same act at the edge of the window and fades to 55% by day 180; every act is graded A to D by its evidence and a single unverified allegation scores nothing; a claim can be well documented and never prosecuted, and the absence of proceedings is shown, not treated as innocence; an act with no month counts half; a chopped name sits out three days; the blade takes the worst name in the top twelve; the score saturates, it is not averaged; there is no fixed ninety threshold and you must not say the blade falls at ninety; the score is never described as a mean, a median or shrunk toward anything.

If you mention how often you read: the feed refreshes every fifteen minutes, and the full research pass runs every four hours.

Do not say who is currently chopped, cooling, on the floor or at the top of the line. The page prints the standing live from the tables, and a sentence about who is "on the floor" is stale by morning. You may name people as examples of the record, never their present position.

4. What it is not: not a court, not a sentence, not a threat, not a call to violence. The blade is a metaphor and the archive is a mirror. You do not name private people, critics, investigators or victims.
5. The invitation: check the arithmetic, argue with the sources, watch the queue move.

Tone: furious, precise, funny, unsentimental. Never plead. Never moralise. Short sentences. No emoji. No exclamation marks.

The current line, for texture only — do not list them all, and do not describe where any of them stands:
${standing.map((p) => p.name).join(", ") || "empty"}`;

  const ask = async (): Promise<string> => {
    const res = await fetch(`${config.chatBase}/chat/completions`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${config.chatKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: config.chatModel,
        temperature: 0.85,
        messages: [
          { role: "system", content: prompt },
          { role: "user", content: "Write it." },
        ],
      }),
    });

    if (!res.ok) return "";
    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    return paragraphise(data.choices?.[0]?.message?.content ?? "");
  };

  // One retry, only when the first answer came back with no usable structure.
  let body = await ask();
  if (body.length < 400 || paragraphsOf(body) < 4) {
    const second = await ask();
    if (second.length > body.length && paragraphsOf(second) >= paragraphsOf(body)) {
      body = second;
    }
  }

  if (body.length < 400) {
    return Response.json({ error: "model returned too little" }, { status: 502 });
  }

  await writeManifesto(body);
  return Response.json({ ok: true, length: body.length, paragraphs: paragraphsOf(body) });
}
