// 메인 디자인 '발자국': 첫 화면에서 네 가지를 골라 보며 발자국이 커지는 것을 바로 확인
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { CATEGORIES, calculate } from "../lib/carbon/engine.js";
import { TARGET_2030_KG } from "../lib/carbon/factors.js";
import { QUESTIONS } from "../lib/carbon/questions.js";
import { PREFILL_KEY } from "../lib/draft.js";
import { useResponses } from "../lib/responses.js";
import { save } from "../lib/storage.js";
import { CAT_COLORS } from "../lib/colors.js";
import { formatDate, num, toTon } from "../lib/format.js";
import "./HomeFootprint.css";

// 미리보기 질문: 배출 차이가 큰 네 항목 (통학 수단은 자주 쓰는 다섯 가지만)
const QUICK = [
  { id: "commuteMode", label: "통학은", only: ["walk", "bike", "bus", "subway", "car"] },
  { id: "housing", label: "사는 곳은" },
  { id: "meat", label: "고기는" },
  { id: "flights", label: "올해 비행기는" },
].map((q) => {
  const def = QUESTIONS.find((d) => d.id === q.id);
  return { ...q, options: def.options.filter((o) => !q.only || q.only.includes(o.value)) };
});

// 발자국 그림의 세로 눈금: 0톤(발뒤꿈치) ~ FOOT_MAX(발가락 끝)
const FOOT_MAX = 7000;
const FOOT_TOP = 14;
const FOOT_BOTTOM = 198;
const footY = (kg) => FOOT_BOTTOM - (Math.min(kg, FOOT_MAX) / FOOT_MAX) * (FOOT_BOTTOM - FOOT_TOP);

const FOOT_SHAPE = (
  <>
    <path d="M62 56 C90 54 102 82 99 112 C97 140 92 160 88 176 C84 192 72 199 59 197 C45 195 37 183 37 167 C37 149 27 133 25 109 C23 79 36 58 62 56 Z" />
    <ellipse cx="40" cy="34" rx="13" ry="16" />
    <ellipse cx="62" cy="25" rx="9" ry="11" />
    <ellipse cx="79" cy="29" rx="8" ry="10" />
    <ellipse cx="93" cy="38" rx="7" ry="8.5" />
    <ellipse cx="103" cy="51" rx="6" ry="7" />
  </>
);

// 영역별 배출을 아래(발뒤꿈치)부터 쌓아 발 모양 안에 채운다
function Foot({ result }) {
  let base = 0;
  const bands = CATEGORIES.map((c) => {
    const v = result.byCategory[c.key].value;
    const band = { key: c.key, y: footY(base + v), h: footY(base) - footY(base + v) };
    base += v;
    return band;
  });
  const targetY = footY(TARGET_2030_KG);
  return (
    <svg className="fp-foot" viewBox="0 0 180 210" role="img" aria-label={`발자국 크기: 연 ${toTon(result.total.value)}톤`}>
      <defs>
        <clipPath id="fp-foot-clip">{FOOT_SHAPE}</clipPath>
      </defs>
      <g className="fp-foot-empty">{FOOT_SHAPE}</g>
      <g clipPath="url(#fp-foot-clip)">
        {bands.map((b) => (
          <rect key={b.key} x="0" width="120" style={{ y: b.y, height: Math.max(0, b.h - 1.5) }} fill={CAT_COLORS[b.key]} />
        ))}
      </g>
      <line className="fp-target" x1="18" x2="126" y1={targetY} y2={targetY} />
      <text className="fp-target-label" x="130" y={targetY + 4}>
        2030 목표
      </text>
      <text className="fp-target-label" x="130" y={targetY + 17}>
        {toTon(TARGET_2030_KG)}톤
      </text>
    </svg>
  );
}

const FLOW = CATEGORIES.map((c) => ({ ...c, count: QUESTIONS.filter((q) => q.category === c.key).length }));

const RESULT_PARTS = [
  { title: "추정 범위", desc: "한 숫자 대신 가능성이 높은 범위를 '추정' 배지와 함께 보여 줘요.", demo: "range" },
  { title: "가장 큰 항목", desc: `${QUESTIONS.length}개 항목 중 내 발자국을 가장 키우는 한 가지를 짚어 줘요.`, demo: "biggest" },
  { title: "감축 제안 3개", desc: "내 답에서 효과가 큰 행동 세 가지와 예상 감축량을 알려 줘요.", demo: "tips" },
];

function ResultDemo({ kind }) {
  if (kind === "range")
    return (
      <div className="fp-demo fp-demo-range" aria-hidden="true">
        <span className="fp-demo-band" />
        <span className="fp-demo-dot" />
      </div>
    );
  if (kind === "biggest")
    return (
      <div className="fp-demo fp-demo-bars" aria-hidden="true">
        {[100, 62, 48, 30].map((w, i) => (
          <span key={w} style={{ width: `${w}%` }} className={i === 0 ? "is-top" : ""} />
        ))}
      </div>
    );
  return (
    <div className="fp-demo fp-demo-tips" aria-hidden="true">
      {["🚇", "🥗", "🥤"].map((e) => (
        <span key={e}>{e}</span>
      ))}
    </div>
  );
}

