"use client";

import { useEffect } from "react";

// 통신 신호(레이더 핑) 파비콘.
// 24/7 상시 구동 최적화: 프레임을 마운트 시 1회만 캔버스로 구워 dataURL 배열로 캐시하고,
// 이후엔 setInterval로 문자열만 교체한다(매 프레임 캔버스 draw/toDataURL 호출 없음 → 상시 CPU ≈ 0).
// 탭이 숨겨지면 완전히 멈춘다.
export default function AnimatedFavicon() {
  useEffect(() => {
    const SIZE = 64;
    const FRAMES = 30;
    const FPS = 12;
    const SKY = "#38bdf8";

    const canvas = document.createElement("canvas");
    canvas.width = SIZE;
    canvas.height = SIZE;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const cx = SIZE / 2;
    const cy = SIZE / 2;
    const RINGS = 3;
    const maxR = 26;

    const bakeFrame = (phase: number): string => {
      ctx.clearRect(0, 0, SIZE, SIZE);
      // 둥근 사각 배경
      const r = 14;
      ctx.beginPath();
      ctx.moveTo(r, 0);
      ctx.arcTo(SIZE, 0, SIZE, SIZE, r);
      ctx.arcTo(SIZE, SIZE, 0, SIZE, r);
      ctx.arcTo(0, SIZE, 0, 0, r);
      ctx.arcTo(0, 0, SIZE, 0, r);
      ctx.closePath();
      ctx.fillStyle = "#0b0e14";
      ctx.fill();
      // 퍼져나가는 핑 링
      ctx.lineCap = "round";
      for (let i = 0; i < RINGS; i++) {
        const p = (phase + i / RINGS) % 1;
        ctx.beginPath();
        ctx.arc(cx, cy, 5 + p * maxR, 0, Math.PI * 2);
        ctx.strokeStyle = SKY;
        ctx.globalAlpha = Math.max(0, 1 - p) * 0.9;
        ctx.lineWidth = 3;
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      // 중심 점 (맥동)
      const pulse = 0.5 + 0.5 * Math.sin(phase * Math.PI * 2);
      ctx.beginPath();
      ctx.arc(cx, cy, 5 + pulse * 1.6, 0, Math.PI * 2);
      ctx.fillStyle = SKY;
      ctx.shadowColor = SKY;
      ctx.shadowBlur = 8;
      ctx.fill();
      ctx.shadowBlur = 0;
      return canvas.toDataURL("image/png");
    };

    // 마운트 시 1회만 굽는다 (이후 GC 대상 캔버스 작업 없음)
    const frames = Array.from({ length: FRAMES }, (_, i) => bakeFrame(i / FRAMES));

    let link = document.querySelector<HTMLLinkElement>("link[rel~='icon']");
    if (!link) {
      link = document.createElement("link");
      link.rel = "icon";
      document.head.appendChild(link);
    }
    link.type = "image/png";
    link.href = frames[0];

    let i = 0;
    let timer: ReturnType<typeof setInterval> | null = null;
    const tick = () => {
      i = (i + 1) % FRAMES;
      link!.href = frames[i];
    };
    const start = () => {
      if (timer === null) timer = setInterval(tick, Math.round(1000 / FPS));
    };
    const stop = () => {
      if (timer !== null) {
        clearInterval(timer);
        timer = null;
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

  return null;
}
