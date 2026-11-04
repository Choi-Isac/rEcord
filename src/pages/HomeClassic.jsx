import { Link } from "react-router-dom";
import StackedBar from "../components/charts/StackedBar.jsx";
import { CATEGORIES, REFERENCE_ANSWERS, calculate } from "../lib/carbon/engine.js";
import { QUESTIONS } from "../lib/carbon/questions.js";
import { useResponses } from "../lib/responses.js";
import { CAT_COLORS } from "../lib/colors.js";
import { formatDate, toTon } from "../lib/format.js";
import "../components/charts/charts.css";
import "./Home.css";

const EXAMPLE = calculate(REFERENCE_ANSWERS);

const AREA_QUESTIONS = Object.fromEntries(
  CATEGORIES.map((c) => [c.key, QUESTIONS.filter((q) => q.category === c.key).map((q) => q.label)])
);

const STEPS = [
  { title: "고르기", desc: "칩을 고르고 슬라이더를 움직여 생활 습관 13가지에 답해요." },
  { title: "확인하기", desc: "연간 배출량과 범위, 영역별 기여도, 가장 큰 항목을 봐요." },
  { title: "줄이기", desc: "내 답에서 효과가 큰 감축 행동 3가지와 받을 수 있는 포인트를 알려드려요." },
];

const TRUST = [
  { icon: "📐", title: "계산식을 모두 공개해요", desc: "배출계수와 칩마다 쓰는 대표값을 계산 방법 페이지에 그대로 실었어요." },
  { icon: "↔️", title: "범위로 보여 드려요", desc: "간편 입력은 대표값을 쓰기 때문에, 한 숫자 대신 가능성이 높은 범위를 함께 표시해요." },
  { icon: "🏷️", title: "'추정' 값을 구분해요", desc: "대표값으로 계산한 값에는 '추정' 배지를 붙여, 직접 입력한 값과 구분해요." },
  { icon: "🔒", title: "이름·연락처는 묻지 않아요", desc: "입력값은 내 브라우저에 저장되고, 통계·연구 활용에 동의했을 때만 이름 없이 서버에 모아요." },
];

export default function HomeClassic() {
  const { responses } = useResponses();
  const last = responses.at(-1);
  const lastTotal = last ? calculate(last.answers, last.detail).total.value : null;

  return (
    <>
      <section className="home-hero">
        <div className="wrap home-hero-grid">
          <div>
            <p className="eyebrow">고려대학교 탄소발자국 계산기</p>
            <h1>
              1분이면 알 수 있어요,
              <br />
              나의 탄소발자국
            </h1>
            <p className="lead">
              통학·주거·식생활·소비에 관한 {QUESTIONS.length}가지 질문에 답하면 1년 동안의 탄소 배출량과 가장 효과적인
              감축 방법을 알려드려요.
            </p>
            <div className="hero-actions">
              <Link className="btn btn-light" to="/calculator">
                간편 입력으로 시작하기 →
              </Link>
              {last ? (
                <Link className="btn btn-outline-light" to={`/result/${last.id}`}>
                  지난 결과 {toTon(lastTotal)}톤 · {formatDate(last.completedAt)}
                </Link>
              ) : (
                <Link className="btn btn-outline-light" to="/method">
                  계산 방법 보기
                </Link>
              )}
            </div>
          </div>

          <div className="card preview" aria-label="결과 예시">
            <div className="preview-head">
              <span>결과 예시</span>
              <span className="badge-sample">가상의 대학생</span>
            </div>
            <div className="preview-value">
              {toTon(EXAMPLE.total.value)}
              <small>톤 CO₂e/년</small>
              <span className="badge-est">추정</span>
            </div>
            <div className="preview-range">
              {toTon(EXAMPLE.total.low)}~{toTon(EXAMPLE.total.high)}톤
            </div>
            <StackedBar
              items={CATEGORIES.map((c) => ({ name: c.label, value: Math.round(EXAMPLE.byCategory[c.key].value) }))}
              colors={CATEGORIES.map((c) => CAT_COLORS[c.key])}
              unit="kg"
            />
          </div>
        </div>
      </section>

      <section className="section wrap">
        <div className="sec-head">
          <div>
            <h2>무엇을 물어보나요?</h2>
            <p>대학생의 일상에서 배출이 큰 네 영역을 다뤄요.</p>
          </div>
        </div>
        <div className="areas">
          {CATEGORIES.map((c) => (
            <div key={c.key} className="card area">
              <div className="area-head">
                <span className="area-icon" style={{ "--c": CAT_COLORS[c.key] }} aria-hidden="true">
                  {c.icon}
                </span>
                <h3>{c.label}</h3>
              </div>
              <ul>
                {AREA_QUESTIONS[c.key].map((label) => (
                  <li key={label}>{label}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <section className="section wrap">
        <div className="sec-head">
          <div>
            <h2>이렇게 진행돼요</h2>
          </div>
        </div>
        <ol className="steps">
          {STEPS.map((s, i) => (
            <li key={s.title} className="card">
              <span className="step-num">{i + 1}</span>
              <h3>{s.title}</h3>
              <p>{s.desc}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="section wrap">
        <div className="sec-head">
          <div>
            <h2>믿을 수 있는 결과를 위해</h2>
            <p>지금은 MVP 테스트 버전(v0.1)이에요. 의견을 받아 계속 고쳐 나가요.</p>
          </div>
        </div>
        <div className="trust">
          {TRUST.map((t) => (
            <div key={t.title} className="trust-item">
              <span aria-hidden="true">{t.icon}</span>
              <div>
                <h3>{t.title}</h3>
                <p>{t.desc}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="cta card">
          <div>
            <h2>지금 바로 계산해 보세요</h2>
            <p>약 1분 · 회원가입 없음</p>
          </div>
          <Link className="btn btn-primary" to="/calculator">
            계산 시작하기 →
          </Link>
        </div>
      </section>
    </>
  );
}
