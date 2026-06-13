import type { Node, Edge } from "@xyflow/react";
import {
  STATUS_META,
  MIDDLEWARE,
  worstStatus,
  type Collector,
  type CollectorStatus,
} from "@/lib/collectors";
import type { ServerGroupNodeData } from "@/components/ServerGroupNode";
import type { ZoneNodeData } from "@/components/ZoneNode";

export type GraphView = "all" | "collector" | "dbproc";

// ---- 레이아웃 상수 ----
const CARD_W = 230;
const CARD_H = 150;
const GAP = 22;
const PAD = 18;
const LABEL_H = 26;
const COMPACT_W = 240;
const COMPACT_H = 130;
const BAND_PAD = 18;
const BAND_TITLE = 30;
const COL_GAP = 22;
const MID_GAP = 300;
const BAND_COMPACT_W = 220;
const BAND_COMPACT_H = 66;

// ---- 그룹핑 ----
export const bandKey = (ip: string) => ip.split(".").slice(0, 3).join(".") + ".x";
const groupKeyOf = (c: Collector) => (c.kind === "dbproc" ? `proc:${c.externalIp}` : c.externalIp);
const groupLabel = (key: string) => (key.startsWith("proc:") ? key.slice(5) : key);

export type Group = { key: string; label: string; kind: Collector["kind"]; members: Collector[] };

export function groupByServer(collectors: Collector[]): Group[] {
  const map = new Map<string, Collector[]>();
  for (const c of collectors) {
    const k = groupKeyOf(c);
    (map.get(k) ?? map.set(k, []).get(k)!).push(c);
  }
  return [...map.entries()].map(([key, members]) => ({
    key,
    label: groupLabel(key),
    kind: members[0].kind,
    members,
  }));
}

type GroupData = {
  total: number;
  breakdown: Record<CollectorStatus, number>;
  worst: CollectorStatus;
  allHealthy: boolean;
};

function groupData(members: Collector[]): GroupData {
  const breakdown: Record<CollectorStatus, number> = { normal: 0, error: 0, offline: 0 };
  for (const m of members) breakdown[m.status] += 1;
  return {
    total: members.length,
    breakdown,
    worst: worstStatus(members),
    allHealthy: breakdown.normal === members.length,
  };
}

function boxSize(n: number) {
  const cols = n <= 1 ? 1 : 2;
  const rows = Math.ceil(n / cols);
  return {
    w: PAD * 2 + cols * CARD_W + (cols - 1) * GAP,
    h: PAD * 2 + LABEL_H + rows * CARD_H + (rows - 1) * GAP,
    cols,
  };
}
const groupSize = (g: Group, expanded: Set<string>) =>
  g.members.length === 1
    ? { w: CARD_W, h: CARD_H, cols: 1 } // 단일 수집기: 서버 박스 없이 카드 크기
    : expanded.has(g.key)
      ? boxSize(g.members.length)
      : { w: COMPACT_W, h: COMPACT_H, cols: 1 };

const bandOf = (g: Group) => bandKey(g.members[0].externalIp);

// ---- 메이슨리 ----
type Sz = { w: number; h: number };
function packMasonry(sizes: Sz[], cols: number) {
  const c = Math.max(1, cols);
  const colW = Math.max(1, ...sizes.map((s) => s.w));
  const colH = new Array(c).fill(0);
  const pos = sizes.map((s) => {
    let col = 0;
    for (let i = 1; i < c; i++) if (colH[i] < colH[col]) col = i;
    const x = col * (colW + COL_GAP) + (colW - s.w) / 2;
    const y = colH[col];
    colH[col] += s.h + COL_GAP;
    return { x, y };
  });
  return { pos, width: c * colW + (c - 1) * COL_GAP, height: Math.max(COL_GAP, ...colH) - COL_GAP };
}

