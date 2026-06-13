"use client";

import type { ReactNode } from "react";
import dynamic from "next/dynamic";
import GraphWidget from "@/components/widgets/GraphWidget";
import SummaryWidget from "@/components/widgets/SummaryWidget";
import TableWidget from "@/components/widgets/TableWidget";
import AlertFeedWidget from "@/components/widgets/AlertFeedWidget";
import CliWidget from "@/components/widgets/CliWidget";
import { HistoryTopWidget, HistoryTimelineWidget } from "@/components/widgets/HistoryWidget";

// 차트 위젯은 recharts(무거움)를 포함 → 차트 페이지에서만 로드되도록 동적 임포트(코드 스플리팅)
const chartLoading = () => (
  <div className="flex h-full items-center justify-center text-xs text-muted">차트 불러오는 중…</div>
);
const TrendChartWidget = dynamic(
  () => import("@/components/widgets/ChartWidgets").then((m) => m.TrendChartWidget),
  { ssr: false, loading: chartLoading }
);
const ImportanceBarWidget = dynamic(
  () => import("@/components/widgets/ChartWidgets").then((m) => m.ImportanceBarWidget),
  { ssr: false, loading: chartLoading }
);
import AlertSettingsWidget from "@/components/widgets/AlertSettingsWidget";
import ScheduleWidget from "@/components/widgets/ScheduleWidget";
import CollectorsWidget from "@/components/widgets/CollectorsWidget";
import { RecipientsPanel, SendHistory } from "@/components/Recipients";

export type WidgetDef = {
  id: string;
  title: string;
  icon: string;
  render: () => ReactNode;
  def: { w: number; h: number; minW: number; minH: number };
};

const FULL = { w: 12, h: 18, minW: 6, minH: 8 };

export const WIDGET_CATALOG: WidgetDef[] = [
  { id: "graph", title: "통신 토폴로지", icon: "🛰️", render: () => <GraphWidget />, def: { w: 8, h: 15, minW: 4, minH: 8 } },
  { id: "summary", title: "상태 요약", icon: "📊", render: () => <SummaryWidget />, def: { w: 12, h: 4, minW: 3, minH: 3 } },
  { id: "alertsFeed", title: "금일 장애·중지", icon: "🚨", render: () => <AlertFeedWidget />, def: { w: 4, h: 9, minW: 3, minH: 5 } },
  { id: "cli", title: "수집 및 적재 현황", icon: "🖥️", render: () => <CliWidget />, def: { w: 7, h: 9, minW: 4, minH: 5 } },
  { id: "table", title: "수집기 목록", icon: "📋", render: () => <TableWidget />, def: { w: 5, h: 9, minW: 4, minH: 5 } },
  { id: "historyTop", title: "에러·정지 요약 TOP", icon: "🧾", render: () => <HistoryTopWidget />, def: { w: 5, h: 14, minW: 4, minH: 8 } },
  { id: "historyTimeline", title: "에러/정지 타임라인", icon: "🕒", render: () => <HistoryTimelineWidget />, def: { w: 7, h: 14, minW: 4, minH: 8 } },
  { id: "trend", title: "에러·중지 추이", icon: "📈", render: () => <TrendChartWidget />, def: { w: 8, h: 14, minW: 4, minH: 7 } },
  { id: "impBar", title: "중요도별 장애 분포", icon: "📊", render: () => <ImportanceBarWidget />, def: { w: 4, h: 14, minW: 3, minH: 7 } },
  { id: "alertSettings", title: "알림 정책 / 수집기별", icon: "💬", render: () => <AlertSettingsWidget />, def: { w: 8, h: 16, minW: 5, minH: 8 } },
  { id: "recipients", title: "알림 수신자", icon: "📒", render: () => <div className="page-enter h-full overflow-auto p-2"><RecipientsPanel /></div>, def: { w: 4, h: 8, minW: 3, minH: 5 } },
  { id: "sendAlert", title: "알림톡 발송 이력", icon: "📨", render: () => <div className="page-enter h-full p-2"><SendHistory kind="alert" title="알림톡 발송 이력" /></div>, def: { w: 4, h: 8, minW: 3, minH: 5 } },
  { id: "schedule", title: "점검 일정 (Cron)", icon: "🗓️", render: () => <ScheduleWidget />, def: { w: 8, h: 16, minW: 5, minH: 8 } },
  { id: "sendSchedule", title: "점검 발송 이력", icon: "📮", render: () => <div className="page-enter h-full p-2"><SendHistory kind="schedule" title="점검 발송 이력" /></div>, def: { w: 4, h: 8, minW: 3, minH: 5 } },
  { id: "collectors", title: "수집기 관리", icon: "🗂️", render: () => <CollectorsWidget />, def: FULL },
];

export const WIDGET_MAP = Object.fromEntries(WIDGET_CATALOG.map((w) => [w.id, w]));

export type BoardId = "dashboard" | "charts" | "history" | "alerts" | "schedule" | "collectors";
export const BOARDS: { id: BoardId; label: string }[] = [
  { id: "dashboard", label: "대시보드" },
  { id: "charts", label: "추이 차트" },
  { id: "history", label: "에러/정지 이력" },
  { id: "alerts", label: "알림톡 설정" },
  { id: "schedule", label: "점검 일정" },
  { id: "collectors", label: "수집기 관리" },
];

// 보드별 사용 가능한(전용) 위젯
export const BOARD_WIDGETS: Record<BoardId, string[]> = {
  dashboard: ["graph", "summary", "alertsFeed", "cli", "table"],
  charts: ["trend", "impBar", "summary"],
  history: ["historyTop", "historyTimeline"],
  alerts: ["alertSettings", "recipients", "sendAlert"],
  schedule: ["schedule", "recipients", "sendSchedule"],
  collectors: ["collectors"],
};

export const BOARD_DEFAULTS: Record<BoardId, string[]> = {
  dashboard: ["graph", "summary", "alertsFeed", "cli", "table"],
  charts: ["trend", "impBar"],
  history: ["historyTop", "historyTimeline"],
  alerts: ["alertSettings", "recipients", "sendAlert"],
  schedule: ["schedule", "recipients", "sendSchedule"],
  collectors: ["collectors"],
};

const keyOf = (b: BoardId) => `board-${b}-widgets-v2`;

export function loadBoardWidgets(b: BoardId): string[] {
  try {
    const s = localStorage.getItem(keyOf(b));
    if (s) return (JSON.parse(s) as string[]).filter((id) => WIDGET_MAP[id]);
  } catch {}
  return BOARD_DEFAULTS[b];
}
export function saveBoardWidgets(b: BoardId, ids: string[]) {
  try {
    localStorage.setItem(keyOf(b), JSON.stringify(ids));
    window.dispatchEvent(new CustomEvent("board-widgets-changed", { detail: b }));
  } catch {}
}
