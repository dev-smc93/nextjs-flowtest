"use client";

import {
  getStraightPath,
  useInternalNode,
  type EdgeProps,
} from "@xyflow/react";
import { getEdgeParams } from "@/lib/edgeUtils";

function safeId(id: string) {
  return id.replace(/[^a-zA-Z0-9_-]/g, "_");
}

// 노드 테두리에서 시작/종료하는 직선 트렁크. 방향 그라데이션 + 중간 화살표.
export default function FloatingEdge({
  id,
  source,
  target,
  style,
}: EdgeProps) {
  const sourceNode = useInternalNode(source);
  const targetNode = useInternalNode(target);
  if (!sourceNode || !targetNode) return null;

  const { sx, sy, tx, ty } = getEdgeParams(sourceNode, targetNode);
  const [path] = getStraightPath({ sourceX: sx, sourceY: sy, targetX: tx, targetY: ty });

  const color = (style?.stroke as string) ?? "#888";
  const gid = `grad-${safeId(id)}`;

  // 도착점 쪽으로 60% 지점에 화살표 → 방향이 한눈에
  const ax = sx + (tx - sx) * 0.6;
  const ay = sy + (ty - sy) * 0.6;
  const angle = (Math.atan2(ty - sy, tx - sx) * 180) / Math.PI;

  return (
    <>
      <defs>
        <linearGradient id={gid} gradientUnits="userSpaceOnUse" x1={sx} y1={sy} x2={tx} y2={ty}>
          <stop offset="0%" stopColor={color} stopOpacity={0.1} />
          <stop offset="55%" stopColor={color} stopOpacity={0.55} />
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
        d="M -6 -5 L 5 0 L -6 5 Z"
        fill={color}
        opacity={0.95}
        transform={`translate(${ax} ${ay}) rotate(${angle})`}
      />
    </>
  );
}