// 서버(IP) 박스 + 펼친 카드. 대역 박스(parentId) 기준 상대 좌표.
function pushServer(
  nodes: Node[],
  g: Group,
  x: number,
  y: number,
  expanded: Set<string>,
  parentId: string
) {
  // 단일 수집기 서버: 서버 박스 없이 수집기 카드만 대역 안에 직접 표시
  if (g.members.length === 1) {
    nodes.push({
      id: g.members[0].id,
      type: "collector",
      parentId,
      extent: "parent",
      position: { x, y },
      data: { collector: g.members[0] },
      draggable: true,
      zIndex: 3,
    });
    return;
  }
  const isExp = expanded.has(g.key);
  const size = groupSize(g, expanded);
  const gd = groupData(g.members);
  nodes.push({
    id: `grp-${g.key}`,
    type: "serverGroup",
    parentId,
    position: { x, y },
    data: {
      label: g.label,
      kind: g.kind,
      total: gd.total,
      collapsed: !isExp,
      worst: gd.worst,
      allHealthy: gd.allHealthy,
      breakdown: gd.breakdown,
    } satisfies ServerGroupNodeData,
    style: { width: size.w, height: size.h },
    draggable: true,
    selectable: false,
    connectable: false,
    zIndex: 2,
  });
  if (isExp) {
    const cols = size.cols;
    g.members.forEach((c, mi) => {
      nodes.push({
        id: c.id,
        type: "collector",
        parentId: `grp-${g.key}`,
        extent: "parent",
        position: {
          x: PAD + (mi % cols) * (CARD_W + GAP),
          y: PAD + LABEL_H + Math.floor(mi / cols) * (CARD_H + GAP),
        },
        data: { collector: c },
        draggable: true,
        zIndex: 3,
      });
    });
  }
}

type BandEntry = [string, Group[]];

function bandEntriesOf(groups: Group[]): BandEntry[] {
  const m = new Map<string, Group[]>();
  for (const g of groups) (m.get(bandOf(g)) ?? m.set(bandOf(g), []).get(bandOf(g))!).push(g);
  return [...m.entries()].sort((a, b) => b[1].length - a[1].length || (a[0] < b[0] ? -1 : 1));
}

function measureSet(
  bands: BandEntry[],
  kind: Collector["kind"],
  expanded: Set<string>,
  collapsedBands: Set<string>
) {
  const serverCols = kind === "collector" ? 2 : 1;
  const bandLayouts = bands.map(([band, servers]) => {
    const collapsed = collapsedBands.has(`band-${kind}-${band}`);
    if (collapsed) {
      return { band, servers, p: null, w: BAND_COMPACT_W, h: BAND_COMPACT_H, collapsed: true as const };
    }
    const p = packMasonry(servers.map((g) => groupSize(g, expanded)), Math.min(serverCols, servers.length));
    return { band, servers, p, w: p.width + BAND_PAD * 2, h: p.height + BAND_PAD * 2 + BAND_TITLE, collapsed: false as const };
  });
  const bandCols =
    kind === "collector" ? (bands.length > 8 ? 3 : bands.length > 3 ? 2 : 1) : bands.length > 4 ? 2 : 1;
  const zp = packMasonry(
    bandLayouts.map((b) => ({ w: b.w, h: b.h })),
    Math.min(bandCols, bandLayouts.length || 1)
  );
  return { bandLayouts, zp, width: zp.width };
}

type Packing = ReturnType<typeof measureSet>;

