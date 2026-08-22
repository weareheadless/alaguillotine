"use client";

import { useState } from "react";
import {
  Empty,
  ErrorBox,
  Loading,
  Pill,
  Section,
  Stat,
  useAdmin,
} from "@/components/admin/admin-ui";

type ArchitectureNode = {
  id: string;
  label: string;
  kind: string;
  lane: string;
  summary: string;
  paths: string[];
  trust: string;
  tags: string[];
  position: { x: number; y: number };
};

type ArchitectureEdge = {
  id: string;
  source: string;
  target: string;
  label: string;
  kind: string;
  guard?: string;
};

type ArchitectureBoundary = {
  id: string;
  label: string;
  description: string;
  node_ids: string[];
  tone: string;
};

type ArchitectureFlow = {
  id: string;
  label: string;
  description: string;
  steps: string[];
  tone: string;
};

type ArchitectureEndpoint = {
  method: string;
  path: string;
  owner: string;
  auth: string;
  mutates: boolean;
  description: string;
};

type ArchitecturePayload = {
  schema_version: number;
  registry_version: string;
  title: string;
  summary: string;
  source: {
    module: string;
    documentation: string;
    api: string;
    generated: boolean;
    inferred_code_graph: boolean;
  };
  diagram: {
    view_box: { width: number; height: number };
    node_width: number;
    node_height: number;
    lanes: string[];
  };
  nodes: ArchitectureNode[];
  edges: ArchitectureEdge[];
  boundaries: ArchitectureBoundary[];
  flows: ArchitectureFlow[];
  endpoints: ArchitectureEndpoint[];
  notes: string[];
};

const KIND_COLORS: Record<string, { stroke: string; fill: string }> = {
  actor: { stroke: "#a1a1aa", fill: "#18181b" },
  entry: { stroke: "#38bdf8", fill: "#082f49" },
  decision: { stroke: "#f59e0b", fill: "#451a03" },
  control: { stroke: "#22c55e", fill: "#052e16" },
  guard: { stroke: "#c084fc", fill: "#2e1065" },
  capability: { stroke: "#f472b6", fill: "#500724" },
  store: { stroke: "#64748b", fill: "#1e293b" },
  external: { stroke: "#fb7185", fill: "#450a0a" },
};

function labelLines(label: string): string[] {
  const words = label.split(" ");
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (current && next.length > 20 && lines.length < 2) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  if (current) lines.push(current);
  return lines.slice(0, 2);
}

function focusButton(active: boolean): string {
  return active
    ? "border-hypeNeon bg-hypeNeon/10 text-hypeNeon"
    : "border-glitchGray text-chop-muted hover:border-sheetWhite hover:text-sheetWhite";
}

