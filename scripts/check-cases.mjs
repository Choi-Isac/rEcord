// 계산 엔진 검증: 가상 이용자 사례 4개를 손계산 값과 대조한다
// 실행: npm run check
// 배출계수(src/lib/carbon/factors.js)를 바꾸면 아래 손계산도 함께 고쳐야 한다.
import { calculate } from "../src/lib/carbon/engine.js";

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
];

const TOLERANCE = 0.5; // kg, 손계산 반올림 허용 오차
let failed = 0;

for (const c of CASES) {
  const r = calculate(c.answers);
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

console.log(failed ? `\n✗ ${failed}개 불일치` : "\n✓ 모든 사례가 손계산과 일치");
process.exit(failed ? 1 : 0);
