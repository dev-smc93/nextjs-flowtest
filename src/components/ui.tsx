"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";

// 숫자가 부드럽게 카운트되는 컴포넌트
export function AnimatedNumber({
  value,
  className,
  style,
}: {
  value: number;
  className?: string;
  style?: CSSProperties;
}) {
  const [display, setDisplay] = useState(0);
  const prev = useRef(0);

  useEffect(() => {
    const from = prev.current;
    const to = value;
    prev.current = value;
    if (from === to) {
      setDisplay(to);
      return;
    }
    const dur = 650;
    const start = performance.now();
    let raf = 0;
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / dur);
      const e = 1 - Math.pow(1 - t, 3);
      setDisplay(Math.round(from + (to - from) * e));
      if (t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value]);

  return (
    <span className={className} style={style}>
      {display}
    </span>
  );
}

export function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string | number;
  accent: string;
}) {
  return (
    <div className="card-3d elevate bg-surface rounded-xl px-4 py-2.5">
      <div className="text-muted text-[11px]">{label}</div>
      <div className="text-xl font-extrabold" style={{ color: accent }}>
        {value}
      </div>
    </div>
  );
}

export function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!on)}
      className={`h-5 w-9 rounded-full p-0.5 transition ${on ? "bg-emerald-500" : "bg-zinc-600"}`}
    >
      <span className={`block h-4 w-4 rounded-full bg-white transition ${on ? "translate-x-4" : ""}`} />
    </button>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="mb-3 block">
      <span className="text-muted mb-1 block text-[11px]">{label}</span>
      {children}
    </label>
  );
}

export function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  return (
    <div
      onClick={onClose}
      className="fade-in fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="card-3d bg-surface page-enter w-[340px] rounded-2xl p-5"
      >
        <h2 className="text-sm font-extrabold">{title}</h2>
        <div className="mt-3">{children}</div>
      </div>
    </div>
  );
}

export function Panel({
  title,
  right,
  children,
}: {
  title: string;
  right?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="card-3d bg-surface flex min-h-0 flex-col rounded-xl">
      <div className="panel-head border-line flex items-center gap-2 border-b px-4 py-2 text-sm font-bold">
        <span>{title}</span>
        {right && <span className="ml-auto">{right}</span>}
      </div>
      {children}
    </section>
  );
}
