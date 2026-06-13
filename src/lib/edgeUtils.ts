import type { InternalNode, Node } from "@xyflow/react";

// 노드 사각형 테두리와, 상대 노드 중심을 향하는 직선의 교차점을 구한다.
// (React Flow 공식 "Floating Edges" 예제 방식)
function getNodeIntersection(
  intersectionNode: InternalNode<Node>,
  targetNode: InternalNode<Node>
) {
  const w = (intersectionNode.measured.width ?? 0) / 2;
  const h = (intersectionNode.measured.height ?? 0) / 2;
  const ip = intersectionNode.internals.positionAbsolute;
  const tp = targetNode.internals.positionAbsolute;

  const cx2 = ip.x + w;
  const cy2 = ip.y + h;
  const cx1 = tp.x + (targetNode.measured.width ?? 0) / 2;
  const cy1 = tp.y + (targetNode.measured.height ?? 0) / 2;

  if (w === 0 || h === 0) return { x: cx2, y: cy2 };

  const xx1 = (cx1 - cx2) / (2 * w) - (cy1 - cy2) / (2 * h);
  const yy1 = (cx1 - cx2) / (2 * w) + (cy1 - cy2) / (2 * h);
  const a = 1 / (Math.abs(xx1) + Math.abs(yy1) || 1);
  const xx3 = a * xx1;
  const yy3 = a * yy1;
  const x = w * (xx3 + yy3) + cx2;
  const y = h * (-xx3 + yy3) + cy2;

  return { x, y };
}

export function getEdgeParams(
  source: InternalNode<Node>,
  target: InternalNode<Node>
) {
  const sp = getNodeIntersection(source, target);
  const tp = getNodeIntersection(target, source);
  return { sx: sp.x, sy: sp.y, tx: tp.x, ty: tp.y };
}
