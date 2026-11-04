import { useRef, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import PageHead from "../components/PageHead.jsx";
import Question from "../components/Question.jsx";
import { CATEGORIES, calculate, commuteKm } from "../lib/carbon/engine.js";
import { HOUSING } from "../lib/carbon/factors.js";
import { QUESTIONS, isAnswered, isSkipped, missingRequired, optionLabel } from "../lib/carbon/questions.js";
import { canExpand, fillBlank, syncSimple } from "../lib/carbon/details.js";
import { answeredCount, useDraft } from "../lib/draft.js";
import { createResponse, useResponses } from "../lib/responses.js";
import { num, toTon } from "../lib/format.js";
import { CAT_COLORS } from "../lib/colors.js";
import "./Calculator.css";

// 영역 하나가 한 화면: 이동 → 주거 → 식생활 → 소비
const STEPS = CATEGORIES.map((c) => ({ ...c, questions: QUESTIONS.filter((q) => q.category === c.key) }));
const stepOf = (q) => STEPS.findIndex((s) => s.key === q.category);

// 간편 입력값에서 바로 파생되는 안내 (계산 과정을 보여 줘 결과를 믿을 수 있게)
function derivedHint(q, answers, touched) {
  if (q.id === "commuteMinutes" && answers.commuteMode) {
    const km = commuteKm(answers.commuteMode, answers.commuteMinutes);
    return `${optionLabel("commuteMode", answers.commuteMode)} 기준 편도 약 ${num(km, 1)}km로 계산해요.`;
  }
  if (q.id === "household" && answers.housing && !touched.includes("household")) {
    return "거주 형태에 맞춰 미리 골라 두었어요. 다르면 바꿔 주세요.";
  }
  return null;
}

function LivePanel({ result, answered, missing, actionLabel, onAction }) {
  const { total } = result;
  return (
    <aside className="card live" aria-label="실시간 예상 배출량">
      <div className="live-label">
        지금까지 예상 배출량 <span className="badge-est">추정</span>
      </div>
      <div className="live-value">
        {toTon(total.value)}
        <small>톤/년</small>
      </div>
      <div className="live-range">
        {toTon(total.low)}~{toTon(total.high)}톤
      </div>
      <ul className="live-list">
        {CATEGORIES.map((c) => (
          <li key={c.key}>
            <i className="key key-rect" style={{ background: CAT_COLORS[c.key] }} aria-hidden="true" />
            <span>{c.label}</span>
            <strong>{num(Math.round(result.byCategory[c.key].value))}kg</strong>
          </li>
        ))}
      </ul>

      <div className="progress" aria-hidden="true">
        <span style={{ width: `${(answered / QUESTIONS.length) * 100}%` }} />
      </div>
      <p className="live-progress">
        {QUESTIONS.length}개 중 <strong>{answered}개</strong> 답함
      </p>
      <button className="btn btn-primary btn-block" onClick={onAction}>
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
  const [draft, setDraft] = useDraft();
  const { add } = useResponses();
  const [showMissing, setShowMissing] = useState(false);
  // 완료 직후 초안을 지우면서 시작 화면으로 되돌려 보내지 않도록
  const finished = useRef(false);

  if (!draft?.consent?.service) return finished.current ? null : <Navigate to="/calculator" replace />;

  const { answers, touched } = draft;
  const detail = draft.detail ?? {};
  const detailOpen = draft.detailOpen ?? [];
  const step = draft.step ?? 0;
  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;
  const result = calculate(answers, detail);
  const missing = missingRequired(answers, detail);
  const missingHere = missing.filter((q) => q.category === current.key);

  // key: 바꿀 답변, qid: 직접 조작한 문항(냉난방은 슬라이더 2개가 한 문항)
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

  const goTo = (i) => {
    setShowMissing(false);
    setDraft((d) => ({ ...d, step: i }));
    window.scrollTo(0, 0);
  };

  // 아직 고르지 않은 칩이 있으면 그 문항을 강조하고 보여 준다
  const flagMissing = (q) => {
    setShowMissing(true);
    requestAnimationFrame(() =>
      document.getElementById(`q-${q.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" })
    );
  };

  const next = () => {
    if (missingHere.length) return flagMissing(missingHere[0]);
    goTo(step + 1);
  };

  const finish = () => {
    if (missing.length) {
      const target = stepOf(missing[0]);
      if (target !== step) setDraft((d) => ({ ...d, step: target }));
      return flagMissing(missing[0]);
    }
    // 건너뛴 문항(통학 0일의 시간·수단)의 자세히 입력은 저장하지 않는다
    const kept = Object.fromEntries(
      Object.entries(detail).filter(([id]) => !isSkipped(QUESTIONS.find((q) => q.id === id), answers, detail))
    );
    const record = createResponse({ ...draft, detail: kept, detailOpened: draft.detailOpened ?? [] });
    finished.current = true;
    add(record);
    setDraft(null);
    navigate(`/result/${record.id}`);
  };

  const primary = isLast
    ? { label: "결과 보기", onClick: finish }
    : { label: `다음: ${STEPS[step + 1].label} →`, onClick: next };

  return (
    <>
      <PageHead
        title="간편 입력"
        description="생활 습관에 가장 가까운 것을 골라 주세요. 정확한 값을 알면 항목마다 '자세히 입력'을 펼쳐 넣을 수 있어요."
        crumbs={[{ to: "/calculator", label: "탄소발자국 계산기" }]}
      />
      <div className="wrap calc-layout">
        <div className="calc-main">
          <ol className="stepper" aria-label="입력 단계">
            {STEPS.map((s, i) => {
              const done = s.questions.filter((q) => isAnswered(q, answers, touched, detail)).length;
              const complete = !missing.some((q) => q.category === s.key);
              const state = i === step ? "is-current" : complete && done > 0 ? "is-done" : "";
              return (
                <li key={s.key} className={state}>
                  <button onClick={() => goTo(i)} aria-current={i === step ? "step" : undefined}>
                    <span className="stepper-num">{state === "is-done" ? "✓" : i + 1}</span>
                    <span className="stepper-label">{s.label}</span>
                    <small>
                      {done}/{s.questions.length}
                    </small>
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
                </p>
                <h2 id="step-title">{current.label}</h2>
                <p>{current.desc}</p>
              </div>
              {expandableHere.length > 0 && (
                <button type="button" className="detail-all" onClick={() => setOpen(expandableHere, !allOpenHere)}>
                  {allOpenHere ? "자세히 입력 모두 접기" : "이 단계 모두 자세히 입력"}
                </button>
              )}
            </div>

            {current.questions.map((q) => (
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
            {step === 0 ? (
              <button className="btn btn-ghost" onClick={() => navigate("/calculator")}>
                ← 시작 화면
              </button>
            ) : (
              <button className="btn btn-ghost" onClick={() => goTo(step - 1)}>
                ← 이전: {STEPS[step - 1].label}
              </button>
            )}
            <button className="btn btn-primary step-next" onClick={primary.onClick}>
              {primary.label}
            </button>
          </div>
        </div>

        <LivePanel
          result={result}
          answered={answeredCount(draft)}
          missing={missing.length}
          actionLabel={primary.label}
          onAction={primary.onClick}
        />
      </div>
    </>
  );
}
