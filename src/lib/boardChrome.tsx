"use client";

// 보드(위젯 레이아웃) 편집 상태를 헤더와 WidgetBoard가 공유하기 위한 컨텍스트.
// - 헤더의 '레이아웃 잠금/편집' 버튼이 editing 토글
// - 현재 마운트된 WidgetBoard가 자신의 resetBoard를 등록 → 헤더 '기본값 복원'이 호출
import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from "react";

type BoardChrome = {
  editing: boolean;
  toggleEditing: () => void;
  setEditing: (v: boolean) => void;
  boardActive: boolean; // 현재 화면에 편집 가능한 보드가 있는지
  registerReset: (fn: (() => void) | null) => void;
  resetCurrent: () => void;
};

const Ctx = createContext<BoardChrome | null>(null);

export function BoardChromeProvider({ children }: { children: ReactNode }) {
  const [editing, setEditing] = useState(false);
  const [boardActive, setBoardActive] = useState(false);
  const resetRef = useRef<(() => void) | null>(null);

  const registerReset = useCallback((fn: (() => void) | null) => {
    resetRef.current = fn;
    setBoardActive(!!fn);
  }, []);

  const value: BoardChrome = {
    editing,
    toggleEditing: () => setEditing((v) => !v),
    setEditing,
    boardActive,
    registerReset,
    resetCurrent: () => resetRef.current?.(),
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useBoardChrome(): BoardChrome {
  const v = useContext(Ctx);
  if (!v) throw new Error("useBoardChrome must be used within BoardChromeProvider");
  return v;
}
