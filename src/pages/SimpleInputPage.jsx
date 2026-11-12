import { useEffect, useRef, useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import PageHead from "../components/PageHead.jsx";
import Question from "../components/Question.jsx";
import { CATEGORIES, calculate, commuteKm } from "../lib/carbon/engine.js";
import { HOUSING } from "../lib/carbon/factors.js";
import { QUESTIONS, isSkipped, missingRequired, optionLabel, progressOf } from "../lib/carbon/questions.js";
import { canExpand, fillBlank, syncSimple } from "../lib/carbon/details.js";
import { draftProgress, upgradeDraft, useDraft } from "../lib/draft.js";
import { createResponse, useResponses } from "../lib/responses.js";
import { num, toTon } from "../lib/format.js";
import { CAT_COLORS } from "../lib/colors.js";
import "./Calculator.css";

// 영역 하나가 한 화면: 이동 → 주거 → 식생활 → 소비
const STEPS = CATEGORIES.map((c) => ({ ...c, questions: QUESTIONS.filter((q) => q.category === c.key) }));
const stepOf = (q) => STEPS.findIndex((s) => s.key === q.category);

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

function LivePanel({ result, progress, missing, actionLabel, onAction }) {
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

      {/* 진하게: 답한 문항, 옅게: 기본값으로 둔 문항 */}
      <div className="progress" aria-hidden="true">
        <span style={{ width: `${(progress.answered / progress.total) * 100}%` }} />
        <span className="is-default" style={{ width: `${(progress.defaults / progress.total) * 100}%` }} />
      </div>
      <p className="live-progress">
        {progress.total}개 중 <strong>{progress.filled}개</strong> 입력
        {progress.defaults > 0 && <span className="live-default"> (기본값 {progress.defaults}개)</span>}
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
  const [stored, setStored] = useDraft();
  // 이전 버전의 초안도 지금 형식으로 보여 주고, 고칠 때도 지금 형식으로 바꾼 뒤에 고친다
  const draft = upgradeDraft(stored);
  const setDraft = (update) => setStored((d) => (typeof update === "function" ? update(upgradeDraft(d)) : update));
  const { add } = useResponses();
  const [showMissing, setShowMissing] = useState(false);
  const location = useLocation();
  // 완료 직후 초안을 지우면서 시작 화면으로 되돌려 보내지 않도록
  const finished = useRef(false);

  // 이어서 입력: 시작 화면이 넘겨준, 값이 아예 없는 첫 문항으로 스크롤
  const focusId = location.state?.focus;
  useEffect(() => {
    if (!focusId) return;
    requestAnimationFrame(() => document.getElementById(`q-${focusId}`)?.scrollIntoView({ block: "center" }));
  }, [focusId]);

  if (!draft?.consent?.service) return finished.current ? null : <Navigate to="/calculator" replace />;

  const { answers, touched, detail } = draft;
  const detailOpen = draft.detailOpen ?? [];
  const step = draft.step ?? 0;
  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;
  const result = calculate(answers, detail);
  const missing = missingRequired(answers, detail);
  const missingHere = missing.filter((q) => q.category === current.key);

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

  const primary = isLast
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
                </p>
                <h2 id="step-title">{current.label}</h2>
                <p>{current.desc}</p>
              </div>
              {expandableHere.length > 0 && (
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
          progress={draftProgress(draft)}
          missing={missing.length}
          actionLabel={primary.label}
          onAction={primary.onClick}
        />
      </div>
    </>
  );
}
