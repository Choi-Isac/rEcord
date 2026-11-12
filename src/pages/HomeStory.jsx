// 메인 디자인 '인포그래픽': 가상의 대학생 한 명의 1년을 숫자로 읽어 내려가는 이야기형
// 모든 수치는 계산 엔진과 같은 배출계수로 계산한다
import { useState } from "react";
import { Link } from "react-router-dom";
import HBarChart from "../components/charts/HBarChart.jsx";
import { CATEGORIES, REFERENCE_ANSWERS, calculate } from "../lib/carbon/engine.js";
import { COMMUTE, FOOD, GOODS, PINE_KG_PER_YEAR, TARGET_2030_KG } from "../lib/carbon/factors.js";
import { QUESTIONS } from "../lib/carbon/questions.js";
import { CAT_COLORS } from "../lib/colors.js";
import { num, roundKg, toTon } from "../lib/format.js";
import "../components/charts/charts.css";
import "./HomeStory.css";

const REF = calculate(REFERENCE_ANSWERS);
const itemOf = (answers, key) => calculate(answers).items.find((i) => i.key === key).value;

// 100칸 와플: 영역별 비율을 최대 나머지 방식으로 정수 칸에 나눈다
function waffleCells(result) {
  const raw = CATEGORIES.map((c) => ({ key: c.key, exact: (result.byCategory[c.key].value / result.total.value) * 100 }));
  raw.forEach((r) => (r.n = Math.floor(r.exact)));
  let left = 100 - raw.reduce((s, r) => s + r.n, 0);
  [...raw].sort((a, b) => (b.exact % 1) - (a.exact % 1)).forEach((r) => left-- > 0 && r.n++);
  return raw.flatMap((r) => Array.from({ length: r.n }, () => r.key));
}
const CELLS = waffleCells(REF);
const SHARE = Object.fromEntries(CATEGORIES.map((c) => [c.key, CELLS.filter((k) => k === c.key).length]));

const SEOUL_BUSAN_KM = 800; // 자가용 서울–부산 왕복
const EQUIVALENTS = [
  { icon: "🌲", value: 1000 / PINE_KG_PER_YEAR, unit: "그루", text: "소나무가 1년 동안 흡수하는 양" },
  { icon: "🚗", value: 1000 / (SEOUL_BUSAN_KM * COMMUTE.pkm.car), unit: "번", text: "자가용으로 서울–부산 왕복", digits: 1 },
  { icon: "🍖", value: 1000 / FOOD.meatServing, unit: "끼", text: "고기 반찬이 있는 식사" },
  { icon: "📦", value: 1000 / GOODS.parcel, unit: "상자", text: "택배 포장과 배송" },
];

// 기준 예시에서 한 가지만 바꿨을 때의 1년 차이
const subwayMin = REFERENCE_ANSWERS.commuteMinutes;
const CHOICES = [
  {
    title: "통학",
    low: { label: "지하철", value: itemOf(REFERENCE_ANSWERS, "commute") },
    high: {
      label: "같은 거리를 자가용",
      value: itemOf(
        { ...REFERENCE_ANSWERS, commuteMode: "car", commuteMinutes: (subwayMin * COMMUTE.speedKmh.subway) / COMMUTE.speedKmh.car },
        "commute"
      ),
    },
    note: `주 ${REFERENCE_ANSWERS.commuteDays}일, 편도 ${subwayMin}분 거리`,
  },
  {
    title: "고기",
    low: { label: "주 3~5회", value: itemOf(REFERENCE_ANSWERS, "meat") },
    high: { label: "매일", value: itemOf({ ...REFERENCE_ANSWERS, meat: "daily" }, "meat") },
    note: "소·돼지·닭 1회 약 120g",
  },
  {
    title: "여행",
    low: { label: "비행기 없이", value: itemOf(REFERENCE_ANSWERS, "flights") },
    high: { label: "아시아 왕복 1회", value: itemOf({ ...REFERENCE_ANSWERS, flights: "asia" }, "flights") },
    note: "도쿄·방콕 등 왕복 약 5,000km",
  },
  {
    title: "냉방",
    low: { label: "하루 6시간", value: itemOf(REFERENCE_ANSWERS, "cooling") },
    high: { label: "하루 12시간", value: itemOf({ ...REFERENCE_ANSWERS, cooling: 5 }, "cooling") },
    note: "본가 4인 가족 중 나의 몫",
  },
];
const CHOICE_MAX = Math.max(...CHOICES.map((c) => c.high.value));

const TOP_ITEMS = REF.items
  .filter((i) => !i.fixed && i.value > 0)
  .sort((a, b) => b.value - a.value)
  .slice(0, 6)
  .map((i) => ({ name: i.label, value: i.value, color: CAT_COLORS[i.category] }));