function emitSet(nodes: Node[], kind: Collector["kind"], packing: Packing, originX: number, expanded: Set<string>) {
  const { bandLayouts, zp } = packing;
  const top = -zp.height / 2;
  bandLayouts.forEach((bl, bi) => {
    const bx = originX + zp.pos[bi].x;
    const by = top + zp.pos[bi].y;
    const bandId = `band-${kind}-${bl.band}`;
    const members = bl.servers.flatMap((g) => g.members);
    const isVirtual = members[0]?.virtual === true;
    nodes.push({
      id: bandId,
      type: "zone",
      position: { x: bx, y: by },
      data: {
        label: isVirtual
          ? `🧠 가상 · ${bl.band}`
          : `${kind === "dbproc" ? "🗄️" : "🌐"} ${bl.band}`,
        count: members.length,
        accent: isVirtual ? "#a78bfa" : kind === "dbproc" ? "#22d3ee" : "#71717a",
        collapsed: bl.collapsed,
        worst: worstStatus(members),
      } satisfies ZoneNodeData,
      style: { width: bl.w, height: bl.h },
      draggable: true,
      selectable: false,
      connectable: false,
      zIndex: 1,
    });
    if (!bl.collapsed && bl.p)
      bl.servers.forEach((g, si) =>
        pushServer(nodes, g, BAND_PAD + bl.p!.pos[si].x, BAND_TITLE + BAND_PAD + bl.p!.pos[si].y, expanded, bandId)
      );
  });
}

export function buildNodes(
  collectors: Collector[],
  expanded: Set<string>,
  view: GraphView,
  collapsedBands: Set<string>
): Node[] {
  const groups = groupByServer(collectors);
  const cBands = bandEntriesOf(groups.filter((g) => g.kind === "collector"));
  const pBands = bandEntriesOf(groups.filter((g) => g.kind === "dbproc"));
  const healthy = collectors.filter((c) => c.status === "normal").length;

  // 좌/우 균형: 전체=수집기|DB, 단일=같은 종류를 절반씩 좌우로
  let leftKind: Collector["kind"], rightKind: Collector["kind"], leftBands: BandEntry[], rightBands: BandEntry[];
  if (view === "all") {
    leftKind = "collector";
    rightKind = "dbproc";
    leftBands = cBands;
    rightBands = pBands;
  } else {
    const all = view === "collector" ? cBands : pBands;
    const mid = Math.ceil(all.length / 2);
    leftKind = rightKind = view;
    leftBands = all.slice(0, mid);
    rightBands = all.slice(mid);
  }

  const nodes: Node[] = [];
  const mL = leftBands.length ? measureSet(leftBands, leftKind, expanded, collapsedBands) : null;
  const mR = rightBands.length ? measureSet(rightBands, rightKind, expanded, collapsedBands) : null;
  const leftW = mL ? mL.width : 0;
  if (mL) emitSet(nodes, leftKind, mL, 0, expanded);
  const midX = leftW + MID_GAP / 2;
  if (mR) emitSet(nodes, rightKind, mR, leftW + MID_GAP, expanded);

  nodes.push({
    id: MIDDLEWARE.id,
    type: "middleware",
    position: { x: midX - 105, y: -115 },
    data: { total: collectors.length, healthy },
    draggable: false,
    selectable: false,
    zIndex: 6,
  });
  return nodes;
}

function edgeProps(status: CollectorStatus) {
  switch (status) {
    case "normal":
      return { animated: true, dash: undefined, opacity: 0.85 };
    case "error":
      return { animated: true, dash: "2 4", opacity: 0.95 };
    case "offline":
      return { animated: false, dash: "4 6", opacity: 0.4 };
  }
}

