"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  BackgroundVariant,
  MiniMap,
  useNodesState,
  useReactFlow,
  type Node,
  type NodeChange,
  type NodeMouseHandler,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import CollectorNode from "@/components/CollectorNode";
import MiddlewareNode from "@/components/MiddlewareNode";
import ServerGroupNode, { type ServerGroupNodeData } from "@/components/ServerGroupNode";
import ZoneNode from "@/components/ZoneNode";
import FloatingEdge from "@/components/FloatingEdge";
import DirectedSmoothEdge from "@/components/DirectedSmoothEdge";
import { toast } from "sonner";
import { useCollectors } from "@/lib/collectorsContext";
import { STATUS_META, MIDDLEWARE, type Collector } from "@/lib/collectors";
import {
  buildNodes,
  buildEdges,
  edgeSignature,
  groupByServer,
  bandKey,
  type GraphView,
} from "@/lib/graphLayout";

const nodeTypes = {
  collector: CollectorNode,
  middleware: MiddlewareNode,
  serverGroup: ServerGroupNode,
  zone: ZoneNode,
};
const edgeTypes = { floating: FloatingEdge, directed: DirectedSmoothEdge };
const PRO_OPTIONS = { hideAttribution: true };
const FIT_VIEW_OPTIONS = { padding: 0.18 };
const MINIMAP_NODE_COLOR = (n: Node) => {
  if (n.type === "middleware") return "#38bdf8";
  if (n.type === "zone") {
    const accent = (n.data as { accent?: string }).accent;
    return accent === "#a78bfa" ? "#a78bfa" : "transparent"; // 가상 대역만 표시
  }
  if (n.type === "serverGroup") {
    const d = n.data as ServerGroupNodeData;
    if (d.kind === "collector" && (d as { virtual?: boolean }).virtual) return "#a78bfa";
    return STATUS_META[d.worst ?? "normal"].color;
  }
  const c = (n.data as { collector?: Collector }).collector;
  if (c?.virtual) return "#a78bfa";
  return STATUS_META[c?.status ?? "normal"].color;
};

const VIEWS: { v: GraphView; label: string; icon: string }[] = [
  { v: "all", label: "전체", icon: "🌐" },
  { v: "collector", label: "수집기 → 미들웨어", icon: "🖥️" },
  { v: "dbproc", label: "미들웨어 → DB프로시저", icon: "🗄️" },
];

