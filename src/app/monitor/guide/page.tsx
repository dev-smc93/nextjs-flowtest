"use client";

import { useRef, useState } from "react";
import Scroll from "@/components/Scroll";

type Section = { id: string; icon: string; title: string; key: string; desc: string; steps: string[] };

const SECTIONS: Section[] = [
  {
    id: "dashboard",
    icon: "📊",
    title: "대시보드",
    key: "위젯 자유 배치 + 실시간 상태 한눈에",
    desc: "위젯을 드래그로 배치해 실시간 상태를 한눈에 봅니다.",
    steps: [
      "‘레이아웃 잠금’을 풀면 위젯을 드래그·크기조절할 수 있고 배치는 자동 저장됩니다.",
      "상태 요약 카드를 클릭하면 해당 상태로 수집기 목록이 필터링됩니다.",
      "위젯 헤더의 ✕로 제거, ‘위젯 관리’에서 다시 추가합니다.",
    ],
  },
  {
    id: "graph",
    icon: "🛰️",
    title: "통신 토폴로지",
    key: "수집기 → 미들웨어 → DB 통신 시각화",
    desc: "수집기·DB프로시저와 미들웨어 간 통신을 그림으로 보여줍니다.",
    steps: [
      "상단 필터(전체 / 수집기 / DB프로시저)에 맞춰 목록도 함께 필터됩니다.",
      "🌐 대역·서버(IP) 박스를 클릭해 접고 펼칩니다.",
"🧠 가상 수집기(회색 점선·‘가상’ 태그)는 정지(끊김)된 수집기가 복구되지 않고 자정을 넘겨 다음날까지 이어졌을 때 '가상'으로 잡히는 항목입니다. 이 경우 상태 요약에는 '미실행'으로 표시되어, 전날의 미복구 정지를 놓치지 않습니다.",
      "수집기를 선택하면 통신 경로가 강조되고 해당 노드로 확대됩니다.",
    ],
  },
  {
    id: "charts",
    icon: "📈",
    title: "추이 차트",
    key: "에러·정지 추이를 그래프로 분석",
    desc: "기간별 에러/정지 발생 추이와 중요도별 분포를 차트로 봅니다.",
    steps: [
      "에러·중지 추이(영역 차트)로 일자별 발생량을 확인합니다.",
      "7 / 14 / 30일 범위를 토글해 기간을 바꿉니다.",
      "중요도별 장애 분포로 어디에 문제가 몰리는지 파악합니다.",
    ],
  },
  {
    id: "history",
    icon: "🧾",
    title: "에러 / 정지 이력",
    key: "기간·작업별 에러/정지 타임라인",
    desc: "달력으로 기간을 고르고 작업별로 에러·정지 이벤트를 조회합니다.",
    steps: [
      "📅 버튼으로 기간(최대 1개월, 미래일 제외)을 선택합니다.",
      "콤보박스로 이력 있는 작업만 골라 필터링합니다.",
      "타임라인의 ‘📋 복사’로 상세 로그를 복사합니다.",
    ],
  },
  {
    id: "alerts",
    icon: "💬",
    title: "알림톡 설정",
    key: "카카오 알림톡 자동 발송 정책",
    desc: "발송 정책·수신자·키워드 제외·발송 이력을 관리합니다.",
    steps: [
      "수신자(명칭/번호)를 등록하고 ON/OFF로 발송 대상을 제어합니다.",
      "전역/수집기별 키워드로 중요하지 않은 오류를 제외합니다.",
      "‘테스트 발송’으로 성공/실패를 확인합니다.",
    ],
  },
  {
    id: "schedule",
    icon: "🗓️",
    title: "점검 일정",
    key: "cron 점검 주기 + N일 전 알림",
    desc: "중요도별 점검 주기를 cron으로 관리하고 N일 전 알림을 보냅니다.",
    steps: [
      "cron 식을 입력하면 사람이 읽는 해석·다음 점검일·알림 예정일이 표시됩니다.",
      "‘N일 전’(한 자리)으로 점검 임박 알림 시점을 정합니다.",
      "🔔 토글로 특정 수집기를 알림에서 제외합니다.",
    ],
  },
  {
    id: "collectors",
    icon: "🗂️",
    title: "수집기 관리",
    key: "수집기 등록 · 실행 매칭",
    desc: "수집기를 직접 등록하고 실행 여부를 매칭합니다.",
    steps: [
      "명칭·IP·작업명으로 수집기를 등록합니다.",
      "실행 중이면 ‘● 실행중’, 없으면 ‘미발견’으로 표시됩니다.",
      "‘신규 발견’ 목록에서 미등록 수집기를 한 번에 등록합니다.",
    ],
  },
  {
    id: "widgets",
    icon: "🧩",
    title: "위젯 관리",
    key: "페이지별 위젯 추가 / 제거",
    desc: "각 페이지(보드)에 표시할 위젯을 켜고 끕니다.",
    steps: [
      "상단 탭에서 편집할 페이지(보드)를 선택합니다.",
      "‘+ 추가 / ✓ 추가됨’으로 위젯을 켜고 끕니다.",
      "변경은 즉시 해당 페이지에 반영됩니다.",
    ],
  },
  {
    id: "nav",
    icon: "↕️",
    title: "메뉴 편집",
    key: "좌측 메뉴 순서 드래그 편집",
    desc: "좌측 사이드바의 그룹·메뉴 순서를 드래그로 바꿉니다.",
    steps: [
      "⠿ 핸들을 잡고 그룹/메뉴를 드래그해 순서를 바꿉니다.",
      "변경 즉시 좌측 사이드바에 반영·저장됩니다.",
      "‘기본 순서로 복원’으로 초기 상태로 되돌립니다.",
    ],
  },
];

