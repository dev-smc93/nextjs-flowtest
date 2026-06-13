"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import Scroll from "@/components/Scroll";
import {
  DEFAULT_NAV_GROUPS,
  loadNavGroups,
  resetNavOrder,
  saveNavOrder,
  type NavGroup,
} from "@/lib/nav";

export default function NavEditorPage() {
  const [groups, setGroups] = useState<NavGroup[]>(DEFAULT_NAV_GROUPS);

  useEffect(() => setGroups(loadNavGroups()), []);

  // 변경 즉시 저장 → 좌측 사이드바에 실시간 반영
  const commit = (next: NavGroup[]) => {
    setGroups(next);
    saveNavOrder(next);
  };

  const moveGroup = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= groups.length) return;
    const next = [...groups];
    [next[i], next[j]] = [next[j], next[i]];
    commit(next);
  };

  const moveItem = (gi: number, ii: number, dir: -1 | 1) => {
    const items = groups[gi].items;
    const j = ii + dir;
    if (j < 0 || j >= items.length) return;
    const ni = [...items];
    [ni[ii], ni[j]] = [ni[j], ni[ii]];
    commit(groups.map((g, idx) => (idx === gi ? { ...g, items: ni } : g)));
  };

  const reset = () => {
    resetNavOrder();
    setGroups(DEFAULT_NAV_GROUPS);
    toast.success("기본 순서로 복원됨");
  };

  return (
    <Scroll className="page-enter h-full w-full">
      <div className="mx-auto max-w-3xl p-5">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-lg font-extrabold">메뉴 편집</h1>
          <button
            onClick={reset}
            className="btn-3d bg-surface2 text-fg ml-auto rounded-lg px-3 py-1.5 text-xs font-semibold ring-1 ring-zinc-500/30"
          >
            기본 순서로 복원
          </button>
        </div>
        <p className="text-muted mt-1 text-sm">
          ▲▼ 버튼으로 그룹과 메뉴 항목의 순서를 바꾸세요. 변경 즉시 좌측 사이드바에 반영됩니다.
        </p>

        <div className="mt-4 space-y-3">
          {groups.map((g, gi) => (
            <section key={g.id} className="card-3d bg-surface overflow-hidden rounded-xl">
              {/* 그룹 헤더 */}
              <div className="panel-head border-line flex items-center gap-2 border-b px-3 py-2">
                <span className="text-base">{g.icon}</span>
                <span className="text-sm font-bold text-fg">{g.label}</span>
                <span className="text-muted text-[11px]">· {g.items.length}개 메뉴</span>
                <div className="ml-auto flex items-center gap-1">
                  <ArrowBtn dir="up" disabled={gi === 0} onClick={() => moveGroup(gi, -1)} title="그룹 위로" />
                  <ArrowBtn dir="down" disabled={gi === groups.length - 1} onClick={() => moveGroup(gi, 1)} title="그룹 아래로" />
                </div>
              </div>
              {/* 항목 목록 */}
              <ul className="divide-line divide-y">
                {g.items.map((it, ii) => (
                  <li key={it.href} className="flex items-center gap-2 px-3 py-2 text-sm">
                    <span className="font-mono text-[12px] leading-none text-zinc-500">└</span>
                    <span className="text-xs">{it.icon}</span>
                    <span className="text-fg">{it.label}</span>
                    <span className="text-muted ml-2 truncate font-mono text-[10px]">{it.href}</span>
                    <div className="ml-auto flex items-center gap-1">
                      <ArrowBtn dir="up" disabled={ii === 0} onClick={() => moveItem(gi, ii, -1)} title="위로" />
                      <ArrowBtn dir="down" disabled={ii === g.items.length - 1} onClick={() => moveItem(gi, ii, 1)} title="아래로" />
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </div>
    </Scroll>
  );
}

function ArrowBtn({
  dir,
  disabled,
  onClick,
  title,
}: {
  dir: "up" | "down";
  disabled?: boolean;
  onClick: () => void;
  title: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="rounded-md px-2 py-1 text-xs text-muted transition hover:bg-sky-500/15 hover:text-sky-400 disabled:opacity-25 disabled:hover:bg-transparent"
    >
      {dir === "up" ? "▲" : "▼"}
    </button>
  );
}
