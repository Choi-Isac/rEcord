// 내 계산 기록의 변화: 회차별 결과, 두 계산 사이의 항목별 증감과 바뀐 답 (내 계정 · 내 기록 변화 화면)
import { calculate } from "./carbon/engine.js";
import { QUESTIONS, optionLabel } from "./carbon/questions.js";
import { FLEX_ITEMS } from "./flexibility.js";
import { formatDate, kgValue } from "./format.js";

// 회차별 결과 (기록 순서 = 계산한 순서)
export const historyRows = (responses) =>
  responses.map((record, i) => ({ record, n: i + 1, result: calculate(record.answers, record.detail ?? {}) }));

// 그래프 눈금용 짧은 날짜: 26.11.13
export const shortDate = (iso) => formatDate(iso).slice(2);

// 두 계산 사이의 항목별 증감(kg, 화면 표기 기준). 변하지 않은 항목과 고정 항목(기본 식단)은 뺀다. 변화가 큰 순
export function itemChanges(from, to) {
  return to.result.items
    .filter((it) => !it.fixed)
    .map((it) => {
      const before = kgValue(from.result.items.find((x) => x.key === it.key).value);
      const after = kgValue(it.value);
      return { key: it.key, label: it.label, category: it.category, before, after, diff: after - before };
    })
    .filter((c) => c.diff !== 0)
    .sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff));
}

// 답을 읽기 쉬운 글로 (칩은 선택지 이름, 슬라이더는 단위를 붙여서)
function answerText(q, v) {
  if (v == null || (Array.isArray(v) && !v.length)) return "—";
  if (q.type === "slider") return q.format(v);
  if (Array.isArray(v)) return v.map((x) => optionLabel(q.id, x)).join("·");
  return optionLabel(q.id, v) ?? String(v);
}

const SHORT = Object.fromEntries(FLEX_ITEMS.map((f) => [f.id, f.label]));

// 답 묶음과 그 묶음이 영향을 주는 배출 항목. 배출 항목은 저마다 정확히 한 묶음의 답으로만 계산된다.
// 그래서 '바뀐 답'의 증감 = 그 묶음 항목들의 '항목별 증감' 합이 되어 두 목록의 숫자가 늘 맞는다.
// 묶음 안의 답은 계산에서 서로 곱해져(통학 수단 × 시간 등) 하나씩 떼어 증감을 낼 수 없으므로 함께 보여 준다.
// label이 없는 묶음은 문항 하나짜리(문항 이름을 쓴다).
// scripts/check-cases.mjs가 엔진에서 답이 자기 묶음 밖의 항목을 바꾸지 않는지 검사한다
export const ANSWER_GROUPS = [
  { id: "commute", label: "통학", questions: ["commuteDays", "commuteMinutes", "commuteMode"], items: ["commute"] },
  { id: "homeTrips", questions: ["homeTrips"], items: ["homeTrips"] },
  { id: "flights", questions: ["flights"], items: ["flights"] },
  {
    id: "home",
    label: "주거·냉난방",
    questions: ["housing", "household", "cooling", "heating"],
    items: ["electricity", "cooling", "heating", "hotWater"],
  },
  { id: "meat", questions: ["meat"], items: ["meat"] },
  { id: "delivery", label: "배달·외식과 다회용기", questions: ["mealsOut", "reusable"], items: ["mealsOut", "disposables"] },
  { id: "clothes", questions: ["clothes"], items: ["clothes"] },
  { id: "parcels", questions: ["parcels"], items: ["parcels"] },
];

// 두 계산 사이에 바뀐 답을 묶음별로. 난방처럼 두 칸인 문항은 칸마다 따로 보여 준다.
// 자세히 입력한 문항은 간편 입력 칸 중 가장 가까운 값으로 보여 주므로 detail 표시를 붙인다.
// effect: 그 묶음 항목들의 증감 합(kg, itemChanges와 같은 값), items: 그중 바뀐 항목
export function answerChanges(from, to) {
  const a = from.record;
  const b = to.record;
  const changed = itemChanges(from, to);
  const out = [];
  for (const g of ANSWER_GROUPS) {
    const changes = QUESTIONS.filter((q) => g.questions.includes(q.id)).flatMap((q) =>
      (q.parts ?? [q])
        .map((p) => ({
          id: p.id,
          label: q.parts ? p.label : (SHORT[q.id] ?? p.label),
          before: answerText(p, a.answers[p.id]),
          after: answerText(p, b.answers[p.id]),
          detail: Boolean(a.detail?.[q.id] || b.detail?.[q.id]),
        }))
        .filter((c) => c.before !== c.after)
    );
    // 자세히 입력 값만 바뀌어 간편 입력 칸은 같아도 배출이 달라졌으면 그 항목을 보여 준다
    const items = changed.filter((c) => g.items.includes(c.key));
    if (!changes.length && !items.length) continue;
    out.push({ id: g.id, label: g.label ?? null, changes, items, effect: items.reduce((s, c) => s + c.diff, 0) });
  }
  return out;
}
