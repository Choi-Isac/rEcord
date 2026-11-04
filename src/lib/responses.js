// 응답 데이터 모델 (docs/응답-데이터-스키마.md 참고)
// 결과값이 아니라 원본 입력값을 저장하고, 계수 버전·입력 방식·학기를 함께 기록한다.
// v0.1은 서버 없이 이 브라우저(localStorage)에만 저장한다.
import { FACTOR_VERSION } from "./carbon/factors.js";
import { QUESTIONS, answerKeys } from "./carbon/questions.js";
import { useStoredState } from "./storage.js";

export const SCHEMA_VERSION = 2; // 2: 자세히 입력(detail, detailOpened) 추가
export const RESPONSES_KEY = "carboncalc:responses";
export const DRAFT_KEY = "carboncalc:draft";

// 3~8월 → 1학기, 9~12월 → 2학기, 1~2월 → 전년도 2학기(겨울방학)
export function semesterOf(date = new Date()) {
  const y = date.getFullYear();
  const m = date.getMonth() + 1;
  if (m >= 3 && m <= 8) return `${y}-1`;
  return m >= 9 ? `${y}-2` : `${y - 1}-2`;
}

const makeId = () =>
  globalThis.crypto?.randomUUID?.() ?? `r-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

export function createResponse({ answers, touched, startedAt, consent, detail = {}, detailOpened = [] }) {
  const now = new Date();
  return {
    id: makeId(),
    schemaVersion: SCHEMA_VERSION,
    factorVersion: FACTOR_VERSION,
    // 자세히 입력한 문항이 하나라도 있으면 "detailed"
    inputMode: Object.keys(detail).length ? "detailed" : "simple",
    semester: semesterOf(now),
    startedAt,
    completedAt: now.toISOString(),
    durationSec: Math.round((now - new Date(startedAt)) / 1000),
    consent,
    answers,
    detail, // 자세히 입력한 문항별 값 (간편 입력보다 우선)
    detailOpened, // 자세히 입력을 펼쳐 본 문항 (값을 바꾸지 않았어도)
    // 직접 움직이지 않고 기본값 그대로 둔 슬라이더 (기본값 의존도 측정용)
    defaultsUsed: QUESTIONS.filter((q) => q.type !== "chips" && !touched.includes(q.id) && !detail[q.id]).flatMap(answerKeys),
    profile: { region: "" }, // 거주 지역 (결과 화면의 포인트 안내)
    feedback: null,
  };
}

export function useResponses() {
  const [responses, setResponses] = useStoredState(RESPONSES_KEY, []);
  const update = (id, patch) => setResponses((list) => list.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  const add = (record) => setResponses((list) => [...list, record]);
  return { responses, add, update };
}
