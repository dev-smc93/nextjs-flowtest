"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import GridLayout from "react-grid-layout";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";

import { useBoardChrome } from "@/lib/boardChrome";
import {
  WIDGET_MAP,
  BOARD_DEFAULTS,
  loadBoardWidgets,
  saveBoardWidgets,
  type BoardId,
} from "@/components/widgets/catalog";

type Layout = GridLayout.Layout;
const Grid = GridLayout.WidthProvider(GridLayout);

type Box = { x: number; y: number; w: number; h: number };
// 보드별 기본 배치 — 12열을 빈틈 없이 타일링
const BOARD_LAYOUT: Record<BoardId, Record<string, Box>> = {
  dashboard: {
    summary: { x: 0, y: 0, w: 12, h: 4 },
    graph: { x: 0, y: 4, w: 8, h: 15 },
    alertsFeed: { x: 8, y: 4, w: 4, h: 7 },
    table: { x: 8, y: 11, w: 4, h: 8 },
    cli: { x: 0, y: 19, w: 12, h: 8 },
  },
  charts: {
    summary: { x: 0, y: 0, w: 12, h: 4 },
    trend: { x: 0, y: 4, w: 8, h: 14 },
    impBar: { x: 8, y: 4, w: 4, h: 14 },
  },
  history: {
    historyTop: { x: 0, y: 0, w: 5, h: 16 },
    historyTimeline: { x: 5, y: 0, w: 7, h: 16 },
  },
  alerts: {
    alertSettings: { x: 0, y: 0, w: 8, h: 16 },
    recipients: { x: 8, y: 0, w: 4, h: 8 },
    sendAlert: { x: 8, y: 8, w: 4, h: 8 },
  },
  schedule: {
    schedule: { x: 0, y: 0, w: 8, h: 16 },
    recipients: { x: 8, y: 0, w: 4, h: 8 },
    sendSchedule: { x: 8, y: 8, w: 4, h: 8 },
  },
  collectors: {
    collectors: { x: 0, y: 0, w: 12, h: 18 },
  },
};

function layoutFor(boardId: BoardId, ids: string[]): Layout[] {
  const preset = BOARD_LAYOUT[boardId];
  let flowY = Math.max(0, ...Object.values(preset).map((b) => b.y + b.h));
  return ids.map((id) => {
    const d = WIDGET_MAP[id];
    const p = preset[id];
    if (p) return { i: id, ...p, minW: d.def.minW, minH: d.def.minH };
    // 프리셋에 없는(추가된) 위젯 → 하단에 전체폭으로 흐름 배치
    const item = { i: id, x: 0, y: flowY, w: 12, h: d.def.h, minW: d.def.minW, minH: d.def.minH };
    flowY += d.def.h;
    return item;
  });
}

function reconcile(boardId: BoardId, layout: Layout[], ids: string[]): Layout[] {
  const map = new Map(layout.map((l) => [l.i, l]));
  return ids.map((id) => map.get(id) ?? layoutFor(boardId, [id])[0]);
}

function Panel({ title, editing, index, onRemove, children }: {
  title: string;
  editing: boolean;
  index: number;
  onRemove: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className="card-3d widget-enter bg-surface flex h-full flex-col overflow-hidden rounded-xl"
      // 순차 등장: 위젯마다 약간씩 지연 (최대 6칸까지만 누적)
      style={{ animationDelay: `${Math.min(index, 6) * 70}ms` }}
    >
      <div className={`widget-drag panel-head border-line flex shrink-0 items-center gap-2 border-b px-3 py-1.5 text-xs font-semibold text-fg ${editing ? "cursor-move" : ""}`}>
        <span>{title}</span>
        {editing && <span className="text-[10px] text-muted">⠿ 드래그</span>}
        <button
          onClick={onRemove}
          title="위젯 제거"
          className="text-muted ml-auto rounded px-1.5 leading-none transition hover:bg-red-500/15 hover:text-red-400"
        >
          ✕
        </button>
      </div>
      <div className="relative min-h-0 flex-1">{children}</div>
    </div>
  );
}

