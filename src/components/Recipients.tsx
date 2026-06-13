"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useCollectors } from "@/lib/collectorsContext";
import Scroll from "@/components/Scroll";

const fmt = (ts: number) =>
  new Date(ts).toLocaleString("ko-KR", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });

export function RecipientsPanel() {
  const { recipients, addRecipient, updateRecipient, removeRecipient } = useCollectors();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");

  const add = () => {
    if (!name.trim() || !phone.trim()) return;
    addRecipient({ name: name.trim(), phone: phone.trim(), enabled: true });
    setName("");
    setPhone("");
    toast.success("수신자가 추가되었습니다");
  };

  return (
    <div className="bg-surface card-3d rounded-xl p-4">
      <h2 className="mb-3 text-sm font-bold">📒 알림 수신자</h2>
      <div className="space-y-1.5">
        {recipients.map((r) => (
          <div key={r.id} className="bg-surface2 flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs">
            <input
              type="checkbox"
              checked={r.enabled}
              onChange={() => {
                updateRecipient(r.id, { enabled: !r.enabled });
                toast(r.enabled ? `🔕 발송 OFF · ${r.name}` : `🔔 발송 ON · ${r.name}`);
              }}
              title="발송 ON/OFF"
              className="h-3.5 w-3.5 shrink-0 cursor-pointer accent-emerald-500"
            />
            <div className="min-w-0 flex-1">
              <div className="text-fg truncate font-semibold">{r.name}</div>
              <div className="text-muted font-mono">{r.phone}</div>
            </div>
            <button
              onClick={() => {
                removeRecipient(r.id);
                toast.success("수신자가 삭제되었습니다", { description: r.name });
              }}
              className="text-muted hover:text-red-400"
            >
              ✕
            </button>
          </div>
        ))}
        {recipients.length === 0 && <div className="text-muted text-xs">등록된 수신자가 없습니다</div>}
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="명칭" className="inp w-24 flex-1" />
        <input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="010-0000-0000"
          onKeyDown={(e) => e.key === "Enter" && add()}
          className="inp w-32 flex-1"
        />
        <button
          onClick={add}
          className="shrink-0 rounded-md bg-emerald-500/20 px-3 text-xs font-semibold text-emerald-400 ring-1 ring-emerald-500/40 hover:bg-emerald-500/30"
        >
          추가
        </button>
      </div>
    </div>
  );
}

export function SendHistory({ kind, title }: { kind: "alert" | "schedule"; title: string }) {
  const { sendLogs, sendTest } = useCollectors();
  const logs = sendLogs.filter((l) => l.kind === kind);

  return (
    <section className="bg-surface card-3d flex h-full min-h-0 flex-col rounded-xl">
      <div className="panel-head border-line flex items-center gap-2 border-b px-4 py-2">
        <span className="text-sm font-bold">📨 {title}</span>
        <button
          onClick={() => {
            const r = sendTest(kind);
            r.ok ? toast.success(r.msg) : toast.error(r.msg);
          }}
          className="ml-auto rounded-md bg-sky-500/15 px-2.5 py-1 text-[11px] font-semibold text-sky-400 ring-1 ring-sky-500/40 transition hover:bg-sky-500/25 active:scale-95"
        >
          테스트 발송
        </button>
      </div>
      <Scroll className="min-h-0 flex-1">
        <table className="w-full text-left text-xs">
          <thead className="bg-surface text-muted sticky top-0 text-[11px]">
            <tr className="border-line border-b">
              <th className="px-3 py-2">시각</th>
              <th className="px-3 py-2">수신자</th>
              <th className="px-3 py-2">내용</th>
              <th className="px-3 py-2 text-center">결과</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((l) => (
              <tr key={l.id} className="border-line border-b hover:bg-zinc-500/10">
                <td className="text-muted whitespace-nowrap px-3 py-2 font-mono text-[10px]">{fmt(l.ts)}</td>
                <td className="text-fg px-3 py-2">{l.to}</td>
                <td className="text-muted px-3 py-2">{l.subject}</td>
                <td className="px-3 py-2 text-center">
                  {l.status === "success" ? (
                    <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-400">
                      성공
                    </span>
                  ) : (
                    <span
                      title={l.error}
                      className="rounded-full bg-red-500/15 px-2 py-0.5 text-[10px] font-semibold text-red-400"
                    >
                      실패 ⚠
                    </span>
                  )}
                </td>
              </tr>
            ))}
            {logs.length === 0 && (
              <tr>
                <td colSpan={4} className="text-muted py-8 text-center text-xs">
                  발송 이력이 없습니다. "테스트 발송"으로 확인해보세요.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Scroll>
    </section>
  );
}
