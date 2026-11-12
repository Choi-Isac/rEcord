// 자세히 입력 (v0.2): 간편 입력 문항마다 펼쳐서 정확한 값을 넣는다 (README '입력 데이터 항목'의 [자세히])
//
// 규칙
// - 펼치면 간편 입력값으로 정한 기본값이 보인다. 값을 하나라도 바꾸면 그 문항의 자세히 입력이 저장되고,
//   계산에서 간편 입력값보다 우선한다. replaces: false면 간편 입력에 더해지고(거주 형태의 전기·가스 요금),
//   배열이면 그 답만 대신한다(난방은 시간만 대신하고 난방 방식은 간편 입력 그대로).
// - '간편 입력으로 되돌리기'를 누르면 그 문항의 자세히 입력을 지운다.
// - 간편 입력으로 나타낼 수 있는 문항(toSimple)은 자세히 입력한 값을 가장 가까운 간편 입력 칸에도 반영한다.
//   계산은 자세히 입력으로 하고, 간편 입력 칸은 화면 표시와 '간편 입력만으로 계산한 값' 비교에 쓴다.
import { clothesCount, commuteKm, commuteSpeed, flightCounts, modesOf, parcelCount } from "./engine.js";
import { CLIMATE_HOURS, COMMUTE, COOL_LEVEL, DETAIL, FOOD, GOODS, HEAT_LEVEL, HOME_TRIPS } from "./factors.js";
import { COMMUTE_MINUTE_STEPS, hasValue } from "./questions.js";

export const WEEKDAYS = ["월", "화", "수", "목", "금", "토", "일"];

const MODE_OPTIONS = [
  { value: "walk", label: "도보", icon: "🚶" },
  { value: "bike", label: "자전거·킥보드", icon: "🚲" },
  { value: "bus", label: "버스", icon: "🚌" },
  { value: "subway", label: "지하철", icon: "🚇" },
  { value: "car", label: "자가용", icon: "🚗" },
  { value: "moto", label: "오토바이", icon: "🛵" },
];

// 부동소수 오차(14.700000000000001) 없이 step 단위로 반올림
const round = (v, step) => Number((Math.round(v / step) * step).toFixed(2));

// 합계를 지키면서 step 단위로 나눈다 (최대 나머지 방식)
function splitRounded(total, weights, step) {
  const units = Math.round(total / step);
  const raw = Object.entries(weights).map(([k, w]) => ({ k, exact: units * w }));
  raw.forEach((r) => (r.n = Math.floor(r.exact)));
  let left = units - raw.reduce((s, r) => s + r.n, 0);
  [...raw].sort((x, y) => (y.exact % 1) - (x.exact % 1)).forEach((r) => left-- > 0 && r.n++);
  return Object.fromEntries(raw.map((r) => [r.k, r.n * step]));
}

// 주 N일 → 월요일부터 N일
const firstDays = (n) => Array.from({ length: n }, (_, i) => i);

// 간편 입력 반영용: 값이 가장 가까운 칸
const nearestKey = (obj, v) => Object.keys(obj).reduce((best, k) => (Math.abs(obj[k] - v) < Math.abs(obj[best] - v) ? k : best));
const nearestIndex = (list, v) => list.reduce((best, x, i) => (Math.abs(x - v) < Math.abs(list[best] - v) ? i : best), 0);
const cap = (v, max) => Math.min(max, Math.max(0, Math.round(v)));

