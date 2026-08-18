"use client";

import { Section, Stat, Pill, Loading, ErrorBox, useAdmin, money, num, Empty } from "./admin-ui";

interface ChatLogData {
  conversations?: {
    ts?: number;
    when?: string;
    user_id?: string;
    msg?: string;
    reply?: string;
    cost?: number;
    flagged?: number;
  }[];
  stats?: { users?: number; messages?: number; attacks?: number; spend_today_usd?: number };
}

export function AdminChatLog() {
  const { data, loading, error, refetch } = useAdmin<ChatLogData>("/api/admin/proxy/chatlog?limit=60");
  if (loading && !data) return <Loading />;
  if (error && !data) return <ErrorBox msg={error} onRetry={refetch} />;
  if (!data) return null;

  const s = data.stats ?? {};
  const convos = data.conversations ?? [];

  return (
    <div className="space-y-4">
      <Section title="Public chat — live stats" sub="chat.db · the widget">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat k="users" v={num(s.users)} />
          <Stat k="messages" v={num(s.messages)} />
          <Stat k="attacks (injection attempts)" v={<span className={Number(s.attacks) > 0 ? "text-spiteCrimson" : "text-hypeNeon"}>{num(s.attacks)}</span>} />
          <Stat k="spend today" v={money(s.spend_today_usd)} />
        </div>
        <p className="mt-3 text-[11px] text-chop-muted">
          the widget runs on a separate model, a 10 msgs/day/person cap, a
          $1/day global cap, and a regex injection filter — this feed is what
          she reads back when deciding what to learn.
        </p>
      </Section>

      <Section title="Recent public exchanges" sub="most recent first">
        {convos.length === 0 ? (
          <Empty msg="no public conversations yet" />
        ) : (
          <ul className="space-y-3">
            {convos.map((c, i) => (
              <li key={i} className="border border-glitchGray/60 bg-black/50 p-3">
                <div className="flex items-center gap-2 text-[10px] text-chop-muted">
                  <span>{c.when}</span>
                  <span className="truncate font-mono">{c.user_id}</span>
                  {c.flagged === 1 && <Pill tone="red">flagged</Pill>}
                  <span className="ml-auto">{money(c.cost)}</span>
                </div>
                <p className="mt-1.5 text-xs text-sheetWhite/90">
                  <span className="font-bold uppercase text-hypeNeon">them:</span> {c.msg}
                </p>
                <p className="mt-1 text-xs leading-relaxed text-sheetWhite/70">
                  <span className="font-bold uppercase text-spiteCrimson">her:</span> {c.reply}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}
