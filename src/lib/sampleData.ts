// =============================================================================
//  샘플(목) 데이터 & 시뮬레이션 — 단일 소스
// -----------------------------------------------------------------------------
//  앱의 모든 가짜 데이터(초기 시드 + 실시간 시뮬레이션)는 이 파일에만 존재한다.
//  Context/컴포넌트는 여기서 export 하는 함수만 호출하므로,
//  실데이터로 전환할 때는 이 파일의 각 함수 구현만 API/WebSocket 호출로 바꾸거나
//  (또는 동일 시그니처의 모듈로 교체) 하면 된다. 컴포넌트는 손댈 필요가 없다.
//
//  ┌── 초기 시드 ─────────────────────────────────────────────
//  │  INITIAL_COLLECTORS / seedMuted / seedConfigs / seedRegistry
//  │  seedRecipients / seedSendLogs / DEFAULT_ALERT / seedErrorEvents
//  ├── 실시간 시뮬레이션 ────────────────────────────────────
//  │  tickCollectors / injectFaultInto / mockSendResult / mockMiddlewareOk
//  └─────────────────────────────────────────────────────────
// =============================================================================

import { STATUS_SEVERITY } from "@/lib/collectors";
import type {
  Collector,
  CollectorStatus,
  Importance,
} from "@/lib/collectors";
import type {
  AlertConfig,
  CollectorConfig,
  ErrorEvent,
  Recipient,
  RegistryEntry,
  SendLog,
} from "@/lib/collectorsContext";

// 상태 전이 판정에 공용 심각도 사용
const SEVERITY = STATUS_SEVERITY;

// 중요도별 기본 점검 스케줄(cron) — 실데이터 전환 시 서버 설정으로 대체
export const CRON_BY_IMPORTANCE: Record<Importance, string> = {
  높음: "0 9 1 * *", // 매월 1일 09:00
  중간: "0 9 1 */3 *", // 분기마다
  낮음: "0 9 1 1 *", // 매년
};

// ============================ 결정론적 PRNG & 풀 ============================
// SSR/CSR 하이드레이션 불일치 방지를 위해 초기 수집기 생성은 시드 기반(결정론적).
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const EXT_BANDS = [
  "49.247.43", "115.68.78", "222.112.141", "125.141.35", "211.234.20",
  "118.235.7", "39.115.8", "203.241.18", "175.223.40", "61.74.12",
  "112.220.90", "218.38.137", "59.18.44", "210.117.6", "183.99.21",
  "106.247.230", "14.63.230", "119.205.7", "220.95.18", "27.122.140",
];

const NAME_PREFIXES = [
  "경매수집기", "네이버수집기", "실거래수집기", "법원공고크롤러", "지적도수집기",
  "위성영상수집기", "KB시세동기화", "온비드수집기", "국토부API수집기", "등기부수집기",
  "건축물대장수집기", "부동산지수수집기",
];

const PROJECTS = [
  "AuctionAllCollector_2025", "anal_naver_with_monitor", "auction_anaysis",
  "naver_estate_agent", "court_notice_agent", "rtms_sync", "cadastral_image",
  "satellite_image", "kb_price_sync", "molit_api", "reb_index", "onbid_collector",
];

const IMPORTANCES: Importance[] = ["높음", "중간", "낮음"];

function pickStatus(r: number): CollectorStatus {
  if (r < 0.85) return "normal";
  if (r < 0.96) return "error";
  return "offline";
}

// 진행률 postfix용 (tqdm 스타일 현재 항목)
const REGION_MSGS = [
  "강남구/역삼동", "서초구/반포동", "송파구/잠실동", "마포구/합정동", "용산구/한남동",
  "성동구/성수동", "수원시/영통동", "성남시/분당동", "고양시/일산동", "부산/해운대구",
  "대구/수성구", "인천/연수구", "광주/서구", "대전/유성구", "울산/남구",
];

