"use client";

import { useMemo, useState } from "react";
import { useCollectors } from "@/lib/collectorsContext";
import Scroll from "@/components/Scroll";
import { Toggle, Field } from "@/components/ui";
import { STATUS_META, type Importance } from "@/lib/collectors";

const IMP_RANK: Record<Importance, number> = { 높음: 3, 중간: 2, 낮음: 1 };
const IMPS: Importance[] = ["높음", "중간", "낮음"];

export default function AlertsPage() {
  const { collectors, alertConfig, setAlertConfig, mutedIds, toggleMute, errorEvents, configs, updateConfig } =
    useCollectors();
  const [q, setQ] = useState("");
  const [kw, setKw] = useState("");

  // 수집기별 최근 에러 로그
  const lastLog = useMemo(() => {
    const m = new Map<string, string>();
    for (const e of errorEvents) if (!m.has(e.collectorId)) m.set(e.collectorId, `${e.message} ${e.log}`);
    return m;
  }, [errorEvents]);

  // 전역 + 수집기별 키워드로 제외 판정
  const keywordExcluded = (id: string) => {
    const log = lastLog.get(id);
    if (!log) return false;
    const keys = [...alertConfig.excludeKeywords, ...(configs[id]?.excludeKeywords ?? [])];
    return keys.some((k) => k && log.includes(k));
  };

  const addLocalKeyword = (id: string, v: string) => {
    const t = v.trim();
    const cur = configs[id]?.excludeKeywords ?? [];
    if (!t || cur.includes(t)) return;
    updateConfig(id, { excludeKeywords: [...cur, t] });
  };
  const removeLocalKeyword = (id: string, k: string) =>
    updateConfig(id, { excludeKeywords: (configs[id]?.excludeKeywords ?? []).filter((x) => x !== k) });

  // 현재 이상 항목 중 실제 발송 대상 (정책 적용)
  const preview = useMemo(() => {
    const anomalies = collectors.filter((c) => c.status === "error" || c.status === "offline");
    const willSend = anomalies.filter(
      (c) =>
        alertConfig.enabled &&
        !mutedIds.has(c.id) &&
        IMP_RANK[c.importance] >= IMP_RANK[alertConfig.minImportance] &&
        !keywordExcluded(c.id)
    );
    return { total: anomalies.length, send: willSend.length, excluded: anomalies.length - willSend.length };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collectors, alertConfig, mutedIds, lastLog]);

  const addKeyword = () => {
    const v = kw.trim();
    if (!v || alertConfig.excludeKeywords.includes(v)) return;
    setAlertConfig({ excludeKeywords: [...alertConfig.excludeKeywords, v] });
    setKw("");
  };
  const removeKeyword = (k: string) =>
    setAlertConfig({ excludeKeywords: alertConfig.excludeKeywords.filter((x) => x !== k) });

  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    const list = s
      ? collectors.filter((c) => c.name.toLowerCase().includes(s) || c.project.toLowerCase().includes(s))
      : collectors;
    return [...list].sort((a, b) => IMP_RANK[b.importance] - IMP_RANK[a.importance]);
  }, [collectors, q]);

  return (
    <div className="page-enter h-full overflow-hidden p-4">
      <div className="grid h-full grid-cols-[360px_1fr] gap-4">
        {/* 글로벌 정책 */}
        <Scroll className="min-h-0">
          <div className="space-y-4 pr-2">
            <section className="rounded-xl border border-line bg-surface p-4">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-bold text-fg">💬 카카오 알림톡</h2>
                <Toggle on={alertConfig.enabled} onChange={(v) => setAlertConfig({ enabled: v })} />
              </div>
              <Field label="봇 이름">
                <input
                  value={alertConfig.botName}
                  onChange={(e) => setAlertConfig({ botName: e.target.value })}
                  className="inp w-full"
                />
              </Field>
              <Field label="API 토큰">
                <input
                  type="password"
                  value={alertConfig.token}
                  placeholder="토큰을 입력하세요"
                  onChange={(e) => setAlertConfig({ token: e.target.value })}
                  className="inp w-full"
                />
              </Field>
            </section>

            <section className="rounded-xl border border-line bg-surface p-4">
              <h2 className="mb-3 text-sm font-bold text-fg">발송 정책</h2>
              <Field label="최소 중요도">
                <select
                  value={alertConfig.minImportance}
                  onChange={(e) => setAlertConfig({ minImportance: e.target.value as Importance })}
                  className="inp w-full"
                >
                  {IMPS.map((i) => (
                    <option key={i} value={i}>
                      {i} 이상
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="연속 오류 N회 이상">
                <input
                  type="number"
                  min={1}
                  value={alertConfig.consecutive}
                  onChange={(e) => setAlertConfig({ consecutive: Number(e.target.value) })}
                  className="inp w-full"
                />
              </Field>
              <Field label="재발송 쿨다운(초)">
                <input
                  type="number"
                  min={0}
                  value={alertConfig.cooldownSec}
                  onChange={(e) => setAlertConfig({ cooldownSec: Number(e.target.value) })}
                  className="inp w-full"
                />
              </Field>
              <Field label="방해 금지 시간">
                <div className="flex items-center gap-2">
                  <Toggle
                    on={alertConfig.quietEnabled}
                    onChange={(v) => setAlertConfig({ quietEnabled: v })}
                  />
                  <input
                    type="time"
                    value={alertConfig.quietFrom}
                    onChange={(e) => setAlertConfig({ quietFrom: e.target.value })}
                    className="inp w-full"
                  />
                  <span className="text-muted">~</span>
                  <input
                    type="time"
                    value={alertConfig.quietTo}
                    onChange={(e) => setAlertConfig({ quietTo: e.target.value })}
                    className="inp w-full"
                  />
                </div>
              </Field>
            </section>

            <section className="rounded-xl border border-line bg-surface p-4">
              <h2 className="mb-1 text-sm font-bold text-fg">에러 키워드 제외</h2>
              <p className="mb-2 text-[11px] text-muted">
                에러 로그에 아래 단어가 포함되면 알림톡에서 제외합니다(예: 일시적·429·재시도).
              </p>
              <div className="mb-2 flex flex-wrap gap-1.5">
                {alertConfig.excludeKeywords.map((k) => (
                  <span
                    key={k}
                    className="inline-flex items-center gap-1 rounded-full bg-surface2 px-2 py-0.5 text-[11px] text-fg"
                  >
                    {k}
                    <button onClick={() => removeKeyword(k)} className="text-muted hover:text-red-400">
                      ✕
                    </button>
                  </span>
                ))}
                {alertConfig.excludeKeywords.length === 0 && (
                  <span className="text-[11px] text-muted">등록된 키워드 없음</span>
                )}
              </div>
              <div className="flex gap-2">
                <input
                  value={kw}
                  onChange={(e) => setKw(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addKeyword()}
                  placeholder="제외할 단어 입력 후 Enter"
                  className="inp w-full"
                />
                <button
                  onClick={addKeyword}
                  className="shrink-0 rounded-md bg-surface2 px-3 text-xs font-semibold text-fg ring-1 ring-zinc-700 hover:bg-zinc-700"
                >
                  추가
                </button>
              </div>
            </section>

            <section className="rounded-xl border border-sky-500/30 bg-sky-500/5 p-4">
              <h2 className="mb-2 text-sm font-bold text-sky-400">발송 미리보기</h2>
              <div className="text-fg text-xs">
                현재 이상 {preview.total}건 중{" "}
                <span className="font-bold text-emerald-400">{preview.send}건 발송</span>,{" "}
                <span className="text-muted font-bold">{preview.excluded}건 제외</span>
              </div>
              <p className="text-muted mt-2 text-[11px] leading-relaxed">
                제외 = 알림 끔(음소거) · 중요도 미달 · 키워드 매칭 · (쿨다운/방해금지/연속횟수).
              </p>
            </section>
          </div>
        </Scroll>

        {/* 수집기별 알림 + 전용 키워드 */}
        <section className="bg-surface border-line flex min-h-0 flex-col rounded-xl border">
          <div className="border-line flex items-center gap-2 border-b p-2">
            <span className="text-fg text-sm font-bold">수집기별 알림 설정</span>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="검색" className="inp ml-auto w-48" />
          </div>
          <Scroll className="min-h-0 flex-1">
            <table className="w-full text-left text-xs">
              <thead className="bg-surface text-muted sticky top-0 text-[11px]">
                <tr className="border-line border-b">
                  <th className="px-3 py-2">수집기</th>
                  <th className="px-3 py-2">중요도</th>
                  <th className="px-3 py-2 text-center">알림</th>
                  <th className="px-3 py-2">에러 키워드 제외 (수집기별)</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((c) => {
                  const meta = STATUS_META[c.status];
                  const muted = mutedIds.has(c.id);
                  return (
                    <tr key={c.id} className="border-line border-b hover:bg-zinc-500/10">
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: meta.color }} />
                          <div>
                            <div className="text-fg font-semibold">{c.name}</div>
                            <div className="text-muted text-[10px]">{c.project}</div>
                          </div>
                        </div>
                      </td>
                      <td className="text-muted px-3 py-2">{c.importance}</td>
                      <td className="px-3 py-2 text-center">
                        <button
                          onClick={() => toggleMute(c.id)}
                          className={`rounded-md px-2 py-0.5 text-[11px] font-semibold ${
                            muted ? "bg-zinc-500/15 text-muted" : "bg-emerald-500/15 text-emerald-400"
                          }`}
                        >
                          {muted ? "🔕 제외" : "🔔 발송"}
                        </button>
                        {keywordExcluded(c.id) && (
                          <div className="mt-0.5 text-[9px] text-amber-400">키워드 제외됨</div>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <KeywordCell
                          words={configs[c.id]?.excludeKeywords ?? []}
                          onAdd={(v) => addLocalKeyword(c.id, v)}
                          onRemove={(k) => removeLocalKeyword(c.id, k)}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Scroll>
        </section>
      </div>
    </div>
  );
}

function KeywordCell({
  words,
  onAdd,
  onRemove,
}: {
  words: string[];
  onAdd: (v: string) => void;
  onRemove: (k: string) => void;
}) {
  const [v, setV] = useState("");
  return (
    <div className="flex flex-wrap items-center gap-1">
      {words.map((k) => (
        <span key={k} className="bg-surface2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px]">
          {k}
          <button onClick={() => onRemove(k)} className="text-muted hover:text-red-400">
            ✕
          </button>
        </span>
      ))}
      <input
        value={v}
        onChange={(e) => setV(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            onAdd(v);
            setV("");
          }
        }}
        placeholder="+ 단어"
        className="inp w-20 !py-0.5"
      />
    </div>
  );
}

