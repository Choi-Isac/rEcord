import { Link } from "react-router-dom";
import { NAV } from "../lib/nav.js";
import { FACTOR_VERSION } from "../lib/carbon/factors.js";
import "./Footer.css";

export default function Footer() {
  return (
    <footer className="site-footer">
      <div className="wrap footer-grid">
        <div>
          <div className="footer-logo">rEcord</div>
          <p>고려대학교 탄소발자국 계산기 (강의 프로젝트 · MVP v0.1)</p>
          <p className="footer-note">
            배출계수 {FACTOR_VERSION} · 잠정 계수로 계산한 추정값이에요. 입력 내용은 이 브라우저에 저장되고, 통계·연구 활용에 동의한 응답만 이름 없이 서버에 모아요.
          </p>
        </div>
        <div>
          <div className="footer-label">바로가기</div>
          {NAV.map((item) => (
            <Link key={item.to} to={item.to}>
              {item.label}
            </Link>
          ))}
        </div>
      </div>
    </footer>
  );
}
