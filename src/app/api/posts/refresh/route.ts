import { getCloudflareContext } from "@opennextjs/cloudflare";
import { clockConfig } from "@/lib/clock-research";
import { getDb, readClock } from "@/lib/clock-store";
import { lastDispatchAt, saveDispatch } from "@/lib/posts-store";

export const dynamic = "force-dynamic";

/**
 * POST /api/posts/refresh — Ada writes the dispatch.
 *
 * Runs on the twelve-hour pass. One piece per pass, built from the current
 * reading. If she has written in the last twenty hours, this is a no-op.
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

  const config = clockConfig(context.env ?? {});
  if (!config) return Response.json({ error: "no model key configured" }, { status: 500 });

  const last = await lastDispatchAt();
  if (last && Date.now() - Date.parse(last) < 20 * 60 * 60 * 1000) {
    return Response.json({ ok: true, skipped: "recent dispatch" });
  }

  const db = await getDb();
  if (!db) return Response.json({ error: "D1 binding unavailable" }, { status: 500 });

  const reading = await readClock(db);
  if (!reading) return Response.json({ error: "no clock reading yet" }, { status: 409 });

  const material = reading.items
    .slice(0, 10)
    .map((i) => `- ${i.headline} (${i.source}) ${i.fact}`)
    .join("\n");

  const res = await fetch(`${config.chatBase}/chat/completions`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${config.chatKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: config.chatModel,
      temperature: 0.8,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `You are Ada, writing a dispatch for alaguillotine — a satirical installation that counts what the rich take and what it costs everyone else.

Write 350-500 words. First person, furious, precise, funny. No moralising, no pleading, no throat-clearing. Open with the number that made you angriest. Name the mechanism, not just the villain. End with something the reader can check.

Use ONLY the supplied items. Never invent a number, name or event.

Return JSON only: {"title":"max 80 chars","dek":"one sentence, max 140 chars","body":"markdown-free prose, paragraphs separated by blank lines"}`,
        },
        {
          role: "user",
          content: `The clock reads ${reading.level}. Composite ${reading.composite}. Items:\n${material}`,
        },
      ],
    }),
  });

  if (!res.ok) {
    return Response.json({ error: "model call failed" }, { status: 502 });
  }

  const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const parsed = JSON.parse(data.choices?.[0]?.message?.content || "{}") as {
    title?: string;
    dek?: string;
    body?: string;
  };

  if (!parsed.title || !parsed.body) {
    return Response.json({ error: "model returned no dispatch" }, { status: 502 });
  }

  const now = new Date();
  const slug = `${now.toISOString().slice(0, 10)}-${parsed.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48)}`;

  await saveDispatch({
    slug,
    title: parsed.title.slice(0, 90),
    dek: (parsed.dek ?? "").slice(0, 200),
    body: parsed.body.slice(0, 8000),
    publishedAt: now.toISOString(),
  });

  return Response.json({ ok: true, slug });
}