export const DETAILS = {
  commuteDays: {
    intro: "학교에 가는 요일을 모두 골라 주세요.",
    fields: [{ key: "days", type: "days" }],
    defaults: (a) => ({ days: firstDays(a.commuteDays) }),
    toSimple: (v) => ({ commuteDays: v.days.length }),
    summary: (v) => (v.days.length ? v.days.map((d) => WEEKDAYS[d]).join("·") : "통학 안 함"),
  },
  commuteMinutes: {
    intro: "지도 앱 경로의 편도 거리를 넣으면 가장 정확해요.",
    fields: [{ key: "km", type: "number", label: "통학 편도 거리", unit: "km", min: 0, max: 200, step: 0.1 }],
    defaults: (a) => ({ km: round(commuteKm(a.commuteMode, a.commuteMinutes), 0.1) }),
    // 거리 ÷ 수단 속도(여러 수단이면 평균) → 가장 가까운 슬라이더 칸
    toSimple: (v, a) => ({
      commuteMinutes: COMMUTE_MINUTE_STEPS[nearestIndex(COMMUTE_MINUTE_STEPS, (v.km / commuteSpeed(a.commuteMode)) * 60)],
    }),
    summary: (v) => `편도 ${v.km}km`,
  },
  commuteMode: {
    intro: "여러 수단을 섞어 타면 비율로 나눠 주세요. 택시는 비율 대신 한 달 이용 횟수로 적어요.",
    fields: [
      { key: "shares", type: "shares", label: "수단별 비율", options: MODE_OPTIONS },
      {
        key: "fuel",
        type: "choice",
        label: "자가용 연료",
        options: [
          { value: "gasoline", label: "휘발유" },
          { value: "diesel", label: "경유" },
          { value: "lpg", label: "LPG" },
          { value: "hybrid", label: "하이브리드" },
          { value: "ev", label: "전기차" },
        ],
        showIf: (v) => (v.shares.car ?? 0) > 0,
      },
      { key: "taxiPerMonth", type: "number", label: "택시로 통학 (한 달, 편도 1회 기준)", unit: "회", min: 0, max: 200, step: 1 },
    ],
    // 고른 수단을 똑같이 나눈다. 택시는 비율 대신, 한 달 통학 횟수(주 일수 × 왕복 2회 × 4주) 중 그 몫을 월 횟수로
    defaults: (a) => {
      const modes = modesOf(a.commuteMode);
      const others = modes.filter((m) => m !== "taxi");
      return {
        shares: others.length ? splitRounded(100, Object.fromEntries(others.map((m) => [m, 1 / others.length])), 1) : { subway: 100 },
        fuel: "gasoline",
        taxiPerMonth: modes.includes("taxi") ? Math.round((a.commuteDays * 2 * 4) / modes.length) : 0,
      };
    },
    // 비중이 있는 수단을 모두 고른다 (택시는 월 횟수를 학기 중 한 달 통학 횟수에 대한 비율로)
    toSimple: (v, a) => {
      const monthly = a.commuteDays * 2 * 4;
      const taxi = monthly > 0 ? Math.min(1, v.taxiPerMonth / monthly) : 0;
      const total = Object.values(v.shares).reduce((s, x) => s + (Number(x) || 0), 0);
      const weights = { taxi };
      for (const [m, x] of Object.entries(v.shares)) weights[m] = total ? ((Number(x) || 0) / total) * (1 - taxi) : 0;
      const modes = Object.keys(COMMUTE.speedKmh).filter((m) => weights[m] > 0);
      return modes.length ? { commuteMode: modes } : {};
    },
    summary: (v) =>
      [
        ...MODE_OPTIONS.filter((o) => v.shares[o.value] > 0).map((o) => `${o.label} ${v.shares[o.value]}%`),
        v.taxiPerMonth > 0 && `택시 월 ${v.taxiPerMonth}회`,
      ]
        .filter(Boolean)
        .join(" · "),
  },
  homeTrips: {
    intro: "기차·버스·자가용으로 본가나 다른 도시에 다녀온 왕복 횟수예요.",
    fields: [
      { key: "perYear", type: "number", label: "1년 동안 왕복 횟수", unit: "회", min: 0, max: 200, step: 1 },
      {
        key: "mode",
        type: "choice",
        label: "주로 타는 수단",
        options: [
          { value: "mixed", label: "기차·버스 섞어서" },
          { value: "train", label: "기차" },
          { value: "bus", label: "고속·시외버스" },
          { value: "car", label: "자가용" },
        ],
      },
    ],
    defaults: (a) => ({ perYear: HOME_TRIPS.roundTripsPerYear[a.homeTrips], mode: "mixed" }),
    toSimple: (v) => ({ homeTrips: nearestKey(HOME_TRIPS.roundTripsPerYear, v.perYear) }),
    summary: (v) => `연 ${v.perYear}회 왕복`,
  },
  flights: {
    intro: "최근 1년 동안 탄 왕복 횟수를 거리대별로 적어 주세요.",
    fields: [
      { key: "domestic", type: "number", label: "국내선 (제주 등)", unit: "회", min: 0, max: 30, step: 1 },
      { key: "asia", type: "number", label: "아시아 (도쿄·방콕 등)", unit: "회", min: 0, max: 30, step: 1 },
      { key: "long", type: "number", label: "장거리 (유럽·미주)", unit: "회", min: 0, max: 30, step: 1 },
    ],
    defaults: (a) => flightCounts(a.flights),
    // 가장 먼 거리대
    toSimple: (v) => ({ flights: v.long > 0 ? "long" : v.asia > 0 ? "asia" : v.domestic > 0 ? "domestic" : "none" }),
    summary: (v) => `왕복 ${v.domestic + v.asia + v.long}회`,
  },
  housing: {
    replaces: false,
    intro: "전기·가스 요금을 직접 낸다면 고지서의 월평균 값을 넣어 주세요. 전기·냉난방·온수 항목을 그 사용량에 맞춰 계산해요.",
    fields: [
      {
        key: "elecBill",
        type: "bill",
        label: "월평균 전기",
        unitKey: "elecUnit",
        units: [
          { value: "won", label: "원" },
          { value: "kwh", label: "kWh" },
        ],
        optional: true,
      },
      {
        key: "gasBill",
        type: "bill",
        label: "월평균 가스",
        unitKey: "gasUnit",
        units: [
          { value: "won", label: "원" },
          { value: "m3", label: "m³" },
        ],
        optional: true,
      },
    ],
    defaults: () => ({ elecBill: null, elecUnit: "won", gasBill: null, gasUnit: "won" }),
    summary: (v) =>
      [
        v.elecBill > 0 && `전기 월 ${v.elecBill.toLocaleString("ko-KR")}${v.elecUnit === "kwh" ? "kWh" : "원"}`,
        v.gasBill > 0 && `가스 월 ${v.gasBill.toLocaleString("ko-KR")}${v.gasUnit === "m3" ? "m³" : "원"}`,
      ]
        .filter(Boolean)
        .join(" · ") || "요금 입력 안 함",
  },
  household: {
    intro: "4명 이상이면 정확한 인원을 적어 주세요. 2명 이상이면 집 전기·가스 중 내가 쓰는(내는) 비율도 넣을 수 있어요.",
    fields: [
      { key: "people", type: "number", label: "함께 사는 인원 (나 포함)", unit: "명", min: 1, max: 30, step: 1 },
      {
        key: "myShare",
        type: "number",
        label: "나의 부담 비율 (비우면 똑같이 나눔)",
        unit: "%",
        min: 1,
        max: 100,
        step: 1,
        optional: true,
        placeholder: (v) => `${Math.round(100 / v.people)}`,
        showIf: (v) => v.people >= 2,
      },
    ],
    defaults: (a) => ({ people: a.household, myShare: null }),
    toSimple: (v) => ({ household: Math.min(4, Math.max(1, v.people)) }),
    summary: (v) => `${v.people}명${v.people >= 2 && v.myShare ? ` · 내 몫 ${v.myShare}%` : ""}`,
  },
  cooling: {
    intro: "에어컨을 켜는 날의 하루 평균 시간과, 1년 중 켜는 기간을 적어 주세요.",
    fields: [
      { key: "coolHours", type: "number", label: "하루 사용 시간", unit: "시간", min: 0, max: 24, step: 0.5 },
      { key: "coolMonths", type: "number", label: "사용하는 기간", unit: "개월", min: 0, max: 12, step: 1 },
    ],
    defaults: (a) => ({ coolHours: CLIMATE_HOURS[a.cooling - 1], coolMonths: DETAIL.coolRef.months }),
    // 시간 × 기간 배수와 가장 가까운 칸
    toSimple: (v) => ({
      cooling: nearestIndex(COOL_LEVEL, (v.coolHours * v.coolMonths) / (DETAIL.coolRef.hours * DETAIL.coolRef.months)) + 1,
    }),
    summary: (v) => `하루 ${v.coolHours}시간 × ${v.coolMonths}개월`,
  },
  heating: {
    replaces: ["heating"], // 난방 시간만 대신한다 (난방 방식은 간편 입력 그대로)
    intro: "난방을 켜는 날의 하루 평균 시간과, 1년 중 켜는 기간을 적어 주세요.",
    fields: [
      { key: "heatHours", type: "number", label: "하루 사용 시간", unit: "시간", min: 0, max: 24, step: 0.5 },
      { key: "heatMonths", type: "number", label: "사용하는 기간", unit: "개월", min: 0, max: 12, step: 1 },
    ],
    defaults: (a) => ({ heatHours: CLIMATE_HOURS[a.heating - 1], heatMonths: DETAIL.heatRef.months }),
    toSimple: (v) => ({
      heating: nearestIndex(HEAT_LEVEL, (v.heatHours * v.heatMonths) / (DETAIL.heatRef.hours * DETAIL.heatRef.months)) + 1,
    }),
    summary: (v) => `하루 ${v.heatHours}시간 × ${v.heatMonths}개월`,
  },
  meat: {
    intro: "1회 = 1인분(약 120g)이에요. 소고기는 같은 양의 닭고기보다 배출이 약 5배예요.",
    fields: [
      { key: "beef", type: "number", label: "🐄 소고기", unit: "회/주", min: 0, max: 21, step: 0.5 },
      { key: "pork", type: "number", label: "🐖 돼지고기", unit: "회/주", min: 0, max: 21, step: 0.5 },
      { key: "chicken", type: "number", label: "🐔 닭고기", unit: "회/주", min: 0, max: 21, step: 0.5 },
      { key: "fish", type: "number", label: "🐟 생선·해산물", unit: "회/주", min: 0, max: 21, step: 0.5 },
    ],
    defaults: (a) => ({
      ...splitRounded(FOOD.servingsPerWeek[a.meat], { beef: 0.2, pork: 0.45, chicken: 0.35 }, 0.5),
      fish: 0,
    }),
    // 간편 문항은 소·돼지·닭만 묻는다 (생선 제외)
    toSimple: (v) => ({ meat: nearestKey(FOOD.servingsPerWeek, v.beef + v.pork + v.chicken) }),
    summary: (v) => `주 ${v.beef + v.pork + v.chicken + v.fish}회`,
  },
  mealsOut: {
    intro: "일주일 끼니를 장소별로 나눠 주세요. 합계가 21끼를 넘지 않게요.",
    fields: [
      { key: "campus", type: "number", label: "🏫 학식", unit: "끼", min: 0, max: 21, step: 1 },
      { key: "out", type: "number", label: "🍽️ 외식", unit: "끼", min: 0, max: 21, step: 1 },
      { key: "delivery", type: "number", label: "🛵 배달", unit: "끼", min: 0, max: 21, step: 1 },
      { key: "convenience", type: "number", label: "🏪 편의점", unit: "끼", min: 0, max: 21, step: 1 },
      { key: "cook", type: "number", label: "🍳 직접 조리", unit: "끼", min: 0, max: 21, step: 1 },
      { type: "total", keys: ["campus", "out", "delivery", "convenience", "cook"], unit: "끼", max: 21 },
    ],
    defaults: (a) => ({
      campus: 0,
      out: Math.ceil(a.mealsOut * (1 - GOODS.deliveryShare)),
      delivery: Math.floor(a.mealsOut * GOODS.deliveryShare),
      convenience: 0,
      cook: 0,
    }),
    toSimple: (v) => ({ mealsOut: cap(v.out + v.delivery, 14) }),
    summary: (v) => `배달 ${v.delivery} · 외식 ${v.out}끼/주`,
  },
  clothes: {
    intro: "중고로 산 것도 개수에 넣고, 그 비율을 따로 알려 주세요.",
    fields: [
      { key: "perMonth", type: "number", label: "옷·신발·가방 구매", unit: "개/월", min: 0, max: 100, step: 1 },
      { key: "secondhand", type: "percent", label: "그중 중고 비율" },
    ],
    defaults: (a) => ({ perMonth: clothesCount(a.clothes), secondhand: 0 }),
    toSimple: (v) => ({ clothes: cap(v.perMonth, 10) }),
    summary: (v) => `월 ${v.perMonth}개 · 중고 ${v.secondhand}%`,
  },
  parcels: {
    intro: "한 달에 받는 택배를 국내 배송과 해외직구로 나눠 적어 주세요. 해외직구는 국제 운송 때문에 1건당 배출이 더 커요.",
    fields: [
      { key: "domestic", type: "number", label: "📦 국내 택배", unit: "건/월", min: 0, max: 300, step: 1 },
      { key: "overseas", type: "number", label: "✈️ 해외직구", unit: "건/월", min: 0, max: 100, step: 1 },
      { type: "total", keys: ["domestic", "overseas"], unit: "건" },
    ],
    defaults: (a) => ({ domestic: parcelCount(a.parcels), overseas: 0 }),
    toSimple: (v) => ({ parcels: cap(v.domestic + v.overseas, 20) }),
    summary: (v) => `국내 ${v.domestic} · 해외직구 ${v.overseas}건/월`,
  },
  reusable: {
    intro: "테이크아웃 음료와 배달 주문 때 일회용품을 얼마나 피하는지 적어 주세요.",
    fields: [
      { key: "drinks", type: "number", label: "테이크아웃 음료", unit: "잔/주", min: 0, max: 60, step: 1 },
      { key: "tumbler", type: "percent", label: "그중 텀블러에 받는 비율" },
      { key: "deliveryReuse", type: "percent", label: "배달 주문 때 다회용기를 고르는 비율" },
    ],
    defaults: (a) => {
      const rate = Math.round(GOODS.reuseRate[a.reusable] * 100);
      return { drinks: GOODS.cupsPerWeek, tumbler: rate, deliveryReuse: rate };
    },
    toSimple: (v) => ({ reusable: nearestKey(GOODS.reuseRate, (v.tumbler + v.deliveryReuse) / 200) }),
    summary: (v) => `음료 주 ${v.drinks}잔 · 텀블러 ${v.tumbler}%`,
  },
};

