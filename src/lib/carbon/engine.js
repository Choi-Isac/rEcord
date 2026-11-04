// 탄소발자국 계산 엔진: 원본 입력값(칩·슬라이더 선택) → 항목별 연간 배출량(kg CO₂e)
// 화면과 분리해 두어 scripts/check-cases.mjs로 가상 이용자 사례를 손계산과 대조할 수 있다.
import {
  COMMUTE,
  COOL_LEVEL,
  EF,
  EXTRA_PERSON_SHARE,
  FLIGHTS,
  FOOD,
  GOODS,
  HEAT_LEVEL,
  HOME_TRIPS,
  HOUSING,
  MONTHS_PER_YEAR,
  UNCERTAINTY,
  WEEKS_PER_YEAR,
} from "./factors.js";

export const CATEGORIES = [
  { key: "transport", label: "이동", icon: "🚌", desc: "통학, 장거리 이동, 비행기" },
  { key: "housing", label: "주거", icon: "🏠", desc: "사는 곳의 전기와 냉난방" },
  { key: "food", label: "식생활", icon: "🍚", desc: "식단과 배달·외식" },
  { key: "goods", label: "소비", icon: "🛍️", desc: "옷, 택배, 일회용품" },
];

// 결과 비교와 미응답 항목 계산에 쓰는 기준 예시 (가상의 대학생: 본가 4인 가족, 지하철 통학)
export const REFERENCE_ANSWERS = {
  commuteDays: 4,
  commuteMinutes: 40,
  commuteMode: "subway",
  homeTrips: "semester",
  flights: "none",
  housing: "family",
  household: 4,
  cooling: 3,
  heating: 3,
  meat: "mid",
  mealsOut: 4,
  clothes: 2,
  parcels: 5,
  reusable: "sometimes",
};

export const commuteKm = (mode, minutes) => (COMMUTE.speedKmh[mode] * minutes) / 60;

// 슬라이더 최댓값("10개 이상" 등)은 대표값으로 바꿔 계산
export const clothesCount = (v) => (v >= GOODS.clothesMax ? GOODS.clothesOverflow : v);
export const parcelCount = (v) => (v >= GOODS.parcelsMax ? GOODS.parcelsOverflow : v);

// 가구 에너지 중 나의 몫
export const householdShare = (n) => (1 + EXTRA_PERSON_SHARE * (n - 1)) / n;

// 답하지 않은 항목(null)은 기준 예시 값으로 채운다. 동거 인원은 거주 형태의 기본 인원을 따른다
export function fillDefaults(answers) {
  const filled = { ...REFERENCE_ANSWERS };
  for (const [k, v] of Object.entries(answers)) if (v !== null && v !== undefined) filled[k] = v;
  if (answers.housing && answers.household == null) filled.household = HOUSING[answers.housing].defaultHousehold;
  return filled;
}

function itemValues(a) {
  const commuting = a.commuteDays > 0;
  const h = HOUSING[a.housing];
  const share = householdShare(a.household);
  const flight = FLIGHTS[a.flights];

  return {
    commute: commuting
      ? a.commuteDays * 2 * commuteKm(a.commuteMode, a.commuteMinutes) * COMMUTE.pkm[a.commuteMode] * COMMUTE.weeksPerYear
      : 0,
    homeTrips: HOME_TRIPS.roundTripsPerYear[a.homeTrips] * HOME_TRIPS.roundTripKm * HOME_TRIPS.pkm,
    flights: flight.pkm * flight.ef,

    electricity: h.elec * EF.electricity * share,
    cooling: h.cool * COOL_LEVEL[a.cooling - 1] * EF.electricity * share,
    heating: h.heat * HEAT_LEVEL[a.heating - 1] * EF.gas * share,
    hotWater: h.hot * EF.gas * share,

    dietBase: FOOD.base,
    meat: FOOD.servingsPerWeek[a.meat] * WEEKS_PER_YEAR * FOOD.meatServing,
    mealsOut: a.mealsOut * WEEKS_PER_YEAR * FOOD.mealOverhead,

    clothes: clothesCount(a.clothes) * MONTHS_PER_YEAR * GOODS.clothingItem,
    parcels: parcelCount(a.parcels) * MONTHS_PER_YEAR * GOODS.parcel,
    disposables:
      (GOODS.cupsPerWeek * GOODS.cup + a.mealsOut * GOODS.deliveryShare * GOODS.container) *
      WEEKS_PER_YEAR *
      (1 - GOODS.reuseRate[a.reusable]),
  };
}

// 항목 정의. fixed: 입력과 무관한 기본값이라 '가장 큰 항목' 후보에서 뺀다
export const ITEMS = [
  { key: "commute", category: "transport", label: "통학" },
  { key: "homeTrips", category: "transport", label: "장거리 이동" },
  { key: "flights", category: "transport", label: "항공" },
  { key: "electricity", category: "housing", label: "전기(조명·가전)" },
  { key: "cooling", category: "housing", label: "냉방" },
  { key: "heating", category: "housing", label: "난방" },
  { key: "hotWater", category: "housing", label: "온수·조리" },
  { key: "dietBase", category: "food", label: "기본 식단", fixed: true },
  { key: "meat", category: "food", label: "육류" },
  { key: "mealsOut", category: "food", label: "배달·외식" },
  { key: "clothes", category: "goods", label: "의류·잡화" },
  { key: "parcels", category: "goods", label: "택배" },
  { key: "disposables", category: "goods", label: "일회용품" },
];

// 값 ± 표준편차. 항목별 오차는 서로 독립이라 보고 제곱합의 제곱근으로 합친다
function withRange(items) {
  const value = items.reduce((s, i) => s + i.value, 0);
  const sd = Math.sqrt(items.reduce((s, i) => s + (i.value * i.u) ** 2, 0));
  return { value, low: Math.max(0, value - sd), high: value + sd };
}

export function calculate(answers) {
  const a = fillDefaults(answers);
  const values = itemValues(a);
  // basis: 'estimate'(간편 입력 대표값) — v0.2에서 자세히 입력한 항목은 'direct'가 된다
  const items = ITEMS.map((def) => ({ ...def, value: values[def.key], u: UNCERTAINTY[def.key], basis: "estimate" }));
  const byCategory = Object.fromEntries(
    CATEGORIES.map((c) => [c.key, withRange(items.filter((i) => i.category === c.key))])
  );
  return { items, byCategory, total: withRange(items) };
}

// 입력으로 바꿀 수 있는 항목 중 가장 큰 것
export const biggestItem = (result) =>
  result.items.filter((i) => !i.fixed).reduce((a, b) => (b.value > a.value ? b : a));
