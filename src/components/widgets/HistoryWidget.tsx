"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { DayPicker, type DateRange } from "react-day-picker";
import { ko } from "date-fns/locale";
import "react-day-picker/style.css";
import { useCollectors } from "@/lib/collectorsContext";
import Scroll from "@/components/Scroll";
import { Stat } from "@/components/ui";
import { STATUS_META, type Collector } from "@/lib/collectors";
import { fmtDateTime as fmtTime } from "@/lib/format";

const fmtDay = (d?: Date) =>
  d ? d.toLocaleDateString("ko-KR", { year: "2-digit", month: "2-digit", day: "2-digit" }) : "—";

// 위젯 1: 요약 카드 + 수집기별 금일 에러/정지 TOP (오류·정지 구분 누적 막대)
const ERR_C = STATUS_META.error.color; // #ef4444
const OFF_C = STATUS_META.offline.color; // #f59e0b

export function HistoryTopWidget() {
  const { collectors, errorEvents } = useCollectors();
  const todayStart = useMemo(() => new Date().setHours(0, 0, 0, 0), []);
  const byId = useMemo(() => new Map(collectors.map((c) => [c.id, c])), [collectors]);

  // 금일 이벤트를 수집기별 오류/정지 건수로 집계
  const top = useMemo(() => {
    const m = new Map<string, { error: number; offline: number }>();
    for (const e of errorEvents) {
      if (e.ts < todayStart) continue;
      const r = m.get(e.collectorId) ?? { error: 0, offline: 0 };
      if (e.status === "offline") r.offline += 1;
      else r.error += 1;
      m.set(e.collectorId, r);
    }
    return [...m.entries()]
      .map(([id, v]) => ({ c: byId.get(id), ...v, total: v.error + v.offline }))
      .filter((x): x is { c: Collector; error: number; offline: number; total: number } => !!x.c)
      .sort((a, b) => b.total - a.total)
      .slice(0, 14);
  }, [errorEvents, byId, todayStart]);

  const maxTotal = Math.max(1, ...top.map((r) => r.total));
  const totalErr = top.reduce((s, r) => s + r.error, 0);
  const totalOff = top.reduce((s, r) => s + r.offline, 0);

  return (
    <div className="flex h-full flex-col gap-3 p-3">
      <div className="grid shrink-0 grid-cols-3 gap-3">
        <Stat label="금일 오류" value={`${totalErr}건`} accent={ERR_C} />
        <Stat label="금일 정지" value={`${totalOff}건`} accent={OFF_C} />
        <Stat label="기록된 이벤트" value={`${errorEvents.length}건`} accent="#38bdf8" />
      </div>
      <div className="border-line bg-surface flex min-h-0 flex-1 flex-col rounded-xl border">
        <div className="border-line flex items-center justify-between border-b px-4 py-2">
          <span className="text-sm font-bold text-fg">수집기별 금일 에러 / 정지 TOP</span>
          {/* 범례 */}
          <span className="flex items-center gap-3 text-[10px] text-muted">
            <span className="flex items-center gap-1"><i className="h-2 w-2 rounded-full" style={{ background: ERR_C }} /> 오류</span>
            <span className="flex items-center gap-1"><i className="h-2 w-2 rounded-full" style={{ background: OFF_C }} /> 정지</span>
          </span>
        </div>
        <Scroll className="min-h-0 flex-1">
          <div className="space-y-2 p-4">
            {top.length === 0 && <div className="py-10 text-center text-xs text-emerald-400">금일 이상 없음 ✓</div>}
            {top.map(({ c, error, offline, total }) => (
              <div key={c.id} className="flex items-center gap-2 text-xs">
                <span className="w-40 shrink-0 truncate text-fg" title={c.name}>{c.name}</span>
                {/* 끝이 둥근 pill 형태 누적 막대 */}
                <div className="relative h-3 flex-1 rounded-full bg-surface2">
                  <div
                    className="absolute inset-y-0 left-0 flex overflow-hidden rounded-full"
                    style={{ width: `${(total / maxTotal) * 100}%` }}
                  >
                    {error > 0 && (
                      <div className="h-full" style={{ width: `${(error / total) * 100}%`, background: ERR_C }} title={`오류 ${error}`} />
                    )}
                    {offline > 0 && <div className="h-full flex-1" style={{ background: OFF_C }} title={`정지 ${offline}`} />}
                  </div>
                </div>
                <span className="w-16 shrink-0 text-right text-[11px] font-semibold tabular-nums">
                  <span className="text-red-400">{error}</span>
                  <span className="text-muted"> · </span>
                  <span className="text-amber-400">{offline}</span>
                </span>
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
  const { errorEvents, collectors } = useCollectors();
  const [range, setRange] = useState<DateRange | undefined>(() => ({
    from: new Date(Date.now() - 30 * 86400_000),
    to: new Date(),
  }));
  const [calOpen, setCalOpen] = useState(false);
  const [sel, setSel] = useState<string>("all"); // 단일 필터: 이력 있는 작업명
  const calRef = useRef<HTMLDivElement>(null);

  // 에러/정지 이력이 있는 작업명만, 프로젝트별로 그룹화 (콤보박스 옵션)
  const histNames = useMemo(() => new Set(errorEvents.map((e) => e.name)), [errorEvents]);
  const grouped = useMemo(() => {
    const m = new Map<string, Set<string>>();
    for (const c of collectors) {
      if (!histNames.has(c.name)) continue;
      (m.get(c.project) ?? m.set(c.project, new Set()).get(c.project)!).add(c.name);
    }
    return [...m.entries()]
      .sort((a, b) => (a[0] < b[0] ? -1 : 1))
      .map(([proj, names]) => ({ proj, names: [...names].sort() }));
  }, [collectors, histNames]);

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
    return errorEvents.filter((e) => e.ts >= f && e.ts <= t && (sel === "all" || e.name === sel));
  }, [errorEvents, range, sel]);

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
          {/* 이력 있는 작업만, 프로젝트별 그룹 — 단일 콤보박스 */}
          <select
            value={sel}
            onChange={(e) => setSel(e.target.value)}
            className="border-line bg-surface2 text-fg ml-auto max-w-[220px] rounded-lg border px-2 py-1.5 text-[11px] font-normal outline-none focus:border-sky-500"
          >
            <option value="all">전체 (이력 있는 작업)</option>
            {grouped.map((g) => (
              <optgroup key={g.proj} label={g.proj}>
                {g.names.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
          <div ref={calRef} className="relative text-[11px] font-normal">
            <button
              onClick={() => setCalOpen((v) => !v)}
              className="btn-3d border-line bg-surface2 text-fg flex items-center gap-1.5 rounded-lg border px-3 py-1.5"
            >
              📅 {fmtDay(range?.from)} ~ {fmtDay(range?.to)}
            </button>
            {calOpen && (
              <div className="card-3d bg-surface page-enter absolute right-0 top-full z-30 mt-1 rounded-xl p-2">
                <DayPicker
                  mode="range"
                  locale={ko}
                  selected={range}
                  onSelect={setRange}
                  numberOfMonths={2}
                  defaultMonth={range?.from}
                  max={31}
                  disabled={{ after: new Date() }}
                />
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
          {ranged.length === 0 ? (
            <div className="py-10 text-center text-xs text-muted">해당 기간 내 이벤트가 없습니다.</div>
          ) : (
            <div className="relative py-3 pl-8 pr-4">
              {/* 세로 타임라인 레일 */}
              <div className="absolute bottom-3 left-[16px] top-3 w-px bg-zinc-500/20" />
              <ul className="space-y-2.5">
                {ranged.map((e, i) => {
                  const meta = STATUS_META[e.status];
                  const prev = ranged[i - 1];
                  const newDay = !prev || new Date(prev.ts).toDateString() !== new Date(e.ts).toDateString();
                  return (
                    <Fragment key={e.id}>
                      {/* 날짜 구분 */}
                      {newDay && (
                        <li className="relative -ml-3 pt-1.5 pb-0.5">
                          <span className="bg-surface2 text-muted rounded-full px-2 py-0.5 text-[10px] font-semibold">
                            {fmtDay(new Date(e.ts))}
                          </span>
                        </li>
                      )}
                      <li className="group relative">
                        {/* 상태 점 마커 */}
                        <span
                          className={`absolute -left-[22px] top-2 h-3 w-3 rounded-full border-2 border-surface ${
                            e.status === "offline" ? "" : "status-glow"
                          }`}
                          style={{ backgroundColor: meta.color, boxShadow: `0 0 6px ${meta.color}` }}
                        />
                        {/* 이벤트 카드 */}
                        <div className="border-line bg-surface2/40 rounded-lg border p-2.5 text-xs transition hover:bg-surface2/70">
                          <div className="flex items-center gap-2">
                            <span
                              className="rounded px-1.5 py-0.5 text-[10px] font-semibold"
                              style={{ backgroundColor: `${meta.color}1f`, color: meta.color }}
                            >
                              {meta.label}
                            </span>
                            <span className="truncate font-semibold text-fg">{e.name}</span>
                            <span className="font-mono text-[10px] text-muted">{fmtTime(e.ts)}</span>
                            <button
                              onClick={() => copyLog(e)}
                              title="로그 복사"
                              className="text-muted ml-auto shrink-0 rounded px-1.5 py-0.5 text-[10px] opacity-0 transition hover:bg-zinc-500/15 hover:text-sky-400 group-hover:opacity-100"
                            >
                              📋 복사
                            </button>
                          </div>
                          <div className="mt-0.5 truncate text-[10px] text-muted">{e.message}</div>
                          {/* 중지(끊김)는 로그가 없으므로 오류일 때만 로그 박스 표시 */}
                          {e.status !== "offline" && (
                            <div
                              className="mt-1.5 flex items-start gap-2 overflow-hidden rounded-md border-l-2 bg-black/40 px-2.5 py-1.5 font-mono text-[10px] shadow-inner"
                              style={{ borderColor: meta.color }}
                            >
                              <span className="shrink-0 select-none text-emerald-400">❯</span>
                              <span className="break-all text-zinc-300">{e.log}</span>
                              <span
                                className="ml-auto shrink-0 select-none rounded bg-white/5 px-1 text-[8px] uppercase tracking-wider"
                                style={{ color: meta.color }}
                              >
                                log
                              </span>
                            </div>
                          )}
                        </div>
                      </li>
                    </Fragment>
                  );
                })}
              </ul>
            </div>
          )}
        </Scroll>
      </section>
    </div>
  );
}
