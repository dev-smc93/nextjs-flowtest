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

export default function MonitorLayout({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <ThemedToaster />
      <AuthGate>
        <CollectorsProvider>
          <AppShell>{children}</AppShell>
        </CollectorsProvider>
      </AuthGate>
    </ThemeProvider>
  );
}
