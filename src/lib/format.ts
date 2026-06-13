// 표시용 포맷 헬퍼 (앱 전역 공용)

// 천 단위 구분 숫자: 12,340
export const fmtNum = (n: number) => n.toLocaleString("en-US");

// 시:분:초 (오전/오후): 02:10:13
export const fmtTime = (ts: number) =>
  new Date(ts).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

// 월/일 시:분: 06/13 02:10
export const fmtDateTime = (ts: number) =>
  new Date(ts).toLocaleString("ko-KR", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
