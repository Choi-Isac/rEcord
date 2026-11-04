// 계산 엔진 검증: 가상 이용자 사례(간편 입력 4개, 자세히 입력 3개)를 손계산 값과 대조하고,
// 자세히 입력이 간편 입력 칸에 맞게 반영되는지 확인한다
// 실행: npm run check
// 배출계수(src/lib/carbon/factors.js)를 바꾸면 아래 손계산도 함께 고쳐야 한다.
import { calculate } from "../src/lib/carbon/engine.js";
import { syncSimple } from "../src/lib/carbon/details.js";

const CASES = [
  {
    name: "A. 기준 예시 — 본가 4인, 지하철 40분 주 4일",
    answers: {
      commuteDays: 4, commuteMinutes: 40, commuteMode: "subway", homeTrips: "semester", flights: "none",
      housing: "family", household: 4, cooling: 3, heating: 3,
      meat: "mid", mealsOut: 4, clothes: 2, parcels: 5, reusable: "sometimes",
    },
    // 이동: 4일×2×(22×40/60=14.667km)×0.03×32주 = 112.64 / 장거리 3회×300km×0.035 = 31.5 / 항공 0
    // 주거: (2000×0.4781 + 400×0.4781 + 380×2.22 + 120×2.22) × (1.75/4) = 2257.44 × 0.4375 = 987.63
    // 식생활: 1100 + 4×52×1.6 + 4×52×0.3 = 1100 + 332.8 + 62.4 = 1495.2
    // 소비: 2×12×12 + 5×12×0.8 + (5×0.04 + 4×0.5×0.25)×52×0.6 = 288 + 48 + 21.84 = 357.84
    expected: { transport: 144.14, housing: 987.63, food: 1495.2, goods: 357.84 },
  },
  {
    name: "B. 자취 1인, 버스 25분 주 5일, 아시아 여행, 고기 매일",
    answers: {
      commuteDays: 5, commuteMinutes: 25, commuteMode: "bus", homeTrips: "monthly", flights: "asia",
      housing: "alone", household: 1, cooling: 4, heating: 2,
      meat: "daily", mealsOut: 10, clothes: 5, parcels: 15, reusable: "rarely",
    },
    // 이동: 5×2×6.25km×0.065×32 = 130 / 18회×300×0.035 = 189 / 5000×0.13 = 650
    // 주거: 1450×0.4781 + 350×1.5×0.4781 + 220×0.75×2.22 + 80×2.22 = 693.25 + 251.0 + 366.3 + 177.6 = 1488.15
    // 식생활: 1100 + 10×52×1.6 + 10×52×0.3 = 1100 + 832 + 156 = 2088
    // 소비: 5×144 + 15×9.6 + (0.2 + 10×0.5×0.25)×52×0.95 = 720 + 144 + 71.63 = 935.63
    expected: { transport: 969, housing: 1488.15, food: 2088, goods: 935.63 },
  },
  {
    name: "C. 기숙사 2인, 도보 10분 매일, 장거리 해외여행, 고기 거의 안 먹음",
    answers: {
      commuteDays: 7, commuteMinutes: 10, commuteMode: "walk", homeTrips: "none", flights: "long",
      housing: "dorm", household: 2, cooling: 2, heating: 3,
      meat: "rare", mealsOut: 1, clothes: 0, parcels: 2, reusable: "often",
    },
    // 이동: 도보 0 / 0 / 18000×0.12 = 2160
    // 주거: (1100×0.4781 + 300×0.6×0.4781 + 180×2.22 + 70×2.22) × (1.25/2) = 1166.97 × 0.625 = 729.35
    // 식생활: 1100 + 0.5×52×1.6 + 1×52×0.3 = 1100 + 41.6 + 15.6 = 1157.2
    // 소비: 0 + 2×9.6 + (0.2 + 1×0.5×0.25)×52×0.2 = 19.2 + 3.38 = 22.58
    expected: { transport: 2160, housing: 729.35, food: 1157.2, goods: 22.58 },
  },
  {
    name: "D. 하숙 1인, 비대면 수업(통학 0일), 주 2회 이상 귀가, 슬라이더 최댓값",
    answers: {
      commuteDays: 0, commuteMinutes: 40, commuteMode: null, homeTrips: "twicePlus", flights: "none",
      housing: "boarding", household: 1, cooling: 5, heating: 5,
      meat: "low", mealsOut: 14, clothes: 10, parcels: 20, reusable: "sometimes",
    },
    // 이동: 0 / 80×300×0.035 = 840 / 0
    // 주거: 900×0.4781 + 300×2.1×0.4781 + 100×1.65×2.22 + 50×2.22 = 430.29 + 301.2 + 366.3 + 111 = 1208.79
    // 식생활: 1100 + 1.5×52×1.6 + 14×52×0.3 = 1100 + 124.8 + 218.4 = 1443.2
    // 소비: "10개 이상"=12 → 12×144 = 1728 / "20건 이상"=24 → 24×9.6 = 230.4 / (0.2 + 14×0.5×0.25)×52×0.6 = 60.84 → 2019.24
    expected: { transport: 840, housing: 1208.79, food: 1443.2, goods: 2019.24 },
  },

  // ── 자세히 입력 (v0.2): 자세히 입력한 값이 간편 입력보다 우선한다
  {
    name: "E. A + 모든 문항 자세히 입력 (버스·지하철 반반 + 택시, 지역난방, 전기요금)",
    answers: {
      commuteDays: 4, commuteMinutes: 40, commuteMode: "subway", homeTrips: "semester", flights: "none",
      housing: "family", household: 4, cooling: 3, heating: 3,
      meat: "mid", mealsOut: 4, clothes: 2, parcels: 5, reusable: "sometimes",
    },
    detail: {
      commuteDays: { days: [0, 2, 4] },
      commuteMinutes: { km: 12 },
      commuteMode: { shares: { bus: 50, subway: 50 }, fuel: "gasoline", taxiPerMonth: 4 },
      homeTrips: { perYear: 6, mode: "train" },
      flights: { domestic: 1, asia: 1, long: 0 },
      housing: { heating: "district" },
      household: { people: 5 },
      climate: { coolHours: 4, coolMonths: 3, heatHours: 6, heatMonths: 4, elecBill: 60000, elecUnit: "won", gasBill: null, gasUnit: "won" },
      meat: { beef: 1, pork: 2, chicken: 2, fish: 1 },
      mealsOut: { campus: 5, out: 2, delivery: 3, convenience: 2, cook: 4 },
      clothes: { perMonth: 3, secondhand: 50 },
      parcels: { domestic: 25, overseas: 5 },
      reusable: { drinks: 7, tumbler: 50, deliveryReuse: 0 },
    },
    // 이동: 3일×2×32 = 192회 중 택시 4×8 = 32회 → 12km × (32×0.21 + 160×(0.5×0.065 + 0.5×0.03)) = 171.84
    //       장거리 6×300×0.03 = 54 / 항공 900×0.2 + 5000×0.13 = 830 → 1055.84
    // 주거: 5명 → 나의 몫 (1 + 0.25×4)/5 = 0.4, 냉방 배수 4×3/18, 난방 배수 6×4/32 = 0.75
    //       전기요금 60000원 ÷ 160 × 12 ÷ 5명 = 900kWh → 전기+냉방 = 900 × 0.4781 = 430.29
    //       난방(지역) 380×0.75×(0.75×2.22)×0.4 = 189.81 / 온수 120×2.22×0.4 = 106.56 → 726.66
    // 식생활: 1100 + (3.9 + 2×1.2 + 2×0.8 + 0.7)×52 + (5×0.05 + 2×0.3 + 3×0.3 + 2×0.25)×52 = 1100 + 447.2 + 117 = 1664.2
    // 소비: 3×12×12×(1 − 0.5×0.9) = 237.6 / 택배 (국내 25×0.8 + 해외직구 5×2)×12 = 360 / (7×0.04×0.5 + 3×0.25)×52 = 46.28 → 643.88
    expected: { transport: 1055.84, housing: 726.66, food: 1664.2, goods: 643.88 },
  },
  {
    name: "F. B + 냉난방·난방 방식만 자세히 입력 (전기 난방, 전기 kWh·가스 요금)",
    answers: {
      commuteDays: 5, commuteMinutes: 25, commuteMode: "bus", homeTrips: "monthly", flights: "asia",
      housing: "alone", household: 1, cooling: 4, heating: 2,
      meat: "daily", mealsOut: 10, clothes: 5, parcels: 15, reusable: "rarely",
    },
    detail: {
      housing: { heating: "electric" },
      climate: { coolHours: 9, coolMonths: 3, heatHours: 6, heatMonths: 4, elecBill: 300, elecUnit: "kwh", gasBill: 20000, gasUnit: "won" },
    },
    // 주거: 전기 300kWh × 12 = 3600kWh가 전기+냉방+전기 난방 → 3600 × 0.4781 = 1721.16
    //       가스 20000원 ÷ 1100 × 12 = 218.18m³가 온수·조리(가스 난방 아님) → 218.18 × 2.22 = 484.36 → 2205.52
    // 나머지 영역은 B와 같다
    expected: { transport: 969, housing: 2205.52, food: 2088, goods: 935.63 },
  },
  {
    name: "G. A + 동거 3명 중 나의 부담 50%, 전기요금 90000원",
    answers: {
      commuteDays: 4, commuteMinutes: 40, commuteMode: "subway", homeTrips: "semester", flights: "none",
      housing: "family", household: 4, cooling: 3, heating: 3,
      meat: "mid", mealsOut: 4, clothes: 2, parcels: 5, reusable: "sometimes",
    },
    detail: {
      household: { people: 3, myShare: 50 },
      climate: { coolHours: 6, coolMonths: 3, heatHours: 8, heatMonths: 4, elecBill: 90000, elecUnit: "won", gasBill: null, gasUnit: "won" },
    },
    // 주거: 가구 에너지 배수 1 + 0.25×2 = 1.5 → 나의 몫 0.5 × 1.5 = 0.75 (냉난방은 '보통'과 같은 시간이라 배수 1)
    //       전기 90000원 ÷ 160 × 12 × 50% = 3375kWh → 3375 × 0.4781 = 1613.59
    //       난방 380×2.22×0.75 = 632.7 / 온수 120×2.22×0.75 = 199.8 → 2446.09
    // 나머지 영역은 A와 같다
    expected: { transport: 144.14, housing: 2446.09, food: 1495.2, goods: 357.84 },
  },
];