export const hasDetail = (q) => Boolean(DETAILS[q.id]);

// 자세히 입력한 값을 간편 입력 칸에 반영한다. 통학 수단을 먼저 정해야 통학 시간(거리 ÷ 속도)을 구할 수 있다
const SYNC_ORDER = ["commuteDays", "commuteMode", ...Object.keys(DETAILS).filter((k) => k !== "commuteDays" && k !== "commuteMode")];
export function syncSimple(answers, detail) {
  const a = { ...answers };
  for (const id of SYNC_ORDER) if (detail?.[id] && DETAILS[id].toSimple) Object.assign(a, DETAILS[id].toSimple(detail[id], a));
  return a;
}

// 자세히 입력을 펼칠 수 있는가: 칩 문항은 먼저 골라야 그 답으로 기본값을 정할 수 있다
export const canExpand = (q, answers) => hasDetail(q) && (q.type !== "chips" || hasValue(answers[q.id]));

// 화면에 보여 줄 값: 저장된 자세히 입력, 없으면 간편 입력으로 정한 기본값
export const detailValues = (q, answers, detail) => detail?.[q.id] ?? DETAILS[q.id].defaults(answers);

// 필수 숫자 칸을 비운 채 두면 기본값으로 되돌린다
export function fillBlank(q, answers, values) {
  const defaults = DETAILS[q.id].defaults(answers);
  const out = { ...values };
  for (const f of DETAILS[q.id].fields) if (f.key && !f.optional && (out[f.key] === null || out[f.key] === "")) out[f.key] = defaults[f.key];
  return out;
}
