import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import PageHead from "../components/PageHead.jsx";
import { CATEGORIES } from "../lib/carbon/engine.js";
import { HOUSING } from "../lib/carbon/factors.js";
import { QUESTIONS, emptyAnswers } from "../lib/carbon/questions.js";
import { PREFILL_KEY, answeredCount, newDraft, useDraft } from "../lib/draft.js";
import { useStoredState } from "../lib/storage.js";
import { useResponses } from "../lib/responses.js";
import { formatDate } from "../lib/format.js";
import "./Calculator.css";

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

  const resume = () => {
    setDraft((d) => ({ ...d, consent: { ...d.consent, research } }));
    navigate("/calculator/simple");
  };

  return (
    <>
      <PageHead title="탄소발자국 계산기" description="생활 습관에 답하면 나의 연간 탄소발자국을 알려드려요. 나중에 결과 화면에서 다시 고칠 수 있어요." />
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
              칩을 고르고 슬라이더를 움직여 {QUESTIONS.length}개 항목에 빠르게 답해요. 정확한 값을 알면 항목마다 '자세히 입력'을
              펼쳐 넣을 수 있어요.
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
          <h3>시작하기 전에</h3>
          <label className="check">
            <input type="checkbox" checked={service} onChange={(e) => setService(e.target.checked)} />
            <span>
              <strong>[필수] 서비스 이용 동의</strong> — 입력한 생활 습관을 탄소발자국 계산과 결과 저장에 사용해요. 이름·연락처는 묻지
              않아요.
            </span>
          </label>
          <label className="check">
            <input type="checkbox" checked={research} onChange={(e) => setResearch(e.target.checked)} />
            <span>
              <strong>[선택] 통계·연구 활용 동의</strong> — 개인을 알아볼 수 없도록 묶은 집계로만 대학·지자체의 탄소 감축 연구에
              활용해요. 동의하지 않아도 계산기를 똑같이 쓸 수 있어요.
            </span>
          </label>
          <p className="consent-note">
            응답은 이 브라우저에 저장돼요. 통계·연구 활용에 동의하면 입력값·피드백·거주 지역이 이름 없이 서버에도 저장되고, 동의하지 않으면 외부로 보내지 않아요.
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
                  이어서 입력하기 ({answeredCount(draft)}/{QUESTIONS.length}) →
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
          {!service && (!draft || prefill) && <p className="consent-hint">필수 동의에 체크하면 시작할 수 있어요.</p>}
        </div>
      </div>
    </>
  );
}