// 자세히 입력 → 간편 입력 칸 반영 (사례 E의 자세히 입력)
const SYNC_EXPECTED = {
  commuteDays: 3, // 월·수·금
  commuteMode: "bus", // 택시 4/24회 = 17%, 버스·지하철 각 42% → 같으면 먼저 나온 버스
  commuteMinutes: 50, // 12km ÷ 버스 15km/h = 48분 → 가장 가까운 칸 50분
  homeTrips: "semester", // 연 6회 → 3회(학기당)가 18회(월 1~2회)보다 가까움
  flights: "asia", // 가장 먼 거리대
  household: 4, // 5명 → '4명 이상'
  cooling: 2, // 4시간×3개월 / (6×3) = 0.67 → 단계 배수 0.6
  heating: 2, // 6시간×4개월 / (8×4) = 0.75
  meat: "mid", // 소·돼지·닭 주 5회 → 4회(주 3~5회)
  mealsOut: 5, // 외식 2 + 배달 3
  clothes: 3,
  parcels: 20, // 국내 25 + 해외직구 5 = 30건 → '20건 이상'
  reusable: "sometimes", // (50% + 0%) / 2 = 25% → 40%(가끔)가 5%(거의 안 씀)보다 가까움
};

const TOLERANCE = 0.5; // kg, 손계산 반올림 허용 오차
let failed = 0;

