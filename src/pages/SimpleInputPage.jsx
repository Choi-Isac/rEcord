import { useEffect, useRef, useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import PageHead from "../components/PageHead.jsx";
import Question from "../components/Question.jsx";
import { CATEGORIES, calculate, commuteKm } from "../lib/carbon/engine.js";
import { HOUSING } from "../lib/carbon/factors.js";
import { QUESTIONS, isAnswered, isSkipped, missingRequired, optionLabel, progressOf } from "../lib/carbon/questions.js";
import { canExpand, fillBlank, syncSimple } from "../lib/carbon/details.js";
import { draftProgress, upgradeDraft, useDraft } from "../lib/draft.js";
import { createResponse } from "../lib/responses.js";
import { useResponses } from "../lib/records.jsx";
import { kgValue, num, toTon } from "../lib/format.js";
import { CAT_COLORS } from "../lib/colors.js";
import "./Calculator.css";

// 영역 하나가 한 화면: 이동 → 주거 → 식생활 → 소비
// 휴대폰(ONE_AT_A_TIME)에서는 스크롤을 줄이려고 영역 안의 문항을 한 화면에 하나씩 보여 준다.
// 난방(방식 + 하루 시간)처럼 두 답을 묶은 문항은 한 문항이라 함께 보인다. 지금 문항은 초안의 question(문항 id)
const ONE_AT_A_TIME = "(max-width: 640px)";
const STEPS = CATEGORIES.map((c) => ({ ...c, questions: QUESTIONS.filter((q) => q.category === c.key) }));
const stepOf = (q) => STEPS.findIndex((s) => s.key === q.category);

// 문항마다 그 답이 움직이는 배출 항목(engine의 items key)과 이름. 아래 바에서 지금 문항의 배출량을 색으로 보여 줄 때 쓴다
// partOf: 다른 항목 중 이 답이 만드는 몫도 함께 (배달·외식 → 일회용품 중 배달 용기: 이 답을 0으로 둔 계산과의 차이)
const HOME_ENERGY = { label: "전기·냉난방·온수", keys: ["electricity", "cooling", "heating", "hotWater"] };
const QUESTION_ITEMS = {
  commuteDays: { label: "통학", keys: ["commute"] },
  commuteMode: { label: "통학", keys: ["commute"] },
  commuteMinutes: { label: "통학", keys: ["commute"] },
  homeTrips: { label: "장거리 이동", keys: ["homeTrips"] },
  flights: { label: "비행기", keys: ["flights"] },
  housing: HOME_ENERGY,
  household: HOME_ENERGY,
  cooling: { label: "냉방", keys: ["cooling"] },
  heating: { label: "난방", keys: ["heating"] },
  meat: { label: "육류", keys: ["meat"] },
  mealsOut: { label: "배달·외식·용기", keys: ["mealsOut"], partOf: "disposables" },
  clothes: { label: "의류·잡화", keys: ["clothes"] },
  parcels: { label: "택배", keys: ["parcels"] },
  reusable: { label: "일회용품", keys: ["disposables"] },
};

// 휴대폰 아래 바의 지금 문항 항목: 영역별 배출량 { label, parts: { 영역: kg } }
function questionFocus(qid, answers, detail, result) {
  const spec = QUESTION_ITEMS[qid];
  const parts = {};
  const add = (category, kg) => (parts[category] = (parts[category] ?? 0) + kg);
  for (const i of result.items) if (spec.keys.includes(i.key)) add(i.category, i.value);
  if (spec.partOf) {
    const { [qid]: _, ...otherDetail } = detail;
    const item = result.items.find((i) => i.key === spec.partOf);
    const without = calculate({ ...answers, [qid]: 0 }, otherDetail).items.find((i) => i.key === spec.partOf).value;
    add(item.category, Math.max(0, item.value - without));
  }
  return { label: spec.label, parts };
}

// 단계 표시의 진행도: 답한 수(기본값 수)/전체, 예: 0(+2)/5
const stepText = ({ answered, defaults, total }) => `${answered}${defaults ? `(+${defaults})` : ""}/${total}`;

// 간편 입력값에서 바로 파생되는 안내 (계산 과정을 보여 줘 결과를 믿을 수 있게)
function derivedHint(q, answers, touched) {
  const modes = answers.commuteMode ?? [];
  if (q.id === "commuteMinutes" && modes.length) {
    const km = num(commuteKm(modes, answers.commuteMinutes), 1);
    const labels = modes.map((m) => optionLabel("commuteMode", m)).join("·");
    return modes.length > 1
      ? `${labels}: 같은 시간씩 탄다고 보고 편도 약 ${km}km로 계산해요.`
      : `${labels} 기준 편도 약 ${km}km로 계산해요.`;
  }
  if (q.id === "household" && answers.housing && !touched.includes("household")) {
    return "거주 형태에 맞춰 미리 골라 두었어요. 다르면 바꿔 주세요.";
  }
  return null;
}

// 화면 폭 조건이 맞는지 (창 크기를 바꾸면 다시 판단)
function useMedia(query) {
  const [match, setMatch] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const on = () => setMatch(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, [query]);
  return match;
}

// 답을 바꿀 때마다 직전 합계와의 차이(kg)와 영역별 차이를 기억한다. 다른 문항·단계로 넘어가면(resetKey) 지운다
// n: 바뀔 때마다 늘어, 같은 크기로 또 바뀌어도 표시가 다시 튀어 오르게 한다
function useLastChange(result, resetKey) {
  const prev = useRef(result);
  const [change, setChange] = useState(null);
  const total = result.total.value;
  useEffect(() => {
    const before = prev.current;
    prev.current = result;
    const diff = total - before.total.value;
    if (Math.abs(diff) < 0.5) return;
    const byCat = Object.fromEntries(CATEGORIES.map((c) => [c.key, result.byCategory[c.key].value - before.byCategory[c.key].value]));
    setChange((c) => ({ diff, byCat, n: (c?.n ?? 0) + 1 }));
  }, [total]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => setChange(null), [resetKey]);
  return change;
}

// 예상 배출량 막대의 최대 크기(전체 길이, kg): 합계가 들어가는 가장 작은 구간. 합계가 구간을 넘거나 내려가면 최대 크기도 바뀐다
const BAR_SCALES = [2, 4, 6, 8, 10, 15, 20, 30, 50].map((t) => t * 1000);
const barScale = (kg) => BAR_SCALES.find((s) => kg <= s) ?? Math.ceil(kg / 10000) * 10000;

// 최대 크기가 바뀌면 잠깐(1.5초) 표시한다: { dir: 1 커짐 / -1 작아짐, n }
function useScaleChange(scale) {
  const prev = useRef(scale);
  const [change, setChange] = useState(null);
  useEffect(() => {
    if (scale === prev.current) return;
    const dir = scale > prev.current ? 1 : -1;
    prev.current = scale;
    setChange((c) => ({ dir, n: (c?.n ?? 0) + 1 }));
    const t = setTimeout(() => setChange(null), 1500);
    return () => clearTimeout(t);
  }, [scale]);
  return change;
}

// 늘어난(▲)·줄어든(▼) 양. 1톤 이상은 톤으로 줄여 써서 휴대폰 아래 바에서도 한 줄에 들어가게
const signed = (kg) => {
  const abs = Math.abs(kg);
  return `${kg > 0 ? "▲" : "▼"} ${abs >= 1000 ? `${toTon(abs)}톤` : `${num(kgValue(abs))}kg`}`;
};

// back: 휴대폰에서 아래 바에 함께 두는 이전 버튼 { label, onClick } (넓은 화면은 본문의 이전 버튼을 쓴다)
// resetKey: 지금 보고 있는 문항(넓은 화면은 단계). 바뀌면 '방금 바꾼 답' 표시를 지운다
// focus: 지금 화면의 항목 { label, parts: { 영역: kg } } — 휴대폰은 지금 문항의 배출 항목, 넓은 화면은 지금 단계의 영역
function LivePanel({ result, progress, missing, actionLabel, onAction, back, resetKey, focus }) {
  const { total } = result;
  const focusKg = Object.values(focus.parts).reduce((s, kg) => s + kg, 0);
  const focusShare = total.value > 0 ? focusKg / total.value : 0;
  const focusCats = CATEGORIES.filter((c) => c.key in focus.parts);
  // 막대는 최대 크기를 고정한 절대 크기: 전체 길이가 scale(kg). 합계만큼만 채우고 나머지는 빈 칸
  const scale = barScale(total.value);
  const scaleChange = useScaleChange(scale);
  // 막대 조각: 영역 순서는 그대로, 영역마다 지금 항목을 뺀 몫은 흐리게, 지금 항목은 원래 색으로.
  // 지금 항목은 첫 영역에서는 끝에, 다음 영역에서는 앞에 붙여 두 영역에 걸친 답(배달·외식 → 일회용품)이 한 덩어리로 늘고 준다
  const segments = CATEGORIES.flatMap((c) => {
    const onKg = focus.parts[c.key] ?? 0;
    const rest = { key: c.key, color: CAT_COLORS[c.key], kg: result.byCategory[c.key].value - onKg };
    if (!(c.key in focus.parts)) return [rest];
    const on = { key: `${c.key}-on`, color: CAT_COLORS[c.key], kg: onKg, on: true };
    return c === focusCats[0] ? [rest, on] : [on, rest];
  });
  const change = useLastChange(result, resetKey);
  // 바뀐 영역이 하나면 그 이름을 붙인다 (예: 이동 ▲ 230kg)
  const changedCats = change ? CATEGORIES.filter((c) => Math.abs(change.byCat[c.key]) >= 0.5) : [];
  return (
    <aside className="card live" aria-label="실시간 예상 배출량">
      <div className="live-label">
        지금까지 예상 배출량 <span className="badge-est">추정</span>
      </div>
      <div className="live-value">
        <span>
          {toTon(total.value)}
          <small>톤/년</small>
        </span>
        {/* 방금 고른 답으로 늘거나 준 양: 톤 단위로는 안 보이는 작은 변화도 kg으로 */}
        {change && (
          <span key={change.n} className={`live-delta ${change.diff > 0 ? "is-up" : "is-down"}`}>
            {changedCats.length === 1 && <span className="live-delta-cat">{changedCats[0].label}</span>}
            {signed(change.diff)}
          </span>
        )}
      </div>
      <p className="sr-only" role="status">
        {change && `방금 고른 답으로 연간 배출량이 ${num(kgValue(Math.abs(change.diff)))}kg ${change.diff > 0 ? "늘었어요" : "줄었어요"}.`}
      </p>
      <div className="live-range">
        {toTon(total.low)}~{toTon(total.high)}톤
      </div>
      {/* 지금 항목의 배출량: 절대 크기 막대(0~scale톤)에 합계만큼 채우고, 나머지는 영역 색을 흐리게, 지금 문항(단계) 몫만 원래 색으로.
          답을 바꾸면 그 부분이 늘거나 줄고, 합계가 구간을 넘으면 최대 크기가 바뀐다 */}
      <div className="live-focus">
        {/* 막대 양 끝에 0톤과 최대 크기 */}
        <div className={scaleChange ? "live-focus-track is-rescaled" : "live-focus-track"}>
          <span className="live-focus-end">0톤</span>
          <div className="live-focus-bar" aria-hidden="true">
            {segments.map((s) => (
              <span key={s.key} className={s.on ? "is-on" : ""} style={{ width: `${(s.kg / scale) * 100}%`, background: s.color }} />
            ))}
          </div>
          {/* 최대 크기가 바뀌면 잠깐 강조색 알약으로, 커졌는지(▲) 작아졌는지(▼)를 숫자 오른쪽 바깥(카드 여백)에.
              화살표는 자리를 차지하지 않아 표시가 켜지고 꺼져도 막대 길이가 그대로다 */}
          <span className={scaleChange ? "live-focus-end is-max is-changed" : "live-focus-end is-max"}>
            {scale / 1000}톤
            <span className="live-focus-arrow" aria-hidden="true">
              {scaleChange?.dir < 0 ? "▼" : "▲"}
            </span>
          </span>
        </div>
        <p className="sr-only" role="status">
          {scaleChange && `막대의 최대 크기가 ${scale / 1000}톤으로 바뀌었어요.`}
        </p>
        <p className="live-focus-text">
          {focusCats.map((c) => (
            <i key={c.key} className="key key-rect" style={{ background: CAT_COLORS[c.key] }} aria-hidden="true" />
          ))}
          {focus.label} <strong>{num(Math.round(focusKg))}kg</strong>
          <span className="live-focus-share"> · 전체의 {Math.round(focusShare * 100)}%</span>
        </p>
      </div>
      <ul className="live-list">
        {CATEGORIES.map((c) => (
          <li key={c.key} className={changedCats.includes(c) ? "is-changed" : ""}>
            <i className="key key-rect" style={{ background: CAT_COLORS[c.key] }} aria-hidden="true" />
            <span>{c.label}</span>
            <strong>
              {num(Math.round(result.byCategory[c.key].value))}kg
              {changedCats.includes(c) && (
                <em key={change.n} className={change.byCat[c.key] > 0 ? "is-up" : "is-down"}>
                  {signed(change.byCat[c.key])}
                </em>
              )}
            </strong>
          </li>
        ))}
      </ul>

      {/* 진하게: 답한 문항, 옅게: 기본값으로 둔 문항 */}
      <div className="progress" aria-hidden="true">
        <span style={{ width: `${(progress.answered / progress.total) * 100}%` }} />
        <span className="is-default" style={{ width: `${(progress.defaults / progress.total) * 100}%` }} />
      </div>
      <p className="live-progress">
        {progress.total}개 중 <strong>{progress.filled}개</strong> 입력
        {progress.defaults > 0 && <span className="live-default"> (기본값 {progress.defaults}개)</span>}
      </p>
      {back && (
        <button className="btn btn-ghost live-back" onClick={back.onClick} aria-label={back.label}>
          ←
        </button>
      )}
      <button className="btn btn-primary btn-block live-next" onClick={onAction}>
        {actionLabel}
      </button>
      <p className="live-note">
        {missing > 0 ? `골라야 할 항목이 ${missing}개 남았어요. ` : ""}
        답하지 않은 항목은 기준 예시 값으로 합계에 넣어 두었어요.
      </p>
    </aside>
  );
}

export default function SimpleInputPage() {
  const navigate = useNavigate();
  const [stored, setStored] = useDraft();
  // 이전 버전의 초안도 지금 형식으로 보여 주고, 고칠 때도 지금 형식으로 바꾼 뒤에 고친다
  const draft = upgradeDraft(stored);
  const setDraft = (update) => setStored((d) => (typeof update === "function" ? update(upgradeDraft(d)) : update));
  const { add } = useResponses();
  const [showMissing, setShowMissing] = useState(false);
  const location = useLocation();
  // 완료 직후 초안을 지우면서 시작 화면으로 되돌려 보내지 않도록
  const finished = useRef(false);
  const oneAtATime = useMedia(ONE_AT_A_TIME);

  // 이어서 입력: 시작 화면이 넘겨준, 값이 아예 없는 첫 문항으로 (휴대폰은 그 문항을 띄우고, 넓은 화면은 스크롤)
  const focusId = location.state?.focus;
  useEffect(() => {
    if (!focusId) return;
    if (oneAtATime) setStored((d) => (d ? { ...d, question: focusId } : d));
    else requestAnimationFrame(() => document.getElementById(`q-${focusId}`)?.scrollIntoView({ block: "center" }));
  }, [focusId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!draft?.consent?.service) return finished.current ? null : <Navigate to="/calculator" replace />;

  const { answers, touched, detail } = draft;
  const detailOpen = draft.detailOpen ?? [];
  const step = draft.step ?? 0;
  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;
  const result = calculate(answers, detail);
  const missing = missingRequired(answers, detail);
  const missingHere = missing.filter((q) => q.category === current.key);

  // 휴대폰: 지금 영역에서 보여 줄 문항(건너뛴 문항은 빼고)과 그중 지금 문항
  const visibleOf = (i) => STEPS[i].questions.filter((q) => !isSkipped(q, answers, detail));
  const visible = visibleOf(step);
  const qIndex = Math.max(0, visible.findIndex((q) => q.id === draft.question));
  const currentQ = visible[qIndex];
  const isLastQ = qIndex === visible.length - 1;
  const shown = oneAtATime ? [currentQ] : current.questions;

  // key: 바꿀 답변, qid: 직접 조작한 문항(난방은 방식과 시간이 한 문항)
  const setAnswer = (key, value, qid = key) =>
    setDraft((d) => {
      const next = { ...d.answers, [key]: value };
      // 거주 형태를 고르면, 동거 인원을 직접 고르기 전까지는 그 형태의 기본 인원으로 맞춘다
      if (key === "housing" && !d.touched.includes("household")) next.household = HOUSING[value].defaultHousehold;
      // 자세히 입력한 문항의 간편 칸은 자세히 입력값을 따른다 (예: 수단을 바꾸면 거리로 구한 통학 시간도 다시 구함)
      return { ...d, answers: syncSimple(next, d.detail), touched: d.touched.includes(qid) ? d.touched : [...d.touched, qid] };
    });

  // 자세히 입력: 펼치기/접기, 값 바꾸기(처음 바꿀 때 기본값과 함께 저장), 비운 칸 되돌리기, 간편 입력으로 되돌리기
  const setOpen = (ids, open) =>
    setDraft((d) => {
      const was = d.detailOpen ?? [];
      return {
        ...d,
        detailOpen: open ? [...new Set([...was, ...ids])] : was.filter((x) => !ids.includes(x)),
        detailOpened: open ? [...new Set([...(d.detailOpened ?? []), ...ids])] : d.detailOpened ?? [],
      };
    });
  // 되돌려도 간편 칸은 마지막으로 반영된 값에 머문다
  const setDetail = (qid, values) =>
    setDraft((d) => {
      const next = { ...(d.detail ?? {}) };
      if (values) next[qid] = values;
      else delete next[qid];
      return { ...d, detail: next, answers: syncSimple(d.answers, next) };
    });
  const detailPropsFor = (q) => ({
    detail: detail[q.id],
    open: detailOpen.includes(q.id),
    onToggle: () => setOpen([q.id], !detailOpen.includes(q.id)),
    onReset: () => setDetail(q.id, null),
    onDetailChange: (values) => setDetail(q.id, values),
    onDetailCommit: () => detail[q.id] && setDetail(q.id, fillBlank(q, answers, detail[q.id])),
  });
  const expandableHere = current.questions.filter((q) => !isSkipped(q, answers, detail) && canExpand(q, answers)).map((q) => q.id);
  const allOpenHere = expandableHere.length > 0 && expandableHere.every((id) => detailOpen.includes(id));

  // 영역(과 휴대폰에서는 그 안의 문항)으로 이동. question이 없으면 영역의 첫 문항
  const goTo = (i, question = null) => {
    setShowMissing(false);
    setDraft((d) => ({ ...d, step: i, question }));
    window.scrollTo(0, 0);
  };

  // 아직 고르지 않은 칩이 있으면 그 문항을 강조하고 보여 준다 (휴대폰은 그 문항을 띄운다)
  const flagMissing = (q) => {
    setShowMissing(true);
    if (oneAtATime) {
      setDraft((d) => ({ ...d, step: stepOf(q), question: q.id }));
      return window.scrollTo(0, 0);
    }
    if (stepOf(q) !== step) setDraft((d) => ({ ...d, step: stepOf(q) }));
    requestAnimationFrame(() =>
      document.getElementById(`q-${q.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" })
    );
  };

  const next = () => {
    if (oneAtATime) {
      if (missing.includes(currentQ)) return flagMissing(currentQ);
      if (!isLastQ) return goTo(step, visible[qIndex + 1].id);
    }
    if (missingHere.length) return flagMissing(missingHere[0]);
    goTo(step + 1);
  };

  // 휴대폰: 이전 문항, 영역의 첫 문항이면 앞 영역의 마지막 문항
  const prev = () => {
    if (!oneAtATime || qIndex === 0) {
      if (step === 0) return navigate("/calculator");
      const before = visibleOf(step - 1);
      return goTo(step - 1, oneAtATime ? before[before.length - 1].id : null);
    }
    goTo(step, visible[qIndex - 1].id);
  };

  const finish = () => {
    if (oneAtATime && missing.includes(currentQ)) return flagMissing(currentQ);
    if (oneAtATime && !isLastQ) return next();
    if (missing.length) return flagMissing(missing[0]);
    // 건너뛴 문항(통학 0일의 수단·시간)의 자세히 입력은 저장하지 않는다
    const kept = Object.fromEntries(
      Object.entries(detail).filter(([id]) => {
        const q = QUESTIONS.find((x) => x.id === id);
        return q && !isSkipped(q, answers, detail);
      })
    );
    const record = createResponse({ ...draft, detail: kept, detailOpened: draft.detailOpened ?? [] });
    finished.current = true;
    add(record);
    setDraft(null);
    navigate(`/result/${record.id}`);
  };

  const prevLabel = oneAtATime && qIndex > 0 ? "이전" : step === 0 ? "시작 화면" : `이전: ${STEPS[step - 1].label}`;
  const primary =
    oneAtATime && !isLastQ
      ? { label: "다음 →", onClick: next }
      : isLast
        ? { label: "결과 보기", onClick: finish }
        : { label: `다음: ${STEPS[step + 1].label} →`, onClick: next };

  return (
    <>
      <PageHead
        title="간편 입력"
        mobileDescription="생활 습관에 가장 가까운 것을 골라 주세요."
        description={
          <>
            생활 습관에 가장 가까운 것을 골라 주세요.
            <br />
            정확한 값을 알면 항목마다 '자세히 입력'을 펼쳐 넣을 수 있어요.
          </>
        }
        crumbs={[{ to: "/calculator", label: "탄소발자국 계산기" }]}
        compact
      />
      <div className="wrap calc-layout">
        <div className="calc-main">
          <ol className="stepper" aria-label="입력 단계">
            {STEPS.map((s, i) => {
              const p = progressOf(s.questions, answers, touched, detail);
              const state = i === step ? "is-current" : p.filled === p.total ? "is-done" : "";
              return (
                <li key={s.key} className={state}>
                  <button onClick={() => goTo(i)} aria-current={i === step ? "step" : undefined}>
                    <span className="stepper-num">{state === "is-done" ? "✓" : i + 1}</span>
                    <span className="stepper-label">{s.label}</span>
                    <small title={`직접 답함 ${p.answered}개 · 기본값 ${p.defaults}개 · 전체 ${p.total}개`}>{stepText(p)}</small>
                  </button>
                </li>
              );
            })}
          </ol>

          <section className="q-section" aria-labelledby="step-title">
            <div className="q-section-head">
              <span className="q-section-icon" aria-hidden="true">
                {current.icon}
              </span>
              <div>
                <p className="step-count">
                  {step + 1} / {STEPS.length} 단계
                  {oneAtATime && (
                    <span className="q-count">
                      {" "}
                      · 질문 {qIndex + 1} / {visible.length}
                    </span>
                  )}
                </p>
                <h2 id="step-title">{current.label}</h2>
                <p>{current.desc}</p>
                {current.note && <p className="q-section-note">{current.note}</p>}
              </div>
              {/* 휴대폰: 제목 오른쪽에 영역 안 문항 점(누르면 그 문항으로). 채움: 답함, 길게: 지금 문항 */}
              {oneAtATime && visible.length > 1 && (
                <div className="q-dots" role="group" aria-label="이 영역의 문항">
                  {visible.map((q, i) => (
                    <button
                      key={q.id}
                      type="button"
                      className={`q-dot${i === qIndex ? " is-current" : ""}${isAnswered(q, answers, touched, detail) ? " is-done" : ""}`}
                      aria-label={`질문 ${i + 1}: ${q.label}`}
                      aria-current={i === qIndex ? "step" : undefined}
                      onClick={() => goTo(step, q.id)}
                    />
                  ))}
                </div>
              )}
              {/* 휴대폰은 문항이 하나씩이라 영역 전체를 펼치는 버튼은 두지 않는다 */}
              {!oneAtATime && expandableHere.length > 0 && (
                // 두 문구를 겹쳐 두고 하나만 보여 준다 — 버튼 폭이 긴 문구에 맞춰 고정되어, 눌러도 위치가 바뀌지 않는다
                <button
                  type="button"
                  className={allOpenHere ? "detail-all is-on" : "detail-all"}
                  aria-pressed={allOpenHere}
                  onClick={() => setOpen(expandableHere, !allOpenHere)}
                >
                  <span aria-hidden={allOpenHere}>이 단계 모두 자세히 입력</span>
                  <span aria-hidden={!allOpenHere}>자세히 입력 모두 접기</span>
                </button>
              )}
            </div>

            {shown.map((q) => (
              <Question
                key={q.id}
                q={q}
                index={QUESTIONS.indexOf(q) + 1}
                answers={answers}
                touched={touched}
                skipped={isSkipped(q, answers, detail)}
                missing={showMissing && missing.includes(q)}
                hint={derivedHint(q, answers, touched)}
                onChange={setAnswer}
                detailProps={detailPropsFor(q)}
              />
            ))}
          </section>

          <div className="step-nav">
            <button className="btn btn-ghost" onClick={prev}>
              ← {prevLabel}
            </button>
            <button className="btn btn-primary step-next" onClick={primary.onClick}>
              {primary.label}
            </button>
          </div>
        </div>

        <LivePanel
          result={result}
          progress={draftProgress(draft)}
          missing={missing.length}
          actionLabel={primary.label}
          onAction={primary.onClick}
          back={oneAtATime ? { label: prevLabel, onClick: prev } : null}
          resetKey={oneAtATime ? `${step}:${currentQ.id}` : step}
          focus={oneAtATime ? questionFocus(currentQ.id, answers, detail, result) : { label: current.label, parts: { [current.key]: result.byCategory[current.key].value } }}
        />
      </div>
    </>
  );
}
