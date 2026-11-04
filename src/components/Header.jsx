import { Link, NavLink } from "react-router-dom";
import { NAV } from "../lib/nav.js";
import { HOME_DESIGNS, useHomeDesign } from "../lib/design.jsx";
import "./Header.css";

// 사이트 디자인 전환(메인 구성 + 전체 색 테마): 넓은 화면은 버튼 묶음, 좁은 화면은 선택 상자
function DesignSwitch() {
  const [design, setDesign] = useHomeDesign();
  return (
    <div className="design-switch">
      <div className="design-seg" role="group" aria-label="사이트 디자인">
        {HOME_DESIGNS.map((d) => (
          <button key={d.key} aria-pressed={design === d.key} title={d.desc} onClick={() => setDesign(d.key)}>
            {d.label}
          </button>
        ))}
      </div>
      <select className="design-select" aria-label="사이트 디자인" value={design} onChange={(e) => setDesign(e.target.value)}>
        {HOME_DESIGNS.map((d) => (
          <option key={d.key} value={d.key}>
            디자인: {d.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export default function Header() {
  return (
    <header className="site-header">
      <div className="wrap nav">
        <Link className="logo" to="/">
          <span className="logo-mark" aria-hidden="true" />
          Ecord
        </Link>

        <DesignSwitch />

        <nav className="menu" aria-label="주 메뉴">
          {NAV.map((item) => (
            <NavLink key={item.to} to={item.to} className="menu-link">
              {item.label}
            </NavLink>
          ))}
        </nav>
      </div>
    </header>
  );
}
