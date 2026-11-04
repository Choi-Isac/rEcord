import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import PageHead from "../components/PageHead.jsx";
import ChartCard from "../components/charts/ChartCard.jsx";
import StackedBar from "../components/charts/StackedBar.jsx";
import HBarChart from "../components/charts/HBarChart.jsx";
import { CATEGORIES, REFERENCE_ANSWERS, biggestItem, calculate } from "../lib/carbon/engine.js";
import { FACTOR_VERSION, PINE_KG_PER_YEAR, TARGET_2030_KG } from "../lib/carbon/factors.js";
import { QUESTIONS, answerKeys } from "../lib/carbon/questions.js";
import { ITEM_NOTES, suggest } from "../lib/carbon/suggestions.js";
import { newDraft, useDraft } from "../lib/draft.js";
import { REGIONS, pointPrograms } from "../lib/points.js";
import { useResponses } from "../lib/responses.js";
import { shouldSync, syncRecord } from "../lib/remote.js";
import { CAT_COLORS } from "../lib/colors.js";
import { formatDate, formatDuration, num, roundKg, toTon } from "../lib/format.js";
import "../components/charts/charts.css";
import "./Result.css";

const REFERENCE = calculate(REFERENCE_ANSWERS).total.value;
const catLabel = (key) => CATEGORIES.find((c) => c.key === key).label;

// 0톤부터의 눈금 위에 나의 추정 범위, 기준 예시, 2030 목표를 함께 표시
function RangeScale({ total }) {
  const max = Math.max(total.high, REFERENCE, TARGET_2030_KG) * 1.12;
  const pos = (v) => `${(v / max) * 100}%`;
  return (
    <div className="scale" aria-hidden="true">
      <div className="scale-track">
        <span className="scale-band" style={{ left: pos(total.low), width: pos(total.high - total.low) }} />
        <span className="scale-me" style={{ left: pos(total.value) }} />
        <span className="scale-mark is-target" style={{ left: pos(TARGET_2030_KG) }}>
          <span>2030 목표 {toTon(TARGET_2030_KG)}톤</span>
        </span>
        <span className="scale-mark is-ref" style={{ left: pos(REFERENCE) }}>
          <span>기준 예시 {toTon(REFERENCE)}톤</span>
        </span>
      </div>
      <div className="scale-axis">
        <span>0톤</span>
        <span>{toTon(max)}톤</span>
      </div>
    </div>
  );
}

const LIKERT = [1, 2, 3, 4, 5];
const INTENT = [
  { value: "yes", label: "있어요" },
  { value: "maybe", label: "고민 중" },
  { value: "no", label: "없어요" },
];
const FEEDBACK_QS = [
  { id: "understand", label: "결과가 잘 이해되었나요?", options: LIKERT, ends: ["전혀", "매우 잘"] },
  { id: "trust", label: "결과를 얼마나 믿을 수 있나요?", options: LIKERT, ends: ["전혀", "매우"] },
  { id: "intent", label: "제안된 행동 중 하나라도 해 볼 생각이 있나요?", options: INTENT },
  { id: "revisit", label: "다음 학기에 다시 측정해 볼 생각이 있나요?", options: INTENT },
];

function Feedback({ record, onSubmit }) {
  const [f, setF] = useState({});
  if (record.feedback) {
    return (
      <div className="card feedback is-done">
        <h3>의견 고마워요!</h3>
        <p>보내 주신 응답은 계산기를 고치는 데 쓰여요.</p>
      </div>
    );
  }
  const complete = FEEDBACK_QS.every((q) => f[q.id] != null);
  return (
    <div className="card feedback">
      <h3>계산기는 어땠나요?</h3>
      <p className="feedback-sub">4개 질문, 10초면 끝나요. MVP 개선에만 써요.</p>
      {FEEDBACK_QS.map((q) => (
        <fieldset key={q.id} className="fb-q">
          <legend>{q.label}</legend>
          <div className="fb-opts">
            {q.ends && <span className="fb-end">{q.ends[0]}</span>}
            {q.options.map((o) => {
              const value = o.value ?? o;
              return (
                <button
                  key={value}
                  type="button"
                  className="pill"
                  aria-pressed={f[q.id] === value}
                  onClick={() => setF((s) => ({ ...s, [q.id]: value }))}
                >
                  {o.label ?? o}
                </button>
              );
            })}
            {q.ends && <span className="fb-end">{q.ends[1]}</span>}
          </div>
        </fieldset>
      ))}
      <button className="btn btn-primary btn-sm" disabled={!complete} onClick={() => onSubmit({ ...f, submittedAt: new Date().toISOString() })}>
        보내기
      </button>
    </div>
  );
}

