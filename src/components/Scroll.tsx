"use client";

import { OverlayScrollbarsComponent } from "overlayscrollbars-react";
import "overlayscrollbars/overlayscrollbars.css";

// 라이브러리용 오버레이 스크롤바 래퍼 (기본 OS 스크롤바 대체)
export default function Scroll({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <OverlayScrollbarsComponent
      defer
      options={{
        scrollbars: { theme: "os-theme-light", autoHide: "leave", autoHideDelay: 600 },
        overflow: { x: "scroll", y: "scroll" },
      }}
      className={className}
    >
      {children}
    </OverlayScrollbarsComponent>
  );
}
