"use client";

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  type Collector,
  type CollectorKind,
  type CollectorStatus,
  type Importance,
} from "@/lib/collectors";
import {
  CRON_BY_IMPORTANCE,
  DEFAULT_ALERT,
  INITIAL_COLLECTORS,
  injectFaultInto,
  injectOfflineInto,
  mockMiddlewareOk,
  mockSendResult,
  seedConfigs,
  seedErrorEvents,
  seedMuted,
  seedRecipients,
  seedRegistry,
  seedSendLogs,
  tickCollectors,
} from "@/lib/sampleData";

export { CRON_BY_IMPORTANCE };

export type CollectorConfig = {
  cron: string; // 점검 스케줄 (cron)
  remindDays: number; // 점검 N일 전 알림톡
  excludeKeywords: string[]; // 이 수집기 전용 알림 제외 키워드
};

// 알림 수신자 (핸드폰 + 명칭)
export type Recipient = { id: string; name: string; phone: string; enabled: boolean };

// 발송 이력 (알림톡 / 점검 알림)
export type SendLog = {
  id: string;
  ts: number;
  kind: "alert" | "schedule";
  to: string;
  subject: string;
  status: "success" | "fail";
  error?: string;
};

// 사용자가 직접 등록하는 수집기 (명칭+IP+작업명으로 라이브와 매칭)
export type RegistryEntry = {
  id: string;
  name: string; // 명칭
  ip: string; // 외부 IP
  project: string; // 작업명/프로젝트
};

export type ErrorEvent = {
  id: string;
  collectorId: string;
  name: string;
  kind: CollectorKind;
  status: CollectorStatus;
  ts: number;
  message: string;
  log: string; // 실제 에러 로그
};

export type AlertConfig = {
  enabled: boolean;
  botName: string;
  token: string;
  minImportance: Importance; // 이 중요도 이상만 발송
  cooldownSec: number; // 동일 항목 재발송 쿨다운
  consecutive: number; // 연속 N회 이상 오류일 때만
  quietEnabled: boolean;
  quietFrom: string;
  quietTo: string;
  excludeKeywords: string[]; // 로그에 이 단어 포함 시 발송 제외
};

type CollectorsCtx = {
  collectors: Collector[];
  live: boolean;
  setLive: (v: boolean | ((p: boolean) => boolean)) => void;
  injectFault: () => void;
  injectOffline: () => void;
  reset: () => void;
  resetNonce: number;
  mutedIds: Set<string>;
  toggleMute: (id: string) => void;
  focusId: string | null;
  focusNonce: number;
  focusCollector: (id: string) => void;
  // 신규
  errorEvents: ErrorEvent[];
  configs: Record<string, CollectorConfig>;
  updateConfig: (id: string, patch: Partial<CollectorConfig>) => void;
  alertConfig: AlertConfig;
  setAlertConfig: (patch: Partial<AlertConfig>) => void;
  registry: RegistryEntry[];
  addRegistry: (e: Omit<RegistryEntry, "id">) => void;
  updateRegistry: (id: string, patch: Partial<RegistryEntry>) => void;
  removeRegistry: (id: string) => void;
  // 미들웨어 자체 헬스
  mwOk: boolean;
  mwTesting: boolean;
  testMiddleware: () => void;
  // 수신자 & 발송 이력
  recipients: Recipient[];
  addRecipient: (r: Omit<Recipient, "id">) => void;
  updateRecipient: (id: string, patch: Partial<Recipient>) => void;
  removeRecipient: (id: string) => void;
  sendLogs: SendLog[];
  sendTest: (kind: "alert" | "schedule") => { ok: boolean; msg: string };
  // 대시보드 상태 카드 ↔ 목록 필터 연동 ("inactive" = 미실행/가상)
  statusFilter: StatusFilter | null;
  setStatusFilter: (s: StatusFilter | null) => void;
  // 통신 토폴로지 종류 필터 ↔ 수집기 목록 연동 (all/collector/dbproc)
  graphView: GraphView;
  setGraphView: (v: GraphView) => void;
};

// 통신 토폴로지 보기 필터 (전체 / 수집기→미들웨어 / 미들웨어→DB프로시저)
export type GraphView = "all" | "collector" | "dbproc";

// 상태 필터 ("inactive" = 미실행/가상)
export type StatusFilter = CollectorStatus | "inactive";

const Ctx = createContext<CollectorsCtx | null>(null);