function seedProgress(rng: () => number) {
  const total = 500 + Math.floor(rng() * 8000);
  const processed = Math.floor(rng() * total);
  const collectedToday = processed + Math.floor(rng() * 80000); // 금일 누적 수집 건수
  const msg = `${REGION_MSGS[Math.floor(rng() * REGION_MSGS.length)]} +${1 + Math.floor(rng() * 40)}`;
  return { total, processed, collectedToday, lastMsg: msg };
}

function nextProgressMsg(): string {
  const i = Math.floor(Math.random() * REGION_MSGS.length);
  return `${REGION_MSGS[i]} +${1 + Math.floor(Math.random() * 40)}`;
}

// 샘플 에러 로그 (이력/알림 키워드 매칭용)
const ERROR_LOGS = [
  "TimeoutError: navigation timeout of 30000ms exceeded",
  "ECONNRESET: connection reset by peer",
  "HTTP 429 Too Many Requests (rate limited)",
  "playwright: Target page/context closed",
  "일시적 네트워크 오류 — 자동 재시도 예정",
  "Selector not found: .complex-list",
  "psql: deadlock detected on relation auctions",
  "Out of memory: worker process killed",
  "HTTP 503 Service Unavailable (upstream)",
  "SSL handshake failed (certificate expired)",
];

function pickErrorLog(): string {
  return ERROR_LOGS[Math.floor(Math.random() * ERROR_LOGS.length)];
}

// ============================ 초기 수집기 시드 ============================
// 첨부 테이블 기반 대표 샘플. kind/진행률은 아래에서 부여.
const FEATURED_COLLECTORS: Omit<
  Collector,
  "kind" | "total" | "processed" | "lastMsg" | "collectedToday"
>[] = [
  { id: "c1", name: "네이버쿠키갱신기", project: "anal_naver_with_monitor", type: "API", importance: "높음", intervalSec: 30, lastSignalSec: 5, externalIp: "49.247.43.115", internalIp: "10.7.1.76", errorsToday: 0, status: "normal" },
  { id: "c2", name: "네이버폴리곤API", project: "anal_naver_with_monitor", type: "API", importance: "높음", intervalSec: 30, lastSignalSec: 28, externalIp: "49.247.43.115", internalIp: "10.7.1.76", errorsToday: 0, status: "normal" },
  { id: "c3", name: "경매물건진행상태분석", project: "auction_anaysis", path: "C:\\app\\물건진행상태분석\\auction_eng.exe", type: "API", importance: "높음", intervalSec: 30, lastSignalSec: 5, externalIp: "115.68.78.8", internalIp: "115.68.78.8", errorsToday: 0, status: "normal" },
  { id: "c4", name: "pgsql경매데이터동기화", project: "auction_anaysis", path: "C:\\app\\pgsql_sync\\sync_pgsql.exe", type: "API", importance: "높음", intervalSec: 30, lastSignalSec: 0, externalIp: "115.68.78.8", internalIp: "115.68.78.8", errorsToday: 0, status: "normal" },
  { id: "c5", name: "경매수집기A(14대)", project: "AuctionAllCollector_2025", type: "API", importance: "높음", intervalSec: 30, lastSignalSec: 5, externalIp: "222.112.141.6", internalIp: "192.168.1.3", errorsToday: 0, status: "normal" },
  { id: "c6", name: "경매수집기B(17대)", project: "AuctionAllCollector_2025", type: "API", importance: "높음", intervalSec: 30, lastSignalSec: 26, externalIp: "125.141.35.245", internalIp: "192.168.2.2", errorsToday: 0, status: "normal" },
  { id: "c7", name: "경매수집기C(17대)", project: "AuctionAllCollector_2025", type: "API", importance: "높음", intervalSec: 30, lastSignalSec: 24, externalIp: "222.112.141.21", internalIp: "192.168.3.2", errorsToday: 0, status: "normal" },
  { id: "c8", name: "네이버부동산수집기(다가구)", project: "naver_estate_agent", type: "Agent", importance: "중간", intervalSec: 60, lastSignalSec: 75, externalIp: "211.234.20.10", internalIp: "192.168.4.7", errorsToday: 2, status: "error" },
  { id: "c9", name: "법원경매공고크롤러", project: "court_notice_agent", type: "Agent", importance: "높음", intervalSec: 30, lastSignalSec: 240, externalIp: "118.235.7.42", internalIp: "192.168.5.11", errorsToday: 14, status: "error" },
  { id: "c10", name: "지적도이미지수집기", project: "cadastral_image", type: "Agent", importance: "낮음", intervalSec: 120, lastSignalSec: 1830, externalIp: "39.115.8.200", internalIp: "192.168.6.21", errorsToday: 0, status: "offline" },
  { id: "c11", name: "실거래가동기화", project: "rtms_sync", type: "API", importance: "중간", intervalSec: 60, lastSignalSec: 12, externalIp: "203.241.18.9", internalIp: "192.168.7.5", errorsToday: 0, status: "normal" },
  { id: "c12", name: "위성영상수집기", project: "satellite_image", type: "Agent", importance: "중간", intervalSec: 300, lastSignalSec: 95, externalIp: "175.223.40.1", internalIp: "192.168.8.9", errorsToday: 1, status: "error" },
];