function GraphInner() {
  const { collectors, resetNonce, focusId, focusNonce, mwOk, reset } = useCollectors();
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [collapsedBands, setCollapsedBands] = useState<Set<string>>(new Set());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [view, setView] = useState<GraphView>("all");

  const collectorsRef = useRef(collectors);
  collectorsRef.current = collectors;

  const { fitView } = useReactFlow();
  const [nodes, setNodes, onNodesChangeRaw] = useNodesState<Node>(
    buildNodes(collectorsRef.current, new Set(), "all", new Set())
  );
  const nodesRef = useRef(nodes);
  nodesRef.current = nodes;
  const animRef = useRef<number | null>(null);

  const onNodesChange = useCallback((changes: NodeChange<Node>[]) => onNodesChangeRaw(changes), [onNodesChangeRaw]);

  // 펼침/필터 변경 시 위치 보간 (노드+선 함께 부드럽게)
  const mountedRef = useRef(false);
  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      return;
    }
    if (animRef.current) cancelAnimationFrame(animRef.current);
    const target = buildNodes(collectorsRef.current, expanded, view, collapsedBands);
    const startPos = new Map(nodesRef.current.map((n) => [n.id, { ...n.position }]));
    const targetPos = new Map(target.map((n) => [n.id, { ...n.position }]));
    setNodes(target.map((n) => {
      const s = startPos.get(n.id);
      return s && !n.parentId ? { ...n, position: { ...s } } : n;
    }));
    const startT = performance.now();
    const dur = 720; // 펼침/접힘 위치 보간 — 더 느긋하게
    const step = (now: number) => {
      const t = Math.min(1, (now - startT) / dur);
      // ease-out-quint: 끝으로 갈수록 더 부드럽게 감속
      const e = 1 - Math.pow(1 - t, 5);
      setNodes((nds) =>
        nds.map((n) => {
          const s = startPos.get(n.id);
          const tp = targetPos.get(n.id);
          return s && tp && !n.parentId
            ? { ...n, position: { x: s.x + (tp.x - s.x) * e, y: s.y + (tp.y - s.y) * e } }
            : n;
        })
      );
      if (t < 1) animRef.current = requestAnimationFrame(step);
      else animRef.current = null;
    };
    animRef.current = requestAnimationFrame(step);
    // 펼치기/접기 시 카메라는 그대로 둠 (자동 축소/맞춤 없음) — 위치 보간만 부드럽게
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [expanded, view, collapsedBands, setNodes, fitView]);

  // 테이블 포커스 → 그룹 펼치고 이동
  const focusMounted = useRef(false);
  useEffect(() => {
    if (!focusMounted.current) {
      focusMounted.current = true;
      return;
    }
    if (!focusId) return;
    const c = collectorsRef.current.find((x) => x.id === focusId);
    if (!c) return;
    const key = c.kind === "dbproc" ? `proc:${c.externalIp}` : c.externalIp;
    setView("all");
    setSelectedId(focusId);
    setExpanded((prev) => (prev.has(key) ? prev : new Set(prev).add(key)));
    const t = setTimeout(() => {
      try {
        // 펼침 위치 보간(720ms)이 끝난 뒤 한 번만 부드럽게 줌 인 (자동 축소 없이 단일 이동)
        fitView({ nodes: [{ id: focusId }], duration: 1300, maxZoom: 1.4, padding: 3 });
      } catch {}
    }, 760);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusNonce]);

  // 최초 진입 시 통신 그래프 전체(모든 수집기)가 보이도록 축소(fit).
  // 그리드 레이아웃/노드 측정이 끝나는 시점이 가변적이라 여러 번 시도해 확실히 맞춤.
  useEffect(() => {
    const fit = () => {
      try {
        fitView({ padding: 0.08, duration: 500, minZoom: 0.02 });
      } catch {}
    };
    const timers = [120, 450, 900].map((ms) => setTimeout(fit, ms));
    return () => timers.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 초기화
  const resetMounted = useRef(false);
  useEffect(() => {
    if (!resetMounted.current) {
      resetMounted.current = true;
      return;
    }
    setSelectedId(null);
    setView("all");
    setExpanded(new Set());
  }, [resetNonce]);

  // 매 틱: 바뀐 노드 데이터만 패치
  useEffect(() => {
    const byId = new Map(collectors.map((c) => [c.id, c]));
    const healthy = collectors.filter((c) => c.status === "normal").length;
    // 그룹별 멤버 수 (단일 수집기는 항상 렌더되므로 패치 대상)
    const groupCount = new Map<string, number>();
    for (const c of collectors) {
      const k = c.kind === "dbproc" ? `proc:${c.externalIp}` : c.externalIp;
      groupCount.set(k, (groupCount.get(k) ?? 0) + 1);
    }
    setNodes((nds) =>
      nds.map((n) => {
        if (n.type === "collector") {
          const c = byId.get(n.id);
          if (!c) return n;
          // 접힌 그룹의 수집기 노드는 렌더되지 않음 → 패치 생략(성능). 단일 수집기는 항상 패치.
          const groupKey = c.kind === "dbproc" ? `proc:${c.externalIp}` : c.externalIp;
          const single = groupCount.get(groupKey) === 1;
          if (!single && !expanded.has(groupKey)) return n;
          return { ...n, data: { ...n.data, collector: c } };
        }
        if (n.type === "serverGroup") {
          const key = n.id.replace(/^grp-/, "");
          const members = collectors.filter((c) => (c.kind === "dbproc" ? `proc:${c.externalIp}` : c.externalIp) === key);
          if (!members.length) return n;
          const breakdown = { normal: 0, error: 0, offline: 0 } as ServerGroupNodeData["breakdown"];
          for (const m of members) breakdown[m.status]++;
          const d = n.data as ServerGroupNodeData;
          const worst = (["offline", "error", "normal"] as const).find((s) => breakdown[s] > 0) ?? "normal";
          const allHealthy = breakdown.normal === members.length;
          if (d.worst === worst && d.allHealthy === allHealthy && d.breakdown.normal === breakdown.normal && d.breakdown.error === breakdown.error && d.breakdown.offline === breakdown.offline)
            return n;
          return { ...n, data: { ...d, worst, allHealthy, breakdown, total: members.length } };
        }
        if (n.type === "middleware") {
          const d = n.data as { total: number; healthy: number; ok?: boolean };
          return d.healthy === healthy && d.total === collectors.length && d.ok === mwOk
            ? n
            : { ...n, data: { ...d, total: collectors.length, healthy, ok: mwOk } };
        }
        return n;
      })
    );
  }, [collectors, mwOk, setNodes, expanded]);

  const sig = edgeSignature(collectors, expanded, view, collapsedBands, selectedId);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const edges = useMemo(() => buildEdges(collectors, expanded, view, collapsedBands, selectedId), [sig]);

  const onNodeClick: NodeMouseHandler = useCallback((_, node) => {
    if (node.type === "zone" && node.id.startsWith("band-")) {
      setCollapsedBands((prev) => {
        const next = new Set(prev);
        next.has(node.id) ? next.delete(node.id) : next.add(node.id);
        return next;
      });
    } else if (node.type === "serverGroup") {
      const key = node.id.replace(/^grp-/, "");
      setExpanded((prev) => {
        const next = new Set(prev);
        next.has(key) ? next.delete(key) : next.add(key);
        return next;
      });
    } else if (node.type === "collector") setSelectedId(node.id);
  }, []);
  const onPaneClick = useCallback(() => setSelectedId(null), []);

  // 미니맵: 선택된 수집기의 통신 경로(수집기→그룹→대역→미들웨어)만 밝게, 나머지는 흐리게
  const minimapColor = useCallback(
    (n: Node) => {
      if (!selectedId) return MINIMAP_NODE_COLOR(n);
      const sel = collectorsRef.current.find((c) => c.id === selectedId);
      if (!sel) return MINIMAP_NODE_COLOR(n);
      const grpKey = sel.kind === "dbproc" ? `proc:${sel.externalIp}` : sel.externalIp;
      const onPath =
        n.id === selectedId ||
        n.id === `grp-${grpKey}` ||
        n.id === `band-${sel.kind}-${bandKey(sel.externalIp)}` ||
        n.type === "middleware";
      return onPath ? "#38bdf8" : "rgba(113,113,122,0.2)";
    },
    [selectedId]
  );
  // '전체 펼치기' 대상은 멤버 2개 이상 서버만 (단일 수집기는 박스가 없음)
  const groupKeys = useMemo(
    () => groupByServer(collectors).filter((g) => g.members.length > 1).map((g) => g.key),
    [collectors]
  );
  const selected = collectors.find((c) => c.id === selectedId) || null;
  const wrapRef = useRef<HTMLDivElement>(null);

  return (
    <div ref={wrapRef} className="relative h-full w-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        fitView
        fitViewOptions={FIT_VIEW_OPTIONS}
        minZoom={0.02}
        maxZoom={1.8}
        proOptions={PRO_OPTIONS}
        nodesConnectable={false}
        elementsSelectable
        onlyRenderVisibleElements
        // 성능: 불필요한 포커스/선택 승격 비용 제거
        nodesFocusable={false}
        edgesFocusable={false}
        elevateNodesOnSelect={false}
        elevateEdgesOnSelect={false}
      >
        <Background variant={BackgroundVariant.Dots} gap={22} size={1} color="var(--grid)" />
        {/* 미니맵: 드래그(패닝)/줌 비활성화 */}
        <MiniMap nodeColor={minimapColor} maskColor="rgba(9,9,11,0.6)" className="!bg-surface !border-line" />
      </ReactFlow>

      <MinimapPathOverlay selected={selected} containerRef={wrapRef} />

      {/* 필터 + 펼치기 + 초기화 */}
      <div className="pointer-events-none absolute left-3 top-3 flex flex-col gap-2">
        <div className="bg-surface border-line pointer-events-auto inline-flex gap-1 rounded-lg border p-1">
          {VIEWS.map(({ v, label, icon }) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-[11px] font-semibold transition ${
                view === v ? "bg-sky-500/20 text-sky-400" : "text-muted hover:bg-zinc-500/10"
              }`}
            >
              <span>{icon}</span>
              {label}
            </button>
          ))}
        </div>
        <div className="pointer-events-auto flex gap-2">
          <button
            onClick={() => setExpanded((p) => (p.size > 0 ? new Set() : new Set(groupKeys)))}
            className="bg-surface border-line text-muted w-fit rounded-lg border px-3 py-1.5 text-xs font-semibold transition hover:text-sky-400"
          >
            {expanded.size > 0 ? "📕 전체 접기" : "📖 전체 펼치기"}
          </button>
          <button
            onClick={() => {
              reset();
              toast.success("그래프·데이터 초기화됨");
            }}
            className="bg-surface border-line text-muted w-fit rounded-lg border px-3 py-1.5 text-xs font-semibold transition hover:text-red-400 active:scale-95"
          >
            ↺ 초기화
          </button>
        </div>
      </div>

    </div>
  );
}

// 미니맵 위에 선택 수집기의 실제 연결선(수집기→그룹→대역→미들웨어)을 SVG 오버레이로 그림.
// 미니맵 svg의 viewBox(=flow 좌표계)를 그대로 읽어 동일 좌표로 겹쳐 그려 노드와 정렬.
type MMBox = { left: number; top: number; width: number; height: number; viewBox: string; vbw: number; vbh: number; par: string };
function MinimapPathOverlay({
  selected,
  containerRef,
}: {
  selected: Collector | null;
  containerRef: React.RefObject<HTMLDivElement | null>;
}) {
  const { getInternalNode } = useReactFlow();
  const [box, setBox] = useState<MMBox | null>(null);
  const [pts, setPts] = useState<{ x: number; y: number }[]>([]);

  useEffect(() => {
    if (!selected) {
      setBox(null);
      setPts([]);
      return;
    }
    const grpKey = selected.kind === "dbproc" ? `proc:${selected.externalIp}` : selected.externalIp;
    const ids = [selected.id, `grp-${grpKey}`, `band-${selected.kind}-${bandKey(selected.externalIp)}`, MIDDLEWARE.id];
    let raf = 0;
    let lastBox = "";
    let lastPts = "";
    let lastRun = 0;
    const center = (id: string) => {
      const n = getInternalNode(id);
      if (!n) return null;
      const p = n.internals?.positionAbsolute ?? n.position;
      const w = n.measured?.width ?? n.width ?? 0;
      const h = n.measured?.height ?? n.height ?? 0;
      if (!w || !h) return null;
      return { x: p.x + w / 2, y: p.y + h / 2 };
    };
    const tick = (t: number) => {
      // ~16fps로 제한 (getBoundingClientRect 리플로우 비용 절감)
      if (t - lastRun < 60) {
        raf = requestAnimationFrame(tick);
        return;
      }
      lastRun = t;
      const mm = document.querySelector(".react-flow__minimap-svg") as SVGSVGElement | null;
      const cont = containerRef.current;
      if (mm && cont) {
        const mr = mm.getBoundingClientRect();
        const cr = cont.getBoundingClientRect();
        const vb = mm.viewBox.baseVal;
        const nb: MMBox = {
          left: mr.left - cr.left,
          top: mr.top - cr.top,
          width: mr.width,
          height: mr.height,
          viewBox: `${vb.x} ${vb.y} ${vb.width} ${vb.height}`,
          vbw: vb.width,
          vbh: vb.height,
          par: mm.getAttribute("preserveAspectRatio") || "xMidYMid meet",
        };
        const bs = JSON.stringify(nb);
        if (bs !== lastBox) {
          lastBox = bs;
          setBox(nb);
        }
      }
      const cs = ids.map(center).filter((v): v is { x: number; y: number } => !!v);
      const ps = JSON.stringify(cs);
      if (ps !== lastPts) {
        lastPts = ps;
        setPts(cs);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [selected, getInternalNode, containerRef]);

  if (!box || pts.length < 2) return null;
  const pointsStr = pts.map((p) => `${p.x},${p.y}`).join(" ");
  return (
    <svg
      className="pointer-events-none absolute z-10"
      style={{ left: box.left, top: box.top, width: box.width, height: box.height }}
      viewBox={box.viewBox}
      preserveAspectRatio={box.par}
    >
      <polyline
        points={pointsStr}
        fill="none"
        stroke="#38bdf8"
        strokeWidth={2.5}
        vectorEffect="non-scaling-stroke"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray="6 5"
        style={{ filter: "drop-shadow(0 0 3px rgba(56,189,248,0.95))", animation: "dashFlow 0.8s linear infinite" }}
      />
    </svg>
  );
}

export default function GraphWidget() {
  return (
    <ReactFlowProvider>
      <GraphInner />
    </ReactFlowProvider>
  );
}
