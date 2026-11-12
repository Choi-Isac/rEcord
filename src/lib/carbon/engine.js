// 탄소발자국 계산 엔진: 원본 입력값(칩·슬라이더 선택 + 자세히 입력) → 항목별 연간 배출량(kg CO₂e)
// 화면과 분리해 두어 scripts/check-cases.mjs로 가상 이용자 사례를 손계산과 대조할 수 있다.
import {
  COMMUTE,
  COOL_LEVEL,
  DETAIL,
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
  UNCERTAINTY_DIRECT,
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
  commuteMode: ["subway"],
  homeTrips: "semester",
  flights: "none",
  housing: "family",
  household: 4,
  cooling: 3,
  heatingType: "unknown",
  heating: 3,
  meat: "mid",
  mealsOut: 4,
  clothes: 2,
  parcels: 5,
  reusable: "sometimes",
};

// 고른 통학 수단 목록 (2026-11-11 이전 응답은 수단 하나를 문자열로 저장)
export const modesOf = (v) => (Array.isArray(v) ? v : v ? [v] : []);

// 수단을 여러 개 고르면 같은 시간씩 탄다고 보고 속도를 평균한다 (고르지 않았으면 지하철)
export function commuteSpeed(modes) {
  const list = modesOf(modes).length ? modesOf(modes) : ["subway"];
  return list.reduce((s, m) => s + COMMUTE.speedKmh[m], 0) / list.length;
}
export const commuteKm = (modes, minutes) => (commuteSpeed(modes) * minutes) / 60;

// 2026-11-11 이전 자세히 입력: 냉난방(climate)이 한 문항이었고, 난방 방식은 거주 형태(housing)에 있었다.
// 지금 구조(냉방 cooling · 난방 heating · 거주 형태의 전기·가스 요금 housing)로 옮긴다
export function upgradeDetail(detail) {
  const { climate, ...d } = detail ?? {};
  if (d.housing && "heating" in d.housing) {
    const { heating, ...rest } = d.housing;
    if (Object.keys(rest).length) d.housing = rest;
    else delete d.housing;
  }
  if (climate) {
    if (!d.cooling) d.cooling = { coolHours: climate.coolHours, coolMonths: climate.coolMonths };
    if (!d.heating) d.heating = { heatHours: climate.heatHours, heatMonths: climate.heatMonths };
    if (!d.housing && (climate.elecBill > 0 || climate.gasBill > 0)) {
      const { elecBill, elecUnit, gasBill, gasUnit } = climate;
      d.housing = { elecBill, elecUnit, gasBill, gasUnit };
    }
  }
  return d;
}

// 슬라이더 최댓값("10개 이상" 등)은 대표값으로 바꿔 계산
export const clothesCount = (v) => (v >= GOODS.clothesMax ? GOODS.clothesOverflow : v);
export const parcelCount = (v) => (v >= GOODS.parcelsMax ? GOODS.parcelsOverflow : v);

// 가구 에너지 중 나의 몫
export const householdShare = (n) => (1 + EXTRA_PERSON_SHARE * (n - 1)) / n;

// 답하지 않은 항목(null)은 기준 예시 값으로 채운다. 동거 인원은 거주 형태의 기본 인원을 따른다
export function fillDefaults(answers) {
  const filled = { ...REFERENCE_ANSWERS };
  for (const [k, v] of Object.entries(answers)) if (v !== null && v !== undefined && !(Array.isArray(v) && !v.length)) filled[k] = v;
  if (answers.housing && answers.household == null) filled.household = HOUSING[answers.housing].defaultHousehold;
  return filled;
}

const sum = (obj) => Object.values(obj).reduce((s, v) => s + (Number(v) || 0), 0);

// 비율 입력(합이 100이 아닐 수도 있음)을 합 1로 맞춘다
function normalize(shares) {
  const total = sum(shares);
  return total > 0 ? Object.fromEntries(Object.entries(shares).map(([k, v]) => [k, (Number(v) || 0) / total])) : {};
}

// 간편 입력 항공 칩 → 거리대별 연간 왕복 횟수 (국내 위주 = 제주 왕복 2회)
export const flightCounts = (choice) =>
  Object.fromEntries(
    Object.keys(DETAIL.flightTripKm).map((k) => [k, k === choice ? FLIGHTS[k].pkm / DETAIL.flightTripKm[k] : 0])
  );

const gasHeated = (type) => type === "gas" || type === "unknown";

