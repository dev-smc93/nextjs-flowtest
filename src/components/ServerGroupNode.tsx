"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import {
  STATUS_META,
  type CollectorStatus,
  type CollectorKind,
} from "@/lib/collectors";

export type ServerGroupNodeData = {
  label: string; // 서버 대역 (예: 49.247.43.x)
  kind: CollectorKind; // collector(수집기) | dbproc(DB프로시저)
  total: number;
  collapsed: boolean;
  worst: CollectorStatus;
  allHealthy: boolean;
  breakdown: Record<CollectorStatus, number>;
};

const hubHandle: React.CSSProperties = {
  left: "50%",
  top: "50%",
  width: 1,
  height: 1,
  minWidth: 0,
  minHeight: 0,
  opacity: 0,
  border: "none",
  background: "transparent",
};

// 펼친 박스 상단 중앙 — 수집기 선이 모이는 헤더 허브
const headerHubHandle: React.CSSProperties = {
  left: "50%",
  top: 8,
  width: 1,
  height: 1,
  minWidth: 0,
  minHeight: 0,
  opacity: 0,
  border: "none",
  background: "transparent",
};

const ORDER: CollectorStatus[] = ["normal", "error", "offline"];

function ServerGroupNode({ data }: NodeProps) {
  const { label, kind, total, collapsed, worst, allHealthy, breakdown } =
    data as ServerGroupNodeData;
  const worstMeta = STATUS_META[worst];
  const alarming = worst === "error" || worst === "offline";
  const isProc = kind === "dbproc";
  const icon = isProc ? "🗄️" : "🖥️";
  const unit = isProc ? "개" : "대";
  // 방향: 수집기는 미들웨어로 송신(→), DB프로시저는 미들웨어가 호출(←)
  const dirHint = isProc ? "미들웨어 ← 호출" : "→ 미들웨어 송신";

  // 펼침 모드: 카드들을 담는 점선 박스
  if (!collapsed) {
    return (
      <div
        className={`relative h-full w-full cursor-pointer rounded-2xl border border-dashed bg-zinc-800/10 transition-colors ${
          allHealthy ? "border-zinc-600/60" : "border-amber-500/50"
        }`}
      >
        {/* 헤더 허브(상단 중앙): 수집기 수신(target) / DB프로시저 송신(source) */}
        <Handle id="hub" type="target" position={Position.Bottom} style={headerHubHandle} />
        <Handle id="hub" type="source" position={Position.Bottom} style={headerHubHandle} />
        <div className="absolute -top-3 left-4 flex items-center gap-2 rounded-full border border-zinc-600/70 bg-zinc-900 px-3 py-0.5 text-[11px] font-semibold shadow">
          <span className={isProc ? "text-cyan-300" : "text-sky-300"}>
            {icon} {label}
          </span>
          <span className="text-zinc-500">
            {total}
            {unit}
          </span>
          <span className="text-zinc-600">· {dirHint} · 접기 ▴</span>
        </div>
      </div>
    );
  }

  // 요약(접힘) 모드: 대역 한 장으로 압축
  return (
    <div className="relative h-full w-full">
      {/* 대역에 장애/끊김 포함 시 숨쉬는 불빛 */}
      {alarming && (
        <div
          className="status-glow pointer-events-none absolute -inset-1.5 -z-10 rounded-2xl blur-md"
          style={{
            backgroundColor: worstMeta.color,
            animationDuration: worst === "error" ? "1.6s" : "2.8s",
          }}
        />
      )}
      <div
        className="relative flex h-full w-full cursor-pointer flex-col justify-between rounded-xl border bg-zinc-900 px-3.5 py-3 shadow-md transition-transform hover:-translate-y-0.5"
        style={{ borderColor: `${worstMeta.color}99` }}
      >
        <Handle type="target" position={Position.Top} style={hubHandle} />
        <Handle type="source" position={Position.Top} style={hubHandle} />

      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-sm font-bold text-zinc-100">
          <span>{icon}</span>
          {label}
        </span>
        <span
          className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold"
          style={{ backgroundColor: `${worstMeta.color}22`, color: worstMeta.color }}
        >
          <span
            className="h-1.5 w-1.5 rounded-full"
            style={{
              backgroundColor: worstMeta.color,
              boxShadow: allHealthy ? undefined : `0 0 6px ${worstMeta.color}`,
            }}
          />
          {total}
          {unit}
        </span>
      </div>

      {/* 상태 분포 바 */}
      <div className="mt-2 flex h-1.5 w-full overflow-hidden rounded-full bg-zinc-800">
        {ORDER.map((s) =>
          breakdown[s] > 0 ? (
            <div
              key={s}
              style={{
                width: `${(breakdown[s] / total) * 100}%`,
                backgroundColor: STATUS_META[s].color,
              }}
            />
          ) : null
        )}
      </div>

      {/* 상태별 카운트 */}
      <div className="mt-2 flex flex-wrap gap-x-2.5 gap-y-1 text-[10.5px]">
        {ORDER.map((s) =>
          breakdown[s] > 0 ? (
            <span key={s} className="inline-flex items-center gap-1 text-zinc-400">
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: STATUS_META[s].color }}
              />
              {STATUS_META[s].label} {breakdown[s]}
            </span>
          ) : null
        )}
      </div>

        <div className="mt-1.5 flex items-center justify-between text-[9.5px] text-zinc-600">
          <span className={isProc ? "text-cyan-500/80" : "text-sky-500/80"}>{dirHint}</span>
          <span>펼치기 ▾</span>
        </div>
      </div>
    </div>
  );
}

export default memo(ServerGroupNode);
