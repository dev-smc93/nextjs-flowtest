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
  const { collectors, resetNonce, focusId, focusNonce, focusCollector, mwOk, reset, graphView: view, setGraphView: setView } =
    useCollectors();
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [collapsedBands, setCollapsedBands] = useState<Set<string>>(new Set());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [moving, setMoving] = useState(false); // 자동 이동 중에는 미니맵을 잠깐 끔
  const [mmMounted, setMmMounted] = useState(true); // 미니맵 DOM 존재 여부
  const [mmVisible, setMmVisible] = useState(true); // 미니맵 페이드(투명도) 제어

  const collectorsRef = useRef(collectors);
  collectorsRef.current = collectors;
  const selectedIdRef = useRef(selectedId);
  selectedIdRef.current = selectedId;

  const { fitView, getViewport, setViewport, getInternalNode, setCenter } = useReactFlow();

  // 필터 전환 시 '수집 미들웨어'를 화면 중앙으로 이동 (레이아웃 재구성 후)
  const centerOnMiddleware = useCallback(() => {
    setTimeout(() => {
      try {
        const mw = getInternalNode(MIDDLEWARE.id);
        if (!mw) return;
        const p = mw.internals?.positionAbsolute ?? mw.position;
        const w = mw.measured?.width ?? 210;
        const h = mw.measured?.height ?? 120;
        setCenter(p.x + w / 2, p.y + h / 2, { zoom: getViewport().zoom, duration: 600 });
      } catch {}
    }, 140);
  }, [getInternalNode, getViewport, setCenter]);
  const [nodes, setNodes, onNodesChangeRaw] = useNodesState<Node>(
    buildNodes(collectorsRef.current, new Set(), "all", new Set())
  );
  const onNodesChange = useCallback((changes: NodeChange<Node>[]) => onNodesChangeRaw(changes), [onNodesChangeRaw]);

  // 펼침/필터 변경 시: 목표 레이아웃으로 한 번만 갱신.
  // 위치 이동은 `.react-flow__node`의 CSS transform 트랜지션(GPU)으로 부드럽게 처리(프레임마다 setNodes 안 함 → 버벅임 제거).
  const mountedRef = useRef(false);
  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      return;
    }
    // 레이아웃 재구성 시에도 현재 선택 노드의 강조(selected)를 유지
    setNodes(
      buildNodes(collectorsRef.current, expanded, view, collapsedBands).map((n) =>
        n.type === "collector" ? { ...n, selected: n.id === selectedIdRef.current } : n
      )
    );
    // 펼치기/접기 시 카메라는 그대로 둠 (자동 축소/맞춤 없음)
  }, [expanded, view, collapsedBands, setNodes]);

  // 목록/노드에서 선택(selectedId) → 해당 수집기 노드 테두리 강조(node.selected)
  useEffect(() => {
    setNodes((nds) =>
      nds.map((n) =>
        n.type === "collector" && !!n.selected !== (n.id === selectedId)
          ? { ...n, selected: n.id === selectedId }
          : n
      )
    );
  }, [selectedId, setNodes]);

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
    // 현재 필터를 유지하되, 선택 수집기가 그 필터에서 안 보일 때만 해당 종류 뷰로 전환
    const isProc = c.kind === "dbproc";
    const visible = view === "all" || (isProc ? view === "dbproc" : view === "collector");
    if (!visible) setView(isProc ? "dbproc" : "collector");
    setSelectedId(focusId);
    // 카드가 보이도록 그룹 펼침. 위치는 즉시 확정(시각 이동은 CSS) → 짧은 대기 후 바로 확대.
    setExpanded((prev) => (prev.has(key) ? prev : new Set(prev).add(key)));
    // 자동 이동 동안엔 미니맵을 잠깐 언마운트 → 프레임마다 미니맵 리렌더 비용 제거(버벅임↓)
    setMoving(true);
    const DELAY = 350;
    const DUR = 900;
    const t = setTimeout(() => {
      try {
        // maxZoom을 낮춰 2단계 정도 덜 확대(더 뒤로)된 시야로 이동
        fitView({ nodes: [{ id: focusId }], duration: DUR, maxZoom: 0.7, padding: 3 });
      } catch {}
    }, DELAY);
    const tEnd = setTimeout(() => setMoving(false), DELAY + DUR + 120);
    return () => {
      clearTimeout(t);
      clearTimeout(tEnd);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusNonce]);

  // 미니맵 페이드 인/아웃: 이동 시작 → 페이드아웃 후 언마운트, 이동 종료 → 마운트 후 페이드인
  useEffect(() => {
    if (moving) {
      setMmVisible(false); // 페이드 아웃
      const t = setTimeout(() => setMmMounted(false), 260); // 페이드 끝나면 언마운트
      return () => clearTimeout(t);
    }
    setMmMounted(true);
    const t = setTimeout(() => setMmVisible(true), 20); // 마운트 후 페이드 인 트리거
    return () => clearTimeout(t);
  }, [moving]);

  // 최초 진입 시 통신 그래프 전체(모든 수집기)가 보이도록 축소(fit).
  // 그리드 레이아웃/노드 측정이 끝나는 시점이 가변적이라 여러 번 시도해 확실히 맞춤.
  useEffect(() => {
    const fit = () => {
      try {
        // 전체 맞춤하되 너무 작아지지 않도록 하한 유지(0.1)
        fitView({ padding: 0.08, duration: 500, minZoom: 0.1 });
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
    } else if (node.type === "collector") {
      // 목록 클릭과 동일하게: 선택 + 해당 수집기로 확대
      focusCollector(node.id);
    }
  }, [focusCollector]);
  const onPaneClick = useCallback(() => setSelectedId(null), []);

  // 선택 경로 노드 id 집합을 1번만 계산(미니맵 렌더마다 O(n) find 하던 것 → O(1) 조회로)
  const pathIds = useMemo(() => {
    if (!selectedId) return null;
    const sel = collectors.find((c) => c.id === selectedId);
    if (!sel) return null;
    const grpKey = sel.kind === "dbproc" ? `proc:${sel.externalIp}` : sel.externalIp;
    return new Set([selectedId, `grp-${grpKey}`, `band-${sel.kind}-${bandKey(sel.externalIp)}`]);
  }, [selectedId, collectors]);

  // 미니맵: 선택된 수집기의 통신 경로만 밝게, 나머지는 흐리게 (이동 중 비용 최소화)
  const minimapColor = useCallback(
    (n: Node) => {
      if (!pathIds) return MINIMAP_NODE_COLOR(n);
      return pathIds.has(n.id) || n.type === "middleware" ? "#38bdf8" : "rgba(113,113,122,0.2)";
    },
    [pathIds]
  );
  // '전체 펼치기' 대상은 멤버 2개 이상 서버만 (단일 수집기는 박스가 없음)
  const groupKeys = useMemo(
    () => groupByServer(collectors).filter((g) => g.members.length > 1).map((g) => g.key),
    [collectors]
  );
  const selected = collectors.find((c) => c.id === selectedId) || null;
  const wrapRef = useRef<HTMLDivElement>(null);

  // 휠 줌: 한 번에 약 2배(≈2칸) · 커서 기준 · 살짝 부드럽게 (RF 기본 휠 줌은 끔)
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const { x, y, zoom } = getViewport();
      const factor = e.deltaY < 0 ? 1.45 : 1 / 1.45;
      const next = Math.min(1.4, Math.max(0.1, zoom * factor));
      if (next === zoom) return;
      const rect = el.getBoundingClientRect();
      const px = e.clientX - rect.left;
      const py = e.clientY - rect.top;
      // 커서 아래 좌표를 고정한 채 줌
      const fx = (px - x) / zoom;
      const fy = (py - y) / zoom;
      setViewport({ x: px - fx * next, y: py - fy * next, zoom: next }, { duration: 130 });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [getViewport, setViewport]);

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
        minZoom={0.1}
        maxZoom={1.4}
        zoomOnScroll={false}
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
        {/* 미니맵: 자동 이동 중엔 언마운트(성능) + 사라짐/나타남 페이드 */}
        {mmMounted && (
          <MiniMap
            nodeColor={minimapColor}
            maskColor="rgba(9,9,11,0.6)"
            className={`!bg-surface !border-line transition-opacity duration-300 ${mmVisible ? "opacity-100" : "opacity-0"}`}
          />
        )}
      </ReactFlow>

      {mmMounted && mmVisible && <MinimapPathOverlay selected={selected} containerRef={wrapRef} />}

      {/* 필터 + 펼치기 + 초기화 */}
      <div className="pointer-events-none absolute left-3 top-3 flex flex-col gap-2">
        <div className="bg-surface border-line pointer-events-auto inline-flex gap-1 rounded-lg border p-1">
          {VIEWS.map(({ v, label, icon }) => (
            <button
              key={v}
              onClick={() => {
                setView(v);
                centerOnMiddleware();
              }}
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
