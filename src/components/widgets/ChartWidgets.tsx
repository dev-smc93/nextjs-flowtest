"use client";

import { useMemo, useState } from "react";
import { format } from "date-fns";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useCollectors } from "@/lib/collectorsContext";
import { STATUS_META } from "@/lib/collectors";

const ERROR_C = STATUS_META.error.color; // #ef4444
const OFFLINE_C = STATUS_META.offline.color; // #f59e0b

// 다크/라이트 공통 툴팁 스타일
const tooltipStyle = {
  background: "var(--surface)",
  border: "1px solid var(--line)",
  borderRadius: 10,
  fontSize: 12,
  color: "var(--text)",
};

const axisTick = { fontSize: 10, fill: "var(--muted)" } as const;

// ============================ 에러·중지 일별 추이 ============================
const RANGES = [7, 14, 30] as const;
type Range = (typeof RANGES)[number];

export function TrendChartWidget() {
  const { errorEvents } = useCollectors();
  const [days, setDays] = useState<Range>(14);

  // errorEvents를 일 단위로 버킷팅 → 오류/중지 건수 시계열
  const data = useMemo(() => {
    const DAY = 86_400_000;
    const today = new Date().setHours(0, 0, 0, 0);
    const start = today - (days - 1) * DAY;
    const buckets = new Map<number, { day: string; 오류: number; 중지: number }>();
    for (let i = 0; i < days; i++) {
      const d = start + i * DAY;
      buckets.set(d, { day: format(d, "MM/dd"), 오류: 0, 중지: 0 });
    }
    for (const e of errorEvents) {
      if (e.ts < start) continue;
      const d = new Date(e.ts).setHours(0, 0, 0, 0);
      const b = buckets.get(d);
      if (b) e.status === "offline" ? (b.중지 += 1) : (b.오류 += 1);
    }
    return [...buckets.values()];
  }, [errorEvents, days]);

  const total = useMemo(() => data.reduce((s, d) => s + d.오류 + d.중지, 0), [data]);

  return (
    <div className="flex h-full w-full flex-col">
      <div className="flex shrink-0 items-center justify-between border-b border-line px-3 py-2 text-[11px]">
        <span className="font-semibold text-fg">
          에러·중지 추이 <span className="text-muted">· 최근 {days}일 {total}건</span>
        </span>
        <div className="bg-surface2 inline-flex gap-0.5 rounded-lg p-0.5">
          {RANGES.map((r) => (
            <button
              key={r}
              onClick={() => setDays(r)}
              className={`rounded-md px-2 py-0.5 text-[11px] font-semibold transition ${
                days === r ? "bg-sky-500/20 text-sky-300" : "text-muted hover:text-fg"
              }`}
            >
              {r}일
            </button>
          ))}
        </div>
      </div>
      <div className="min-h-0 flex-1 p-2">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
            <defs>
              <linearGradient id="gErr" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={ERROR_C} stopOpacity={0.5} />
                <stop offset="100%" stopColor={ERROR_C} stopOpacity={0.03} />
              </linearGradient>
              <linearGradient id="gOff" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={OFFLINE_C} stopOpacity={0.5} />
                <stop offset="100%" stopColor={OFFLINE_C} stopOpacity={0.03} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--grid)" vertical={false} />
            <XAxis dataKey="day" tick={axisTick} tickLine={false} axisLine={{ stroke: "var(--line)" }} interval="preserveStartEnd" minTickGap={16} />
            <YAxis tick={axisTick} tickLine={false} axisLine={false} allowDecimals={false} width={28} />
            <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: "var(--muted)" }} />
            <Legend iconType="circle" wrapperStyle={{ fontSize: 11 }} />
            <Area type="monotone" dataKey="오류" stackId="1" stroke={ERROR_C} strokeWidth={2} fill="url(#gErr)" isAnimationActive={false} />
            <Area type="monotone" dataKey="중지" stackId="1" stroke={OFFLINE_C} strokeWidth={2} fill="url(#gOff)" isAnimationActive={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ============================ 중요도별 에러 분포 ============================
// 어떤 중요도의 작업에서 장애가 집중되는지 한눈에 (운영 우선순위 판단용)
const IMP_ORDER = ["높음", "중간", "낮음"] as const;

export function ImportanceBarWidget() {
  const { collectors } = useCollectors();

  const data = useMemo(() => {
    const m: Record<string, { importance: string; 오류: number; 중지: number }> = {};
    for (const imp of IMP_ORDER) m[imp] = { importance: imp, 오류: 0, 중지: 0 };
    for (const c of collectors) {
      if (c.status === "error") m[c.importance].오류 += c.errorsToday || 1;
      else if (c.status === "offline") m[c.importance].중지 += 1;
    }
    return IMP_ORDER.map((i) => m[i]);
  }, [collectors]);

  return (
    <div className="flex h-full w-full flex-col">
      <div className="flex shrink-0 items-center justify-between border-b border-line px-3 py-2 text-[11px]">
        <span className="font-semibold text-fg">중요도별 장애 분포</span>
        <span className="text-muted">현재 기준</span>
      </div>
      <div className="min-h-0 flex-1 p-2">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--grid)" vertical={false} />
            <XAxis dataKey="importance" tick={axisTick} tickLine={false} axisLine={{ stroke: "var(--line)" }} />
            <YAxis tick={axisTick} tickLine={false} axisLine={false} allowDecimals={false} width={28} />
            <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: "var(--muted)" }} cursor={{ fill: "rgba(113,113,122,0.12)" }} />
            <Legend iconType="circle" wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="오류" stackId="1" fill={ERROR_C} isAnimationActive={false} />
            <Bar dataKey="중지" stackId="1" fill={OFFLINE_C} radius={[3, 3, 0, 0]} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