export function CollectorsProvider({ children }: { children: ReactNode }) {
  const [collectors, setCollectors] = useState<Collector[]>(INITIAL_COLLECTORS);
  const [live, setLive] = useState(true);
  const [resetNonce, setResetNonce] = useState(0);
  const [mutedIds, setMutedIds] = useState<Set<string>>(seedMuted);
  const [focusId, setFocusId] = useState<string | null>(null);
  const [focusNonce, setFocusNonce] = useState(0);
  const [errorEvents, setErrorEvents] = useState<ErrorEvent[]>([]);
  const [configs, setConfigs] = useState<Record<string, CollectorConfig>>(seedConfigs);
  const [alertConfig, setAlertConfigState] = useState<AlertConfig>(DEFAULT_ALERT);
  const [registry, setRegistry] = useState<RegistryEntry[]>(seedRegistry);

  const [mwOk, setMwOk] = useState(true);
  const [mwTesting, setMwTesting] = useState(false);
  const [recipients, setRecipients] = useState<Recipient[]>(seedRecipients);
  const [sendLogs, setSendLogs] = useState<SendLog[]>(seedSendLogs);
  const [statusFilter, setStatusFilter] = useState<StatusFilter | null>(null);
  const [graphView, setGraphView] = useState<GraphView>("all");

  const addRecipient = (r: Omit<Recipient, "id">) =>
    setRecipients((p) => [{ ...r, id: `rcp-${Date.now()}` }, ...p]);
  const updateRecipient = (id: string, patch: Partial<Recipient>) =>
    setRecipients((p) => p.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  const removeRecipient = (id: string) => setRecipients((p) => p.filter((x) => x.id !== id));

  const sendTest = (kind: "alert" | "schedule") => {
    const active = recipients.filter((r) => r.enabled);
    if (!active.length) return { ok: false, msg: "활성 수신자가 없습니다" };
    const to = active.map((r) => r.name).join(", ");
    const fail = mockSendResult();
    const subject =
      kind === "alert" ? "[경고] 수집기 이상 테스트 알림" : "[점검] 정기 점검 테스트 안내";
    setSendLogs((p) =>
      [
        {
          id: `log-${Date.now()}`,
          ts: Date.now(),
          kind,
          to,
          subject,
          status: (fail ? "fail" : "success") as SendLog["status"],
          error: fail ? "카카오 API 오류(5xx)" : undefined,
        },
        ...p,
      ].slice(0, 200)
    );
    return { ok: !fail, msg: fail ? `발송 실패: ${to}` : `발송 성공: ${to}` };
  };
  const testMiddleware = () => {
    setMwTesting(true);
    setTimeout(() => {
      setMwOk(mockMiddlewareOk());
      setMwTesting(false);
    }, 900);
  };

  // 시작 시 에러/중지 이력 시드 (마운트 후 → SSR 불일치 방지)
  useEffect(() => {
    setErrorEvents(seedErrorEvents(collectorsRef.current));
  }, []);

  const addRegistry = (e: Omit<RegistryEntry, "id">) =>
    setRegistry((prev) => [{ ...e, id: `reg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}` }, ...prev]);
  const updateRegistry = (id: string, patch: Partial<RegistryEntry>) =>
    setRegistry((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  const removeRegistry = (id: string) => setRegistry((prev) => prev.filter((r) => r.id !== id));

  const liveRef = useRef(live);
  liveRef.current = live;
  const collectorsRef = useRef(collectors);
  collectorsRef.current = collectors;

  const focusCollector = (id: string) => {
    setFocusId(id);
    setFocusNonce((n) => n + 1);
  };

  const toggleMute = (id: string) =>
    setMutedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const updateConfig = (id: string, patch: Partial<CollectorConfig>) =>
    setConfigs((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));

  const setAlertConfig = (patch: Partial<AlertConfig>) =>
    setAlertConfigState((prev) => ({ ...prev, ...patch }));

  // 단일 하트비트 (모든 화면 공유) — 시뮬레이션 1틱 + 이력 누적
  // 탭이 보이지 않으면(백그라운드/장시간 방치) 시뮬레이션을 멈춰 불필요한
  // 재렌더·CPU 사용을 0으로 만든다 → 오래 켜둬도 누적 작업/랙이 생기지 않음.
  useEffect(() => {
    let id: ReturnType<typeof setInterval> | null = null;
    const start = () => {
      if (id !== null) return;
      id = setInterval(() => {
        if (!liveRef.current) return;
        const { next, events } = tickCollectors(collectorsRef.current);
        setCollectors(next);
        if (events.length) setErrorEvents((p) => [...events, ...p].slice(0, 400));
      }, 2000);
    };
    const stop = () => {
      if (id !== null) {
        clearInterval(id);
        id = null;
      }
    };
    const onVisibility = () => (document.visibilityState === "visible" ? start() : stop());
    onVisibility();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  const injectFault = () => {
    const { next, event } = injectFaultInto(collectorsRef.current);
    setCollectors(next);
    setErrorEvents((p) => [event, ...p].slice(0, 400));
  };

  const injectOffline = () => {
    const { next, event } = injectOfflineInto(collectorsRef.current);
    setCollectors(next);
    setErrorEvents((p) => [event, ...p].slice(0, 400));
  };

  const reset = () => {
    setCollectors(INITIAL_COLLECTORS);
    setMutedIds(seedMuted());
    setErrorEvents([]);
    setRegistry(seedRegistry());
    setMwOk(true);
    setRecipients(seedRecipients());
    setSendLogs(seedSendLogs());
    setResetNonce((n) => n + 1);
  };

  return (
    <Ctx.Provider
      value={{
        collectors,
        live,
        setLive,
        injectFault,
        injectOffline,
        reset,
        resetNonce,
        mutedIds,
        toggleMute,
        focusId,
        focusNonce,
        focusCollector,
        errorEvents,
        configs,
        updateConfig,
        alertConfig,
        setAlertConfig,
        registry,
        addRegistry,
        updateRegistry,
        removeRegistry,
        mwOk,
        mwTesting,
        testMiddleware,
        recipients,
        addRecipient,
        updateRecipient,
        removeRecipient,
        sendLogs,
        sendTest,
        statusFilter,
        setStatusFilter,
        graphView,
        setGraphView,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useCollectors(): CollectorsCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error("useCollectors must be used within CollectorsProvider");
  return v;
}