function Dot({ c }: { c: string }) {
  return <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: c }} />;
}

// 각 화면을 본뜬 미니 미리보기(목업)
function Preview({ id }: { id: string }) {
  if (id === "dashboard")
    return (
      <div className="grid h-full grid-cols-3 grid-rows-2 gap-1.5 p-2">
        <div className="bg-surface2 col-span-2 row-span-2 rounded-md ring-1 ring-zinc-500/20">
          <div className="h-2 animate-pulse rounded-t-md bg-sky-500/40" />
        </div>
        <div className="bg-surface2 rounded-md ring-1 ring-zinc-500/20">
          <div className="h-2 rounded-t-md bg-emerald-500/30" />
        </div>
        <div className="bg-surface2 rounded-md ring-1 ring-zinc-500/20">
          <div className="h-2 rounded-t-md bg-amber-500/30" />
        </div>
      </div>
    );
  if (id === "graph")
    return (
      <svg viewBox="0 0 160 80" className="h-full w-full">
        {[
          [20, 20],
          [20, 45],
          [20, 65],
          [50, 30],
          [50, 58],
        ].map(([x, y], i) => (
          <g key={i}>
            <line className="flow-line" x1={x + 14} y1={y} x2={110} y2={40} stroke="#22c55e" strokeWidth="1" strokeDasharray="3 3" />
            <rect x={x} y={y - 5} width="14" height="10" rx="2" fill="var(--surface)" stroke="#3f3f46" />
          </g>
        ))}
        <line className="flow-line" x1={118} y1={40} x2={140} y2={25} stroke="#a78bfa" strokeWidth="1.2" strokeDasharray="3 3" />
        <rect x={140} y={20} width="14" height="10" rx="2" fill="var(--surface)" stroke="#a78bfa" />
        <circle cx={114} cy={40} r="9" fill="#0ea5e9" className="origin-center animate-pulse" style={{ transformBox: "fill-box" }} />
        <text x={114} y={43} textAnchor="middle" fontSize="8" fill="#fff">🛰</text>
      </svg>
    );
  if (id === "charts")
    return (
      <div className="flex h-full items-end gap-1.5 p-3">
        {[45, 70, 35, 88, 55, 62, 40].map((h, i) => (
          <div
            key={i}
            className="flex-1 rounded-t"
            style={{ height: `${h}%`, background: i % 3 === 0 ? "#f59e0b" : "#ef4444", opacity: 0.75 }}
          />
        ))}
      </div>
    );
  if (id === "history")
    return (
      <div className="flex h-full gap-2 p-2">
        <div className="grid grid-cols-4 gap-0.5">
          {Array.from({ length: 12 }).map((_, i) => (
            <div
              key={i}
              className={`h-2.5 w-2.5 rounded-sm ${i === 5 || i === 6 ? "animate-pulse bg-sky-500/70" : "bg-surface2"}`}
            />
          ))}
        </div>
        <div className="flex-1 space-y-1">
          {["#ef4444", "#6b7280", "#f59e0b"].map((c, i) => (
            <div key={i} className="bg-surface2 flex items-center gap-1 rounded px-1 py-0.5">
              <Dot c={c} />
              <div className="bg-zinc-500/30 h-1 flex-1 rounded" />
            </div>
          ))}
        </div>
      </div>
    );
  if (id === "alerts")
    return (
      <div className="space-y-1.5 p-2">
        <div className="flex items-center gap-1.5">
          <div className="h-3 w-6 rounded-full bg-emerald-500 p-0.5">
            <div className="h-2 w-2 rounded-full bg-white" style={{ animation: "slideKnob 2.4s ease-in-out infinite" }} />
          </div>
          <span className="text-[9px] text-muted">카카오 알림톡 ON</span>
        </div>
        {["운영팀 김주임", "관제 야간조"].map((n) => (
          <div key={n} className="bg-surface2 flex items-center gap-1.5 rounded px-1.5 py-1 text-[9px]">
            <Dot c="#22c55e" /> {n}{" "}
            <span className="ml-auto inline-block origin-top" style={{ animation: "wiggle 1.8s ease-in-out infinite" }}>
              🔔
            </span>
          </div>
        ))}
      </div>
    );
  if (id === "schedule")
    return (
      <div className="space-y-1.5 p-2 text-[9px]">
        <div className="bg-surface2 rounded px-1.5 py-1 font-mono">0 9 1 * *</div>
        <div className="text-muted">→ 매월 1일 09:00</div>
        <span className="inline-block animate-pulse rounded-full bg-amber-500/20 px-1.5 py-0.5 font-semibold text-amber-300">
          ⏰ D-3 알림 예정
        </span>
      </div>
    );
  if (id === "widgets")
    return (
      <div className="grid h-full grid-cols-2 gap-1.5 p-2 text-[9px] font-semibold">
        {["✓ 추가됨", "+ 추가", "+ 추가", "✓ 추가됨"].map((t, i) => (
          <div
            key={i}
            className={`flex items-center justify-center rounded-md ring-1 ${
              t.startsWith("✓")
                ? "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30"
                : "bg-zinc-500/10 text-muted ring-zinc-500/30"
            }`}
          >
            {t}
          </div>
        ))}
      </div>
    );
  if (id === "nav")
    return (
      <div className="space-y-1 p-2 text-[9px]">
        {["📊 대시보드", "📈 추이 차트", "🧾 에러/정지 이력"].map((t) => (
          <div key={t} className="bg-surface2 flex items-center gap-1.5 rounded px-1.5 py-1">
            <span className="text-muted">⠿</span>
            {t}
          </div>
        ))}
      </div>
    );
  // collectors
  return (
    <div className="space-y-1.5 p-2 text-[9px]">
      <div className="bg-surface2 rounded ring-1 ring-emerald-500/40">
        <div className="flex items-center gap-1 px-1.5 py-1">
          <span className="status-glow inline-block h-1.5 w-1.5 rounded-full" style={{ background: "#22c55e" }} />
          <span className="font-semibold text-emerald-400">실행중</span>
          <span className="text-muted ml-auto font-mono">222.112.141.6</span>
        </div>
      </div>
      <div className="bg-surface2 rounded ring-1 ring-red-500/40">
        <div className="flex items-center gap-1 px-1.5 py-1">
          <Dot c="#ef4444" /> <span className="font-semibold text-red-400">미발견</span>
        </div>
      </div>
    </div>
  );
}