export function AdminArchitecture() {
  const { data, loading, error, refetch } = useAdmin<ArchitecturePayload>(
    "/api/admin/proxy/architecture",
  );
  const [selectedId, setSelectedId] = useState("consciousness");
  const [kindFilter, setKindFilter] = useState("all");
  const [flowId, setFlowId] = useState<string | null>(null);

  if (loading && !data) return <Loading />;
  if (error && !data) return <ErrorBox msg={error} onRetry={refetch} />;
  if (!data) return <Empty msg="architecture registry is empty" />;

  const nodeById = new Map(data.nodes.map((node) => [node.id, node]));
  const selected = nodeById.get(selectedId) ?? data.nodes[0];
  const activeFlow = data.flows.find((flow) => flow.id === flowId) ?? null;
  const focusIds = activeFlow ? new Set(activeFlow.steps) : null;
  const visibleNodes = data.nodes.filter(
    (node) => kindFilter === "all" || node.kind === kindFilter,
  );
  const visibleIds = new Set(visibleNodes.map((node) => node.id));
  const visibleEdges = data.edges.filter(
    (edge) => visibleIds.has(edge.source) && visibleIds.has(edge.target),
  );
  const connectedEdges = data.edges.filter(
    (edge) => edge.source === selected?.id || edge.target === selected?.id,
  );
  const selectedTrustTone =
    selected?.trust === "untrusted"
      ? "red"
      : selected?.trust === "gated"
        ? "yellow"
        : selected?.trust === "external"
          ? "white"
          : "green";
  const kinds = [...new Set(data.nodes.map((node) => node.kind))];
  const nodeWidth = data.diagram.node_width;
  const nodeHeight = data.diagram.node_height;

  return (
    <div className="space-y-4">
      <Section
        title="Architecture registry"
        sub={`registry ${data.registry_version} · read-only contract · source: ${data.source.module}`}
        right={
          <button
            onClick={refetch}
            className="border border-glitchGray px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-chop-muted hover:border-hypeNeon hover:text-hypeNeon"
          >
            refresh
          </button>
        }
      >
        <p className="max-w-4xl text-sm leading-relaxed text-sheetWhite/80">{data.summary}</p>
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat k="nodes" v={data.nodes.length} tone="text-hypeNeon" />
          <Stat k="connections" v={data.edges.length} tone="text-sky-300" />
          <Stat k="boundaries" v={data.boundaries.length} tone="text-amber-400" />
          <Stat k="http surfaces" v={data.endpoints.length} tone="text-fuchsia-300" />
        </div>
        <div className="mt-3 flex flex-wrap gap-2 text-[10px] uppercase tracking-wider text-chop-muted">
          <Pill tone="green">curated</Pill>
          <Pill tone="gray">secret-free</Pill>
          <Pill tone="yellow">not live telemetry</Pill>
          <span className="self-center">docs: {data.source.documentation}</span>
        </div>
      </Section>

      <Section
        title="Control plane map"
        sub="Select a node for ownership and trust details. Filter by kind or highlight a verified request flow."
      >
        <div className="mb-3 flex flex-wrap gap-2">
          {[
            { id: "all", label: "all nodes" },
            ...kinds.map((kind) => ({ id: kind, label: kind })),
          ].map((filter) => (
            <button
              key={filter.id}
              onClick={() => setKindFilter(filter.id)}
              className={`border px-2 py-1 text-[10px] font-bold uppercase tracking-wider ${focusButton(kindFilter === filter.id)}`}
            >
              {filter.label}
            </button>
          ))}
        </div>
        <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
          <button
            onClick={() => setFlowId(null)}
            className={`shrink-0 border px-2 py-1 text-[10px] font-bold uppercase tracking-wider ${focusButton(!flowId)}`}
          >
            no flow focus
          </button>
          {data.flows.map((flow) => (
            <button
              key={flow.id}
              onClick={() => setFlowId(flow.id)}
              className={`shrink-0 border px-2 py-1 text-[10px] font-bold uppercase tracking-wider ${focusButton(flowId === flow.id)}`}
            >
              {flow.label}
            </button>
          ))}
        </div>
        <div className="overflow-x-auto border-2 border-glitchGray bg-black p-2">
          <svg
            viewBox={`0 0 ${data.diagram.view_box.width} ${data.diagram.view_box.height}`}
            className="min-w-[960px]"
            role="img"
            aria-label="Ada architecture control plane diagram"
          >
            <defs>
              <marker id="architecture-arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
                <path d="M0,0 L8,4 L0,8 z" fill="#71717a" />
              </marker>
            </defs>
            {visibleEdges.map((edge) => {
              const source = nodeById.get(edge.source);
              const target = nodeById.get(edge.target);
              if (!source || !target) return null;
              const active =
                !focusIds || (focusIds.has(edge.source) && focusIds.has(edge.target));
              const selectedEdge =
                selected?.id === edge.source || selected?.id === edge.target;
              const sourceX = source.position.x + nodeWidth / 2;
              const sourceY = source.position.y + nodeHeight / 2;
              const targetX = target.position.x + nodeWidth / 2;
              const targetY = target.position.y + nodeHeight / 2;
              const midX = (sourceX + targetX) / 2;
              return (
                <g key={edge.id} opacity={active ? (selectedEdge ? 0.95 : 0.48) : 0.08}>
                  <path
                    d={`M ${sourceX} ${sourceY} C ${midX} ${sourceY}, ${midX} ${targetY}, ${targetX} ${targetY}`}
                    fill="none"
                    stroke={selectedEdge ? "#22c55e" : "#52525b"}
                    strokeWidth={selectedEdge ? 2 : 1}
                    markerEnd="url(#architecture-arrow)"
                  />
                </g>
              );
            })}
            {data.nodes.map((node) => {
              const visible = visibleIds.has(node.id);
              const focused = !focusIds || focusIds.has(node.id);
              const selectedNode = node.id === selected?.id;
              const colors = KIND_COLORS[node.kind] ?? KIND_COLORS.actor;
              const lines = labelLines(node.label);
              return (
                <g
                  key={node.id}
                  className="cursor-pointer"
                  opacity={!visible ? 0.05 : focused ? 1 : 0.22}
                  onClick={() => visible && setSelectedId(node.id)}
                  role="button"
                  tabIndex={visible ? 0 : -1}
                  aria-label={`${node.label}: ${node.summary}`}
                  onKeyDown={(event) => {
                    if (visible && (event.key === "Enter" || event.key === " ")) {
                      event.preventDefault();
                      setSelectedId(node.id);
                    }
                  }}
                >
                  <rect
                    x={node.position.x}
                    y={node.position.y}
                    width={nodeWidth}
                    height={nodeHeight}
                    rx="2"
                    fill={colors.fill}
                    stroke={selectedNode ? "#fef08a" : colors.stroke}
                    strokeWidth={selectedNode ? 3 : 1.5}
                  />
                  <text
                    x={node.position.x + nodeWidth / 2}
                    y={node.position.y + 22}
                    fill="#fafafa"
                    fontSize="12"
                    fontWeight="700"
                    textAnchor="middle"
                  >
                    {lines.map((line, index) => (
                      <tspan key={line} x={node.position.x + nodeWidth / 2} dy={index ? 14 : 0}>
                        {line}
                      </tspan>
                    ))}
                  </text>
                  <text
                    x={node.position.x + nodeWidth / 2}
                    y={node.position.y + nodeHeight - 10}
                    fill={colors.stroke}
                    fontSize="8"
                    fontWeight="700"
                    letterSpacing="1"
                    textAnchor="middle"
                  >
                    {node.kind.toUpperCase()} · {node.trust.toUpperCase()}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-[10px] uppercase tracking-wider text-chop-muted">
          {Object.entries(KIND_COLORS).map(([kind, colors]) => (
            <span key={kind} className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2" style={{ backgroundColor: colors.stroke }} />
              {kind}
            </span>
          ))}
        </div>
      </Section>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
        <Section
          title={selected ? selected.label : "Selected node"}
          sub={selected ? `${selected.kind} · ${selected.lane}` : "Choose a node from the map"}
        >
          {selected ? (
            <div className="space-y-3">
              <p className="text-sm leading-relaxed text-sheetWhite/80">{selected.summary}</p>
              <div className="flex flex-wrap gap-2">
                <Pill tone={selectedTrustTone}>
                  {selected.trust}
                </Pill>
                {selected.tags.map((tag) => (
                  <Pill key={tag}>{tag}</Pill>
                ))}
              </div>
              <div>
                <h4 className="text-[10px] font-bold uppercase tracking-widest text-chop-muted">owned surfaces</h4>
                {selected.paths.length ? (
                  <ul className="mt-1 space-y-1 font-mono text-[11px] text-sky-200">
                    {selected.paths.map((path) => <li key={path}>{path}</li>)}
                  </ul>
                ) : (
                  <p className="mt-1 text-xs text-chop-muted">No file or endpoint path registered.</p>
                )}
              </div>
              <div>
                <h4 className="text-[10px] font-bold uppercase tracking-widest text-chop-muted">connections</h4>
                {connectedEdges.length ? (
                  <div className="mt-1 space-y-1 text-xs text-sheetWhite/80">
                    {connectedEdges.map((edge) => {
                      const other = edge.source === selected.id ? edge.target : edge.source;
                      return (
                        <button
                          key={edge.id}
                          onClick={() => setSelectedId(other)}
                          className="block text-left hover:text-hypeNeon"
                        >
                          <span className="font-mono text-sky-200">{edge.source === selected.id ? "→" : "←"} {other}</span>
                          <span className="ml-2 text-chop-muted">{edge.label}</span>
                          {edge.guard && <span className="ml-2 text-amber-300">[{edge.guard}]</span>}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <p className="mt-1 text-xs text-chop-muted">No registered connections.</p>
                )}
              </div>
            </div>
          ) : (
            <Empty msg="select a node" />
          )}
        </Section>

        <Section title="Focused flow" sub="The registry's verified request paths, not live execution telemetry.">
          {activeFlow ? (
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h4 className="font-bold text-hypeNeon">{activeFlow.label}</h4>
                  <p className="mt-1 text-xs leading-relaxed text-sheetWhite/70">{activeFlow.description}</p>
                </div>
                <Pill tone={activeFlow.tone === "red" ? "red" : activeFlow.tone === "purple" ? "white" : "green"}>flow</Pill>
              </div>
              <div className="space-y-1">
                {activeFlow.steps.map((step, index) => (
                  <button
                    key={step}
                    onClick={() => setSelectedId(step)}
                    className="flex w-full items-center gap-2 border border-transparent px-2 py-1 text-left text-xs hover:border-glitchGray"
                  >
                    <span className="w-5 font-mono text-[10px] text-chop-muted">{String(index + 1).padStart(2, "0")}</span>
                    <span className="font-mono text-sky-200">{step}</span>
                    {index < activeFlow.steps.length - 1 && <span className="ml-auto text-chop-muted">↓</span>}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <Empty msg="choose a flow above" />
          )}
        </Section>
      </div>

      <Section title="Boundaries and HTTP surface" sub="Security and ownership facts kept beside the diagram so they remain reviewable.">
        <div className="grid gap-3 lg:grid-cols-2">
          {data.boundaries.map((boundary) => (
            <button
              key={boundary.id}
              onClick={() => setSelectedId(boundary.node_ids[0])}
              className="border-2 border-glitchGray bg-black p-3 text-left hover:border-hypeNeon"
            >
              <div className="flex items-center justify-between gap-3">
                <h4 className="text-xs font-black uppercase tracking-wider text-sheetWhite">{boundary.label}</h4>
                <Pill tone={boundary.tone === "red" ? "red" : boundary.tone === "yellow" ? "yellow" : "gray"}>boundary</Pill>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-sheetWhite/70">{boundary.description}</p>
              <p className="mt-2 font-mono text-[10px] text-sky-200">{boundary.node_ids.join(" · ")}</p>
            </button>
          ))}
        </div>
        <div className="mt-4 overflow-x-auto border-2 border-glitchGray">
          <table className="w-full min-w-[760px] text-left text-xs">
            <thead className="border-b-2 border-glitchGray bg-black text-[10px] uppercase tracking-wider text-chop-muted">
              <tr>
                <th className="px-3 py-2">method</th>
                <th className="px-3 py-2">path</th>
                <th className="px-3 py-2">owner</th>
                <th className="px-3 py-2">auth</th>
                <th className="px-3 py-2">writes</th>
              </tr>
            </thead>
            <tbody>
              {data.endpoints.map((endpoint) => (
                <tr key={`${endpoint.method}-${endpoint.path}`} className="border-b border-glitchGray/60 last:border-0">
                  <td className="px-3 py-2 font-mono text-hypeNeon">{endpoint.method}</td>
                  <td className="px-3 py-2 font-mono text-sky-200">{endpoint.path}</td>
                  <td className="px-3 py-2 text-sheetWhite/80">{endpoint.owner}</td>
                  <td className="px-3 py-2 text-amber-300">{endpoint.auth}</td>
                  <td className={`px-3 py-2 font-bold uppercase ${endpoint.mutates ? "text-spiteCrimson" : "text-chop-muted"}`}>
                    {endpoint.mutates ? "yes" : "no"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="Registry notes" sub="What this view deliberately does not claim.">
        <ul className="space-y-1 text-xs leading-relaxed text-chop-muted">
          {data.notes.map((note) => <li key={note}>· {note}</li>)}
        </ul>
      </Section>
    </div>
  );
}
