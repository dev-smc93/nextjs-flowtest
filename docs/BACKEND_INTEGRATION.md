# CollectOps 백엔드 연동 문서 (MSSQL)

> 대상: 백엔드 개발자
> 목적: 현재 프론트엔드(Next.js)가 사용하는 **목(mock) 데이터를 실제 MSSQL 기반 API로 교체**하기 위한 데이터 모델·API 계약·상태 계산 규칙 정의
> 연동 DB: **Microsoft SQL Server (MSSQL)**

---

## 1. 전체 구조 한눈에 보기

```
[수집기/DB프로시저]  --(heartbeat/실행로그)-->  [수집 미들웨어]  -->  [MSSQL]
                                                                      |
                                                            [백엔드 API (신규 개발)]
                                                                      |  REST(JSON) / (옵션) SSE
                                                                      v
                                                          [CollectOps 프론트엔드(Next.js)]
```

- 프론트엔드는 **모든 데이터를 한 파일에서만** 가져옵니다: `src/lib/sampleData.ts`
- 현재는 이 파일이 가짜 데이터를 만들어 냅니다. **백엔드 연동 = 이 파일의 함수들을 실제 API 호출로 바꾸는 것**이 전부이며, 화면 컴포넌트는 수정할 필요가 없습니다.
- 따라서 백엔드는 **아래 6절의 REST 응답 JSON 형태를 그대로 맞춰주면** 됩니다. (프론트 타입과 1:1 매핑)

### 프론트 교체 지점 (참고)
| 현재 함수 (sampleData.ts) | 의미 | 대응 API |
|---|---|---|
| `INITIAL_COLLECTORS`, `tickCollectors()` | 수집기 현재 상태(라이브) | `GET /api/collectors` (폴링) |
| `seedErrorEvents()` | 에러/중지 이력 | `GET /api/events` |
| `seedConfigs()` | 수집기별 점검/알림 설정 | `GET /api/configs`, `PUT /api/configs/{id}` |
| `seedRegistry()` | 등록된 수집기 | `GET/POST/DELETE /api/registry` |
| `seedRecipients()` | 알림 수신자 | `GET/POST/PATCH/DELETE /api/recipients` |
| `seedSendLogs()` | 알림톡 발송 이력 | `GET /api/send-logs` |
| `DEFAULT_ALERT` | 알림 정책 | `GET/PUT /api/alert-config` |
| `mockSendResult()` | 알림 테스트 발송 결과 | `POST /api/alerts/test` |
| `mockMiddlewareOk()` | 미들웨어 헬스 | `GET /api/middleware/health` |

---

## 2. 핵심 개념 / Enum

| 개념 | 값 | 설명 |
|---|---|---|
| `status` (상태) | `normal` \| `error` \| `offline` | 정상 / 오류 / 중지(끊김) |
| `kind` (종류) | `collector` \| `dbproc` | 수집기(→미들웨어) / DB프로시저(미들웨어→DB) |
| `type` (유형) | `API` \| `Agent` \| `PROC` | 표시용 유형 |
| `importance` (중요도) | `높음` \| `중간` \| `낮음` | 한글 문자열 그대로 사용 |
| 심각도 정렬 | normal=0, error=2, offline=3 | 값이 클수록 심각 |

> ⚠️ `importance`는 **한글 문자열**(`높음/중간/낮음`)을 그대로 주고받습니다. (영문 변환 X)

### 2.1 상태(status) 계산 규칙 — **백엔드가 동일하게 계산해야 함**

각 수집기는 주기(`intervalSec`)마다 생존 신호(heartbeat)를 보냅니다.
`마지막 신호 이후 경과 초(lastSignalSec)`를 기준으로 상태를 판정합니다.

```
grace = intervalSec                      // 기대 주기(초)
if   lastSignalSec > grace * 20  -> offline   (중지/끊김)
elif lastSignalSec > grace * 3   -> error     (오류/지연)
else                             -> normal    (정상)
```

- `lastSignalSec = DATEDIFF(SECOND, LastSignalAt, SYSUTCDATETIME())` 로 계산
- 프론트는 폴링 응답의 `status`, `lastSignalSec`를 **그대로 신뢰**합니다. (백엔드에서 계산해 내려주세요)

### 2.2 금일 집계 필드
- `errorsToday`: **오늘(자정~현재)** 발생한 오류 이벤트 건수
- `collectedToday`: 오늘 누적 수집 건수 (수집량 지표의 기준값)

