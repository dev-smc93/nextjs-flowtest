// 라우트(페이지 세그먼트) 로딩 중 표시되는 스피너 — 전환 시 잠깐 비는 검은 화면 방지
export default function Loading() {
  return (
    <div className="bg-app flex h-full w-full flex-col items-center justify-center gap-3">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-500/25 border-t-sky-400" />
      <div className="text-muted text-xs">불러오는 중…</div>
    </div>
  );
}
