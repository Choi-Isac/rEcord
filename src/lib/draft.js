// 입력 중인 답변 (새로고침하거나 다른 페이지에 다녀와도 이어서 입력할 수 있게)
import { CATEGORIES, upgradeDetail } from "./carbon/engine.js";
import { emptyAnswers, QUESTIONS, missingRequired, progressOf, withDefaults } from "./carbon/questions.js";
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

// 이전 버전의 초안을 지금 형식으로: 기본값이 생긴 문항, 여러 개 고르는 통학 수단,
// 냉방·난방 문항 분리(2026-11-11, 이전의 냉난방 문항 'climate'와 거주 형태의 난방 방식)
const renameClimate = (ids) => (ids?.includes("climate") ? [...new Set(ids.flatMap((x) => (x === "climate" ? ["cooling", "heating"] : [x])))] : ids);
export function upgradeDraft(draft) {
  if (!draft) return draft;
  const legacyHeating = draft.detail?.housing?.heating;
  return {
    ...draft,
    answers: withDefaults({ ...(legacyHeating && { heatingType: legacyHeating }), ...draft.answers }),
    touched: renameClimate(draft.touched ?? []),
    detail: upgradeDetail(draft.detail),
    detailOpen: renameClimate(draft.detailOpen),
    detailOpened: renameClimate(draft.detailOpened),
  };
}

export const draftProgress = (raw) => {
  const draft = upgradeDraft(raw);
  return progressOf(QUESTIONS, draft.answers, draft.touched, draft.detail);
};

// 진행도 글자: "11/13 (기본값 4)" — 기본값으로 둔 문항은 소괄호로 따로 알린다
export const progressText = ({ filled, total, defaults }) => `${filled}/${total}${defaults ? ` (기본값 ${defaults})` : ""}`;

// 이어서 입력: 값이 아예 없는(기본값도 없는) 첫 문항과 그 단계. 모두 채웠으면 null
export function resumePoint(raw) {
  const draft = upgradeDraft(raw);
  const q = missingRequired(draft.answers, draft.detail)[0];
  return q ? { step: CATEGORIES.findIndex((c) => c.key === q.category), id: q.id } : null;
}
