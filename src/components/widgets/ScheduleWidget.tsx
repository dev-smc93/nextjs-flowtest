"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useCollectors } from "@/lib/collectorsContext";
import Scroll from "@/components/Scroll";
import { cronReadable, cronNext, daysUntil } from "@/lib/cron";

const fmtDate = (d: Date | null) =>
  d ? d.toLocaleString("ko-KR", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }) : "-";

export default function SchedulePage() {
  const { collectors, configs, updateConfig, mutedIds, toggleMute } = useCollectors();
  const [q, setQ] = useState("");
  const [onlyDue, setOnlyDue] = useState(false);

  // configs(특히 remindDays/cron)·mutedIds가 바뀌면 즉시 다음 점검·상태 재계산
  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    return collectors
      .filter((c) => (s ? c.name.toLowerCase().includes(s) : true))
      .map((c) => {
        const cfg = configs[c.id];
        const next = cronNext(cfg.cron);
        const days = daysUntil(next);
        // 알림 발송 예정일 = 다음 점검일 − N일, 그 날까지 남은 일수
        const alertAt = next ? new Date(next.getTime() - cfg.remindDays * 86_400_000) : null;
        const daysToAlert = daysUntil(alertAt);
        const muted = mutedIds.has(c.id);
        const due = !muted && days !== null && days <= cfg.remindDays;
        return { c, cfg, next, days, alertAt, daysToAlert, due, muted, readable: cronReadable(cfg.cron) };
      })
      .filter((r) => (onlyDue ? r.due : true))
      .sort((a, b) => (a.days ?? 9999) - (b.days ?? 9999));
  }, [collectors, configs, q, onlyDue, mutedIds]);

  const dueCount = useMemo(
    () =>
      collectors.filter((c) => {
        if (mutedIds.has(c.id)) return false; // 제외된 항목은 알림 임박 집계에서 제외
        const cfg = configs[c.id];
        const d = daysUntil(cronNext(cfg.cron));
        return d !== null && d <= cfg.remindDays;
      }).length,
    [collectors, configs, mutedIds]
  );

  return (
    <div className="flex h-full flex-col gap-3 overflow-hidden p-4">
      <div className="flex items-center gap-3">
        <div className="rounded-xl border border-line bg-surface px-4 py-2 text-xs text-muted">
          점검 알림 임박 <span className="font-bold text-amber-300">{dueCount}건</span>
        </div>
        <p className="text-[11px] text-muted">
          중요도별 점검 주기(cron)를 분석해 다음 점검일 <b>N일 전</b>에 알림톡을 발송합니다.
        </p>
        <label className="ml-auto flex items-center gap-1.5 text-xs text-muted">
          <input type="checkbox" checked={onlyDue} onChange={(e) => setOnlyDue(e.target.checked)} />
          임박만 보기
        </label>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="검색"
          className="w-44 rounded-md border border-line bg-surface2 px-2 py-1 text-xs text-fg outline-none focus:border-sky-500"
        />
      </div>

      <section className="flex min-h-0 flex-1 flex-col rounded-xl border border-line bg-surface">
        <Scroll className="min-h-0 flex-1">
          <table className="w-full text-left text-xs">
            <thead className="sticky top-0 bg-surface text-[11px] text-muted">
              <tr className="border-b border-line">
                <th className="px-3 py-2">수집기</th>
                <th className="px-3 py-2">중요도</th>
                <th className="px-3 py-2">점검 주기 (cron)</th>
                <th className="px-3 py-2">해석</th>
                <th className="px-3 py-2">다음 점검</th>
                <th className="px-3 py-2">N일 전</th>
                <th className="px-3 py-2">알림 예정일</th>
                <th className="px-2 py-2 text-center">알림</th>
                <th className="px-3 py-2">상태</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ c, cfg, next, days, alertAt, daysToAlert, due, muted, readable }) => (
                <tr key={c.id} className="border-b border-line hover:bg-zinc-500/10">
                  <td className="px-3 py-2">
                    <div className="font-semibold text-fg">{c.name}</div>
                    <div className="text-[10px] text-muted">{c.externalIp}</div>
                  </td>
                  <td className="px-3 py-2 text-fg">{c.importance}</td>
                  <td className="px-3 py-2">
                    <input
                      value={cfg.cron}
                      onChange={(e) => updateConfig(c.id, { cron: e.target.value })}
                      className="w-32 rounded border border-line bg-surface2 px-1.5 py-0.5 font-mono text-[11px] text-fg outline-none focus:border-sky-500"
                    />
                  </td>
                  <td className="px-3 py-2 text-muted">{readable}</td>
                  <td className="px-3 py-2 font-mono text-[11px] text-fg">{fmtDate(next)}</td>
                  <td className="px-3 py-2">
                    <input
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={cfg.remindDays}
                      onChange={(e) => {
                        // 한 자리 숫자만 허용 → 즉시 다음 점검·상태 재계산(configs 의존)
                        const v = e.target.value.replace(/\D/g, "").slice(0, 1);
                        updateConfig(c.id, { remindDays: v === "" ? 0 : Number(v) });
                      }}
                      className="w-10 rounded border border-line bg-surface2 px-1.5 py-0.5 text-center text-[11px] text-fg outline-none focus:border-sky-500"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <div className="font-mono text-[11px] text-fg">{fmtDate(alertAt)}</div>
                    <div className="text-[10px] text-muted">
                      {daysToAlert === null ? "" : daysToAlert > 0 ? `D-${daysToAlert}` : "발송 구간"}
                    </div>
                  </td>
                  <td className="px-2 py-2 text-center">
                    <button
                      onClick={() => {
                        toggleMute(c.id);
                        toast(muted ? "🔔 점검 알림 포함됨" : "🔕 점검 알림 제외됨", { description: c.name });
                      }}
                      title={muted ? "알림 제외됨 (포함하기)" : "알림 발송 중 (제외하기)"}
                      className="rounded-md px-1 py-0.5 text-sm hover:bg-zinc-500/15"
                    >
                      {muted ? "🔕" : "🔔"}
                    </button>
                  </td>
                  <td className="px-3 py-2">
                    {muted ? (
                      <span className="rounded-full bg-zinc-500/15 px-2 py-0.5 text-[10px] font-semibold text-zinc-400">
                        제외됨
                      </span>
                    ) : due ? (
                      <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-300">
                        ⏰ {days}일 후 · 알림 예정
                      </span>
                    ) : (
                      <span className="text-[10px] text-muted">{days}일 후</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Scroll>
      </section>
    </div>
  );
}
