"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useCollectors, type RegistryEntry } from "@/lib/collectorsContext";
import Scroll from "@/components/Scroll";
import { Stat } from "@/components/ui";
import { STATUS_META, type Collector } from "@/lib/collectors";

const matchKey = (name: string, ip: string, project: string) => `${name}|${ip}|${project}`;

export default function CollectorsPage() {
  const { collectors, registry, addRegistry, removeRegistry } = useCollectors();
  const handleAdd = (e: Omit<RegistryEntry, "id">) => {
    addRegistry(e);
    toast.success("수집기 등록됨", { description: `${e.name} · ${e.ip}` });
  };
  const handleRemove = (r: RegistryEntry) => {
    removeRegistry(r.id);
    toast.success("수집기 삭제됨", { description: r.name });
  };
  const [q, setQ] = useState("");
  const [adding, setAdding] = useState(false);

  // 라이브 수집기 인덱스 (명칭+IP+작업명)
  const liveByKey = useMemo(() => {
    const m = new Map<string, Collector>();
    for (const c of collectors) m.set(matchKey(c.name, c.externalIp, c.project), c);
    return m;
  }, [collectors]);

  const registeredKeys = useMemo(
    () => new Set(registry.map((r) => matchKey(r.name, r.ip, r.project))),
    [registry]
  );

  // 등록했지만 매칭(실행) 여부
  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    return registry
      .filter((r) => (s ? r.name.toLowerCase().includes(s) || r.ip.includes(s) : true))
      .map((r) => ({ r, live: liveByKey.get(matchKey(r.name, r.ip, r.project)) ?? null }));
  }, [registry, liveByKey, q]);

  // 미등록(신규 발견): 라이브에 있는데 레지스트리에 없음
  const discovered = useMemo(
    () => collectors.filter((c) => !registeredKeys.has(matchKey(c.name, c.externalIp, c.project))),
    [collectors, registeredKeys]
  );

  const runningCount = rows.filter((x) => x.live && x.live.status !== "offline").length;

  return (
    <div className="page-enter flex h-full flex-col gap-3 overflow-hidden p-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="grid flex-1 grid-cols-3 gap-3">
          <Stat label="등록 수집기" value={registry.length} accent="#38bdf8" />
          <Stat label="실행중" value={runningCount} accent="#22c55e" />
          <Stat label="신규 발견(미등록)" value={discovered.length} accent="#f59e0b" />
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            onClick={() => setAdding((v) => !v)}
            className="rounded-lg bg-sky-500/20 px-3 py-1.5 text-xs font-semibold text-sky-300 ring-1 ring-sky-500/40 transition hover:bg-sky-500/30"
          >
            + 수집기 등록
          </button>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="명칭 / IP 검색"
            className="inp w-48"
          />
        </div>
      </div>

      {adding && <AddForm onAdd={handleAdd} onClose={() => setAdding(false)} />}

      <div className="grid min-h-0 flex-1 grid-rows-[1.6fr_1fr] gap-3">
        {/* 등록된 수집기 */}
        <section className="bg-surface border-line flex min-h-0 flex-col rounded-xl border">
          <div className="border-line border-b px-4 py-2 text-sm font-bold">
            등록된 수집기 ({registry.length})
          </div>
          <Scroll className="min-h-0 flex-1">
            <table className="w-full text-left text-xs">
              <thead className="bg-surface2 text-muted sticky top-0 text-[11px]">
                <tr className="border-line border-b">
                  <th className="px-3 py-2">상태</th>
                  <th className="px-3 py-2">명칭 / 작업명</th>
                  <th className="px-3 py-2">IP</th>
                  <th className="px-3 py-2 text-right">동작</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ r, live }) => (
                  <RegRow key={r.id} r={r} live={live} onRemove={() => handleRemove(r)} />
                ))}
              </tbody>
            </table>
          </Scroll>
        </section>

        {/* 신규 발견 */}
        <section className="bg-surface border-line flex min-h-0 flex-col rounded-xl border">
          <div className="flex items-center gap-2 px-4 pt-2.5 pb-2 text-sm font-bold text-amber-400">
            <span className="status-glow inline-block h-2 w-2 rounded-full bg-amber-400" />
            신규 발견 — 미등록 ({discovered.length})
          </div>
          {/* 이쁜 그라데이션 구분선 */}
          <div className="h-px w-full bg-gradient-to-r from-transparent via-amber-400/60 to-transparent" />
          <Scroll className="min-h-0 flex-1">
            <ul className="divide-y divide-amber-500/10">
              {discovered.length === 0 && (
                <li className="text-muted py-8 text-center text-xs">미등록 수집기가 없습니다 ✓</li>
              )}
              {discovered.map((c) => (
                <li key={c.id} className="flex items-center gap-3 px-4 py-2 text-xs">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: STATUS_META[c.status].color }} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-semibold">{c.name}</div>
                    <div className="text-muted truncate text-[10px]">
                      {c.externalIp} · {c.project}
                    </div>
                  </div>
                  <button
                    onClick={() => handleAdd({ name: c.name, ip: c.externalIp, project: c.project })}
                    className="rounded-md bg-amber-500/15 px-2 py-1 text-[11px] font-semibold text-amber-300 transition hover:bg-amber-500/25"
                  >
                    + 등록
                  </button>
                </li>
              ))}
            </ul>
          </Scroll>
        </section>
      </div>
    </div>
  );
}

