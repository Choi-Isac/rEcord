// 사이트 디자인 전환 (헤더 메뉴바에서 고르고, 이 브라우저에 기억)
// 고른 디자인은 메인 화면의 구성을 바꾸고, <html data-theme>로 모든 화면의 색 테마를 바꾼다(global.css)
import { createContext, useContext, useLayoutEffect } from "react";
import { useStoredState } from "./storage.js";

export const HOME_DESIGNS = [
  { key: "footprint", label: "발자국", desc: "바로 골라 보는 계산기형" },
  { key: "story", label: "인포그래픽", desc: "숫자로 읽는 이야기형" },
  { key: "classic", label: "기본", desc: "처음 만든 소개형" },
];

// index.html의 인라인 스크립트도 이 키를 읽어, 첫 화면부터 테마가 깜빡이지 않게 한다
export const DESIGN_KEY = "carboncalc:homeDesign";

const DesignContext = createContext(null);

export function DesignProvider({ children }) {
  const [design, setDesign] = useStoredState(DESIGN_KEY, HOME_DESIGNS[0].key);
  // 저장된 값이 목록에 없으면(디자인 이름 변경 등) 첫 디자인으로
  const valid = HOME_DESIGNS.some((d) => d.key === design) ? design : HOME_DESIGNS[0].key;

  useLayoutEffect(() => {
    document.documentElement.dataset.theme = valid;
  }, [valid]);

  return <DesignContext.Provider value={[valid, setDesign]}>{children}</DesignContext.Provider>;
}

export const useHomeDesign = () => useContext(DesignContext);
