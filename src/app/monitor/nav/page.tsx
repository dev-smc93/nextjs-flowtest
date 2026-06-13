"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import Scroll from "@/components/Scroll";
import {
  DEFAULT_NAV_GROUPS,
  loadNavGroups,
  resetNavOrder,
  saveNavOrder,
  type NavGroup,
} from "@/lib/nav";

type Drag = { type: "group"; gi: number } | { type: "item"; gi: number; ii: number } | null;

export default function NavEditorPage() {
  const [groups, setGroups] = useState<NavGroup[]>(DEFAULT_NAV_GROUPS);
  const groupsRef = useRef(groups);
  groupsRef.current = groups;
  const dragRef = useRef<Drag>(null);
  const [dragKey, setDragKey] = useState<string | null>(null);

  useEffect(() => setGroups(loadNavGroups()), []);

  // 드래그 중 실시간 재정렬 (저장은 dragEnd에서)
  const moveGroup = (from: number, to: number) =>
    setGroups((prev) => {
      if (from === to || to < 0 || to >= prev.length) return prev;
      const n = [...prev];
      const [g] = n.splice(from, 1);
      n.splice(to, 0, g);
      return n;
    });
  const moveItem = (gi: number, from: number, to: number) =>
    setGroups((prev) => {
      const items = prev[gi].items;
      if (from === to || to < 0 || to >= items.length) return prev;
      const ni = [...items];
      const [it] = ni.splice(from, 1);
      ni.splice(to, 0, it);
      return prev.map((g, idx) => (idx === gi ? { ...g, items: ni } : g));
    });

  const onDragEnd = () => {
    dragRef.current = null;
    setDragKey(null);
    saveNavOrder(groupsRef.current);
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
          ⠿ 핸들을 드래그해 그룹·메뉴 순서를 바꾸세요. 변경 즉시 좌측 사이드바에 반영됩니다.
        </p>

        <div className="mt-4 space-y-3">
          {groups.map((g, gi) => (
            <section
              key={g.id}
              onDragOver={(e) => {
                if (dragRef.current?.type !== "group") return;
                e.preventDefault();
                if (dragRef.current.gi !== gi) {
                  moveGroup(dragRef.current.gi, gi);
                  dragRef.current = { type: "group", gi };
                }
              }}
              className={`card-3d bg-surface overflow-hidden rounded-xl transition-opacity ${
                dragKey === `g${gi}` ? "opacity-50" : ""
              }`}
            >
              {/* 그룹 헤더 (드래그 핸들) */}
              <div
                draggable
                onDragStart={() => {
                  dragRef.current = { type: "group", gi };
                  setDragKey(`g${gi}`);
                }}
                onDragEnd={onDragEnd}
                className="panel-head flex cursor-grab items-center gap-2 px-3 py-2.5 active:cursor-grabbing"
              >
                <span className="text-muted text-sm select-none">⠿</span>
                <span className="text-base">{g.icon}</span>
                <span className="text-sm font-bold text-fg">{g.label}</span>
                <span className="text-muted ml-1 rounded-full bg-zinc-500/15 px-2 py-0.5 text-[10px]">
                  {g.items.length}
                </span>
              </div>
              {/* 헤더 구분선 (그라데이션) */}
              <div className="h-px w-full bg-gradient-to-r from-transparent via-sky-400/40 to-transparent" />

              {/* 항목 목록 */}
              <ul className="p-1.5">
                {g.items.map((it, ii) => (
                  <li
                    key={it.href}
                    draggable
                    onDragStart={(e) => {
                      e.stopPropagation();
                      dragRef.current = { type: "item", gi, ii };
                      setDragKey(`i${gi}-${ii}`);
                    }}
                    onDragEnd={onDragEnd}
                    onDragOver={(e) => {
                      const d = dragRef.current;
                      if (d?.type !== "item" || d.gi !== gi) return;
                      e.preventDefault();
                      e.stopPropagation();
                      if (d.ii !== ii) {
                        moveItem(gi, d.ii, ii);
                        dragRef.current = { type: "item", gi, ii };
                      }
                    }}
                    className={`group flex cursor-grab items-center gap-2 rounded-lg px-2.5 py-2 text-sm transition active:cursor-grabbing hover:bg-zinc-500/10 ${
                      dragKey === `i${gi}-${ii}` ? "opacity-40 ring-1 ring-sky-400/50" : ""
                    }`}
                  >
                    <span className="text-muted/60 select-none transition group-hover:text-sky-400">⠿</span>
                    <span className="text-xs">{it.icon}</span>
                    <span className="text-fg">{it.label}</span>
                    <span className="text-muted ml-auto truncate font-mono text-[10px]">{it.href}</span>
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