---

## 3. 데이터 모델 (프론트 TypeScript 타입 = API 응답 형태)

```ts
// 수집기/DB프로시저 1건 (라이브 스냅샷)
interface Collector {
  id: string;
  kind: "collector" | "dbproc";
  name: string;            // 작업명
  project: string;         // 프로젝트/작업그룹
  path?: string;           // 실행 경로 (선택)
  type: "API" | "Agent" | "PROC";
  importance: "높음" | "중간" | "낮음";
  intervalSec: number;     // 기대 주기(초)
  lastSignalSec: number;   // 마지막 신호 이후 경과 초 (백엔드 계산)
  externalIp: string;
  internalIp: string;
  errorsToday: number;     // 금일 오류 건수
  status: "normal" | "error" | "offline";
  virtual?: boolean;       // 가상(인메모리) 수집기 여부
  collectedToday: number;  // 금일 누적 수집 건수
  total: number;           // 이번 사이클 총 작업 수 (진행바용, 없으면 0)
  processed: number;       // 처리 완료 수 (없으면 0)
  lastMsg: string;         // 현재 처리 항목 텍스트 (없으면 "")
}

// 에러/중지 이력 1건
interface ErrorEvent {
  id: string;
  collectorId: string;
  name: string;            // 수집기명 (조인 결과)
  kind: "collector" | "dbproc";
  status: "error" | "offline";
  ts: number;              // 발생 시각 (epoch ms, UTC 기준 ms)
  message: string;         // 요약 메시지
  log: string;             // 원본 로그
}

// 수집기별 점검/알림 설정
interface CollectorConfig {
  cron: string;            // 점검 스케줄 (표준 cron 식)
  remindDays: number;      // 점검 N일 전 알림 (0~9)
  excludeKeywords: string[]; // 이 수집기 전용 알림 제외 키워드
  // muted?: boolean;      // (권장 추가) 알림 제외 여부 — 4.2 참고
}

// 사용자가 등록한 수집기
interface RegistryEntry {
  id: string;
  name: string;
  ip: string;              // 외부 IP
  project: string;
}

// 알림 수신자
interface Recipient {
  id: string;
  name: string;
  phone: string;           // 010-0000-0000
  enabled: boolean;
}

// 발송 이력
interface SendLog {
  id: string;
  ts: number;              // epoch ms
  kind: "alert" | "schedule";
  to: string;              // 수신자 표시 문자열 (예: "운영팀 김주임, 관제 야간조")
  subject: string;
  status: "success" | "fail";
  error?: string;
}

// 알림 정책 (단일 설정)
interface AlertConfig {
  enabled: boolean;
  botName: string;
  token: string;           // 카카오 알림톡 토큰
  minImportance: "높음" | "중간" | "낮음"; // 이 중요도 이상만 발송
  cooldownSec: number;     // 동일 항목 재발송 쿨다운
  consecutive: number;     // 연속 N회 이상 오류일 때만
  quietEnabled: boolean;
  quietFrom: string;       // "23:00"
  quietTo: string;         // "07:00"
  excludeKeywords: string[]; // 로그에 포함 시 발송 제외
}
```

> 📌 **시간 값은 epoch milliseconds(`ts`)** 로 주고받습니다. MSSQL `DATETIME2`(UTC) → API 직렬화 시 `DATEDIFF_BIG(MILLISECOND,'1970-01-01', SentAtUtc)` 형태로 변환하세요.

---

## 4. MSSQL 스키마 (T-SQL DDL)

