"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { MIDDLEWARE } from "@/lib/collectors";

export type MiddlewareNodeData = {
  total: number;
  healthy: number;
  ok?: boolean; // 미들웨어 자체 헬스
};

const hiddenHandle: React.CSSProperties = {
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

function MiddlewareNode({ data }: NodeProps) {
  const { total, healthy, ok = true } = data as MiddlewareNodeData;
  const ratio = total > 0 ? healthy / total : 0;
  const allGood = healthy === total;

  return (
    <div
      className={`relative flex w-[210px] flex-col items-center rounded-2xl border px-5 py-5 text-center ${
        ok
          ? "border-sky-400/50 bg-gradient-to-b from-sky-950 to-indigo-950 shadow-[0_0_40px_rgba(56,189,248,0.35)]"
          : "border-red-500/70 bg-gradient-to-b from-red-950 to-zinc-950 shadow-[0_0_44px_rgba(239,68,68,0.5)]"
      }`}
    >
      {!ok && (
        <div className="absolute -top-2.5 rounded-full bg-red-500 px-2 py-0.5 text-[10px] font-bold text-white">
          미들웨어 이상
        </div>
      )}
      <Handle type="target" position={Position.Top} style={hiddenHandle} />
      <Handle type="source" position={Position.Top} style={hiddenHandle} />

      {/* 펄스 코어 */}
      <div className="relative mb-3 flex h-14 w-14 items-center justify-center">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-sky-400/40" />
        <span className="relative inline-flex h-14 w-14 items-center justify-center rounded-full bg-sky-500 text-2xl shadow-lg">
          🛰️
        </span>
      </div>

      <div className="text-base font-extrabold text-sky-100">{MIDDLEWARE.name}</div>
      <div className="mt-0.5 text-[10px] font-medium text-sky-300/70">
        {MIDDLEWARE.subtitle}
      </div>

      {/* 건강도 요약 */}
      <div className="mt-3 w-full">
        <div className="flex items-center justify-between text-[11px] font-semibold">
          <span className="text-zinc-300">연결 정상</span>
          <span className={allGood ? "text-emerald-300" : "text-amber-300"}>
            {healthy}/{total}
          </span>
        </div>
        <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-zinc-700/70">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${ratio * 100}%`,
              background: allGood
                ? "linear-gradient(90deg,#22c55e,#34d399)"
                : "linear-gradient(90deg,#f59e0b,#ef4444)",
            }}
          />
        </div>
      </div>
    </div>
  );
}

export default memo(MiddlewareNode);
