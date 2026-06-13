"use client";

import { useMemo } from "react";
import { useCollectors } from "@/lib/collectorsContext";
import Scroll from "@/components/Scroll";
import { AnimatedNumber } from "@/components/ui";
import { STATUS_META, type CollectorStatus } from "@/lib/collectors";

const ORDER: CollectorStatus[] = ["normal", "error", "offline"];

export default function SummaryWidget() {
  const { collectors, statusFilter, setStatusFilter } = useCollectors();

  const stats = useMemo(() => {
    const acc: Record<CollectorStatus, { total: number; collector: number; dbproc: number }> = {
      normal: { total: 0, collector: 0, dbproc: 0 },
      error: { total: 0, collector: 0, dbproc: 0 },
      offline: { total: 0, collector: 0, dbproc: 0 },
    };
    for (const c of collectors) {
      acc[c.status].total += 1;
      if (c.kind === "dbproc") acc[c.status].dbproc += 1;
      else acc[c.status].collector += 1;
    }
    return acc;
  }, [collectors]);

  const total = collectors.length || 1;

  return (
    <Scroll className="h-full w-full">
      <div className="grid grid-cols-3 gap-2.5 p-3">
        {ORDER.map((s) => {
          const meta = STATUS_META[s];
          const d = stats[s];
          const pct = Math.round((d.total / total) * 100);
          const active = statusFilter === s;
          const alarming = (s === "error" || s === "offline") && d.total > 0;
          return (
            <div key={s} className="relative">
              {/* 오류/중지 발생 시 기존 노드와 통일된 백그라운드 펄스 */}
              {alarming && (
                <div
                  className="status-glow pointer-events-none absolute -inset-1 -z-10 rounded-xl blur-md"
                  style={{ backgroundColor: meta.color, animationDuration: s === "error" ? "1.6s" : "2.8s" }}
                />
              )}
              <button
                onClick={() => setStatusFilter(active ? null : s)}
                className={`card-3d bg-surface relative w-full rounded-xl p-3 text-left transition hover:-translate-y-0.5 ${
                  active ? "ring-2" : ""
                }`}
                style={{
                  borderColor: `${meta.color}${active ? "" : "55"}`,
                  boxShadow: active ? `0 0 0 2px ${meta.color}` : undefined,
                }}
              >
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-[11px] text-muted">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: meta.color }} />
                  {meta.label}
                  {active && <span className="text-[9px]" style={{ color: meta.color }}>● 필터</span>}
                </span>
                <span className="text-[10px] text-muted">{pct}%</span>
              </div>
              <AnimatedNumber
                value={d.total}
                className="mt-1 block text-2xl font-extrabold"
                style={{ color: meta.color }}
              />
              {/* 하위 정보 */}
              <div className="mt-2 space-y-1 border-t border-line pt-2 text-[10.5px] text-muted">
                <div className="flex justify-between">
                  <span>🖥️ 수집기</span>
                  <span className="text-fg font-semibold">{d.collector}</span>
                </div>
                <div className="flex justify-between">
                  <span>🗄️ DB프로시저</span>
                  <span className="text-fg font-semibold">{d.dbproc}</span>
                </div>
                <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-surface2">
                  <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: meta.color }} />
                </div>
              </div>
              </button>
            </div>
          );
        })}
      </div>
    </Scroll>
  );
}