```sql
-- 수집기 마스터 + 라이브 상태
CREATE TABLE dbo.Collectors (
  Id            VARCHAR(64)   NOT NULL PRIMARY KEY,
  Kind          VARCHAR(16)   NOT NULL CONSTRAINT CK_Collectors_Kind CHECK (Kind IN ('collector','dbproc')),
  Name          NVARCHAR(200) NOT NULL,
  Project       NVARCHAR(200) NOT NULL,
  Path          NVARCHAR(400) NULL,
  Type          VARCHAR(16)   NOT NULL CONSTRAINT CK_Collectors_Type CHECK (Type IN ('API','Agent','PROC')),
  Importance    NVARCHAR(8)   NOT NULL CONSTRAINT CK_Collectors_Imp CHECK (Importance IN (N'높음',N'중간',N'낮음')),
  IntervalSec   INT           NOT NULL,
  ExternalIp    VARCHAR(64)   NOT NULL,
  InternalIp    VARCHAR(64)   NOT NULL,
  IsVirtual     BIT           NOT NULL DEFAULT 0,
  -- 라이브 상태
  LastSignalAt  DATETIME2     NULL,            -- 마지막 생존 신호 시각(UTC)
  ErrorsToday   INT           NOT NULL DEFAULT 0,
  CollectedToday BIGINT       NOT NULL DEFAULT 0,
  Total         INT           NOT NULL DEFAULT 0,
  Processed     INT           NOT NULL DEFAULT 0,
  LastMsg       NVARCHAR(400) NOT NULL DEFAULT '',
  IsRegistered  BIT           NOT NULL DEFAULT 1, -- 등록(레지스트리) 여부
  UpdatedAt     DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME()
);

-- 에러/중지 이력
CREATE TABLE dbo.ErrorEvents (
  Id          BIGINT IDENTITY(1,1) PRIMARY KEY,
  CollectorId VARCHAR(64)  NOT NULL REFERENCES dbo.Collectors(Id),
  Status      VARCHAR(16)  NOT NULL CHECK (Status IN ('error','offline')),
  OccurredAt  DATETIME2    NOT NULL,        -- UTC
  Message     NVARCHAR(400) NOT NULL,
  Log         NVARCHAR(MAX) NOT NULL
);
CREATE INDEX IX_ErrorEvents_Time ON dbo.ErrorEvents (OccurredAt DESC);
CREATE INDEX IX_ErrorEvents_Collector ON dbo.ErrorEvents (CollectorId, OccurredAt DESC);

-- 수집기별 점검/알림 설정 (1:1)
CREATE TABLE dbo.CollectorConfigs (
  CollectorId     VARCHAR(64) NOT NULL PRIMARY KEY REFERENCES dbo.Collectors(Id),
  Cron            VARCHAR(64) NOT NULL DEFAULT '0 9 1 * *',
  RemindDays      INT         NOT NULL DEFAULT 3,
  ExcludeKeywords NVARCHAR(MAX) NOT NULL DEFAULT '[]', -- JSON 배열 문자열
  Muted           BIT         NOT NULL DEFAULT 0       -- 알림 제외 여부
);

-- 알림 수신자
CREATE TABLE dbo.Recipients (
  Id       VARCHAR(64)   NOT NULL PRIMARY KEY,
  Name     NVARCHAR(100) NOT NULL,
  Phone    VARCHAR(32)   NOT NULL,
  Enabled  BIT           NOT NULL DEFAULT 1
);

-- 발송 이력
CREATE TABLE dbo.SendLogs (
  Id       VARCHAR(64)   NOT NULL PRIMARY KEY,
  SentAt   DATETIME2     NOT NULL,           -- UTC
  Kind     VARCHAR(16)   NOT NULL CHECK (Kind IN ('alert','schedule')),
  ToText   NVARCHAR(400) NOT NULL,
  Subject  NVARCHAR(400) NOT NULL,
  Status   VARCHAR(16)   NOT NULL CHECK (Status IN ('success','fail')),
  Error    NVARCHAR(400) NULL
);
CREATE INDEX IX_SendLogs_Time ON dbo.SendLogs (SentAt DESC);

-- 알림 정책 (단일 행: Id=1 고정)
CREATE TABLE dbo.AlertConfig (
  Id              INT          NOT NULL PRIMARY KEY DEFAULT 1 CHECK (Id = 1),
  Enabled         BIT          NOT NULL DEFAULT 1,
  BotName         NVARCHAR(100) NOT NULL DEFAULT N'수집기 모니터봇',
  Token           NVARCHAR(400) NOT NULL DEFAULT '',
  MinImportance   NVARCHAR(8)  NOT NULL DEFAULT N'중간',
  CooldownSec     INT          NOT NULL DEFAULT 600,
  Consecutive     INT          NOT NULL DEFAULT 2,
  QuietEnabled    BIT          NOT NULL DEFAULT 0,
  QuietFrom       VARCHAR(5)   NOT NULL DEFAULT '23:00',
  QuietTo         VARCHAR(5)   NOT NULL DEFAULT '07:00',
  ExcludeKeywords NVARCHAR(MAX) NOT NULL DEFAULT '[]'
);
```

