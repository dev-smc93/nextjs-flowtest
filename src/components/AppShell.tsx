"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ClipLoader } from "react-spinners";
import { useCollectors } from "@/lib/collectorsContext";
import { useTheme } from "@/lib/theme";
import { BoardChromeProvider, useBoardChrome } from "@/lib/boardChrome";
import { Modal } from "@/components/ui";

type NavItem = { href: string; label: string; icon: string };
type NavGroup = { id: string; label: string; icon: string; items: NavItem[] };

const NAV_GROUPS: NavGroup[] = [
  {
    id: "monitoring",
    label: "모니터링",
    icon: "🖥️",
    items: [
      { href: "/monitor", label: "대시보드", icon: "📊" },
      { href: "/monitor/charts", label: "추이 차트", icon: "📈" },
      { href: "/monitor/history", label: "에러/정지 이력", icon: "🧾" },
    ],
  },
  {
    id: "ops",
    label: "알림 · 일정",
    icon: "🔔",
    items: [
      { href: "/monitor/alerts", label: "알림톡 설정", icon: "💬" },
      { href: "/monitor/schedule", label: "점검 일정", icon: "🗓️" },
    ],
  },
  {
    id: "manage",
    label: "관리",
    icon: "🗂️",
    items: [
      { href: "/monitor/collectors", label: "수집기 관리", icon: "📁" },
      { href: "/monitor/widgets", label: "위젯 관리", icon: "🧩" },
    ],
  },
  {
    id: "help",
    label: "도움말",
    icon: "❓",
    items: [{ href: "/monitor/guide", label: "사용 방법", icon: "📖" }],
  },
];

const TITLES: Record<string, string> = {
  "/monitor": "대시보드",
  "/monitor/charts": "에러·중지 추이 차트",
  "/monitor/widgets": "위젯 관리",
  "/monitor/history": "에러 / 정지(끊김) 이력",
  "/monitor/alerts": "알림톡 설정",
  "/monitor/schedule": "점검 일정 (Cron)",
  "/monitor/collectors": "수집기 등록 / 관리",
  "/monitor/guide": "사용 방법",
};

export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <BoardChromeProvider>
      <AppShellInner>{children}</AppShellInner>
    </BoardChromeProvider>
  );
}

function AppShellInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { injectFault, mwOk, mwTesting, testMiddleware } = useCollectors();
  const { theme, toggle } = useTheme();
  const { editing, toggleEditing, boardActive, resetCurrent } = useBoardChrome();
  const [now, setNow] = useState("");
  const [collapsed, setCollapsed] = useState(true);
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [openGroups, setOpenGroups] = useState<Set<string>>(
    () => new Set(NAV_GROUPS.map((g) => g.id))
  );
  const toggleGroup = (id: string) =>
    setOpenGroups((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  useEffect(() => {
    const v = localStorage.getItem("nav-collapsed");
    if (v !== null) setCollapsed(v === "1");
    const fmt = () =>
      new Date().toLocaleString("ko-KR", {
        year: "2-digit",
        month: "2-digit",
        day: "2-digit",
        weekday: "short",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
    setNow(fmt());
    // 시간은 자동 갱신 바(10초)가 한 바퀴 돌 때마다 갱신
    const t = setInterval(() => setNow(fmt()), 10000);
    return () => clearInterval(t);
  }, []);

  const toggleNav = () =>
    setCollapsed((v) => {
      localStorage.setItem("nav-collapsed", v ? "0" : "1");
      return !v;
    });

  const doLogout = () => {
    sessionStorage.removeItem("collectops-auth");
    location.reload();
  };

  // 미들웨어 점검 결과 토스트
  const wasTesting = useRef(false);
  useEffect(() => {
    if (wasTesting.current && !mwTesting) {
      if (mwOk) toast.success("미들웨어 통신 정상");
      else toast.error("미들웨어 응답 이상 — 점검 필요");
    }
    wasTesting.current = mwTesting;
  }, [mwTesting, mwOk]);

  return (
    <div className="bg-app text-fg flex h-screen w-screen overflow-hidden">
      <aside
        className={`sidebar border-line flex shrink-0 flex-col overflow-hidden border-r transition-[width] duration-300 ease-in-out ${
          collapsed ? "w-16" : "w-56"
        }`}
      >
        <div className="border-line flex flex-col gap-2 overflow-hidden border-b px-4 py-4">
          <div className="flex h-9 items-center justify-center">
            {collapsed ? (
              <div className="text-sm font-extrabold text-sky-400">CO</div>
            ) : (
              <div className="whitespace-nowrap text-center">
                <div className="text-sm font-extrabold">CollectOps</div>
                <div className="text-muted text-[10px]">수집 모니터링 콘솔</div>
              </div>
            )}
          </div>
          {/* 자동 갱신 (2초 주기 라이브) */}
          <div className="flex items-center justify-center gap-2">
            <svg
              viewBox="0 0 24 24"
              className="h-3.5 w-3.5 shrink-0 text-sky-400"
              style={{ animation: "refreshTick 10s linear infinite" }}
              fill="none"
              stroke="currentColor"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21 12a9 9 0 1 1-2.64-6.36" />
              <path d="M21 3v6h-6" />
            </svg>
            <span className={`text-[10px] text-muted whitespace-nowrap transition-opacity duration-200 ${collapsed ? "hidden" : "opacity-100"}`}>
              자동 갱신
            </span>
            {!collapsed && (
              <div className="bg-surface2 h-1.5 w-20 overflow-hidden rounded-full">
                <div className="h-full rounded-full bg-sky-500" style={{ animation: "refillBar 10s linear infinite" }} />
              </div>
            )}
          </div>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto overflow-x-hidden p-2">
          {NAV_GROUPS.map((g) => {
            const open = collapsed || openGroups.has(g.id);
            return (
              <div key={g.id}>
                {/* 카테고리 헤더 (항상 렌더 → 폭 변화에 맞춰 자연스럽게 클립) */}
                <button
                  onClick={() => toggleGroup(g.id)}
                  className="text-muted flex w-full items-center gap-2 overflow-hidden rounded-lg px-2 py-1.5 text-[11px] font-bold whitespace-nowrap uppercase tracking-wide transition hover:bg-zinc-500/10"
                >
                  <span className="shrink-0 text-sm">{g.icon}</span>
                  <span className={`transition-opacity duration-200 ${collapsed ? "opacity-0" : "opacity-100"}`}>
                    {g.label}
                  </span>
                  <span
                    className={`ml-auto text-[10px] transition-all duration-200 ${collapsed ? "opacity-0" : "opacity-100"} ${open ? "" : "-rotate-90"}`}
                  >
                    ▾
                  </span>
                </button>
                <div
                  className="grid transition-[grid-template-rows] duration-300 ease-in-out"
                  style={{ gridTemplateRows: open ? "1fr" : "0fr" }}
                >
                  <div className="overflow-hidden">
                    <div className={`mt-0.5 space-y-0.5 pb-1 ${collapsed ? "pl-0.5" : "pl-3"}`}>
                      {g.items.map((n) => {
                        const active = pathname === n.href;
                        return (
                          <Link
                            key={n.href}
                            href={n.href}
                            title={n.label}
                            className={`flex items-center gap-1.5 overflow-hidden rounded-lg px-2 py-2 text-sm font-medium whitespace-nowrap transition ${
                              active
                                ? "nav-active bg-sky-500/15 text-sky-400 ring-1 ring-sky-500/30"
                                : "text-muted hover:bg-zinc-500/10"
                            }`}
                          >
                            <span className="shrink-0 font-mono text-[12px] leading-none text-zinc-500">└</span>
                            <span className="shrink-0 text-xs">{n.icon}</span>
                            <span className={`transition-opacity duration-200 ${collapsed ? "opacity-0" : "opacity-100"}`}>
                              {n.label}
                            </span>
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </nav>
        <button
          onClick={() => setLogoutOpen(true)}
          className="border-line flex items-center justify-center gap-2 border-t py-2.5 text-xs font-semibold text-red-400 transition hover:bg-red-500/15"
        >
          <svg viewBox="0 0 24 24" className="h-[18px] w-[18px] shrink-0" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 3v9" />
            <path d="M7.5 6.7a8 8 0 1 0 9 0" />
          </svg>
          {!collapsed && <span className="whitespace-nowrap">로그아웃</span>}
        </button>
        <button
          onClick={toggleNav}
          className="border-line text-muted flex items-center justify-center gap-1.5 border-t py-2 text-xs transition hover:bg-zinc-500/10 hover:text-sky-400"
        >
          <svg viewBox="0 0 24 24" className={`h-4 w-4 shrink-0 transition-transform ${collapsed ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M13 6l-6 6 6 6" />
            <path d="M19 6l-6 6 6 6" />
          </svg>
          {!collapsed && <span>접기</span>}
        </button>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="panel-head border-line flex shrink-0 items-center gap-3 border-b px-5 py-3">
          <h1 className="text-base font-extrabold">{TITLES[pathname] ?? "모니터"}</h1>
          <span className="text-muted font-mono text-xs">{now}</span>
          {/* 미들웨어 헬스 */}
          <button
            onClick={testMiddleware}
            title="미들웨어 통신 점검"
            className={`btn-3d rounded-lg px-2.5 py-1 text-[11px] font-semibold ring-1 ${
              mwTesting
                ? "bg-sky-500/20 text-sky-400 ring-sky-500/40"
                : mwOk
                  ? "bg-emerald-500/15 text-emerald-400 ring-emerald-500/40"
                  : "bg-red-500/15 text-red-400 ring-red-500/40"
            }`}
          >
            {mwTesting ? (
              <span className="inline-flex items-center gap-1.5">
                <ClipLoader size={11} color="#38bdf8" /> 점검중…
              </span>
            ) : mwOk ? (
              "🛰️ 미들웨어 정상"
            ) : (
              "🛰️ 미들웨어 이상"
            )}
          </button>
          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={() => {
                injectFault();
                toast.error("장애 주입됨", { description: "임의 수집기에 오류 발생" });
              }}
              className="btn-3d rounded-lg bg-red-500/15 px-3 py-1.5 text-xs font-semibold text-red-400 ring-1 ring-red-500/40 hover:bg-red-500/25"
            >
              장애 주입
            </button>
            {/* 레이아웃 잠금/편집 — 현재 페이지(보드)에만 적용 */}
            {boardActive && (
              <>
                <button
                  onClick={() => {
                    toast(editing ? "🔒 레이아웃 잠금" : "🔓 편집 모드");
                    toggleEditing();
                  }}
                  className={`btn-3d rounded-lg px-3 py-1.5 text-xs font-semibold ${
                    editing ? "bg-sky-500/20 text-sky-300 ring-1 ring-sky-500/40" : "bg-surface2 text-fg ring-1 ring-zinc-500/30"
                  }`}
                >
                  {editing ? "🔓 편집 중" : "🔒 레이아웃 잠금"}
                </button>
                {editing && (
                  <button
                    onClick={resetCurrent}
                    className="btn-3d bg-surface2 text-fg rounded-lg px-3 py-1.5 text-xs font-semibold ring-1 ring-zinc-500/30"
                  >
                    기본값 복원
                  </button>
                )}
              </>
            )}
            <button
              onClick={toggle}
              title="테마 전환"
              className="btn-3d text-muted rounded-lg bg-zinc-500/10 px-3 py-1.5 text-sm ring-1 ring-zinc-500/30 hover:bg-zinc-500/20"
            >
              {theme === "dark" ? "🌙" : "☀️"}
            </button>
          </div>
        </header>
        <main className="min-h-0 flex-1 overflow-hidden">{children}</main>
      </div>

      {logoutOpen && (
        <Modal title="로그아웃" onClose={() => setLogoutOpen(false)}>
          <p className="text-muted text-xs">정말 로그아웃 하시겠습니까?</p>
          <div className="mt-4 flex justify-end gap-2">
            <button
              onClick={() => setLogoutOpen(false)}
              className="text-muted rounded-lg bg-zinc-500/10 px-3 py-1.5 text-xs font-semibold ring-1 ring-zinc-500/30 hover:bg-zinc-500/20"
            >
              취소
            </button>
            <button
              onClick={doLogout}
              className="rounded-lg bg-red-500 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-red-400 active:scale-95"
            >
              로그아웃
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
