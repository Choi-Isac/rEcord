import { useEffect, useLayoutEffect, useRef, useState } from "react";
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

// 옆 카드(target)와 높이가 같아지도록 내용을 접어 두고, 버튼으로 모두 펼친다.
// 카드가 위아래로 놓이는 좁은 화면(휴대폰)에서는 앞의 fallbackRows줄(rowSelector)만 보여 준다
function FitToCard({ target, moreLabel, fallbackRows, rowSelector, children }) {
  const bodyRef = useRef(null);
  const [limit, setLimit] = useState(null); // 접었을 때 본문 최대 높이(px), null = 접지 않음
  const [open, setOpen] = useState(false);

  useLayoutEffect(() => {
    const body = bodyRef.current;
    const card = body?.closest(".chart-card");
    if (!body || !card || !target.current || typeof ResizeObserver === "undefined") return;
    const update = () => {
      const side = target.current;
      if (!side || side.offsetTop !== card.offsetTop) {
        const rows = fallbackRows ? body.querySelectorAll(rowSelector) : [];
        // 한 줄만 더 남는 경우에는 접지 않는다
        if (rows.length <= fallbackRows + 1) return setLimit(null);
        const last = rows[fallbackRows - 1];
        return setLimit(last.offsetTop + last.offsetHeight + 4);
      }
      // 카드에서 본문을 뺀 높이(제목·버튼·여백)는 그대로 두고, 남는 높이만큼 본문을 보여 준다
      const room = side.offsetHeight - (card.offsetHeight - body.offsetHeight);
      setLimit(body.scrollHeight > room + 1 ? Math.max(room, 120) : null);
    };
    const observer = new ResizeObserver(update);
    observer.observe(target.current);
    observer.observe(card);
    update();
    return () => observer.disconnect();
  }, [target, fallbackRows, rowSelector]);

  const clamped = limit !== null && !open;
  return (
    <>
      <div ref={bodyRef} className={clamped ? "fit-body is-clamped" : "fit-body"} style={clamped ? { maxHeight: limit } : undefined}>
        {children}
      </div>
      {limit !== null && (
        <button type="button" className="fit-toggle" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
          {open ? "접기 ▴" : `${moreLabel} ▾`}
        </button>
      )}
    </>
  );
}

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

// 피드백: 5점 척도 6문항 + 추가 기능 요청(선택 서술형). 기존 관심도는 결과를 보기 전 생각을 묻는다
const LIKERT = [1, 2, 3, 4, 5];
const FEEDBACK_QS = [
  { id: "interest", label: "계산하기 전, 환경·기후 문제에 얼마나 관심이 있었나요?", ends: ["전혀 없었음", "매우 많았음"] },
  { id: "understand", label: "결과가 잘 이해되었나요?", ends: ["전혀", "매우 잘"] },
  { id: "ease", label: "입력이 간편했나요?", ends: ["매우 번거로움", "매우 간편"] },
  { id: "satisfaction", label: "계산기에 얼마나 만족하나요?", ends: ["매우 불만족", "매우 만족"] },
  { id: "sufficiency", label: "알고 싶은 정보를 충분히 얻었나요?", ends: ["전혀", "충분히"] },
  { id: "reuse", label: "다음에 이 계산기를 다시 쓸 생각이 있나요?", ends: ["전혀 없음", "꼭 쓸 것"] },
];
const WISH_MAX = 500;

// 보낸 피드백에서 지금 문항에 해당하는 답만 꺼낸다 (문항을 바꾸기 전 피드백은 일부만 채워짐)
const scoresOf = (fb) =>
  Object.fromEntries(FEEDBACK_QS.filter((q) => LIKERT.includes(fb?.[q.id])).map((q) => [q.id, fb[q.id]]));

// 피드백 활용 안내: 피드백은 통계·연구 활용 동의와 관계없이 서버로 보낸다 (remote.js)
const FEEDBACK_POLICY =
  "제출된 의견은 통계·연구 활용 동의 여부와 관계없이 개인 식별 정보 없이 서버에 저장되며, 계산기 개선에 활용됩니다.";

