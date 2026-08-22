"use client";

import { ErrorBox, JsonTree, Loading, Pill, Section, Stat, useAdmin } from "./admin-ui";

type Row = Record<string, unknown>;
type PoliciesResponse = { policies?: Row[] };
type RequestsResponse = { requests?: Row[] };

function value(row: Row, key: string, fallback = "-"): string {
  const item = row[key];
  return item === null || item === undefined || item === "" ? fallback : String(item);
}

function tone(status: string): "green" | "red" | "yellow" | "gray" {
  if (["active", "approved", "succeeded"].includes(status)) return "green";
  if (["denied", "failed", "blocked", "cancelled"].includes(status)) return "red";
  if (["pending", "requested"].includes(status)) return "yellow";
  return "gray";
}

export function AdminPermissions() {
  const policies = useAdmin<PoliciesResponse>("/api/admin/proxy/permissions/policies?active_only=false&limit=100", 15000);
  const requests = useAdmin<RequestsResponse>("/api/admin/proxy/permissions/requests?limit=100", 5000);
  if (policies.loading && !policies.data && requests.loading && !requests.data) return <Loading />;
  const error = policies.error || requests.error;
  if (error && !policies.data && !requests.data) return <ErrorBox msg={error} onRetry={() => { policies.refetch(); requests.refetch(); }} />;

  const policyRows = policies.data?.policies ?? [];
  const requestRows = requests.data?.requests ?? [];
  const pending = requestRows.filter((row) => value(row, "status") === "pending").length;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <Stat k="policies" v={policyRows.length} />
        <Stat k="requests" v={requestRows.length} />
        <Stat k="pending requests" v={<span className={pending ? "text-amber-400" : "text-chop-muted"}>{pending}</span>} />
      </div>
      <Section title="Permission requests" sub="requests are visible here; policy decisions remain fail-closed">
        {requestRows.length === 0 ? <p className="text-xs text-chop-muted">No permission requests recorded.</p> : (
          <div className="space-y-2">
            {requestRows.map((row) => {
              const status = value(row, "status");
              return (
                <article key={value(row, "id")} className="border border-glitchGray bg-black/60 p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-bold text-sheetWhite">{value(row, "capability")}</span>
                    <Pill tone={tone(status)}>{status}</Pill>
                    <span className="text-[10px] text-chop-muted">{value(row, "requested_by")}</span>
                  </div>
                  <div className="mt-1 grid gap-1 text-[10px] text-chop-muted sm:grid-cols-2">
                    <span>action: {value(row, "action")}</span>
                    <span>resource: {value(row, "resource")}</span>
                    <span>request: {value(row, "request_key")}</span>
                    <span>decided by: {value(row, "decided_by")}</span>
                  </div>
                  {row.reason ? <p className="mt-2 text-[11px] text-sheetWhite/90">{value(row, "reason")}</p> : null}
                </article>
              );
            })}
          </div>
        )}
      </Section>
      <Section title="Policy registry" sub="active and historical policy definitions">
        {policyRows.length === 0 ? <p className="text-xs text-chop-muted">No permission policies recorded.</p> : (
          <div className="space-y-2">
            {policyRows.map((row) => (
              <article key={value(row, "id")} className="border border-glitchGray bg-black/60 p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-bold text-sheetWhite">{value(row, "name", value(row, "policy_id"))}</span>
                  <Pill tone={row.active === false ? "gray" : "green"}>{row.active === false ? "inactive" : "active"}</Pill>
                  <span className="text-[10px] text-chop-muted">workspace: {value(row, "workspace_id")}</span>
                </div>
                {row.rules ? <div className="mt-2 border-t border-glitchGray/60 pt-2"><JsonTree data={row.rules} name="rules" /></div> : null}
              </article>
            ))}
          </div>
        )}
      </Section>
    </div>
  );
}