function RegRow({
  r,
  live,
  onRemove,
}: {
  r: RegistryEntry;
  live: Collector | null;
  onRemove: () => void;
}) {
  const running = live && live.status !== "offline";
  const meta = live ? STATUS_META[live.status] : null;
  return (
    <tr className="border-line border-b transition hover:bg-black/5 dark:hover:bg-white/5">
      <td className="px-3 py-2">
        {running ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-semibold text-emerald-300">
            <span className="status-glow h-1.5 w-1.5 rounded-full" style={{ backgroundColor: meta!.color }} />
            실행중
          </span>
        ) : live ? (
          <span className="rounded-full bg-zinc-500/15 px-2 py-0.5 text-[11px] font-semibold text-zinc-400">
            중지
          </span>
        ) : (
          <span className="rounded-full bg-red-500/15 px-2 py-0.5 text-[11px] font-semibold text-red-300">
            미발견
          </span>
        )}
      </td>
      <td className="px-3 py-2">
        <div className="font-semibold">{r.name}</div>
        <div className="text-muted text-[10px]">{r.project}</div>
      </td>
      <td className="px-3 py-2 font-mono text-[11px]">{r.ip}</td>
      <td className="px-3 py-2 text-right">
        <button
          onClick={onRemove}
          className="rounded-md px-2 py-1 text-[11px] text-zinc-500 transition hover:text-red-400"
        >
          삭제
        </button>
      </td>
    </tr>
  );
}

function AddForm({
  onAdd,
  onClose,
}: {
  onAdd: (e: Omit<RegistryEntry, "id">) => void;
  onClose: () => void;
}) {
  const [f, setF] = useState({ name: "", ip: "", project: "" });
  return (
    <div className="bg-surface border-line fade-in flex flex-wrap items-end gap-2 rounded-xl border p-3">
      <L label="명칭">
        <input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} className="inp" />
      </L>
      <L label="IP">
        <input value={f.ip} onChange={(e) => setF({ ...f, ip: e.target.value })} className="inp" />
      </L>
      <L label="작업명">
        <input value={f.project} onChange={(e) => setF({ ...f, project: e.target.value })} className="inp" />
      </L>
      <button
        onClick={() => {
          if (!f.name || !f.ip) return;
          onAdd(f);
          onClose();
        }}
        className="rounded-lg bg-emerald-500/20 px-3 py-2 text-xs font-semibold text-emerald-300 ring-1 ring-emerald-500/40 transition hover:bg-emerald-500/30"
      >
        등록
      </button>
      <button onClick={onClose} className="text-muted px-2 py-2 text-xs hover:text-zinc-300">
        취소
      </button>
    </div>
  );
}

function L({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-muted text-[10px]">{label}</span>
      <span className="w-36">{children}</span>
    </label>
  );
}

