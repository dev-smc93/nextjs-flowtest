"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import Scroll from "@/components/Scroll";
import {
  WIDGET_CATALOG,
  BOARDS,
  BOARD_WIDGETS,
  loadBoardWidgets,
  saveBoardWidgets,
  type BoardId,
} from "@/components/widgets/catalog";

const HREF: Record<BoardId, string> = {
  dashboard: "/monitor",
  charts: "/monitor/charts",
  history: "/monitor/history",
  alerts: "/monitor/alerts",
  schedule: "/monitor/schedule",
  collectors: "/monitor/collectors",
};

export default function WidgetsPage() {
  const [board, setBoard] = useState<BoardId>("dashboard");
  const [active, setActive] = useState<string[]>([]);

  useEffect(() => setActive(loadBoardWidgets(board)), [board]);

  const toggle = (id: string) => {
    const has = active.includes(id);
    const next = has ? active.filter((x) => x !== id) : [...active, id];
    setActive(next);
    saveBoardWidgets(board, next);
    toast.success(has ? "보드에서 제거됨" : "보드에 추가됨");
  };

  return (
    <Scroll className="page-enter h-full w-full">
      <div className="mx-auto max-w-4xl p-5">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-lg font-extrabold">위젯 관리</h1>
          <Link href={HREF[board]} className="text-sky-400 text-xs font-semibold hover:underline">
            {BOARDS.find((b) => b.id === board)?.label}로 이동 →
          </Link>
        </div>
        <p className="text-muted mt-1 text-sm">
          페이지(보드)를 선택하고 표시할 위젯을 켜고 끄세요. 위젯의 ✕로도 제거할 수 있습니다.
        </p>

        {/* 보드 선택 탭 */}
        <div className="mt-4 inline-flex flex-wrap gap-1 rounded-lg bg-surface2 p-1">
          {BOARDS.map((b) => (
            <button
              key={b.id}
              onClick={() => setBoard(b.id)}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                board === b.id ? "btn-3d bg-sky-500/20 text-sky-400" : "text-muted hover:bg-zinc-500/10"
              }`}
            >
              {b.label}
            </button>
          ))}
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {WIDGET_CATALOG.filter((w) => BOARD_WIDGETS[board].includes(w.id)).map((w) => {
            const on = active.includes(w.id);
            return (
              <div key={w.id} className="card-3d elevate bg-surface flex items-center gap-3 rounded-xl p-4">
                <span className="text-2xl">{w.icon}</span>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-bold">{w.title}</div>
                  <div className="text-muted text-[11px]">{on ? "이 보드에 표시 중" : "숨김"}</div>
                </div>
                <button
                  onClick={() => toggle(w.id)}
                  className={`btn-3d rounded-lg px-3 py-1.5 text-xs font-semibold ring-1 ${
                    on
                      ? "bg-emerald-500/15 text-emerald-400 ring-emerald-500/40"
                      : "bg-zinc-500/10 text-muted ring-zinc-500/30"
                  }`}
                >
                  {on ? "✓ 추가됨" : "+ 추가"}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </Scroll>
  );
}
