// 입력 중인 답변 (새로고침하거나 다른 페이지에 다녀와도 이어서 입력할 수 있게)
import { emptyAnswers, QUESTIONS, isAnswered } from "./carbon/questions.js";
import { DRAFT_KEY } from "./responses.js";
import { useStoredState } from "./storage.js";

export const useDraft = () => useStoredState(DRAFT_KEY, null);

// detail: 자세히 입력한 문항별 값 / detailOpen: 지금 펼쳐 둔 문항 / detailOpened: 한 번이라도 펼친 문항(펼침 비율 측정)
export const newDraft = (consent, answers = emptyAnswers(), touched = [], detail = {}) => ({
  answers,
  touched,
  detail,
  detailOpen: Object.keys(detail),
  detailOpened: Object.keys(detail),
  consent,
  startedAt: new Date().toISOString(),
});

// 메인 화면 미리보기에서 고른 답 → 간편 입력을 새로 시작할 때 미리 채운다
export const PREFILL_KEY = "carboncalc:prefill";

export const answeredCount = (draft) =>
  QUESTIONS.filter((q) => isAnswered(q, draft.answers, draft.touched, draft.detail)).length;