function Profile({ record, onChange }) {
  const { profile } = record;
  const programs = pointPrograms(profile.region);
  const set = (key) => (e) => onChange({ ...profile, [key]: e.target.value });
  return (
    <div className="card profile">
      <h3>포인트 받고 줄이기</h3>
      <p className="profile-sub">사는 지역을 고르면 참여할 수 있는 탄소 감축 포인트 제도를 알려드려요.</p>
      <div className="profile-fields">
        <label>
          <span>거주 지역</span>
          <select className="select" value={profile.region} onChange={set("region")}>
            <option value="">선택</option>
            {REGIONS.map((r) => (
              <option key={r}>{r}</option>
            ))}
          </select>
        </label>
        <label>
          <span>대학 (선택)</span>
          <input className="input" value={profile.university} onChange={set("university")} placeholder="예: 고려대학교" />
        </label>
        <label>
          <span>학과 (선택)</span>
          <input className="input" value={profile.department} onChange={set("department")} placeholder="예: 환경생태공학부" />
        </label>
      </div>
      {programs.length > 0 && (
        <ul className="programs">
          {programs.map((p) => (
            <li key={p.name}>
              <a href={p.url} target="_blank" rel="noreferrer">
                <strong>{p.name} ↗</strong>
                <span>{p.desc}</span>
              </a>
            </li>
          ))}
        </ul>
      )}
      <p className="profile-note">포인트 제도는 안내만 하고 있어요. 신청은 각 사이트에서 직접 해 주세요.</p>
    </div>
  );
}

