// 좌측 사이드바 네비게이션 정의 + 사용자 순서(그룹/항목) localStorage 영속화
// '메뉴 편집' 페이지에서 순서를 바꾸면 AppShell이 이 순서를 읽어 렌더한다.

export type NavItem = { href: string; label: string; icon: string };
export type NavGroup = { id: string; label: string; icon: string; items: NavItem[] };

export const DEFAULT_NAV_GROUPS: NavGroup[] = [
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
      { href: "/monitor/nav", label: "메뉴 편집", icon: "↕️" },
    ],
  },
  {
    id: "help",
    label: "도움말",
    icon: "❓",
    items: [{ href: "/monitor/guide", label: "사용 방법", icon: "📖" }],
  },
];

const KEY = "nav-order-v1";
export const NAV_ORDER_EVENT = "nav-order-changed";

type Order = { groups: string[]; items: Record<string, string[]> };

// 저장된 순서를 기본 정의에 적용 (새로 추가된 그룹/항목은 뒤에 자동 보강)
export function loadNavGroups(): NavGroup[] {
  let order: Order | null = null;
  try {
    const s = localStorage.getItem(KEY);
    if (s) order = JSON.parse(s);
  } catch {}
  if (!order || !Array.isArray(order.groups)) return DEFAULT_NAV_GROUPS;

  const byId = new Map(DEFAULT_NAV_GROUPS.map((g) => [g.id, g]));
  const orderedGroups: NavGroup[] = [
    ...order.groups.map((id) => byId.get(id)).filter((g): g is NavGroup => !!g),
    ...DEFAULT_NAV_GROUPS.filter((g) => !order!.groups.includes(g.id)),
  ];

  return orderedGroups.map((g) => {
    const itemOrder = order!.items?.[g.id];
    if (!itemOrder) return g;
    const byHref = new Map(g.items.map((it) => [it.href, it]));
    const items: NavItem[] = [
      ...itemOrder.map((h) => byHref.get(h)).filter((it): it is NavItem => !!it),
      ...g.items.filter((it) => !itemOrder.includes(it.href)),
    ];
    return { ...g, items };
  });
}

export function saveNavOrder(groups: NavGroup[]) {
  const order: Order = {
    groups: groups.map((g) => g.id),
    items: Object.fromEntries(groups.map((g) => [g.id, g.items.map((it) => it.href)])),
  };
  try {
    localStorage.setItem(KEY, JSON.stringify(order));
    window.dispatchEvent(new CustomEvent(NAV_ORDER_EVENT));
  } catch {}
}

export function resetNavOrder() {
  try {
    localStorage.removeItem(KEY);
    window.dispatchEvent(new CustomEvent(NAV_ORDER_EVENT));
  } catch {}
}
