"use client";

import { useMemo } from "react";
import { useCollectors } from "@/lib/collectorsContext";
import Scroll from "@/components/Scroll";
import { AnimatedNumber } from "@/components/ui";
import { STATUS_META, type CollectorStatus } from "@/lib/collectors";

const ORDER: CollectorStatus[] = ["normal", "error", "offline"];

export default function SummaryWidget() {
  const { collectors, errorEvents, statusFilter, setStatusFilter } = useCollectors();

  // 현재 정상이지만 금일 오류/중지 이력이 있던(복구된) 수집기 수
  const recovered = useMemo(() => {
    const todayStart = new Date().setHours(0, 0, 0, 0);
    const incidentIds = new Set<string>();
    for (const e of errorEvents) if (e.ts >= todayStart) incidentIds.add(e.collectorId);
    return collectors.filter(
      (c) => c.status === "normal" && (incidentIds.has(c.id) || c.errorsToday > 0)
    ).length;
  }, [collectors, errorEvents]);

  // 정상/오류/중지: 가상(미실행) 제외 집계
  const stats = useMemo(() => {
    const acc: Record<CollectorStatus, { total: number; collector: number; dbproc: number }> = {
      normal: { total: 0, collector: 0, dbproc: 0 },
      error: { total: 0, collector: 0, dbproc: 0 },
      offline: { total: 0, collector: 0, dbproc: 0 },
    };
    for (const c of collectors) {
      if (c.virtual) continue; // 가상=미실행은 별도 집계
      acc[c.status].total += 1;
      if (c.kind === "dbproc") acc[c.status].dbproc += 1;
      else acc[c.status].collector += 1;
    }
    return acc;
  }, [collectors]);

  // 미실행: 전일 미복구 정지가 가상으로 잡힌 항목
  const inactive = useMemo(() => {
    const acc = { total: 0, collector: 0, dbproc: 0 };
    for (const c of collectors) {
      if (!c.virtual) continue;
      acc.total += 1;
      if (c.kind === "dbproc") acc.dbproc += 1;
      else acc.collector += 1;
    }
    return acc;
  }, [collectors]);

  const total = collectors.length || 1;
  const inactivePct = Math.round((inactive.total / total) * 100);

  return (
    <Scroll className="h-full w-full">
      <div className="grid grid-cols-4 gap-2.5 p-3">
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
              <div className="mt-1 flex items-end justify-between gap-2">
                <AnimatedNumber
                  value={d.total}
                  className="block text-2xl font-extrabold leading-none"
                  style={{ color: meta.color }}
                />
                {/* 정상이지만 금일 오류·중지 후 복구된 항목 — 우측 2줄 표시 */}
                {s === "normal" && recovered > 0 && (
                  <span className="text-right leading-tight">
                    <span className="block whitespace-nowrap text-[9px] text-muted">오류·중지 복구</span>
                    <span className="block text-[11px] font-bold text-amber-400">{recovered}건</span>
                  </span>
                )}
              </div>
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

        {/* 미실행 — 전일 미복구 정지가 가상으로 잡힌 항목 */}
        <div className="relative">
          {inactive.total > 0 && (
            <div
              className="status-glow pointer-events-none absolute -inset-1 -z-10 rounded-xl blur-md"
              style={{ backgroundColor: "#94a3b8", animationDuration: "2.8s" }}
            />
          )}
          <button
            onClick={() => setStatusFilter(statusFilter === "inactive" ? null : "inactive")}
            className={`card-3d bg-surface relative w-full rounded-xl p-3 text-left transition hover:-translate-y-0.5 ${
              statusFilter === "inactive" ? "ring-2" : ""
            }`}
            style={{
              borderColor: `#94a3b8${statusFilter === "inactive" ? "" : "55"}`,
              boxShadow: statusFilter === "inactive" ? "0 0 0 2px #94a3b8" : undefined,
            }}
          >
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-[11px] text-muted">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: "#94a3b8" }} />
              미실행
              {statusFilter === "inactive" && <span className="text-[9px] text-[#94a3b8]">● 필터</span>}
            </span>
            <span className="text-[10px] text-muted">{inactivePct}%</span>
          </div>
          <div className="mt-1 flex items-end justify-between gap-2">
            <AnimatedNumber
              value={inactive.total}
              className="block text-2xl font-extrabold leading-none"
              style={{ color: "#94a3b8" }}
            />
            <span className="text-right text-[9px] leading-tight text-muted">전일 미복구<br />가상 전환</span>
          </div>
          <div className="mt-2 space-y-1 border-t border-line pt-2 text-[10.5px] text-muted">
            <div className="flex justify-between">
              <span>🖥️ 수집기</span>
              <span className="text-fg font-semibold">{inactive.collector}</span>
            </div>
            <div className="flex justify-between">
              <span>🗄️ DB프로시저</span>
              <span className="text-fg font-semibold">{inactive.dbproc}</span>
            </div>
            <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-surface2">
              <div className="h-full rounded-full" style={{ width: `${inactivePct}%`, backgroundColor: "#94a3b8" }} />
            </div>
          </div>
          </button>
        </div>
      </div>
    </Scroll>
  );
}
