"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { DayPicker, type DateRange } from "react-day-picker";
import { ko } from "date-fns/locale";
import "react-day-picker/style.css";
import { useCollectors } from "@/lib/collectorsContext";
import Scroll from "@/components/Scroll";
import { Stat } from "@/components/ui";
import { STATUS_META } from "@/lib/collectors";
import { fmtDateTime as fmtTime } from "@/lib/format";

const fmtDay = (d?: Date) =>
  d ? d.toLocaleDateString("ko-KR", { year: "2-digit", month: "2-digit", day: "2-digit" }) : "—";

// 위젯 1: 요약 카드 + 수집기별 에러 TOP
export function HistoryTopWidget() {
  const { collectors, errorEvents } = useCollectors();
  const topErrors = useMemo(
    () => [...collectors].filter((c) => c.errorsToday > 0).sort((a, b) => b.errorsToday - a.errorsToday).slice(0, 14),
    [collectors]
  );
  const maxErr = Math.max(1, ...topErrors.map((c) => c.errorsToday));
  const totalErrToday = collectors.reduce((s, c) => s + c.errorsToday, 0);
  const stoppedCount = collectors.filter((c) => c.status === "offline").length;

  return (
    <div className="flex h-full flex-col gap-3 p-3">
      <div className="grid shrink-0 grid-cols-3 gap-3">
        <Stat label="금일 누적 에러" value={`${totalErrToday}건`} accent="#ef4444" />
        <Stat label="정지된 항목" value={`${stoppedCount}개`} accent="#f59e0b" />
        <Stat label="기록된 이벤트" value={`${errorEvents.length}건`} accent="#38bdf8" />
      </div>
      <div className="border-line bg-surface flex min-h-0 flex-1 flex-col rounded-xl border">
        <div className="border-line border-b px-4 py-2 text-sm font-bold text-fg">수집기별 금일 에러 / 정지 TOP</div>
        <Scroll className="min-h-0 flex-1">
          <div className="space-y-2 p-4">
            {topErrors.length === 0 && <div className="py-10 text-center text-xs text-emerald-400">금일 에러 없음 ✓</div>}
            {topErrors.map((c) => (
              <div key={c.id} className="flex items-center gap-2 text-xs">
                <span className="w-40 shrink-0 truncate text-fg" title={c.name}>{c.name}</span>
                <div className="h-3 flex-1 overflow-hidden rounded bg-surface2">
                  <div className="h-full rounded" style={{ width: `${(c.errorsToday / maxErr) * 100}%`, backgroundColor: STATUS_META[c.status].color }} />
                </div>
                <span className="w-10 shrink-0 text-right font-semibold text-red-400">{c.errorsToday}</span>
              </div>
            ))}
          </div>
        </Scroll>
      </div>
    </div>
  );
}

// 위젯 2: 달력(기간) + 에러/정지 타임라인
export function HistoryTimelineWidget() {
  const { errorEvents } = useCollectors();
  const [range, setRange] = useState<DateRange | undefined>(() => ({
    from: new Date(Date.now() - 30 * 86400_000),
    to: new Date(),
  }));
  const [calOpen, setCalOpen] = useState(false);
  const calRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (calRef.current && !calRef.current.contains(e.target as Node)) setCalOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const ranged = useMemo(() => {
    const f = range?.from ? new Date(range.from).setHours(0, 0, 0, 0) : -Infinity;
    const t = range?.to ?? range?.from ? new Date(range?.to ?? range!.from!).setHours(23, 59, 59, 999) : Infinity;
    return errorEvents.filter((e) => e.ts >= f && e.ts <= t);
  }, [errorEvents, range]);

  const copyLog = (e: (typeof errorEvents)[number]) => {
    navigator.clipboard
      .writeText(`[${new Date(e.ts).toLocaleString("ko-KR")}] ${e.name} (${e.status})\n${e.message}\n${e.log}`)
      .then(() => toast.success("로그가 복사되었습니다"))
      .catch(() => toast.error("복사 실패"));
  };

  return (
    <div className="flex h-full flex-col p-3">
      <section className="border-line bg-surface flex min-h-0 flex-1 flex-col rounded-xl border">
        <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-2 text-sm font-bold text-fg">
          에러 / 정지(끊김) 타임라인
          <span className="text-muted ml-2 text-[11px] font-normal">{ranged.length}건</span>
          <div ref={calRef} className="relative ml-auto text-[11px] font-normal">
            <button
              onClick={() => setCalOpen((v) => !v)}
              className="btn-3d border-line bg-surface2 text-fg flex items-center gap-1.5 rounded-lg border px-3 py-1.5"
            >
              📅 {fmtDay(range?.from)} ~ {fmtDay(range?.to)}
            </button>
            {calOpen && (
              <div className="card-3d bg-surface page-enter absolute right-0 top-full z-30 mt-1 rounded-xl p-2">
                <DayPicker mode="range" locale={ko} selected={range} onSelect={setRange} numberOfMonths={2} defaultMonth={range?.from} />
                <div className="flex justify-end gap-2 px-2 pb-1">
                  <button
                    onClick={() => setRange({ from: new Date(Date.now() - 30 * 86400_000), to: new Date() })}
                    className="text-muted text-[11px] hover:text-sky-400"
                  >
                    최근 1달
                  </button>
                  <button onClick={() => setCalOpen(false)} className="text-sky-400 text-[11px] font-semibold">닫기</button>
                </div>
              </div>
            )}
          </div>
        </div>
        <Scroll className="min-h-0 flex-1">
          <ul className="divide-y divide-zinc-500/20">
            {ranged.length === 0 && <li className="py-10 text-center text-xs text-muted">해당 기간 내 이벤트가 없습니다.</li>}
            {ranged.map((e) => {
              const meta = STATUS_META[e.status];
              return (
                <li key={e.id} className="group px-4 py-2 text-xs">
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-[10px] text-muted">{fmtTime(e.ts)}</span>
                    <span className="rounded px-1.5 py-0.5 text-[10px] font-semibold" style={{ backgroundColor: `${meta.color}1f`, color: meta.color }}>
                      {meta.label}
                    </span>
                    <span className="flex-1 truncate text-fg">{e.name}</span>
                    <span className="truncate text-[10px] text-muted">{e.message}</span>
                    <button
                      onClick={() => copyLog(e)}
                      title="로그 복사"
                      className="text-muted shrink-0 rounded px-1.5 py-0.5 text-[10px] opacity-0 transition hover:bg-zinc-500/15 hover:text-sky-400 group-hover:opacity-100"
                    >
                      📋 복사
                    </button>
                  </div>
                  <div
                    className="mt-1.5 flex items-start gap-2 overflow-hidden rounded-md border-l-2 bg-black/40 px-2.5 py-1.5 font-mono text-[10px] shadow-inner"
                    style={{ borderColor: meta.color }}
                  >
                    <span className="shrink-0 select-none text-emerald-400">❯</span>
                    <span className="break-all text-zinc-300">{e.log}</span>
                    <span className="ml-auto shrink-0 select-none rounded bg-white/5 px-1 text-[8px] uppercase tracking-wider" style={{ color: meta.color }}>
                      log
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        </Scroll>
      </section>
    </div>
  );
}