// 1단계: 간편 입력(answers)과 자세히 입력(detail)을 계산에 쓰는 구체적인 양으로 바꾼다.
// 자세히 입력이 있는 문항은 그 값이 간편 입력보다 우선한다. 감축 제안도 이 값을 바꿔 다시 계산한다.
export function resolve(answers, detail) {
  const a = fillDefaults(answers);
  // 2026-11-11 이전 응답은 난방 방식을 거주 형태의 자세히 입력에 담았다
  const heatingType = detail?.housing?.heating ?? a.heatingType;
  const d = upgradeDetail(detail);
  const h = HOUSING[a.housing];
  const people = d.household?.people ?? a.household;
  // 2명 이상이 나의 부담 비율을 넣으면 가구 전체 에너지 × 그 비율, 비우면 똑같이 나눈다
  const myShare = people >= 2 && d.household?.myShare > 0 ? d.household.myShare / 100 : null;
  const share = myShare !== null ? myShare * (1 + EXTRA_PERSON_SHARE * (people - 1)) : householdShare(people);
  const billShare = myShare ?? 1 / people;

  const days = d.commuteDays ? d.commuteDays.days.length : a.commuteDays;
  const md = d.commuteMode;
  const cool = d.cooling;
  const heat = d.heating;
  const bills = d.housing ?? {};
  const coolMult = cool ? (cool.coolHours * cool.coolMonths) / (DETAIL.coolRef.hours * DETAIL.coolRef.months) : COOL_LEVEL[a.cooling - 1];
  const heatMult = heat ? (heat.heatHours * heat.heatMonths) / (DETAIL.heatRef.hours * DETAIL.heatRef.months) : HEAT_LEVEL[a.heating - 1];

  // 요금·사용량을 직접 넣으면, 모형으로 구한 사용량을 그 값에 맞춰 비례 조정한다 (요금 중 나의 몫 = 부담 비율, 없으면 균등)
  let elecScale = 1;
  let gasScale = 1;
  if (bills.elecBill > 0) {
    const kwh = (bills.elecUnit === "kwh" ? bills.elecBill : bills.elecBill / DETAIL.wonPerKwh) * MONTHS_PER_YEAR * billShare;
    const modeled = (h.elec + h.cool * coolMult + (heatingType === "electric" ? h.heat * heatMult * DETAIL.kwhPerM3 : 0)) * share;
    elecScale = kwh / modeled;
  }
  if (bills.gasBill > 0) {
    const m3 = (bills.gasUnit === "m3" ? bills.gasBill : bills.gasBill / DETAIL.wonPerM3) * MONTHS_PER_YEAR * billShare;
    const modeled = (h.hot + (gasHeated(heatingType) ? h.heat * heatMult : 0)) * share;
    gasScale = m3 / modeled;
  }

  const meals = d.mealsOut ?? {
    out: a.mealsOut * (1 - GOODS.deliveryShare),
    delivery: a.mealsOut * GOODS.deliveryShare,
  };
  const reuse = GOODS.reuseRate[a.reusable];

  return {
    commute: {
      trips: days * 2 * COMMUTE.weeksPerYear,
      km: d.commuteMinutes?.km ?? commuteKm(a.commuteMode, a.commuteMinutes),
      // 간편 입력: 고른 수단을 같은 시간씩 탄다고 본다
      shares: md ? normalize(md.shares) : Object.fromEntries(modesOf(a.commuteMode).map((m, _, all) => [m, 1 / all.length])),
      taxiTrips: md ? md.taxiPerMonth * DETAIL.semesterMonths : 0,
      carFactor: md ? DETAIL.carFuel[md.fuel] : 1,
    },
    homeTrips: {
      perYear: d.homeTrips?.perYear ?? HOME_TRIPS.roundTripsPerYear[a.homeTrips],
      pkm: DETAIL.homeTripPkm[d.homeTrips?.mode ?? "mixed"],
    },
    flights: d.flights ?? flightCounts(a.flights),
    housing: a.housing,
    share,
    heatingType,
    coolMult,
    heatMult,
    elecScale,
    gasScale,
    meat: d.meat ?? Object.fromEntries(Object.entries(DETAIL.meatMix).map(([k, f]) => [k, f * FOOD.servingsPerWeek[a.meat]])),
    meals,
    clothes: { perMonth: d.clothes?.perMonth ?? clothesCount(a.clothes), secondhand: (d.clothes?.secondhand ?? 0) / 100 },
    // 택배: 자세히 입력하면 국내 택배와 해외직구를 나눠 받는다
    parcels: d.parcels
      ? { domestic: d.parcels.domestic ?? 0, overseas: d.parcels.overseas ?? 0 }
      : { domestic: parcelCount(a.parcels), overseas: 0 },
    disposables: {
      drinks: d.reusable?.drinks ?? GOODS.cupsPerWeek,
      tumbler: d.reusable ? d.reusable.tumbler / 100 : reuse,
      deliveryReuse: d.reusable ? d.reusable.deliveryReuse / 100 : reuse,
    },
    // 직접 입력한 값으로 계산한 항목 (결과의 '직접 입력' 표시와 범위 계산에 쓴다)
    direct: new Set(
      [
        (d.commuteDays || d.commuteMinutes || d.commuteMode) && "commute",
        d.homeTrips && "homeTrips",
        d.flights && "flights",
        bills.elecBill > 0 && "electricity",
        cool && "cooling",
        heat && "heating",
        bills.gasBill > 0 && "hotWater",
        d.meat && "meat",
        d.mealsOut && "mealsOut",
        d.clothes && "clothes",
        d.parcels && "parcels",
        d.reusable && "disposables",
      ].filter(Boolean)
    ),
  };
}

