import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import PageHead from "../components/PageHead.jsx";
import { CATEGORIES } from "../lib/carbon/engine.js";
import { HOUSING } from "../lib/carbon/factors.js";
import { QUESTIONS, emptyAnswers } from "../lib/carbon/questions.js";
import { PREFILL_KEY, draftProgress, newDraft, progressText, resumePoint, useDraft } from "../lib/draft.js";
import { useStoredState } from "../lib/storage.js";
import { useResponses } from "../lib/responses.js";
import { formatDate } from "../lib/format.js";
import "./Calculator.css";

// 동의 문구. 휴대폰에서는 제목만 보이고 '내용 보기'로 펼친다
const CONSENT = {
  service: "입력한 생활 정보는 탄소발자국 계산과 결과 저장에만 사용합니다. 이름, 연락처 등 개인 식별 정보는 수집하지 않습니다.",
  research: "입력값과 거주 지역을 개인 식별 정보 없이 서버에 저장하며, 집계된 통계로만 대학·지자체의 탄소 감축 연구에 활용합니다. 동의하지 않아도 모든 기능을 이용할 수 있습니다.",
};

export default function StartPage() {
  const navigate = useNavigate();
  const [draft, setDraft] = useDraft();
  const { responses } = useResponses();
  const last = responses.at(-1);

  const [service, setService] = useState(draft?.consent.service ?? false);
  const [research, setResearch] = useState(draft?.consent.research ?? false);
  const [prefill, setPrefill] = useStoredState(PREFILL_KEY, null);

  const start = () => {
    const answers = { ...emptyAnswers(), ...prefill };
    // 거주 형태를 미리 골랐다면 동거 인원은 입력 화면과 같은 규칙으로 기본 인원을 채운다
    if (answers.housing && answers.household == null) answers.household = HOUSING[answers.housing].defaultHousehold;
    setDraft(newDraft({ service, research, agreedAt: new Date().toISOString() }, answers));
    setPrefill(null);
    navigate("/calculator/simple");
  };

  // 값이 아예 없는 첫 문항의 단계부터 다시 연다 (모두 채웠으면 마지막에 보던 단계)
  const resume = () => {
    const at = resumePoint(draft);
    setDraft((d) => ({ ...d, consent: { ...d.consent, research }, step: at ? at.step : d.step }));
    navigate("/calculator/simple", { state: at ? { focus: at.id } : null });
  };

  return (
    <>
      <PageHead
        title="탄소발자국 계산기"
        description="생활 습관에 답하면 나의 연간 탄소발자국을 알려드려요. 나중에 결과 화면에서 다시 고칠 수 있어요."
        mobileDescription="생활 습관에 답하면 연간 탄소발자국을 알려드려요."
      />
      <div className="wrap start">
        <h2 className="sr-only">입력 방식</h2>
        <div className="mode-cards">
          <div className="card mode-card is-available">
            <div className="mode-top">
              <span className="mode-time">약 1분 · 자세히 입력하면 약 5분</span>
              <span className="badge-est">추정 범위로 결과 표시</span>
            </div>
            <h3>간편 입력</h3>
            <p>
              <span className="only-desktop">
                칩을 고르고 슬라이더를 움직여 {QUESTIONS.length}개 항목에 빠르게 답해요. 정확한 값을 알면 항목마다 '자세히
                입력'을 펼쳐 넣을 수 있어요.
              </span>
              <span className="only-mobile">{QUESTIONS.length}개 항목을 칩과 슬라이더로 빠르게 답해요.</span>
            </p>
            <ul className="mode-cats">
              {CATEGORIES.map((c) => (
                <li key={c.key}>
                  <span aria-hidden="true">{c.icon}</span> {c.label}
                </li>
              ))}
            </ul>
          </div>

        </div>

        <div className="card consent">
          <h3>이용 동의</h3>
          <label className="check">
            <input type="checkbox" checked={service} onChange={(e) => setService(e.target.checked)} />
            <span>
              <strong>[필수] 서비스 이용 동의</strong>
              <span className="only-desktop"> — {CONSENT.service}</span>
            </span>
          </label>
          <details className="consent-detail only-mobile-block">
            <summary>내용 보기</summary>
            <p>{CONSENT.service}</p>
          </details>
          <label className="check">
            <input type="checkbox" checked={research} onChange={(e) => setResearch(e.target.checked)} />
            <span>
              <strong>[선택] 통계·연구 활용 동의</strong>
              <span className="only-desktop"> — {CONSENT.research}</span>
            </span>
          </label>
          <details className="consent-detail only-mobile-block">
            <summary>내용 보기</summary>
            <p>{CONSENT.research}</p>
          </details>
          <p className="consent-note">
            응답은 이용 중인 브라우저에 저장됩니다. 통계·연구 활용에 동의하지 않은 응답은 외부로 전송되지 않습니다. 단, 결과
            화면에서 제출한 피드백은 동의 여부와 관계없이 개인 식별 정보 없이 서버에 저장됩니다.
          </p>

          {prefill && (
            <p className="prefill-note">
              메인 화면에서 고른 답 {Object.keys(prefill).length}개를 미리 채워서 시작해요.{" "}
              <button className="link-btn" onClick={() => setPrefill(null)}>
                빈 상태로 시작
              </button>
            </p>
          )}

          <div className="start-actions">
            {prefill ? (
              <button className="btn btn-primary" onClick={start} disabled={!service}>
                고른 답으로 시작하기 →
              </button>
            ) : draft ? (
              <>
                <button className="btn btn-primary" onClick={resume}>
                  이어서 입력하기 · {progressText(draftProgress(draft))} →
                </button>
                <button className="btn btn-ghost" onClick={start} disabled={!service}>
                  처음부터 다시
                </button>
              </>
            ) : (
              <button className="btn btn-primary" onClick={start} disabled={!service}>
                간편 입력 시작하기 →
              </button>
            )}
            {last && (
              <Link className="btn btn-ghost" to={`/result/${last.id}`}>
                지난 결과 보기 ({formatDate(last.completedAt)})
              </Link>
            )}
          </div>
          {!service && (!draft || prefill) && <p className="consent-hint">필수 항목에 동의해야 시작할 수 있습니다.</p>}
        </div>
      </div>
    </>
  );
}