function Waffle() {
  const [active, setActive] = useState(null);
  return (
    <div className="st-waffle-wrap" onPointerLeave={() => setActive(null)}>
      <div
        className={`st-waffle${active ? " has-active" : ""}`}
        role="img"
        aria-label={CATEGORIES.map((c) => `${c.label} ${SHARE[c.key]}%`).join(", ")}
      >
        {CELLS.map((k, i) => (
          <span
            key={i}
            className={active === k ? "is-active" : ""}
            style={{ background: CAT_COLORS[k] }}
            onPointerEnter={() => setActive(k)}
          />
        ))}
      </div>
      <ul className="st-waffle-legend">
        {CATEGORIES.map((c) => (
          <li key={c.key}>
            <button
              type="button"
              className={active === c.key ? "is-active" : ""}
              onPointerEnter={() => setActive(c.key)}
              onFocus={() => setActive(c.key)}
              onBlur={() => setActive(null)}
            >
              <i style={{ background: CAT_COLORS[c.key] }} aria-hidden="true" />
              <span className="st-lg-name">
                {c.icon} {c.label}
              </span>
              <strong>{SHARE[c.key]}%</strong>
              <span className="st-lg-kg">{roundKg(REF.byCategory[c.key].value)}kg</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function HomeStory() {
  const scaleMax = 6000;
  const pos = (v) => `${(v / scaleMax) * 100}%`;

  return (
    <div className="st">
      <section className="st-hero">
        <div className="wrap">
          <p className="st-kicker">대학생 한 명의 1년을 탄소로 바꾸면</p>
          <div className="st-big">
            {toTon(REF.total.value)}
            <span>톤 CO₂e</span>
          </div>
          <p className="st-sub">
            <span className="only-desktop">
              본가에서 지하철로 주 {REFERENCE_ANSWERS.commuteDays}일 통학하는 가상의 대학생 기준이에요{" "}
            </span>
            <span className="only-mobile">가상의 대학생 기준 </span>
            <span className="badge-est">추정</span> · 소나무 {num(Math.round(REF.total.value / PINE_KG_PER_YEAR))}그루가 1년
            동안 흡수할 양
          </p>

          <div className="st-scale" aria-hidden="true">
            <div className="st-scale-track">
              <span className="st-scale-fill" style={{ width: pos(REF.total.value) }} />
              <span className="st-scale-mark" style={{ left: pos(TARGET_2030_KG) }}>
                <span>2030년 1.5℃ 목표 {toTon(TARGET_2030_KG)}톤</span>
              </span>
            </div>
            <div className="st-scale-axis">
              <span>0톤</span>
              <span>{toTon(scaleMax)}톤</span>
            </div>
          </div>

          <div className="st-hero-actions">
            <Link className="btn st-btn" to="/calculator">
              나는 몇 톤일까? 계산하기 →
            </Link>
            <span>약 1분 · {QUESTIONS.length}개 항목</span>
          </div>
        </div>
      </section>

      <section className="section wrap st-split">
        <div>
          <p className="st-num">01</p>
          <h2>어디에서 나올까요?</h2>
          <p className="st-text">
            한 칸이 1%예요. <strong>식생활</strong>과 <strong>주거</strong>가 대부분이에요.
            <span className="only-desktop"> 통학은 생각보다 작아요. 칸이나 범례에 마우스를 올리면 영역별로 볼 수 있어요.</span>
          </p>
          <Waffle />
        </div>
        <div className="card st-card">
          <h3>입력으로 바꿀 수 있는 큰 항목</h3>
          <p className="st-card-sub">단위 kg CO₂e/년 · 색은 영역 · 기본 식단 제외</p>
          <HBarChart items={TOP_ITEMS} unit="kg" format={roundKg} />
        </div>
      </section>

      <section className="section wrap">
        <p className="st-num">02</p>
        <h2>1톤은 이만큼이에요</h2>
        <p className="st-text">계산기와 같은 배출계수로 1톤 CO₂e를 바꿔 보면,</p>
        <div className="st-equiv">
          {EQUIVALENTS.map((e) => (
            <div key={e.text} className="st-eq">
              <span className="st-eq-icon" aria-hidden="true">
                {e.icon}
              </span>
              <div className="st-eq-value">
                {num(e.value, e.digits ?? 0)}
                <small>{e.unit}</small>
              </div>
              <p>{e.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="section wrap">
        <p className="st-num">03</p>
        <h2>작은 선택, 1년이면 이만큼</h2>
        <p className="st-text">가상의 대학생에서 한 가지만 바꿨을 때 그 항목의 1년 배출량이에요.</p>
        <ul className="legend st-choice-legend">
          <li>
            <i className="key key-rect" style={{ background: "var(--viz-cat-1)" }} aria-hidden="true" />
            탄소가 적은 선택
          </li>
          <li>
            <i className="key key-rect" style={{ background: "var(--viz-cat-2)" }} aria-hidden="true" />
            탄소가 많은 선택
          </li>
        </ul>
        <div className="st-choices">
          {CHOICES.map((c) => (
            <div key={c.title} className="card st-choice">
              <div className="st-choice-head">
                <h3>{c.title}</h3>
                <span className="st-diff">
                  1년에 <strong>{roundKg(c.high.value - c.low.value)}kg</strong> 차이
                </span>
              </div>
              {[
                { ...c.low, color: "var(--viz-cat-1)" },
                { ...c.high, color: "var(--viz-cat-2)" },
              ].map((r) => (
                <div key={r.label} className="st-bar-row">
                  <span className="st-bar-label">{r.label}</span>
                  <span className="st-bar-track">
                    <span className="st-bar" style={{ width: `${(r.value / CHOICE_MAX) * 100}%`, background: r.color }} />
                    <span className="st-bar-value">{roundKg(r.value)}kg</span>
                  </span>
                </div>
              ))}
              <p className="st-choice-note">{c.note}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="wrap">
        <div className="st-cta">
          <div>
            <h2>내 선택은 어느 쪽일까요?</h2>
            <p>
              {QUESTIONS.length}개 항목에 답하면 나의 연간 탄소발자국과 가장 효과적인 감축 방법을 알려드려요.
              <span className="only-desktop">
                {" "}
                계산식은 <Link to="/method">계산 방법</Link>에 모두 공개돼 있어요.
              </span>
            </p>
          </div>
          <Link className="btn st-btn" to="/calculator">
            계산 시작하기 →
          </Link>
        </div>
      </section>
    </div>
  );
}