// 2단계: 구체적인 양 → 항목별 연간 배출량(kg CO₂e)
function itemValues(r) {
  const h = HOUSING[r.housing];
  const c = r.commute;
  const taxi = Math.min(c.taxiTrips, c.trips);
  const perKm = Object.entries(c.shares).reduce((s, [m, f]) => s + f * COMMUTE.pkm[m] * (m === "car" ? c.carFactor : 1), 0);
  const heatScale = r.heatingType === "electric" ? r.elecScale : gasHeated(r.heatingType) ? r.gasScale : 1;
  const mealsOverhead = Object.entries(r.meals).reduce((s, [place, n]) => s + n * DETAIL.mealOverhead[place], 0);
  const dp = r.disposables;

  return {
    commute: c.km * (taxi * COMMUTE.pkm.taxi + (c.trips - taxi) * perKm),
    homeTrips: r.homeTrips.perYear * HOME_TRIPS.roundTripKm * r.homeTrips.pkm,
    flights: Object.entries(r.flights).reduce((s, [k, n]) => s + n * DETAIL.flightTripKm[k] * FLIGHTS[k].ef, 0),

    electricity: h.elec * EF.electricity * r.share * r.elecScale,
    cooling: h.cool * r.coolMult * EF.electricity * r.share * r.elecScale,
    heating: h.heat * r.heatMult * DETAIL.heatingEf[r.heatingType] * r.share * heatScale,
    hotWater: h.hot * EF.gas * r.share * r.gasScale,

    dietBase: FOOD.base,
    meat: Object.entries(r.meat).reduce((s, [k, n]) => s + n * DETAIL.meatServing[k], 0) * WEEKS_PER_YEAR,
    mealsOut: mealsOverhead * WEEKS_PER_YEAR,

    clothes:
      r.clothes.perMonth * MONTHS_PER_YEAR * GOODS.clothingItem * (1 - r.clothes.secondhand * (1 - DETAIL.secondhandFactor)),
    parcels: (r.parcels.domestic * GOODS.parcel + r.parcels.overseas * DETAIL.overseasParcel) * MONTHS_PER_YEAR,
    disposables:
      (dp.drinks * GOODS.cup * (1 - dp.tumbler) + (r.meals.delivery ?? 0) * GOODS.container * (1 - dp.deliveryReuse)) *
      WEEKS_PER_YEAR,
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

// resolve()로 구한 양으로 계산. basis: 'estimate'(간편 입력 대표값) / 'direct'(자세히 입력한 값)
export function calculateResolved(r) {
  const values = itemValues(r);
  const items = ITEMS.map((def) => {
    const direct = r.direct.has(def.key);
    return {
      ...def,
      value: values[def.key],
      u: (direct ? UNCERTAINTY_DIRECT : UNCERTAINTY)[def.key],
      basis: direct ? "direct" : "estimate",
    };
  });
  const byCategory = Object.fromEntries(
    CATEGORIES.map((c) => [c.key, withRange(items.filter((i) => i.category === c.key))])
  );
  return { items, byCategory, total: withRange(items) };
}

export const calculate = (answers, detail) => calculateResolved(resolve(answers, detail));

// 입력으로 바꿀 수 있는 항목 중 가장 큰 것
export const biggestItem = (result) =>
  result.items.filter((i) => !i.fixed).reduce((a, b) => (b.value > a.value ? b : a));