export default function GuidePage() {
  const [active, setActive] = useState<string | null>(null);
  const [flashId, setFlashId] = useState<string | null>(null); // 선택 시 헤더 잠깐 강조
  const flashTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const onSelect = (id: string) => {
    setActive(id);
    setFlashId(id);
    clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => setFlashId(null), 1600);
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="page-enter flex h-full w-full flex-col">
      {/* 상단 고정 영역 (제목·설명·기능 칩) */}
      <div className="border-line bg-app shrink-0 border-b px-5 pt-5 pb-3">
        <div className="mx-auto max-w-5xl">
          <h1 className="text-lg font-extrabold">사용 방법</h1>
          <p className="text-muted mt-1 text-sm">각 화면의 미리보기와 핵심 기능·사용 절차를 안내합니다.</p>
          {/* 주요 기능 한눈에 — 칩 요약 */}
          <div className="mt-3 flex flex-wrap gap-2">
            {SECTIONS.map((s) => {
              const on = active === s.id;
              return (
                <a
                  key={s.id}
                  href={`#${s.id}`}
                  onClick={(e) => {
                    e.preventDefault();
                    onSelect(s.id);
                  }}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition ${
                    on
                      ? "border-sky-500/60 bg-sky-500/20 text-sky-300 ring-1 ring-sky-500/40"
                      : "border-line bg-surface2 text-fg hover:border-sky-500/50 hover:text-sky-400"
                  }`}
                >
                  <span>{s.icon}</span>
                  {s.title}
                </a>
              );
            })}
          </div>
        </div>
      </div>

      {/* 스크롤되는 카드 영역 */}
      <Scroll className="min-h-0 flex-1">
      <div className="mx-auto max-w-5xl p-5">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {SECTIONS.map((s) => (
            <div
              key={s.id}
              id={s.id}
              className={`card-3d elevate bg-surface scroll-mt-4 overflow-hidden rounded-xl transition-all duration-500 ${
                flashId === s.id ? "ring-2 ring-sky-400/70" : ""
              }`}
              style={
                flashId === s.id
                  ? { backgroundColor: "rgba(56,189,248,0.12)", boxShadow: "0 0 22px rgba(56,189,248,0.3)" }
                  : undefined
              }
            >
              <div className="panel-head flex items-center gap-2 px-4 py-2.5">
                <span className="text-lg">{s.icon}</span>
                <span className="text-sm font-bold">{s.title}</span>
              </div>
              {/* 미니 미리보기 */}
              <div className="bg-app border-line h-28 border-b">
                <Preview id={s.id} />
              </div>
              <div className="p-4">
                {/* 핵심 기능 — 눈에 띄게 */}
                <div className="flex items-center gap-1.5 rounded-lg bg-sky-500/10 px-3 py-2 ring-1 ring-sky-500/25">
                  <span className="text-sky-400">⭐</span>
                  <span className="text-[12px] font-bold text-sky-300">핵심</span>
                  <span className="text-fg text-[12px] font-semibold">{s.key}</span>
                </div>
                <p className="text-muted mt-2.5 text-xs leading-relaxed">{s.desc}</p>
                <ol className="mt-3 space-y-2">
                  {s.steps.map((t, i) => (
                    <li key={i} className="flex gap-2 text-xs">
                      <span className="bg-sky-500/15 text-sky-400 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold">
                        {i + 1}
                      </span>
                      <span className="text-fg leading-relaxed">{t}</span>
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          ))}
        </div>
      </div>
      </Scroll>
    </div>
  );
}