export default function ResultPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { responses, update } = useResponses();
  const [, setDraft] = useDraft();

  const idx = id ? responses.findIndex((r) => r.id === id) : responses.length - 1;
  const record = responses[idx];

  // 연구 활용에 동의한 응답은 서버에도 보낸다. 지역·학과를 입력하는 동안에는 기다렸다가 한 번에 보낸다
  useEffect(() => {
    if (!record || !shouldSync(record)) return;
    const timer = setTimeout(async () => {
      const remote = await syncRecord(record);
      if (JSON.stringify(remote) !== JSON.stringify(record.remote ?? {})) update(record.id, { remote });
    }, 800);
    return () => clearTimeout(timer);
  }, [record]);

  if (!record) {
    return (
      <>
        <PageHead title="내 결과" />
        <div className="wrap">
          <div className="card empty">
            <h2>아직 계산한 결과가 없어요</h2>
            <p>간편 입력으로 1분 만에 나의 탄소발자국을 확인해 보세요.</p>
            <Link className="btn btn-primary" to="/calculator">
              계산 시작하기 →
            </Link>
          </div>
        </div>
      </>
    );
  }

  const previous = idx > 0 ? responses[idx - 1] : null;
  // 저장된 원본 입력값으로 현재 배출계수에 맞춰 다시 계산한다
  const result = calculate(record.answers);
  const prevTotal = previous ? calculate(previous.answers).total.value : null;
  const { total, byCategory, items } = result;
  const biggest = biggestItem(result);
  const suggestions = suggest(record.answers, { focusItem: biggest.key });
  const savingSum = suggestions.reduce((s, x) => s + x.saving, 0);
  const vsRef = ((total.value - REFERENCE) / REFERENCE) * 100;

  const edit = () => {
    const touched = QUESTIONS.filter((q) => !answerKeys(q).some((k) => record.defaultsUsed.includes(k))).map((q) => q.id);
    setDraft(newDraft(record.consent, record.answers, touched));
    navigate("/calculator/simple");
  };

  // 순위는 입력으로 바꿀 수 있는 항목만 매기고(맨 위 = 가장 큰 항목), 모든 사람에게 같은 기본 식단은 맨 아래에 회색으로
  const rankedItems = [
    ...items.filter((i) => !i.fixed).sort((a, b) => b.value - a.value),
    ...items.filter((i) => i.fixed),
  ];
  const itemName = (i) => (i.fixed ? `${i.label} (공통)` : i.label);
  const shownItems = rankedItems
    .filter((i) => i.value >= 0.5)
    .map((i) => ({
      name: itemName(i),
      value: i.value,
      color: i.fixed ? "var(--viz-reference)" : CAT_COLORS[i.category],
      highlight: i.key === biggest.key,
    }));
  const itemLabel = (key) => items.find((i) => i.key === key).label;

  return (
    <>
      <PageHead
        title="나의 탄소발자국"
        description={`${formatDate(record.completedAt)} 간편 입력 결과 · 입력 시간 ${formatDuration(record.durationSec)}`}
        crumbs={[{ to: "/calculator", label: "탄소발자국 계산기" }]}
      />
      <div className="wrap result">
        {/* 총량 */}
        <section className="card hero" aria-labelledby="total-title">
          <div className="hero-main">
            <h2 id="total-title" className="hero-label">
              나의 연간 탄소발자국 <span className="badge-est" title="간편 입력의 대표값으로 계산한 추정값">추정</span>
            </h2>
            <div className="hero-value">
              {toTon(total.value)}
              <small>톤 CO₂e/년</small>
            </div>
            <p className="hero-range">
              실제 값은 대략 <strong>{toTon(total.low)}~{toTon(total.high)}톤</strong> 사이일 가능성이 높아요.
            </p>
            <RangeScale total={total} />
            <ul className="hero-compare">
              <li>
                기준 예시(가상의 대학생) {toTon(REFERENCE)}톤보다{" "}
                <strong className={vsRef <= 0 ? "delta-good" : "delta-bad"}>
                  {num(Math.abs(vsRef))}% {vsRef <= 0 ? "적어요" : "많아요"}
                </strong>
              </li>
              <li>
                1.5℃ 목표에 맞춘 2030년 1인 생활 탄소발자국 {toTon(TARGET_2030_KG)}톤의{" "}
                <strong>{num(total.value / TARGET_2030_KG, 1)}배</strong>
              </li>
              {previous && (
                <li>
                  지난 계산({formatDate(previous.completedAt)}) {toTon(prevTotal)}톤 대비{" "}
                  <strong className={total.value <= prevTotal ? "delta-good" : "delta-bad"}>
                    {Math.abs(total.value - prevTotal) < 50
                      ? "거의 같아요"
                      : `${toTon(Math.abs(total.value - prevTotal))}톤 ${total.value < prevTotal ? "줄었어요" : "늘었어요"}`}
                  </strong>
                </li>
              )}
            </ul>
          </div>
          <div className="trees">
            <span className="trees-icon" aria-hidden="true">
              🌲
            </span>
            <div>
              <strong>소나무 {num(Math.round(total.value / PINE_KG_PER_YEAR))}그루</strong>
              <p>가 1년 동안 흡수해야 하는 양이에요</p>
            </div>
          </div>
        </section>

        {/* 영역별 기여도 */}
        <div className="result-grid">
          <ChartCard
            title="영역별 기여도"
            subtitle="단위 kg CO₂e/년 · 추정값"
            table={{
              columns: ["영역", "추정 (kg)", "범위 (kg)"],
              rows: CATEGORIES.map((c) => [
                c.label,
                roundKg(byCategory[c.key].value),
                `${roundKg(byCategory[c.key].low)}~${roundKg(byCategory[c.key].high)}`,
              ]),
            }}
          >
            <StackedBar
              items={CATEGORIES.map((c) => ({ name: `${c.icon} ${c.label}`, value: Math.round(byCategory[c.key].value) }))}
              colors={CATEGORIES.map((c) => CAT_COLORS[c.key])}
              unit="kg"
            />
          </ChartCard>

          <ChartCard
            title="항목별 배출량"
            subtitle="큰 순서 · 색은 영역"
            table={{
              columns: ["항목", "영역", "추정 (kg)"],
              rows: rankedItems.map((i) => [itemName(i), catLabel(i.category), roundKg(i.value)]),
            }}
          >
            <HBarChart items={shownItems} unit="kg" format={roundKg} />
            <p className="items-note">
              기본 식단(곡물·채소·유제품 등)은 모든 사람에게 같은 값이라 순위에서 빼고 맨 아래에 두었어요. 영역별 합계에는
              포함돼요.
            </p>
          </ChartCard>
        </div>

        {/* 가장 큰 항목 + 감축 제안 */}
        <section className="card advice" aria-labelledby="advice-title">
          <div className="biggest">
            <div className="biggest-label">가장 큰 항목</div>
            <h2 id="advice-title">
              <i className="key key-rect" style={{ background: CAT_COLORS[biggest.category] }} aria-hidden="true" />
              {biggest.label}
              <span className="biggest-value">
                {roundKg(biggest.value)}kg · 전체의 {num((biggest.value / total.value) * 100)}%
              </span>
            </h2>
            <p>
              {ITEM_NOTES[biggest.key]}
              {suggestions[0]?.isFocus && " 아래 첫 번째 제안이 이 항목을 줄이는 방법이에요."}
            </p>
          </div>

          <h3 className="advice-title">이렇게 줄여 보세요</h3>
          {suggestions.length > 0 ? (
            <>
              <ol className="suggestions">
                {suggestions.map((s) => (
                  <li key={s.id} className={s.isFocus ? "is-focus" : ""}>
                    <span className="sg-icon" aria-hidden="true">
                      {s.icon}
                    </span>
                    <div>
                      <span className="sg-target">
                        {s.isFocus && <b>가장 큰 항목</b>}
                        {itemLabel(s.item)} 줄이기
                      </span>
                      <strong>{s.title}</strong>
                      <p>{s.desc}</p>
                    </div>
                    <span className="sg-saving">
                      연 약 <b>{roundKg(s.saving)}kg</b> 감축
                    </span>
                  </li>
                ))}
              </ol>
              <p className="advice-sum">
                {suggestions.length > 1 ? `${["", "", "두", "세"][suggestions.length]} 가지를 모두` : "이것을"} 실천하면 약 <strong>{toTon(total.value)}톤 → {toTon(Math.max(0, total.value - savingSum))}톤</strong>
                으로 줄어요.
              </p>
            </>
          ) : (
            <p className="muted">이미 대부분의 습관이 탄소를 적게 쓰는 쪽이에요. 멋져요!</p>
          )}
        </section>

        <div className="result-grid">
          <Profile record={record} onChange={(profile) => update(record.id, { profile })} />
          <Feedback record={record} onSubmit={(feedback) => update(record.id, { feedback })} />
        </div>

        <div className="result-actions">
          <button className="btn btn-ghost" onClick={edit}>
            입력 수정하기
          </button>
          <Link className="btn btn-ghost" to="/calculator">
            처음부터 다시 계산
          </Link>
          <Link className="btn btn-primary" to="/method">
            어떻게 계산했나요? →
          </Link>
        </div>

        <p className="disclaimer">
          <span className="badge-est">추정</span> 간편 입력의 칩·슬라이더 대표값과 잠정 배출계수({FACTOR_VERSION})로 계산한 값이에요.
          범위는 대표값의 불확도를 합쳐 계산했어요. 기준 예시는 가상의 대학생 응답이며, 파일럿 이후 실제 응답 평균으로 바뀔
          예정이에요. 소나무 흡수량은 30년생 소나무 1그루 기준 연 {PINE_KG_PER_YEAR}kg(국립산림과학원)이에요.
        </p>
      </div>
    </>
  );
}
