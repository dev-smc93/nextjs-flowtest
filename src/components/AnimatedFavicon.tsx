"use client";

import { useEffect } from "react";

// 통신 신호(레이더 핑) 파비콘 — SVG SMIL 은 탭에서 안 움직이므로
// 캔버스로 매 프레임 그려서 favicon href 를 교체한다.
export default function AnimatedFavicon() {
  useEffect(() => {
    const SIZE = 64;
    const canvas = document.createElement("canvas");
    canvas.width = SIZE;
    canvas.height = SIZE;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // favicon link 확보 (없으면 생성)
    let link = document.querySelector<HTMLLinkElement>("link[rel~='icon']");
    if (!link) {
      link = document.createElement("link");
      link.rel = "icon";
      document.head.appendChild(link);
    }
    link.type = "image/png";

    const SKY = "#38bdf8";
    const cx = SIZE / 2;
    const cy = SIZE / 2;
    const RINGS = 3;
    const maxR = 26;

    let raf = 0;
    let last = 0;
    const start = performance.now();

    const draw = (now: number) => {
      raf = requestAnimationFrame(draw);
      // 탭이 안 보이거나 ~13fps 보다 빠르면 스킵 (toDataURL 비용 절감)
      if (document.hidden) return;
      if (now - last < 75) return;
      last = now;

      const phase = ((now - start) / 1500) % 1; // 1.5s 루프

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
        const radius = 5 + p * maxR;
        const alpha = Math.max(0, 1 - p);
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.strokeStyle = SKY;
        ctx.globalAlpha = alpha * 0.9;
        ctx.lineWidth = 3;
        ctx.stroke();
      }
      ctx.globalAlpha = 1;

      // 중심 점 (살짝 맥동)
      const pulse = 0.5 + 0.5 * Math.sin((phase * Math.PI * 2));
      ctx.beginPath();
      ctx.arc(cx, cy, 5 + pulse * 1.6, 0, Math.PI * 2);
      ctx.fillStyle = SKY;
      ctx.shadowColor = SKY;
      ctx.shadowBlur = 8;
      ctx.fill();
      ctx.shadowBlur = 0;

      link!.href = canvas.toDataURL("image/png");
    };

    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, []);

  return null;
}
