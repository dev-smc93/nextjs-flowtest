"use client";

import {
  getStraightPath,
  useInternalNode,
  type EdgeProps,
} from "@xyflow/react";
import { getEdgeParams } from "@/lib/edgeUtils";

// 노드 테두리에서 시작/종료하는 직선 트렁크. 단색 stroke + 중간 화살표.
// (성능: 엣지별 SVG 그라데이션은 팬/줌마다 좌표 재계산·재페인트가 비싸 단색으로 대체)
export default function FloatingEdge({ id, source, target, style }: EdgeProps) {
  const sourceNode = useInternalNode(source);
  const targetNode = useInternalNode(target);
  if (!sourceNode || !targetNode) return null;

  const { sx, sy, tx, ty } = getEdgeParams(sourceNode, targetNode);
  const [path] = getStraightPath({ sourceX: sx, sourceY: sy, targetX: tx, targetY: ty });

  const color = (style?.stroke as string) ?? "#888";

  // 도착점 쪽으로 60% 지점에 화살표 → 방향이 한눈에
  const ax = sx + (tx - sx) * 0.6;
  const ay = sy + (ty - sy) * 0.6;
  const angle = (Math.atan2(ty - sy, tx - sx) * 180) / Math.PI;

  return (
    <>
      <path id={id} className="react-flow__edge-path" d={path} style={style} />
      <path
        d="M -6 -5 L 5 0 L -6 5 Z"
        fill={color}
        opacity={0.95}
        transform={`translate(${ax} ${ay}) rotate(${angle})`}
      />
    </>
  );
}
