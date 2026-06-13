"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { type Collector, STATUS_META, formatSignal } from "@/lib/collectors";

export type CollectorNodeData = {
  collector: Collector;
};

// 위치는 React Flow의 Position 클래스에 맡기고, 점만 숨긴다 (left/top 미지정)
const edgeHandle: React.CSSProperties = {
  width: 1,
  height: 1,
  minWidth: 0,
  minHeight: 0,
  opacity: 0,
  border: "none",
  background: "transparent",
};

function CollectorNode({ data, selected }: NodeProps) {
  const { collector } = data as CollectorNodeData;
  const meta = STATUS_META[collector.status];
  const alarming = collector.status === "error" || collector.status === "offline";
  const isProc = collector.kind === "dbproc";

  return (
    <div className="node-enter relative w-[230px]">
      {/* 장애/끊김: 카드 뒤에서 숨쉬는 불빛 */}
      {alarming && (
        <div
          className="status-glow pointer-events-none absolute -inset-1.5 -z-10 rounded-2xl blur-md"
          style={{
            backgroundColor: meta.color,
            animationDuration: collector.status === "error" ? "1.6s" : "2.8s",
          }}
        />
      )}

      <div
        className={`relative rounded-xl border bg-zinc-900 px-3.5 py-3 shadow-lg transition-colors ${
          selected
            ? "border-sky-400 ring-2 ring-sky-400/40"
            : "border-zinc-700/80 hover:border-zinc-500"
        }`}
        style={{ borderColor: selected ? undefined : `${meta.color}66` }}
      >
        {/* 상단 핸들: 헤더 허브와 연결 (수집기 송신 / DB프로시저 수신) */}
        <Handle id="T" type="source" position={Position.Top} style={edgeHandle} />
        <Handle id="T" type="target" position={Position.Top} style={edgeHandle} />

        {/* 상태 배지 */}
        <div className="flex items-center justify-between gap-2">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold ${meta.textClass}`}
            style={{ backgroundColor: `${meta.color}1f` }}
          >
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{
                backgroundColor: meta.color,
                boxShadow: `0 0 8px ${meta.color}`,
              }}
            />
            {meta.label}
          </span>
          <span
            className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${
              isProc ? "bg-cyan-500/15 text-cyan-300" : "bg-violet-500/15 text-violet-300"
            }`}
          >
            {isProc ? "🗄️ PROC" : collector.type}
          </span>
        </div>

        {/* 이름 / 프로젝트 */}
        <div className="mt-2">
          <div className="truncate text-sm font-bold text-zinc-100" title={collector.name}>
            {collector.name}
          </div>
          <div className="truncate text-[11px] text-zinc-500" title={collector.project}>
            {collector.project}
          </div>
        </div>

        {/* 메타 정보 */}
        <div className="mt-2.5 grid grid-cols-2 gap-x-2 gap-y-1 text-[10.5px]">
          <Info label="주기" value={`${collector.intervalSec}초`} />
          <Info label="최근 신호" value={formatSignal(collector.lastSignalSec)} />
          <Info label="외부 IP" value={collector.externalIp} mono />
          <Info
            label="에러"
            value={collector.errorsToday > 0 ? `${collector.errorsToday}건` : "-"}
            danger={collector.errorsToday > 0}
          />
        </div>
      </div>
    </div>
  );
}

function Info({
  label,
  value,
  mono,
  danger,
}: {
  label: string;
  value: string;
  mono?: boolean;
  danger?: boolean;
}) {
  return (
    <div className="flex flex-col">
      <span className="text-[9px] uppercase tracking-wide text-zinc-600">{label}</span>
      <span
        className={`truncate ${mono ? "font-mono" : ""} ${
          danger ? "text-red-400 font-semibold" : "text-zinc-300"
        }`}
        title={value}
      >
        {value}
      </span>
    </div>
  );
}

export default memo(CollectorNode);