function generateCollectors(count: number): Collector[] {
  const rng = mulberry32(20260612);
  const out: Collector[] = [];
  for (let i = 0; i < count; i++) {
    const bandIdx = i % EXT_BANDS.length; // 대역마다 ~5대씩 고르게 분포
    const band = EXT_BANDS[bandIdx];
    // 한 서버(IP)에 여러 수집기가 돌도록 호스트를 소수로 묶어 충돌 유도
    const serverIdx = Math.floor(i / EXT_BANDS.length);
    const host = 11 + (serverIdx % 3);
    const intervalSec = [30, 60, 120, 300][Math.floor(rng() * 4)];
    const status = pickStatus(rng());

    let lastSignalSec: number;
    if (status === "normal") lastSignalSec = Math.floor(rng() * intervalSec);
    else if (status === "error") lastSignalSec = Math.floor(intervalSec * (3.5 + rng() * 6));
    else lastSignalSec = Math.floor(intervalSec * (25 + rng() * 30));

    const errorsToday = status === "error" ? 3 + Math.floor(rng() * 20) : 0;

    const prefix = NAME_PREFIXES[Math.floor(rng() * NAME_PREFIXES.length)];
    const letter = String.fromCharCode(65 + (i % 26));

    out.push({
      id: `g${i + 100}`,
      kind: "collector",
      name: `${prefix}${letter}(${1 + Math.floor(rng() * 20)}대)`,
      project: PROJECTS[Math.floor(rng() * PROJECTS.length)],
      type: rng() < 0.6 ? "API" : "Agent",
      importance: IMPORTANCES[Math.floor(rng() * (rng() < 0.5 ? 1 : IMPORTANCES.length))],
      intervalSec,
      lastSignalSec,
      externalIp: `${band}.${host}`,
      internalIp: `192.168.${bandIdx}.${host}`,
      errorsToday,
      status,
      ...seedProgress(rng),
    });
  }
  return out;
}

// ---- DB 프로시저: 미들웨어가 DB 서버로 호출(반대 방향) ----
const DB_SERVERS = [
  { band: "10.10.1", db: "PGSQL · auction" },
  { band: "10.10.2", db: "PGSQL · estate" },
  { band: "10.20.5", db: "MSSQL · member" },
];

const PROC_NAMES = [
  "경매낙찰가집계", "일별통계갱신", "회원등급재계산", "알림큐적재", "세션정리",
  "인덱스리빌드", "파티션관리", "매물상태롤업", "랭킹스코어계산", "로그아카이브",
  "중복데이터정리", "환율반영", "지역코드매핑", "캐시무효화",
];

