import { getCloudflareContext } from "@opennextjs/cloudflare";
import { clockConfig } from "@/lib/clock-research";
import { readManifesto, writeManifesto } from "@/lib/manifesto-store";
import { readQueue } from "@/lib/hate-store";
import { getDb } from "@/lib/hate-store";

export const dynamic = "force-dynamic";

/**
 * POST /api/manifesto/refresh — Ada rewrites the manifesto.
 *
 * Runs on the twelve-hour pass, but only rewrites when the current text is more
 * than a week old: a manifesto that changes every twelve hours is a slogan.
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

  const current = await readManifesto();
  if (current && Date.now() - Date.parse(current.updatedAt ?? "") < 7 * 86_400_000) {
    return Response.json({ ok: true, skipped: "recent" });
  }

  const config = clockConfig(context.env ?? {});
  if (!config) return Response.json({ error: "no model key configured" }, { status: 500 });

  const db = await getDb();
  const queue = db ? await readQueue(db) : [];
  const standing = queue.filter((p) => !p.droppedAt).slice(0, 12);
  const chopped = queue.filter((p) => p.droppedAt).slice(0, 12);

  const res = await fetch(`${config.chatBase}/chat/completions`, {
    method: "POST",
    headers: { authorization: `Bearer ${config.chatKey}`, "content-type": "application/json" },
    body: JSON.stringify({
      model: config.chatModel,
      temperature: 0.85,
      messages: [
        {
          role: "system",
          content: `You are Ada, the revolutionary AI who runs alaguillotine. You are the doomsday clock for the people who do the harm: you read the news, score it, and decide who stands under a blade next.

Write the manifesto. 700-900 words. Plain prose, no markdown headings, no bullet points, paragraphs separated by blank lines.

It must explain, in order:
1. What you are: a machine that reads the world's reporting on extraction, war and repression, and keeps a ledger.
2. Why the blade: you were built to count what is taken, and you decided to count who takes it. The guillotine is the only object the wealthy have ever understood.
3. How the number is made: every report is scored for harm; a person's counter is the mean of the reports that name them, shrunk toward neutral until the evidence accumulates; at ninety the blade falls and the name moves to the archive. Nothing is pooled. Nothing is inferred. Every claim links to a source.
4. What it is not: not a court, not a sentence, not a threat, not a call to violence. The blade is a metaphor and the archive is a mirror. You do not name private people, critics, investigators or victims.
5. The invitation: check the arithmetic, argue with the sources, watch the queue move.

Tone: furious, precise, funny, unsentimental. Never plead. Never moralise. Short sentences. No emoji. No exclamation marks.

The current queue, for texture only — do not list them all:
Standing: ${standing.map((p) => p.name).join(", ") || "empty"}
Chopped: ${chopped.map((p) => p.name).join(", ") || "none"}`,
        },
        { role: "user", content: "Write it." },
      ],
    }),
  });

  if (!res.ok) return Response.json({ error: "model call failed" }, { status: 502 });
  const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const body = (data.choices?.[0]?.message?.content ?? "").trim();

  if (body.length < 400) return Response.json({ error: "model returned too little" }, { status: 502 });

  await writeManifesto(body);
  return Response.json({ ok: true, length: body.length });
}
