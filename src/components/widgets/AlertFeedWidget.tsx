"use client";

import { useEffect, useMemo, useState } from "react";
import { useCollectors, type ErrorEvent } from "@/lib/collectorsContext";
import Scroll from "@/components/Scroll";
import { bandKey } from "@/lib/graphLayout";
import { STATUS_META, STATUS_SEVERITY, type Collector } from "@/lib/collectors";
import { fmtTime } from "@/lib/format";

export default function AlertFeedWidget() {
  const { collectors, errorEvents, focusId, focusNonce } = useCollectors();
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [highlight, setHighlight] = useState<string | null>(null);

  // 금일(자정 이후) 에러/중지 이벤트만, 수집기별 그룹핑
  const todayStart = useMemo(() => new Date().setHours(0, 0, 0, 0), []);
  const eventsBy = useMemo(() => {
    const m = new Map<string, ErrorEvent[]>();
    for (const e of errorEvents) {
      if (e.ts < todayStart) continue;
      (m.get(e.collectorId) ?? m.set(e.collectorId, []).get(e.collectorId)!).push(e);
    }
    return m;
  }, [errorEvents, todayStart]);

  const byId = useMemo(() => new Map(collectors.map((c) => [c.id, c])), [collectors]);

  const items = useMemo(() => {
    const arr = [...eventsBy.entries()]
      .map(([id, events]) => ({ c: byId.get(id), events }))
      .filter((x): x is { c: Collector; events: ErrorEvent[] } => !!x.c);
    arr.sort((a, b) => STATUS_SEVERITY[b.c.status] - STATUS_SEVERITY[a.c.status] || b.events.length - a.events.length);
    return arr;
  }, [eventsBy, byId]);

  // 목록에서 선택(focus) → 펼침 + 강조 + 스크롤
  useEffect(() => {
    if (!focusId || !eventsBy.has(focusId)) return;
    setExpanded((p) => (p.has(focusId) ? p : new Set(p).add(focusId)));
    setHighlight(focusId);
    const t1 = setTimeout(() => {
      document.getElementById(`alert-${focusId}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 60);
    const t2 = setTimeout(() => setHighlight(null), 2400);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusNonce]);

  const toggle = (id: string) =>
    setExpanded((p) => {
      const n = new Set(p);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });

  return (
    <div className="flex h-full w-full flex-col">
      <div className="flex shrink-0 items-center gap-2 border-b border-line px-3 py-2 text-[11px]">
        <span className="font-semibold text-fg">금일 장애·중지</span>
        <span className="text-muted">{items.length}개 항목</span>
      </div>
      <Scroll className="min-h-0 flex-1">
        {items.length === 0 ? (
          <div className="flex h-full items-center justify-center text-xs text-emerald-400">✓ 금일 이상 없음</div>
        ) : (
          <ul className="divide-y divide-zinc-500/20">
            {items.map(({ c, events }) => (
              <AlertRow
                key={c.id}
                c={c}
                events={events}
                open={expanded.has(c.id)}
                highlight={highlight === c.id}
                onExpand={() => toggle(c.id)}
              />
            ))}
          </ul>
        )}
      </Scroll>
    </div>
  );
}

function AlertRow({
  c,
  events,
  open,
  highlight,
  onExpand,
}: {
  c: Collector;
  events: ErrorEvent[];
  open: boolean;
  highlight: boolean;
  onExpand: () => void;
}) {
  const meta = STATUS_META[c.status];
  const alarming = c.status === "error" || c.status === "offline";
  const rep = events[0];
  // 금일 오류/정지 건수 분리 (배지 색을 종류에 맞춰 표시 → 정상 복구 항목이 빨갛게 오해되지 않도록)
  const errN = events.filter((e) => e.status !== "offline").length;
  const offN = events.length - errN;

  return (
    <li
      id={`alert-${c.id}`}
      className={`fade-in rounded transition-colors ${highlight ? "bg-sky-500/15 ring-1 ring-sky-400/50" : ""}`}
    >
      <div onClick={onExpand} className="relative flex cursor-pointer items-center gap-3 px-3 py-2 hover:bg-zinc-500/10">
        <span
          className={`h-2.5 w-2.5 shrink-0 rounded-full ${alarming ? "status-glow" : ""}`}
          style={{ backgroundColor: meta.color, boxShadow: `0 0 8px ${meta.color}` }}
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className={`text-[9px] text-muted transition-transform ${open ? "" : "-rotate-90"}`}>▾</span>
            <span className="truncate text-xs font-semibold text-fg">{c.name}</span>
            {errN > 0 && (
              <span className="shrink-0 rounded-full bg-red-500/15 px-1.5 text-[9px] font-bold text-red-300">
                오류 {errN}
              </span>
            )}
            {offN > 0 && (
              <span className="shrink-0 rounded-full bg-amber-500/15 px-1.5 text-[9px] font-bold text-amber-300">
                정지 {offN}
              </span>
            )}
          </div>
          <div className="truncate pl-3 text-[10px] text-muted">{rep ? rep.message : bandKey(c.externalIp)}</div>
        </div>
        <div className="shrink-0 text-right">
          <div className="text-[11px] font-semibold" style={{ color: meta.color }}>
            {meta.label}
          </div>
          <div className="text-[10px] text-muted">{fmtTime(rep?.ts ?? Date.now())}</div>
        </div>
      </div>

      <div className="grid transition-[grid-template-rows] duration-300 ease-in-out" style={{ gridTemplateRows: open ? "1fr" : "0fr" }}>
        <div className="overflow-hidden">
          <ul className="space-y-1 px-3 pb-2 pl-9">
            {events.map((e) => (
              <li key={e.id} className="text-[10px]">
                <span className="font-mono text-muted">{fmtTime(e.ts)}</span>{" "}
                <span style={{ color: STATUS_META[e.status].color }}>{STATUS_META[e.status].label}</span>{" "}
                <span className="text-fg">{e.message}</span>
                <div
                  className="mt-0.5 flex items-start gap-1.5 overflow-hidden rounded-md border-l-2 bg-black/40 px-2 py-1 font-mono shadow-inner"
                  style={{ borderColor: STATUS_META[e.status].color }}
                >
                  <span className="shrink-0 select-none text-emerald-400">❯</span>
                  <span className="break-all text-zinc-300">{e.log}</span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </li>
  );
}