> `ExcludeKeywords`는 `NVARCHAR(MAX)`에 **JSON 배열 문자열**(`["일시적","429","재시도"]`)로 저장하고, API 직렬화 시 배열로 변환하세요. (별도 자식 테이블을 써도 무방)

### 4.1 상태 계산 쿼리 예시 (GET /api/collectors)
```sql
SELECT
  c.Id, c.Kind, c.Name, c.Project, c.Path, c.Type, c.Importance,
  c.IntervalSec, c.ExternalIp, c.InternalIp, c.IsVirtual AS [virtual],
  c.ErrorsToday, c.CollectedToday, c.Total, c.Processed, c.LastMsg,
  DATEDIFF(SECOND, c.LastSignalAt, SYSUTCDATETIME()) AS lastSignalSec,
  CASE
    WHEN DATEDIFF(SECOND, c.LastSignalAt, SYSUTCDATETIME()) > c.IntervalSec * 20 THEN 'offline'
    WHEN DATEDIFF(SECOND, c.LastSignalAt, SYSUTCDATETIME()) > c.IntervalSec * 3  THEN 'error'
    ELSE 'normal'
  END AS status
FROM dbo.Collectors c
WHERE c.IsRegistered = 1;
```

### 4.2 알림 제외(muted)
프론트의 "알림 제외"(목록·점검일정의 🔔/🔕)는 현재 클라이언트 상태입니다.
실제 연동 시 **`CollectorConfigs.Muted`** 로 저장하고, `GET /api/configs` 응답에 `muted` 필드를 포함하세요. (프론트는 muted를 config의 일부로 읽도록 연결 예정)

---

## 5. 실시간 갱신 전략

프론트는 **2초 주기**로 수집기 상태를 갱신하도록 설계되어 있습니다. (대시보드 자동 갱신 바도 이 주기를 시각화)

- **권장(단순): 폴링** — 프론트가 `GET /api/collectors`를 2~3초 간격으로 호출. 백엔드는 가벼운 단일 쿼리(4.1)로 응답.
- **옵션(고급): SSE/WebSocket** — `GET /api/stream`(text/event-stream)으로 상태 변화 시 push. 대량(수백 대) 환경에서 트래픽 절감. 1차 연동은 폴링으로 시작 권장.

> 신규 에러/중지 이벤트도 폴링으로 가져옵니다: `GET /api/events?since={마지막ts}` 로 증분 조회.

---

## 6. REST API 명세

> 공통: 응답 `Content-Type: application/json; charset=utf-8`. 인증 헤더는 9절 참고.

### 6.1 수집기 라이브 상태
```
GET /api/collectors
200 OK  ->  Collector[]
```
예시 응답:
```json
[
  {
    "id": "c9", "kind": "collector", "name": "법원경매공고크롤러",
    "project": "court_notice_agent", "type": "Agent", "importance": "높음",
    "intervalSec": 30, "lastSignalSec": 240, "externalIp": "118.235.7.42",
    "internalIp": "192.168.5.11", "errorsToday": 14, "status": "error",
    "collectedToday": 18342, "total": 5000, "processed": 1200, "lastMsg": "강남구/역삼동 +12"
  }
]
```

### 6.2 에러/중지 이력
```
GET /api/events?since={epochMs}&limit=400
200 OK  ->  ErrorEvent[]   // 최신순 정렬, ts 내림차순
```
- `since` 생략 시 오늘 자정부터. 캘린더/타임라인용으로 과거 30일까지 조회 가능하게 권장.

### 6.3 수집기별 설정
```
GET /api/configs
200 OK  ->  { [collectorId: string]: CollectorConfig }

PUT /api/configs/{id}
body: Partial<CollectorConfig>     // 예: { "remindDays": 3 } 또는 { "cron": "0 9 1 * *" } 또는 { "muted": true }
200 OK  ->  CollectorConfig
```

### 6.4 등록 수집기 (Registry)
```
GET    /api/registry              -> RegistryEntry[]
POST   /api/registry  body:{name,ip,project}  -> RegistryEntry (id 채번)
DELETE /api/registry/{id}         -> 204 No Content
```

### 6.5 알림 수신자
```
GET    /api/recipients                          -> Recipient[]
POST   /api/recipients  body:{name,phone,enabled} -> Recipient
PATCH  /api/recipients/{id}  body:Partial<Recipient> -> Recipient
DELETE /api/recipients/{id}                     -> 204
```

