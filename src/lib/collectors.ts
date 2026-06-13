// 수집기 상태 모니터링 — 도메인 타입 & 표시 메타 (목 데이터는 sampleData.ts 참고)

export type CollectorStatus = "normal" | "error" | "offline";

// 수집기(→미들웨어)=API, DB프로시저(미들웨어→)=Agent
export type CollectorType = "API" | "Agent";

// 통신 방향 구분: collector = 수집기→미들웨어, dbproc = 미들웨어→DB프로시저
export type CollectorKind = "collector" | "dbproc";

export type Importance = "높음" | "중간" | "낮음";

export interface Collector {
  id: string;
  kind: CollectorKind;
  name: string; // 작업명
  project: string; // 프로젝트
  path?: string; // 실행 경로 (있는 경우)
  type: CollectorType;
  importance: Importance;
  intervalSec: number; // 주기(초)
  lastSignalSec: number; // 최근 생존 신호 (n초 전, 음수면 "n초 후" 예정)
  externalIp: string;
  internalIp: string;
  errorsToday: number; // 금일 발생 에러
  status: CollectorStatus;
  virtual?: boolean; // 가상(인메모리/논리) 수집기
  // 수집 지표
  collectedToday: number; // 금일 누적 수집 건수 (수집률의 기준값)
  // 수집 진행률 (CLI 진행바용)
  total: number; // 이번 사이클 총 작업 수
  processed: number; // 처리 완료 수
  lastMsg: string; // 현재 처리 항목 (tqdm postfix 형태)
}

// 수집 지표 — 현재 기준은 '금일 수집 건수'. 추후 목표/성공률/시간당 처리량으로 확장.
export type CollectionMetrics = {
  collected: number; // 금일 누적 수집 건수 (핵심 기준)
  target?: number; // (확장) 목표 건수 → 수집률 = collected / target
  // attempts?: number; // (확장) 시도 건수 → 성공률 = collected / attempts
  // windowSec?: number; // (확장) 측정 구간 → 시간당 처리량
};

// 위젯은 이 헬퍼로만 수집 지표를 읽는다 (확장 시 여기만 수정).
export function collectionMetrics(c: Collector): CollectionMetrics {
  return { collected: c.collectedToday, target: c.total };
}

export const STATUS_META: Record<
  CollectorStatus,
  { label: string; color: string; glow: string; textClass: string }
> = {
  normal: {
    label: "정상",
    color: "#22c55e",
    glow: "rgba(34,197,94,0.55)",
    textClass: "text-emerald-300",
  },
  error: {
    label: "오류",
    color: "#ef4444",
    glow: "rgba(239,68,68,0.55)",
    textClass: "text-red-300",
  },
  offline: {
    label: "중지(끊김)",
    color: "#f59e0b",
    glow: "rgba(245,158,11,0.55)",
    textClass: "text-amber-300",
  },
};

export const MIDDLEWARE = {
  id: "middleware",
  name: "수집 미들웨어",
  subtitle: "Collector Middleware / Message Bus",
};

// 상태 심각도 — 정렬/집계 공용 (값이 클수록 심각). 대시보드·목록·피드·시뮬레이션이 모두 사용.
export const STATUS_SEVERITY: Record<CollectorStatus, number> = {
  normal: 0,
  error: 2,
  offline: 3,
};

export function worstStatus(list: Collector[]): CollectorStatus {
  return list.reduce<CollectorStatus>(
    (acc, c) => (STATUS_SEVERITY[c.status] > STATUS_SEVERITY[acc] ? c.status : acc),
    "normal"
  );
}

// "n초 전 / n분 전" 같은 사람이 읽기 쉬운 표현
export function formatSignal(sec: number): string {
  if (sec < 0) return `${Math.abs(sec)}초 후`;
  if (sec < 60) return `${sec}초 전`;
  if (sec < 3600) return `${Math.floor(sec / 60)}분 전`;
  return `${Math.floor(sec / 3600)}시간 전`;
}
