import { Link } from "react-router-dom";
import { NAV } from "../lib/nav.js";
import { FACTOR_VERSION } from "../lib/carbon/factors.js";
import "./Footer.css";

const DATA_POLICY =
  "입력 정보는 이용 중인 브라우저에 저장되며, 통계·연구 활용에 동의한 응답에 한해 개인 식별 정보 없이 서버에 저장됩니다. 제출된 피드백은 동의 여부와 관계없이 서버에 저장됩니다.";

export default function Footer() {
  return (
    <footer className="site-footer">
      <div className="wrap footer-grid">
        <div>
          <div className="footer-logo">rEcord</div>
          <p>고려대학교 탄소발자국 계산기 (v0.1)</p>
          <p className="footer-note">
            배출계수 {FACTOR_VERSION} · 결과는 잠정 배출계수를 적용한 추정값입니다.
            <br className="only-desktop" />
            <span className="only-desktop">{DATA_POLICY}</span>
          </p>
          {/* 휴대폰: 데이터 처리 안내는 접어 둔다 */}
          <details className="footer-policy only-mobile-block">
            <summary>데이터 처리 안내</summary>
            <p className="footer-note">{DATA_POLICY}</p>
          </details>
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
