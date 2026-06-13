"use client";

import { getSmoothStepPath, type EdgeProps } from "@xyflow/react";

function safeId(id: string) {
  return id.replace(/[^a-zA-Z0-9_-]/g, "_");
}

// 헤더 허브 ↔ 수집기 직각(smoothstep) 연결. 방향 그라데이션 + 중간 화살표로 정돈.
export default function DirectedSmoothEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style,
}: EdgeProps) {
  const [path, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    borderRadius: 10,
  });

  const color = (style?.stroke as string) ?? "#888";
  const gid = `grad-${safeId(id)}`;
  const angle = (Math.atan2(targetY - sourceY, targetX - sourceX) * 180) / Math.PI;

  return (
    <>
      <defs>
        <linearGradient
          id={gid}
          gradientUnits="userSpaceOnUse"
          x1={sourceX}
          y1={sourceY}
          x2={targetX}
          y2={targetY}
        >
          <stop offset="0%" stopColor={color} stopOpacity={0.15} />
          <stop offset="100%" stopColor={color} stopOpacity={1} />
        </linearGradient>
      </defs>
      <path
        id={id}
        className="react-flow__edge-path"
        d={path}
        style={{ ...style, stroke: `url(#${gid})` }}
      />
      <path
        d="M -5 -4 L 4 0 L -5 4 Z"
        fill={color}
        transform={`translate(${labelX} ${labelY}) rotate(${angle})`}
      />
    </>
  );
}
