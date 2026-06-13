"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useCollectors } from "@/lib/collectorsContext";
import Scroll from "@/components/Scroll";
import { STATUS_META, STATUS_SEVERITY, formatSignal, type Collector } from "@/lib/collectors";

type SortKey = "status" | "name" | "type" | "intervalSec" | "lastSignalSec" | "errorsToday";

const IMP_COLOR: Record<string, string> = { 높음: "#ec4899", 중간: "#f59e0b", 낮음: "#94a3b8" };

function highlight(text: string, q: string) {
  if (!q) return text;
  const i = text.toLowerCase().indexOf(q.toLowerCase());
  if (i < 0) return text;
  return (
    <>
      {text.slice(0, i)}
      <mark className="rounded bg-amber-400/40 text-fg">{text.slice(i, i + q.length)}</mark>
      {text.slice(i + q.length)}
    </>
  );
}

export default function TableWidget() {
  const { collectors, errorEvents, mutedIds, toggleMute, focusCollector, statusFilter, setStatusFilter, focusId } =
    useCollectors();
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("status");
  const [asc, setAsc] = useState(false);

  // 금일 정지(끊김) 횟수 — errorEvents에서 수집기별 집계
  const offlineToday = useMemo(() => {
    const todayStart = new Date().setHours(0, 0, 0, 0);
    const m = new Map<string, number>();
    for (const e of errorEvents) {
      if (e.ts < todayStart || e.status !== "offline") continue;
      m.set(e.collectorId, (m.get(e.collectorId) ?? 0) + 1);
    }
    return m;
  }, [errorEvents]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = collectors;
    if (statusFilter) list = list.filter((c) => c.status === statusFilter);
    if (q) {
      list = list.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.project.toLowerCase().includes(q) ||
          c.externalIp.includes(q) ||
          c.internalIp.includes(q)
      );
    }
    const dir = asc ? 1 : -1;
    return [...list].sort((a, b) => {
      const av = sortKey === "status" ? STATUS_SEVERITY[a.status] : a[sortKey];
      const bv = sortKey === "status" ? STATUS_SEVERITY[b.status] : b[sortKey];
      if (av < bv) return -1 * dir;
      if (av > bv) return 1 * dir;
      return 0;
    });
  }, [collectors, query, sortKey, asc, statusFilter]);

  const toggleSort = (k: SortKey) => {
    if (k === sortKey) setAsc((v) => !v);
    else {
      setSortKey(k);
      setAsc(false);
    }
  };

  return (
    <div className="flex h-full w-full flex-col">
      <div className="flex shrink-0 items-center gap-2 border-b border-line p-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="작업 / 프로젝트 / IP 검색"
          className="min-w-0 flex-1 rounded-md border border-line bg-surface2 px-3 py-1.5 text-xs text-fg outline-none placeholder:text-muted focus:border-sky-500"
        />
        {statusFilter && (
          <button
            onClick={() => setStatusFilter(null)}
            className="shrink-0 rounded-full px-2 py-1 text-[11px] font-semibold"
            style={{ backgroundColor: `${STATUS_META[statusFilter].color}22`, color: STATUS_META[statusFilter].color }}
          >
            {STATUS_META[statusFilter].label} ✕
          </button>
        )}
      </div>
      <Scroll className="min-h-0 flex-1">
        <table className="w-full text-left text-xs">
          <thead className="sticky top-0 z-10 bg-surface text-[11px] text-muted">
            <tr className="border-b border-line">
              <Th label="상태" k="status" {...{ sortKey, asc, toggleSort }} />
              <Th label="작업 / 프로젝트" k="name" {...{ sortKey, asc, toggleSort }} />
              <Th label="유형" k="type" {...{ sortKey, asc, toggleSort }} />
              <th className="px-3 py-2 font-medium">중요도</th>
              <Th label="주기" k="intervalSec" {...{ sortKey, asc, toggleSort }} />
              <Th label="최근 신호" k="lastSignalSec" {...{ sortKey, asc, toggleSort }} />
              <Th label="에러" k="errorsToday" {...{ sortKey, asc, toggleSort }} />
              <th className="px-3 py-2 font-medium">정지</th>
              <th className="px-3 py-2 font-medium">외부/내부 IP</th>
              <th className="px-2 py-2 text-center font-medium">알림</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => (
              <Row
                key={c.id}
                c={c}
                q={query.trim()}
                muted={mutedIds.has(c.id)}
                selected={focusId === c.id}
                offlineCount={offlineToday.get(c.id) ?? 0}
                onMute={() => {
                  const was = mutedIds.has(c.id);
                  toggleMute(c.id);
                  toast(was ? "🔔 알림 포함됨" : "🔕 알림 제외됨", { description: c.name });
                }}
                onFocus={() => focusCollector(c.id)}
              />
            ))}
          </tbody>
        </table>
        {rows.length === 0 && (
          <div className="p-6 text-center text-xs text-muted">결과 없음</div>
        )}
      </Scroll>
    </div>
  );
}