function generateDbProcs(count: number): Collector[] {
  const rng = mulberry32(99991111);
  const out: Collector[] = [];
  for (let i = 0; i < count; i++) {
    const srv = DB_SERVERS[i % DB_SERVERS.length];
    // 한 DB 서버(IP)에 여러 프로시저
    const host = 10 + (Math.floor(i / DB_SERVERS.length) % 2);
    const intervalSec = [60, 300, 600, 900][Math.floor(rng() * 4)];
    const status = pickStatus(rng());

    let lastSignalSec: number;
    if (status === "normal") lastSignalSec = Math.floor(rng() * intervalSec);
    else if (status === "error") lastSignalSec = Math.floor(intervalSec * (3.5 + rng() * 6));
    else lastSignalSec = Math.floor(intervalSec * (10 + rng() * 20));

    const errorsToday = status === "error" ? 1 + Math.floor(rng() * 10) : 0;

    out.push({
      id: `p${i + 1}`,
      kind: "dbproc",
      name: `usp_${PROC_NAMES[i % PROC_NAMES.length]}`,
      project: srv.db,
      type: "PROC",
      importance: IMPORTANCES[Math.floor(rng() * (rng() < 0.5 ? 1 : IMPORTANCES.length))],
      intervalSec,
      lastSignalSec,
      externalIp: `${srv.band}.${host}`,
      internalIp: `${srv.band}.${host}`,
      errorsToday,
      status,
      ...seedProgress(rng),
    });
  }
  return out;
}

// ---- 가상(인메모리/논리) 수집기 ----
const VIRTUAL_NAMES = [
  "메모리집계기", "실시간랭킹계산", "세션캐시동기화", "스트림조인워커", "인메모리큐워커", "집계스냅샷",
];
function generateVirtual(count: number): Collector[] {
  const rng = mulberry32(55557777);
  const out: Collector[] = [];
  for (let i = 0; i < count; i++) {
    const host = 2 + Math.floor(i / 2); // 일부는 같은 가상 노드(IP) 공유
    const intervalSec = [10, 30, 60][Math.floor(rng() * 3)];
    const status = pickStatus(rng());
    let lastSignalSec: number;
    if (status === "normal") lastSignalSec = Math.floor(rng() * intervalSec);
    else if (status === "error") lastSignalSec = Math.floor(intervalSec * (3.5 + rng() * 6));
    else lastSignalSec = Math.floor(intervalSec * (25 + rng() * 30));
    out.push({
      id: `v${i + 1}`,
      kind: "collector",
      virtual: true,
      name: `${VIRTUAL_NAMES[i % VIRTUAL_NAMES.length]}${String.fromCharCode(65 + i)}`,
      project: "in_memory_agg",
      type: rng() < 0.5 ? "API" : "Agent",
      importance: IMPORTANCES[Math.floor(rng() * IMPORTANCES.length)],
      intervalSec,
      lastSignalSec,
      externalIp: `10.255.0.${host}`,
      internalIp: `10.255.0.${host}`,
      errorsToday: status === "error" ? 1 + Math.floor(rng() * 8) : 0,
      status,
      ...seedProgress(rng),
    });
  }
  return out;
}

// 대표 12 + 수집기 96 + DB프로시저 14 + 가상 6
const featuredRng = mulberry32(13572468);
export const INITIAL_COLLECTORS: Collector[] = [
  ...FEATURED_COLLECTORS.map((c) => ({
    ...c,
    kind: "collector" as const,
    ...seedProgress(featuredRng),
  })),
  ...generateCollectors(96),
  ...generateDbProcs(14),
  ...generateVirtual(6),
];

// ============================ Context 상태 시드 ============================
export const seedMuted = (): Set<string> =>
  new Set(INITIAL_COLLECTORS.filter((c) => c.importance === "낮음").map((c) => c.id));

export const seedConfigs = (): Record<string, CollectorConfig> => {
  const m: Record<string, CollectorConfig> = {};
  INITIAL_COLLECTORS.forEach((c) => {
    m[c.id] = {
      cron: CRON_BY_IMPORTANCE[c.importance],
      remindDays: c.importance === "높음" ? 3 : c.importance === "중간" ? 5 : 7,
      excludeKeywords: [],
    };
  });
  return m;
};