export function buildEdges(
  collectors: Collector[],
  expanded: Set<string>,
  view: GraphView,
  collapsedBands: Set<string>,
  selectedId?: string | null
): Edge[] {
  const edges: Edge[] = [];
  const groups = groupByServer(collectors);
  const showC = view !== "dbproc";
  const showP = view !== "collector";

  // 대역(밴드) → 미들웨어 트렁크
  const byKindBand = (kind: Collector["kind"]) => {
    const m = new Map<string, Collector[]>();
    for (const c of collectors)
      if (c.kind === kind) (m.get(bandKey(c.externalIp)) ?? m.set(bandKey(c.externalIp), []).get(bandKey(c.externalIp))!).push(c);
    return m;
  };
  const trunk = (kind: Collector["kind"]) => {
    for (const [band, members] of byKindBand(kind)) {
      const status = worstStatus(members);
      const p = edgeProps(status);
      const isProc = kind === "dbproc";
      const isVirtual = members[0]?.virtual === true;
      const nodeId = `band-${kind}-${band}`;
      edges.push({
        id: `e-${nodeId}`,
        source: isProc ? MIDDLEWARE.id : nodeId,
        target: isProc ? nodeId : MIDDLEWARE.id,
        sourceHandle: isProc ? undefined : "z",
        targetHandle: isProc ? "z" : undefined,
        type: "floating",
        animated: p.animated,
        style: {
          // 가상 수집기는 보라색 점선으로 구분
          stroke: isVirtual ? "#a78bfa" : STATUS_META[status].color,
          strokeWidth: 2.5,
          strokeDasharray: isVirtual ? "2 5" : p.dash,
          opacity: status === "offline" ? 0.5 : 0.9,
        },
      });
    }
  };
  if (showC) trunk("collector");
  if (showP) trunk("dbproc");

  // 펼친 서버: 멤버 → 헤더 허브 (대역이 접혀 있으면 서버가 없으므로 생략)
  for (const g of groups) {
    if (g.members.length === 1) continue; // 단일 수집기는 서버 박스/허브가 없음
    if (!expanded.has(g.key)) continue;
    if (g.kind === "collector" ? !showC : !showP) continue;
    if (collapsedBands.has(`band-${g.kind}-${bandOf(g)}`)) continue;
    const groupId = `grp-${g.key}`;
    const isProc = g.kind === "dbproc";
    for (const m of g.members) {
      const p = edgeProps(m.status);
      edges.push({
        id: `e-${m.id}`,
        source: isProc ? groupId : m.id,
        sourceHandle: isProc ? "hub" : "T",
        target: isProc ? m.id : groupId,
        targetHandle: isProc ? "T" : "hub",
        type: "directed",
        animated: p.animated,
        style: {
          stroke: STATUS_META[m.status].color,
          strokeWidth: m.status === "normal" ? 1.5 : 2,
          strokeDasharray: p.dash,
          opacity: p.opacity,
        },
      });
    }
  }

  // 선택된 수집기의 통신 경로만 강조 (멤버선 + 해당 대역 트렁크), 나머지는 흐리게
  if (selectedId) {
    const sel = collectors.find((c) => c.id === selectedId);
    if (sel) {
      const trunkId = `e-band-${sel.kind}-${bandKey(sel.externalIp)}`;
      const hot = new Set([trunkId, `e-${sel.id}`]);
      return edges.map((e) =>
        hot.has(e.id)
          ? {
              ...e,
              animated: true,
              zIndex: 20,
              style: {
                ...e.style,
                stroke: "#38bdf8",
                strokeWidth: 4,
                strokeDasharray: "7 5",
                opacity: 1,
                filter: "drop-shadow(0 0 6px rgba(56,189,248,0.95))",
              },
            }
          : { ...e, animated: false, style: { ...e.style, opacity: 0.1 } }
      );
    }
  }
  return edges;
}

// 엣지 재계산 시그니처 (상태/펼침/뷰/대역접힘 변할 때만)
export function edgeSignature(
  collectors: Collector[],
  expanded: Set<string>,
  view: GraphView,
  collapsedBands: Set<string>,
  selectedId?: string | null
): string {
  return (
    view +
    "|sel:" +
    (selectedId ?? "") +
    "|" +
    [...collapsedBands].sort().join(",") +
    "|" +
    groupByServer(collectors)
      .map((g) =>
        expanded.has(g.key)
          ? `${g.key}:E:${g.members.map((m) => m.id + m.status).join(",")}`
          : `${g.key}:C:${worstStatus(g.members)}`
      )
      .join("|")
  );
}
