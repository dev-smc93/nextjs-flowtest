"use client";

import { useEffect, useState } from "react";
import { ClipLoader } from "react-spinners";

const PASSWORD = "admin"; // 데모용 비밀번호
const KEY = "collectops-auth";

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [pw, setPw] = useState("");
  const [err, setErr] = useState(false);

  useEffect(() => {
    setAuthed(sessionStorage.getItem(KEY) === "1");
  }, []);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pw === PASSWORD) {
      sessionStorage.setItem(KEY, "1");
      setAuthed(true);
    } else {
      setErr(true);
      setTimeout(() => setErr(false), 1200);
    }
  };

  if (authed === null)
    return (
      <div className="bg-app flex h-screen w-screen items-center justify-center">
        <ClipLoader size={32} color="#38bdf8" />
      </div>
    );
  if (authed) return <>{children}</>;

  return (
    <div className="bg-app relative flex h-screen w-screen items-center justify-center overflow-hidden">
      {/* 은은한 앰비언트 그라데이션 (애플풍) */}
      <div className="pointer-events-none absolute -left-40 -top-40 h-96 w-96 rounded-full bg-sky-500/20 blur-[120px]" />
      <div className="pointer-events-none absolute -bottom-40 -right-32 h-96 w-96 rounded-full bg-indigo-500/20 blur-[120px]" />
      <div className="pointer-events-none absolute left-1/2 top-1/3 h-72 w-72 -translate-x-1/2 rounded-full bg-violet-500/10 blur-[120px]" />

      <form
        onSubmit={submit}
        className={`page-enter relative w-[380px] rounded-[28px] border border-white/10 bg-surface/70 p-9 shadow-2xl backdrop-blur-2xl ${
          err ? "animate-[shake_0.3s]" : ""
        }`}
        style={{ boxShadow: "0 20px 60px -15px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.08)" }}
      >
        {/* 앱 아이콘 (squircle + 신호 글리프) */}
        <div
          className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-[20px] bg-gradient-to-br from-sky-400 to-indigo-500 ring-1 ring-white/25"
          style={{ boxShadow: "0 10px 24px -6px rgba(56,189,248,0.5), inset 0 1px 0 rgba(255,255,255,0.35)" }}
        >
          <svg viewBox="0 0 24 24" className="h-8 w-8" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="15" r="1.5" fill="#fff" stroke="none" />
            <path d="M8.8 11.8a4.5 4.5 0 0 1 6.4 0" />
            <path d="M6.3 9a8 8 0 0 1 11.4 0" />
          </svg>
        </div>

        <h1 className="text-center text-xl font-bold tracking-tight text-fg">CollectOps</h1>
        <p className="text-muted mb-7 mt-1 text-center text-[13px]">수집 모니터링 콘솔</p>

        <label className="text-muted mb-1.5 block text-[12px] font-medium">비밀번호</label>
        <input
          type="password"
          autoFocus
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          placeholder="••••••••"
          className={`w-full rounded-2xl border bg-surface2/80 px-4 py-3 text-sm text-fg outline-none transition placeholder:text-muted ${
            err
              ? "border-red-500 ring-2 ring-red-500/30"
              : "border-line focus:border-sky-500 focus:ring-2 focus:ring-sky-500/30"
          }`}
        />
        {err && <p className="mt-1.5 text-[12px] text-red-400">비밀번호가 올바르지 않습니다.</p>}

        <button
          type="submit"
          className="mt-5 w-full rounded-2xl bg-gradient-to-b from-sky-400 to-sky-500 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-sky-500/30 transition hover:from-sky-300 hover:to-sky-400 active:scale-[0.98]"
        >
          로그인
        </button>

        <p className="text-muted mt-5 text-center text-[11px]">데모 비밀번호 · admin</p>
      </form>
    </div>
  );
}