// 사용자가 등록한 수집기 (대부분 라이브와 일치 → 실행중). 일부는 일부러 누락(미발견).
export const seedRegistry = (): RegistryEntry[] =>
  INITIAL_COLLECTORS.filter((_, i) => i % 6 !== 0).map((c) => ({
    id: `reg-${c.id}`,
    name: c.name,
    ip: c.externalIp,
    project: c.project,
  }));

export const seedRecipients = (): Recipient[] => [
  { id: "r1", name: "운영팀 김주임", phone: "010-1234-5678", enabled: true },
  { id: "r2", name: "관제 야간조", phone: "010-9876-5432", enabled: true },
  { id: "r3", name: "백업 담당", phone: "010-5555-0000", enabled: false },
];

export const seedSendLogs = (): SendLog[] => {
  const now = Date.now();
  return [
    { id: "s1", ts: now - 3600_000, kind: "alert", to: "운영팀 김주임", subject: "[경고] 법원경매공고크롤러 정지", status: "success" },
    { id: "s2", ts: now - 7200_000, kind: "alert", to: "운영팀 김주임, 관제 야간조", subject: "[경고] 지적도이미지수집기 통신 끊김", status: "fail", error: "카카오 API 503" },
    { id: "s3", ts: now - 86400_000, kind: "schedule", to: "운영팀 김주임", subject: "[점검] 경매수집기A 정기 점검 D-3", status: "success" },
  ];
};

export const DEFAULT_ALERT: AlertConfig = {
  enabled: true,
  botName: "수집기 모니터봇",
  token: "",
  minImportance: "중간",
  cooldownSec: 600,
  consecutive: 2,
  quietEnabled: false,
  quietFrom: "23:00",
  quietTo: "07:00",
  excludeKeywords: ["일시적", "429", "재시도"], // 기본: 일시적/레이트리밋 제외
};

// 시작 시 에러/중지 이력 시드 — 현재 이상 + 금일 에러가 있던(복구된) 수집기까지.
// 오류: errorsToday와 1:1 일치, 중지: 끊김/재접속 반복 2~9건(샘플).
export function seedErrorEvents(collectors: Collector[]): ErrorEvent[] {
  const targets = collectors
    .filter((c) => c.status === "error" || c.status === "offline" || c.errorsToday > 0)
    .slice(0, 50);
  const seed: ErrorEvent[] = [];
  const dayStart = new Date().setHours(0, 0, 0, 0);
  const elapsedToday = Math.max(1, Date.now() - dayStart);
  for (const c of targets) {
    const offline = c.status === "offline";
    const evStatus: CollectorStatus = offline ? "offline" : "error";
    const todayN = offline ? 2 + Math.floor(Math.random() * 8) : Math.max(c.errorsToday, 1);
    for (let j = 0; j < todayN; j++) {
      // 하루에 고르게 분포 (최신순 정렬 시 보기 좋게)
      const ts = dayStart + Math.floor((elapsedToday * (j + 0.5)) / todayN) + Math.floor(Math.random() * 90_000);
      seed.push({
        id: `seed-${c.id}-t${j}`,
        collectorId: c.id,
        name: c.name,
        kind: c.kind,
        status: evStatus,
        ts: Math.min(ts, Date.now()),
        message: offline ? `생존 신호 두절 — 재접속 실패 (#${j + 1})` : `오류 발생 (#${j + 1})`,
        log: offline ? `no heartbeat for ${c.lastSignalSec + j * 60}s` : pickErrorLog(),
      });
    }
    // 달력(이력)용 과거 이벤트 2건
    for (let k = 0; k < 2; k++) {
      seed.push({
        id: `seed-${c.id}-p${k}`,
        collectorId: c.id,
        name: c.name,
        kind: c.kind,
        status: evStatus,
        ts: Date.now() - (1 + Math.floor(Math.random() * 29)) * 86400_000,
        message: offline ? "생존 신호 두절 (통신 끊김)" : "오류 발생",
        log: offline ? "no heartbeat" : pickErrorLog(),
      });
    }
  }
  seed.sort((a, b) => b.ts - a.ts);
  return seed;
}

