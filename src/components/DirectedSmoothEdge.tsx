"use client";

import { getSmoothStepPath, type EdgeProps } from "@xyflow/react";

// 헤더 허브 ↔ 수집기 직각(smoothstep) 연결. 단색 stroke + 중간 화살표.
// (성능: 엣지별 그라데이션 제거 → 팬/줌 재페인트 비용 절감)
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
  const angle = (Math.atan2(targetY - sourceY, targetX - sourceX) * 180) / Math.PI;

  return (
    <>
      <path id={id} className="react-flow__edge-path" d={path} style={style} />
      <path
        d="M -5 -4 L 4 0 L -5 4 Z"
        fill={color}
        transform={`translate(${labelX} ${labelY}) rotate(${angle})`}
      />
    </>
  );
}