export default function HomeFootprint() {
  const navigate = useNavigate();
  const { responses } = useResponses();
  const last = responses.at(-1);
  const [picks, setPicks] = useState({});

  const result = calculate(picks);
  const picked = Object.keys(picks).length;

  const continueWithPicks = () => {
    save(PREFILL_KEY, picks);
    navigate("/calculator");
  };

  return (
    <div className="fp">
      <section className="fp-hero">
        <div className="wrap fp-hero-grid">
          <div className="fp-intro">
            <p className="fp-eyebrow">고려대학교 탄소발자국 계산기</p>
            <h1>
              통학길과 점심 한 끼에도
              <br />
              <em>발자국</em>이 남아요
            </h1>
            <p className="fp-lead">
              <span className="only-desktop">
                오른쪽에서 네 가지만 골라 보세요. 발자국이 얼마나 커지는지 바로 보여요. {QUESTIONS.length}개 항목에 모두
                답하면 내 결과와 줄이는 방법까지 알려드려요.
              </span>
              <span className="only-mobile">아래에서 네 가지만 골라 보세요. 발자국 크기가 바로 바뀌어요.</span>
            </p>
            <ul className="fp-meta">
              <li>⏱ 약 1분</li>
              <li>📝 {QUESTIONS.length}개 항목</li>
              <li>🔒 회원가입 없음</li>
            </ul>
            {last && (
              <Link className="fp-last" to={`/result/${last.id}`}>
                지난 결과 {toTon(calculate(last.answers, last.detail).total.value)}톤 ({formatDate(last.completedAt)}) 보기 →
              </Link>
            )}
          </div>

          <div className="card fp-try">
            <div className="fp-try-qs">
              {QUICK.map((q) => (
                <fieldset key={q.id} className="fp-q">
                  <legend>{q.label}</legend>
                  <div className="fp-pills">
                    {q.options.map((o) => (
                      <button
                        key={o.value}
                        type="button"
                        className="fp-pill"
                        aria-pressed={picks[q.id] === o.value}
                        onClick={() => setPicks((p) => ({ ...p, [q.id]: o.value }))}
                      >
                        {o.icon && <span aria-hidden="true">{o.icon} </span>}
                        {o.label}
                      </button>
                    ))}
                  </div>
                </fieldset>
              ))}
            </div>

            <div className="fp-try-result">
              <Foot result={result} />
              <div className="fp-total">
                <div className="fp-total-label">
                  내 발자국 <span className="badge-est">추정</span>
                </div>
                <div className="fp-total-value">
                  {toTon(result.total.value)}
                  <small>톤/년</small>
                </div>
                <ul className="fp-legend">
                  {CATEGORIES.map((c) => (
                    <li key={c.key}>
                      <i style={{ background: CAT_COLORS[c.key] }} aria-hidden="true" />
                      {c.label}
                      <strong>{num(Math.round(result.byCategory[c.key].value / 10) * 10)}kg</strong>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <p className="fp-try-note">
              {picked < QUICK.length ? (
                <>
                  {QUICK.length}개 중 {picked}개 골랐어요.
                  <span className="only-desktop"> 고르지 않은 항목은 기준 예시(가상의 대학생) 값이에요.</span>
                </>
              ) : (
                <>
                  나머지 {QUESTIONS.length - QUICK.length}개 항목은 기준 예시 값이에요.
                  <span className="only-desktop"> 이어서 답하면 더 정확해져요.</span>
                </>
              )}
            </p>
            <div className="fp-try-actions">
              <button className="btn btn-primary" onClick={continueWithPicks} disabled={picked === 0}>
                이 답으로 이어서 계산하기 →
              </button>
              <Link className="link-btn" to="/calculator">
                처음부터 입력
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="section wrap">
        <div className="sec-head">
          <div>
            <h2>네 걸음이면 끝나요</h2>
            <p>영역마다 한 화면씩, 칩을 고르고 슬라이더를 움직이면 돼요.</p>
          </div>
        </div>
        <ol className="fp-flow">
          {FLOW.map((s, i) => (
            <li key={s.key}>
              <span className="fp-flow-icon" style={{ "--c": CAT_COLORS[s.key] }} aria-hidden="true">
                {s.icon}
              </span>
              <span className="fp-flow-step">{i + 1}단계</span>
              <strong>{s.label}</strong>
              <span className="fp-flow-desc">
                {s.desc} · {s.count}개
              </span>
            </li>
          ))}
          <li className="is-result">
            <span className="fp-flow-icon" aria-hidden="true">
              👣
            </span>
            <span className="fp-flow-step">결과</span>
            <strong>나의 발자국</strong>
            <span className="fp-flow-desc">연간 배출량과 줄이는 방법</span>
          </li>
        </ol>
      </section>

      <section className="section wrap">
        <div className="sec-head">
          <div>
            <h2>결과 화면에서 볼 수 있어요</h2>
          </div>
        </div>
        <div className="fp-parts">
          {RESULT_PARTS.map((p) => (
            <div key={p.title} className="card fp-part">
              <ResultDemo kind={p.demo} />
              <h3>{p.title}</h3>
              <p>{p.desc}</p>
            </div>
          ))}
        </div>
        <p className="fp-trust">
          계산식과 배출계수는 <Link to="/method">계산 방법</Link>에 모두 공개되어 있습니다.
          <span className="only-desktop">
            {" "}
            입력 정보는 이용 중인 브라우저에 저장되며, 통계·연구 활용에 동의한 경우에 한해 개인 식별 정보 없이 서버에 저장됩니다.
          </span>
        </p>
      </section>
    </div>
  );
}