function Th({
  label,
  k,
  sortKey,
  asc,
  toggleSort,
}: {
  label: string;
  k: SortKey;
  sortKey: SortKey;
  asc: boolean;
  toggleSort: (k: SortKey) => void;
}) {
  const active = sortKey === k;
  return (
    <th
      onClick={() => toggleSort(k)}
      className="cursor-pointer select-none whitespace-nowrap px-3 py-2 font-medium hover:text-fg"
    >
      {label}
      <span className="ml-1 text-[9px] text-sky-400">{active ? (asc ? "▲" : "▼") : ""}</span>
    </th>
  );
}

function Row({
  c,
  q,
  muted,
  selected,
  offlineCount,
  onMute,
  onFocus,
}: {
  c: Collector;
  q: string;
  muted: boolean;
  selected: boolean;
  offlineCount: number;
  onMute: () => void;
  onFocus: () => void;
}) {
  const meta = STATUS_META[c.status];
  const [pathOpen, setPathOpen] = useState(false);
  return (
    <tr
      onClick={onFocus}
      title="클릭 → 그래프/알림 이력에서 보기"
      className={`cursor-pointer border-b border-line transition-colors ${
        selected ? "bg-sky-500/15 ring-1 ring-inset ring-sky-400/50" : "hover:bg-zinc-500/10"
      }`}
    >
      <td className="px-3 py-2">
        <div className="flex items-center gap-1.5">
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold"
            style={{ backgroundColor: `${meta.color}1f`, color: meta.color }}
          >
            <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: meta.color }} />
            {meta.label}
          </span>
          {c.virtual && (
            <span className="rounded-full bg-violet-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-violet-300">
              🧠 가상
            </span>
          )}
          {c.status === "normal" && c.errorsToday > 0 && (
            <span
              title={`금일 에러 ${c.errorsToday}건 (현재 복구)`}
              className="status-glow h-1.5 w-1.5 rounded-full bg-amber-400"
            />
          )}
        </div>
      </td>
      <td className="relative px-3 py-2">
        <div className="font-semibold text-fg">{highlight(c.name, q)}</div>
        <div className="flex items-center gap-1 text-[10px] text-muted">
          {highlight(c.project, q)}
          {c.path && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setPathOpen((v) => !v);
              }}
              title="실행 경로 보기"
              className="text-sky-400 inline-flex items-center rounded px-1 hover:bg-zinc-500/20"
            >
              <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 17l6-6-6-6" />
                <path d="M12 19h8" />
              </svg>
            </button>
          )}
        </div>
        {c.path && pathOpen && (
          <div
            onClick={(e) => e.stopPropagation()}
            className="card-3d bg-surface page-enter absolute left-3 top-full z-30 mt-1 max-w-[320px] rounded-lg p-2.5"
          >
            <div className="text-muted mb-1 text-[10px] font-semibold">실행 경로</div>
            <div className="break-all font-mono text-[11px] text-fg">{c.path}</div>
            <div className="mt-1.5 text-right">
              <button onClick={() => setPathOpen(false)} className="text-sky-400 text-[10px] font-semibold">
                닫기
              </button>
            </div>
          </div>
        )}
      </td>
      <td className="px-3 py-2">
        <span
          className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
            c.kind === "dbproc" ? "bg-cyan-500/15 text-cyan-300" : "bg-violet-500/15 text-violet-300"
          }`}
        >
          {c.kind === "dbproc" ? "PROC" : c.type}
        </span>
      </td>
      <td className="px-3 py-2">
        <span className="text-[11px] font-semibold" style={{ color: IMP_COLOR[c.importance] }}>
          {c.importance}
        </span>
      </td>
      <td className="px-3 py-2 text-fg">{c.intervalSec}초</td>
      <td className="px-3 py-2 text-fg">{formatSignal(c.lastSignalSec)}</td>
      <td className="px-3 py-2">
        {c.errorsToday > 0 ? (
          <span className="font-semibold text-red-400">{c.errorsToday}건</span>
        ) : (
          <span className="text-muted">-</span>
        )}
      </td>
      <td className="px-3 py-2">
        {offlineCount > 0 ? (
          <span className="font-semibold text-amber-400">{offlineCount}건</span>
        ) : (
          <span className="text-muted">-</span>
        )}
      </td>
      <td className="whitespace-nowrap px-3 py-2 font-mono text-[10px] text-muted">
        <div>외부 {c.externalIp}</div>
        <div>내부 {c.internalIp}</div>
      </td>
      <td className="px-2 py-2 text-center">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onMute();
          }}
          title={muted ? "알림 제외됨 (켜기)" : "알림 발송중 (끄기)"}
          className="rounded-md px-1 py-0.5 text-sm hover:bg-zinc-500/15"
        >
          {muted ? "🔕" : "🔔"}
        </button>
      </td>
    </tr>
  );
}