// 질문은 접어 두고 제목 옆 버튼으로 펼친다. 접어도 고른 답은 남는다
function Feedback({ record, onSubmit }) {
  const [editing, setEditing] = useState(false);
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({});
  const [wish, setWish] = useState("");

  // 다시 입력: 보냈던 답을 채워 둔 채로 펼친다
  const startEdit = () => {
    setF(scoresOf(record.feedback));
    setWish(record.feedback.wish ?? "");
    setEditing(true);
    setOpen(true);
  };

  if (record.feedback && !editing) {
    return (
      <div className="card feedback is-done">
        <h3>의견 고마워요!</h3>
        <p>{FEEDBACK_POLICY}</p>
        <button type="button" className="btn btn-ghost btn-sm fb-again" onClick={startEdit}>
          다시 입력하기
        </button>
      </div>
    );
  }
  const answered = FEEDBACK_QS.filter((q) => f[q.id] != null).length;
  const complete = answered === FEEDBACK_QS.length;
  const submit = () => {
    onSubmit({ ...f, wish: wish.trim() || null, submittedAt: new Date().toISOString() });
    setEditing(false);
  };
  const title = editing ? "의견 다시 입력하기" : "계산기는 어땠나요?";

  // 접힌 모습: 옆의 '포인트 받고 줄이기'와 같은 짜임(제목 · 설명 · 작은 제목과 입력 칸 · 작은 안내)
  if (!open) {
    return (
      <div className="card feedback">
        <h3>{title}</h3>
        <p className="feedback-sub">결과를 보고 느낀 점을 알려 주세요.</p>
        <div className="fb-start">
          <span>
            질문 {FEEDBACK_QS.length}개 · 약 30초{answered > 0 && ` · ${answered}개 답함`}
          </span>
          <button type="button" className="btn btn-primary fb-open" aria-expanded={false} aria-controls="fb-body" onClick={() => setOpen(true)}>
            {answered ? "이어서 답하기" : "의견 남기기"} ▾
          </button>
        </div>
        <p className="fb-note">{FEEDBACK_POLICY}</p>
      </div>
    );
  }

  return (
    <div className="card feedback is-open">
      <div className="fb-head">
        <h3>{title}</h3>
        <button type="button" className="fb-toggle" aria-expanded={true} aria-controls="fb-body" onClick={() => setOpen(false)}>
          접기 ▴
        </button>
      </div>
      <p className="feedback-sub">
        {editing
          ? "보냈던 답이 채워져 있어요. 고친 뒤 다시 보내면 새 답으로 바뀌어요."
          : `${FEEDBACK_QS.length}개 질문, 30초면 끝나요.`}{" "}
        {FEEDBACK_POLICY}
      </p>
      <div id="fb-body">
        {FEEDBACK_QS.map((q) => (
          <fieldset key={q.id} className="fb-q">
            <legend>{q.label}</legend>
            <div className="fb-scale">
              <div className="fb-opts">
                {LIKERT.map((v) => (
                  <button
                    key={v}
                    type="button"
                    className="pill"
                    aria-pressed={f[q.id] === v}
                    aria-label={`${v}점${v === 1 ? ` (${q.ends[0]})` : v === 5 ? ` (${q.ends[1]})` : ""}`}
                    onClick={() => setF((s) => ({ ...s, [q.id]: v }))}
                  >
                    {v}
                  </button>
                ))}
              </div>
              <div className="fb-ends" aria-hidden="true">
                <span>1 = {q.ends[0]}</span>
                <span>5 = {q.ends[1]}</span>
              </div>
            </div>
          </fieldset>
        ))}
        <label className="fb-q fb-wish">
          <span className="fb-wish-label">추가되었으면 하는 기능이 있나요? (선택)</span>
          <textarea
            className="input"
            rows={3}
            maxLength={WISH_MAX}
            value={wish}
            placeholder="예: 친구와 결과 비교하기, 지난 학기와 변화 그래프"
            onChange={(e) => setWish(e.target.value)}
          />
          <span className="fb-count">
            {wish.length}/{WISH_MAX}
          </span>
        </label>
        <div className="fb-actions">
          <button className="btn btn-primary btn-sm" disabled={!complete} onClick={submit}>
            {editing ? "다시 보내기" : "보내기"}
          </button>
          {editing && (
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditing(false)}>
              취소
            </button>
          )}
        </div>
        {!complete && <p className="fb-hint">점수 문항 {FEEDBACK_QS.length}개에 모두 답하면 보낼 수 있어요.</p>}
      </div>
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
  const [allCompare, setAllCompare] = useState(false); // 휴대폰: 비교 문장을 모두 보여 줄지
  const [openTip, setOpenTip] = useState(null); // 휴대폰: 설명을 펼친 제안
  const categoryCard = useRef(null); // 영역별 기여도 카드 (항목별 배출량이 이 높이에 맞춘다)

  const idx = id ? responses.findIndex((r) => r.id === id) : responses.length - 1;
  const record = responses[idx];

  // 연구 활용에 동의한 응답과 피드백은 서버에도 보낸다. 지역을 바꾸는 동안에는 기다렸다가 한 번에 보낸다
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
  const detail = record.detail ?? {};
  const result = calculate(record.answers, detail);
  const prevTotal = previous ? calculate(previous.answers, previous.detail).total.value : null;
  const { total, byCategory, items } = result;
  const biggest = biggestItem(result);
  const suggestions = suggest(record.answers, { detail, focusItem: biggest.key });
  // 자세히 입력이 있으면 간편 입력만으로 계산한 값과 비교한다 (README 가설 2)
  const directCount = items.filter((i) => i.basis === "direct").length;
  const simpleTotal = directCount ? calculate(record.answers).total.value : null;
  const savingSum = suggestions.reduce((s, x) => s + x.saving, 0);
  const vsRef = ((total.value - REFERENCE) / REFERENCE) * 100;

  const edit = () => {
    const touched = QUESTIONS.filter((q) => !answerKeys(q).some((k) => record.defaultsUsed.includes(k))).map((q) => q.id);
    setDraft(newDraft(record.consent, record.answers, touched, detail));
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
      tag: i.basis === "direct" ? "직접 입력" : null,
    }));
  const itemLabel = (key) => items.find((i) => i.key === key).label;

  return (
    <>
      <PageHead
        title="나의 탄소발자국"
        description={`${formatDate(record.completedAt)} ${directCount ? "간편 + 자세히 입력" : "간편 입력"} 결과 · 입력 시간 ${formatDuration(record.durationSec)}`}
        crumbs={[{ to: "/calculator", label: "탄소발자국 계산기" }]}
      />
      <div className="wrap result">
        {/* 총량 */}
        <section className="card hero" aria-labelledby="total-title">
          <div className="hero-main">
            <h2 id="total-title" className="hero-label">
              나의 연간 탄소발자국 <span className="badge-est" title="간편 입력의 대표값으로 계산한 추정값">추정</span>
              {directCount > 0 && (
                <span className="badge-direct" title="자세히 입력한 값으로 계산한 항목이 있어요">
                  {directCount}개 항목 직접 입력
                </span>
              )}
            </h2>
            <div className="hero-value">
              {toTon(total.value)}
              <small>톤 CO₂e/년</small>
            </div>
            <p className="hero-range">
              <span className="only-desktop">실제 값은 대략 </span>
              <span className="only-mobile">가능성이 높은 범위 </span>
              <strong>{toTon(total.low)}~{toTon(total.high)}톤</strong>
              <span className="only-desktop"> 사이일 가능성이 높아요.</span>
            </p>
            <RangeScale total={total} />
            <ul className={allCompare ? "hero-compare is-all" : "hero-compare"}>
              {simpleTotal !== null && (
                <li className="is-extra">
                  간편 입력만으로 계산하면 {toTon(simpleTotal)}톤 → 자세히 입력을 반영해{" "}
                  <strong>
                    {Math.abs(total.value - simpleTotal) < 50
                      ? "거의 같아요"
                      : `${toTon(Math.abs(total.value - simpleTotal))}톤 ${total.value < simpleTotal ? "줄었어요" : "늘었어요"}`}
                  </strong>
                </li>
              )}
              <li>
                기준 예시<span className="only-desktop">(가상의 대학생)</span> {toTon(REFERENCE)}톤보다{" "}
                <strong className={vsRef <= 0 ? "delta-good" : "delta-bad"}>
                  {num(Math.abs(vsRef))}% {vsRef <= 0 ? "적어요" : "많아요"}
                </strong>
              </li>
              <li className="is-extra">
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
            {!allCompare && (
              <button type="button" className="link-btn compare-more" onClick={() => setAllCompare(true)}>
                비교 {simpleTotal !== null ? 2 : 1}개 더 보기
              </button>
            )}
          </div>
          <div className="trees">
            <span className="trees-icon" aria-hidden="true">
              🌲
            </span>
            <div>
              <strong>소나무 {num(Math.round(total.value / PINE_KG_PER_YEAR))}그루</strong>
              <p>
                <span className="only-desktop">가 1년 동안 흡수해야 하는 양이에요</span>
                <span className="only-mobile">가 1년 동안 흡수할 양</span>
              </p>
            </div>
          </div>
        </section>

        {/* 영역별 기여도 */}
        <div className="result-grid">
          <ChartCard
            cardRef={categoryCard}
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
            subtitle={directCount ? "큰 순서 · 색은 영역 · ✓는 자세히 입력한 항목" : "큰 순서 · 색은 영역"}
            table={{
              columns: ["항목", "영역", "배출량 (kg)", "입력"],
              rows: rankedItems.map((i) => [
                itemName(i),
                catLabel(i.category),
                roundKg(i.value),
                i.basis === "direct" ? "직접 입력" : "추정",
              ]),
            }}
          >
            <FitToCard target={categoryCard} moreLabel={`항목 ${shownItems.length}개 모두 보기`} fallbackRows={5} rowSelector=".hbar-row">
              <HBarChart items={shownItems} unit="kg" format={roundKg} />
              <p className="items-note">
                기본 식단(곡물·채소·유제품 등)은 모든 사람에게 같은 값이라 순위에서 빼고 맨 아래에 두었어요. 영역별 합계에는
                포함돼요.
              </p>
            </FitToCard>
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
            <p className="biggest-note">
              {ITEM_NOTES[biggest.key]}
              {suggestions[0]?.isFocus && " 아래 첫 번째 제안이 이 항목을 줄이는 방법이에요."}
            </p>
          </div>

          <h3 className="advice-title">이렇게 줄여 보세요</h3>
          {suggestions.length > 0 ? (
            <>
              <ol className="suggestions">
                {suggestions.map((s) => (
                  <li key={s.id} className={`${s.isFocus ? "is-focus" : ""}${openTip === s.id ? " is-open" : ""}`}>
                    <span className="sg-icon" aria-hidden="true">
                      {s.icon}
                    </span>
                    <div>
                      <span className="sg-target">
                        {s.isFocus && <b>가장 큰 항목</b>}
                        {itemLabel(s.item)} 줄이기
                      </span>
                      <strong>{s.title}</strong>
                      <p className="sg-desc">{s.desc}</p>
                      <button
                        type="button"
                        className="link-btn sg-more"
                        aria-expanded={openTip === s.id}
                        onClick={() => setOpenTip((id) => (id === s.id ? null : s.id))}
                      >
                        {openTip === s.id ? "접기" : "방법 보기"}
                      </button>
                    </div>
                    <span className="sg-saving">
                      <span className="only-desktop">연 약 </span>
                      <b>{roundKg(s.saving)}kg</b>
                      <span className="only-desktop"> 감축</span>
                      <span className="only-mobile">/년</span>
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
          <span className="badge-est">추정</span>{" "}
          <span className="only-desktop">
            간편 입력의 칩·슬라이더 대표값과 잠정 배출계수({FACTOR_VERSION})로 계산한 값이에요. 범위는 대표값의 불확도를 합쳐
            계산했어요. 기준 예시는 가상의 대학생 응답이며, 파일럿 이후 실제 응답 평균으로 바뀔 예정이에요. 소나무 흡수량은 30년생
            소나무 1그루 기준 연 {PINE_KG_PER_YEAR}kg(국립산림과학원)이에요.
          </span>
          <span className="only-mobile">
            대표값과 잠정 배출계수({FACTOR_VERSION})로 계산한 값이에요. 계산 기준은 '어떻게 계산했나요?'에 있어요.
          </span>
        </p>
      </div>
    </>
  );
}
