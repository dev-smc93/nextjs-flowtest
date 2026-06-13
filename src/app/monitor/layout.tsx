"use client";

import { Toaster } from "sonner";
import { CollectorsProvider } from "@/lib/collectorsContext";
import { ThemeProvider, useTheme } from "@/lib/theme";
import AuthGate from "@/components/AuthGate";
import AppShell from "@/components/AppShell";

// 앱 테마(다크/라이트)에 맞춘 감성 토스트 — 프로스티드 글래스 + 라운드 + 소프트 섀도우
function ThemedToaster() {
  const { theme } = useTheme();
  return (
    <Toaster
      theme={theme}
      richColors
      closeButton
      position="top-center"
      gap={10}
      toastOptions={{
        duration: 2600,
        style: {
          borderRadius: "16px",
          boxShadow: "0 16px 44px -16px rgba(0,0,0,0.5)",
          fontSize: "13px",
          fontWeight: 500,
        },
      }}
    />
  );
}

// 모바일(작은 화면) 미지원 안내 — md(768px) 미만에서 전체 화면을 덮음
function MobileBlock() {
  return (
    <div className="bg-app fixed inset-0 z-[9999] flex flex-col items-center justify-center gap-3 p-8 text-center md:hidden">
      <div className="text-5xl">🖥️</div>
      <div className="text-fg text-lg font-bold">모바일 화면에서는 지원하지 않습니다</div>
      <div className="text-muted text-sm leading-relaxed">
        CollectOps 콘솔은 데스크톱 환경에 최적화되어 있습니다.
        <br />
        가로 768px 이상 화면에서 이용해 주세요.
      </div>
    </div>
  );
}

export default function MonitorLayout({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <ThemedToaster />
      <AuthGate>
        <CollectorsProvider>
          <AppShell>{children}</AppShell>
        </CollectorsProvider>
      </AuthGate>
      <MobileBlock />
    </ThemeProvider>
  );
}