for (const c of CASES) {
  const r = calculate(c.answers, c.detail);
  console.log(`\n${c.name}`);
  for (const [key, want] of Object.entries(c.expected)) {
    const got = r.byCategory[key].value;
    const ok = Math.abs(got - want) <= TOLERANCE;
    if (!ok) failed++;
    console.log(`  ${ok ? "✓" : "✗"} ${key.padEnd(9)} 계산 ${got.toFixed(2).padStart(8)}  손계산 ${want.toFixed(2).padStart(8)}`);
  }
  const want = Object.values(c.expected).reduce((s, v) => s + v, 0);
  const { value, low, high } = r.total;
  console.log(`    합계 ${(value / 1000).toFixed(2)}톤 (손계산 ${(want / 1000).toFixed(2)}톤), 범위 ${(low / 1000).toFixed(1)}~${(high / 1000).toFixed(1)}톤`);
}

const synced = syncSimple(CASES[4].answers, CASES[4].detail);
console.log("\n자세히 입력 → 간편 입력 칸 반영 (사례 E)");
for (const [key, want] of Object.entries(SYNC_EXPECTED)) {
  const ok = synced[key] === want;
  if (!ok) failed++;
  console.log(`  ${ok ? "✓" : "✗"} ${key.padEnd(15)} ${String(synced[key]).padEnd(10)} 예상 ${want}`);
}

console.log(failed ? `\n✗ ${failed}개 불일치` : "\n✓ 모든 사례가 손계산과 일치");
process.exit(failed ? 1 : 0);