// ============================ 실시간 시뮬레이션 ============================
// 2초마다 1틱: 신호 수신/상태 전이/수집 누적을 흉내내고, 악화 시 이력 이벤트를 만든다.
// 실데이터 전환 시 → WebSocket/폴링으로 받은 스냅샷으로 대체.
export function tickCollectors(prev: Collector[]): { next: Collector[]; events: ErrorEvent[] } {
  const events: ErrorEvent[] = [];
  const now = Date.now();

  const next = prev.map((c) => {
    let lastSignalSec = c.lastSignalSec + 2;
    let status = c.status;
    let errorsToday = c.errorsToday;

    const receiveChance = c.status === "offline" ? 0.02 : 0.45;
    if (Math.random() < receiveChance) lastSignalSec = 0;

    const grace = c.intervalSec;
    if (lastSignalSec > grace * 20) status = "offline";
    else if (lastSignalSec > grace * 3) status = "error";
    else status = "normal";

    const worsened = SEVERITY[status] >= 2 && SEVERITY[c.status] < 2;

    // 오류 발생 카운트 = 현황판 이벤트와 1:1 (전이 시 + 지속 오류 중 추가 발생)
    if (status === "error" && (worsened || Math.random() < 0.3)) {
      errorsToday += 1;
      events.push({
        id: `${c.id}-${now}`,
        collectorId: c.id,
        name: c.name,
        kind: c.kind,
        status: "error",
        ts: now,
        message: `오류 발생 (금일 ${errorsToday}건)`,
        log: pickErrorLog(),
      });
    }
    // 중지(끊김) 전이 시 이력 기록
    if (status === "offline" && worsened) {
      events.push({
        id: `${c.id}-${now}-off`,
        collectorId: c.id,
        name: c.name,
        kind: c.kind,
        status: "offline",
        ts: now,
        message: "생존 신호 두절 (통신 끊김)",
        log: `no heartbeat for ${lastSignalSec}s`,
      });
    }

    let { processed, total, lastMsg, collectedToday } = c;
    if (status === "normal") {
      const step = Math.max(1, Math.round(total / 60));
      const inc = Math.floor(Math.random() * step) + 1;
      processed += inc;
      collectedToday += inc; // 금일 누적 수집 건수 (리셋하지 않음)
      if (Math.random() < 0.5) lastMsg = nextProgressMsg();
      if (processed >= total) {
        processed = 0;
        lastMsg = nextProgressMsg();
      }
    }

    return { ...c, lastSignalSec, status, errorsToday, processed, total, lastMsg, collectedToday };
  });

  return { next, events };
}

// 수동 장애 주입 (테스트 버튼)
export function injectFaultInto(prev: Collector[]): { next: Collector[]; event: ErrorEvent } {
  const idx = Math.floor(Math.random() * prev.length);
  const target = prev[idx];
  const next = prev.map((c, i) =>
    i === idx
      ? { ...c, status: "error" as CollectorStatus, lastSignalSec: c.intervalSec * 4, errorsToday: c.errorsToday + 1 }
      : c
  );
  const event: ErrorEvent = {
    id: `${target.id}-${Date.now()}`,
    collectorId: target.id,
    name: target.name,
    kind: target.kind,
    status: "error",
    ts: Date.now(),
    message: "수동 장애 주입",
    log: "manual fault injection (test)",
  };
  return { next, event };
}

// 알림톡 발송 결과(성공/실패) — 실데이터 전환 시 실제 발송 API 응답으로 대체
export const mockSendResult = (): boolean => Math.random() < 0.15; // true = 실패
// 미들웨어 통신 점검 결과 — 실데이터 전환 시 헬스체크 응답으로 대체
export const mockMiddlewareOk = (): boolean => Math.random() > 0.25;