### 6.6 발송 이력 & 테스트 발송
```
GET  /api/send-logs?limit=200     -> SendLog[]   // 최신순

POST /api/alerts/test  body:{ kind: "alert" | "schedule" }
200 OK -> { ok: boolean, msg: string }
// 발송 시도 후 SendLogs에 1건 적재. ok=false면 msg에 실패 사유.
```

### 6.7 알림 정책
```
GET /api/alert-config            -> AlertConfig
PUT /api/alert-config body:Partial<AlertConfig>  -> AlertConfig
```

### 6.8 미들웨어 헬스
```
GET /api/middleware/health       -> { ok: boolean }
```

---

## 7. 점검 일정 / N일 전 알림 계산

프론트는 표준 **cron 식**(`CollectorConfig.cron`)을 파싱해 다음 점검일과 알림 예정일을 계산합니다.

```
다음 점검일      = cron 식의 다음 발생 시각
알림 예정일      = 다음 점검일 − (remindDays × 1일)
"임박(알림 예정)" = 현재시각 ≥ 알림 예정일  (즉, 다음 점검까지 남은 일수 ≤ remindDays)
```

- `cron`은 표준 5필드 식(`분 시 일 월 요일`)을 사용합니다. 예) `0 9 1 * *` = 매월 1일 09:00.
- 중요도별 기본 스케줄(초기값 참고): 높음 `0 9 1 * *`, 중간 `0 9 1 */3 *`, 낮음 `0 9 1 1 *`.
- **백엔드 역할**: cron/remindDays 저장 및 조회. 실제 알림 발송 스케줄러를 백엔드에서 돌릴 경우, 위 규칙으로 발송 대상·시각을 산출하고 발송 후 `SendLogs`에 기록하세요.

---

## 8. 초기 데이터(시드) 참고

프론트 데모 시드에는 대표 12 + 일반 수집기 96 + DB프로시저 14 + 가상 6 = 약 128건이 있습니다.
실제 환경에서는 미들웨어가 수집기 등록/생존신호를 적재하면 됩니다. 최소 시작 데이터:
- `Collectors` (등록 수집기), `CollectorConfigs` (수집기당 1행, 기본 cron/remindDays),
- `AlertConfig` 1행(Id=1), `Recipients` 약간.

---

## 9. 인증 / 보안

- 현재 프론트는 **데모 비밀번호 `admin`**(클라이언트 sessionStorage)로만 막혀 있습니다 → 실제 연동 시 **서버 인증(JWT/세션)** 으로 교체 필요.
- API는 사내망/리버스프록시 뒤에 두고, 토큰(`AlertConfig.token` 등 민감정보)은 응답에서 마스킹 권장.
- CORS: 프론트 도메인만 허용.

---

## 10. 연동 체크리스트

- [ ] 4절 스키마로 MSSQL 테이블 생성
- [ ] 미들웨어 → `Collectors.LastSignalAt`/집계 컬럼 적재 파이프라인
- [ ] 6절 REST 엔드포인트 구현 (JSON 형태 정확히 일치)
- [ ] 상태/`lastSignalSec`는 **서버에서 계산**해 응답(2.1)
- [ ] 시간은 **epoch ms**로 직렬화
- [ ] 프론트 `src/lib/sampleData.ts`의 시드/시뮬레이션 함수를 `fetch` 호출로 교체 (1절 매핑표)
- [ ] 폴링 주기(기본 2초) 확정, 필요 시 SSE 전환
- [ ] 인증/CORS/민감정보 마스킹 적용

---

### 부록 A. 프론트 연동 코드 교체 예시
```ts
// 변경 전 (sampleData.ts): 가짜 데이터 생성
export const INITIAL_COLLECTORS = [ /* ... */ ];

// 변경 후 (예시): 실제 API 호출 어댑터
export async function fetchCollectors(): Promise<Collector[]> {
  const res = await fetch("/api/collectors", { cache: "no-store" });
  if (!res.ok) throw new Error("collectors fetch failed");
  return res.json(); // Collector[] 형태 그대로
}
```
> Context(`collectorsContext.tsx`)의 2초 `setInterval`(현재 `tickCollectors` 호출)을 `fetchCollectors()` 폴링으로 바꾸면 됩니다. 화면 컴포넌트는 무수정.