export default function WidgetBoard({ boardId }: { boardId: BoardId }) {
  const { editing, registerReset } = useBoardChrome();
  const [mounted, setMounted] = useState(false);
  const [active, setActive] = useState<string[]>(BOARD_DEFAULTS[boardId]);
  const [layout, setLayout] = useState<Layout[]>([]);

  const LK = `board-${boardId}-layout-v6`;

  useEffect(() => {
    const a = loadBoardWidgets(boardId);
    setActive(a);
    let saved: Layout[] | null = null;
    try {
      const s = localStorage.getItem(LK);
      if (s) saved = JSON.parse(s);
    } catch {}
    setLayout(reconcile(boardId, saved ?? [], a));
    setMounted(true);

    const onChange = (e: Event) => {
      if ((e as CustomEvent).detail && (e as CustomEvent).detail !== boardId) return;
      const na = loadBoardWidgets(boardId);
      setActive(na);
      // 위젯 추가/제거(위젯 관리 화면 포함) 시에도 보드별 localStorage에 레이아웃 저장
      setLayout((prev) => {
        const next = reconcile(boardId, prev, na);
        try {
          localStorage.setItem(LK, JSON.stringify(next));
        } catch {}
        return next;
      });
    };
    window.addEventListener("board-widgets-changed", onChange);
    return () => window.removeEventListener("board-widgets-changed", onChange);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boardId]);

  const persist = (l: Layout[]) => {
    setLayout(l);
    try {
      localStorage.setItem(LK, JSON.stringify(l));
    } catch {}
  };

  const removeWidget = (id: string) => {
    const na = active.filter((x) => x !== id);
    setActive(na);
    saveBoardWidgets(boardId, na);
    persist(layout.filter((l) => l.i !== id));
    toast(`위젯 제거됨 · ${WIDGET_MAP[id]?.title ?? id}`);
  };

  const resetBoard = () => {
    setActive(BOARD_DEFAULTS[boardId]);
    saveBoardWidgets(boardId, BOARD_DEFAULTS[boardId]);
    setLayout(layoutFor(boardId, BOARD_DEFAULTS[boardId]));
    try {
      localStorage.removeItem(LK);
    } catch {}
    toast.success("레이아웃 기본값으로 복원됨");
  };

  // 헤더의 '기본값 복원'이 현재 보드의 resetBoard를 호출하도록 등록 (최신 클로저는 ref로 참조)
  const resetBoardRef = useRef(resetBoard);
  resetBoardRef.current = resetBoard;
  useEffect(() => {
    registerReset(() => resetBoardRef.current());
    return () => registerReset(null);
  }, [registerReset]);

  const children = useMemo(
    () =>
      active
        .filter((id) => WIDGET_MAP[id])
        .map((id, i) => {
          const w = WIDGET_MAP[id];
          return (
            <div key={id}>
              <Panel title={`${w.icon} ${w.title}`} editing={editing} index={i} onRemove={() => removeWidget(id)}>
                {w.render()}
              </Panel>
            </div>
          );
        }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [active, editing]
  );

  return (
    <div className="flex h-full flex-col">
      <div className="min-h-0 flex-1 overflow-auto">
        {mounted && active.length === 0 && (
          <div className="text-muted flex h-full items-center justify-center text-sm">
            표시할 위젯이 없습니다 · ‘위젯 관리’에서 추가하세요
          </div>
        )}
        {mounted && active.length > 0 && (
          <Grid
            className="layout"
            layout={layout}
            cols={12}
            rowHeight={36}
            margin={[12, 12]}
            draggableHandle=".widget-drag"
            isDraggable={editing}
            isResizable={editing}
            onLayoutChange={persist}
            compactType="vertical"
          >
            {children}
          </Grid>
        )}
      </div>
    </div>
  );
}
