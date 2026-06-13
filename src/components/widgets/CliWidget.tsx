"use client";

import { useMemo, useState } from "react";
import { useCollectors } from "@/lib/collectorsContext";
import Scroll from "@/components/Scroll";
import { STATUS_META, collectionMetrics, type Collector } from "@/lib/collectors";
import { fmtNum as fmt } from "@/lib/format";

export default function CliWidget() {
  const { collectors } = useCollectors();
  const [onlyRunning, setOnlyRunning] = useState(false);
  const [q, setQ] = useState("");

  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    let list = collectors;
    if (onlyRunning) list = list.filter((c) => c.status === "normal");
    if (s) list = list.filter((c) => c.project.toLowerCase().includes(s) || c.name.toLowerCase().includes(s));
    // 수집 건수 많은 순
    return [...list].sort((a, b) => collectionMetrics(b).collected - collectionMetrics(a).collected);
  }, [collectors, onlyRunning, q]);

  // 금일 전체 수집 합계 (개수 기준)
  const totalCollected = useMemo(
    () => rows.reduce((s, c) => s + collectionMetrics(c).collected, 0),
    [rows]
  );

  return (
    <div className="flex h-full w-full flex-col bg-[#0b0e14]">
      <div className="flex shrink-0 items-center gap-2 border-b border-zinc-800 px-3 py-1.5 font-mono text-[11px] text-zinc-400">
        <span className="shrink-0 text-emerald-400">$ grep</span>
        <div className="relative flex min-w-0 flex-1 items-center">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="프로젝트명 검색…"
            className="w-full bg-transparent text-zinc-200 caret-emerald-400 outline-none placeholder:text-zinc-600"
          />
          {q === "" && <span className="pointer-events-none absolute left-0 inline-block h-3 w-1.5 animate-[blink_1s_steps(1)_infinite] bg-emerald-400" />}
        </div>
        <button
          onClick={() => setOnlyRunning((v) => !v)}
          className={`shrink-0 rounded px-2 py-0.5 text-[10px] font-semibold ${
            onlyRunning ? "bg-emerald-500/20 text-emerald-300" : "bg-zinc-800 text-zinc-400"
          }`}
        >
          {onlyRunning ? "실행중만" : "전체"}
        </button>
      </div>
      {/* 금일 수집 합계 */}
      <div className="flex shrink-0 items-baseline gap-2 border-b border-zinc-800 px-3 py-1.5 font-mono">
        <span className="text-[10px] text-zinc-500"># 금일 수집 합계</span>
        <span className="text-sm font-bold text-emerald-300">{fmt(totalCollected)}</span>
        <span className="text-[10px] text-zinc-500">건 · {rows.length}대</span>
      </div>
      <Scroll className="min-h-0 flex-1">
        <div className="space-y-1 p-2 font-mono text-[11px]">
          {rows.map((c) => (
            <CliLine key={c.id} c={c} />
          ))}
        </div>
      </Scroll>
    </div>
  );
}

function CliLine({ c }: { c: Collector }) {
  const meta = STATUS_META[c.status];
  const { collected } = collectionMetrics(c);
  const stalled = c.status === "error" || c.status === "offline";

  return (
    <div className="flex items-center gap-2 whitespace-pre rounded px-1 py-0.5 leading-none hover:bg-white/5">
      <span className="w-1.5 shrink-0" style={{ color: meta.color }}>
        {stalled ? "✗" : "›"}
      </span>
      <span className="w-[170px] shrink-0 truncate text-zinc-300" title={c.name}>
        {c.name}
      </span>
      {/* 핵심: 금일 수집 건수 (추후 수집률 %·시간당 처리량으로 확장) */}
      <span className="w-[110px] shrink-0 text-right font-semibold text-emerald-300">
        {fmt(collected)}
        <span className="ml-0.5 text-[9px] font-normal text-zinc-500">건</span>
      </span>
      <span className="min-w-0 flex-1 truncate text-zinc-600">
        {stalled ? `· ${meta.label} (정지)` : "· 수집·적재 중"}
      </span>
    </div>
  );
}
