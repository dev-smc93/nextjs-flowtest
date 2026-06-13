"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { STATUS_META, type CollectorStatus } from "@/lib/collectors";

export type ZoneNodeData = {
  label: string;
  count: number;
  accent: string;
  collapsed?: boolean;
  worst?: CollectorStatus;
};

const hidden: React.CSSProperties = {
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

function ZoneNode({ data }: NodeProps) {
  const { label, count, accent, collapsed, worst } = data as ZoneNodeData;
  const wm = worst ? STATUS_META[worst] : null;

  if (collapsed) {
    // 접힘: 클릭 가능한 요약 카드
    return (
      <div
        className="card-3d bg-surface flex h-full w-full cursor-pointer flex-col justify-center rounded-xl px-3 transition hover:-translate-y-0.5"
        style={{ borderColor: wm ? `${wm.color}88` : `${accent}66` }}
      >
        <Handle id="z" type="source" position={Position.Top} style={hidden} />
        <Handle id="z" type="target" position={Position.Top} style={hidden} />
        <div className="flex items-center gap-2 text-sm font-bold">
          {wm && (
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: wm.color }} />
          )}
          <span className="text-fg">{label}</span>
          <span className="text-muted ml-auto rounded-full bg-zinc-500/15 px-1.5 text-[10px]">
            {count}대
          </span>
        </div>
        <div className="text-muted mt-0.5 text-[9.5px]">클릭하여 펼치기 ▾</div>
      </div>
    );
  }

  // 펼침: 점선 컨테이너
  return (
    <div
      className="relative h-full w-full rounded-3xl border-2 border-dashed"
      style={{ borderColor: `${accent}55`, backgroundColor: `${accent}0a` }}
    >
      <Handle id="z" type="source" position={Position.Top} style={hidden} />
      <Handle id="z" type="target" position={Position.Top} style={hidden} />
      <div
        className="absolute -top-3.5 left-6 flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1 text-xs font-bold"
        style={{ borderColor: `${accent}66`, backgroundColor: "var(--surface)", color: accent }}
      >
        {label}
        <span className="rounded-full bg-zinc-500/20 px-1.5 text-[10px] text-fg">{count}</span>
        <span className="text-muted text-[10px]">· 접기 ▴</span>
      </div>
    </div>
  );
}

export default memo(ZoneNode);
