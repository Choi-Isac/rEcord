import { Link, NavLink } from "react-router-dom";
import { NAV } from "../lib/nav.js";
import { useAuth } from "../lib/auth.jsx";
import logo from "../img/rEcord_crimson-dot.svg";
import "./Header.css";

export default function Header() {
  const { enabled, user } = useAuth();
  return (
    <header className="site-header">
      <div className="wrap nav">
        <Link className="logo" to="/">
          <img className="logo-img" src={logo} alt="rEcord" width="700" height="218" />
        </Link>

        <nav className="menu" aria-label="주 메뉴">
          {NAV.map((item) => (
            <NavLink key={item.to} to={item.to} className="menu-link">
              {item.label}
            </NavLink>
          ))}
        </nav>
        {enabled && (
          <NavLink to="/account" className="menu-link menu-account">
            {user ? "내 계정" : "로그인"}
          </NavLink>
        )}
      </div>
    </header>
  );
}
