// 배출계수와 칩·슬라이더 대표값 (단위: kg CO₂e)
//
// ⚠ 잠정값: 배출계수 출처와 기준 연도는 아직 팀 결정 전이다(README '결정이 필요한 사항').
//   계수를 바꿀 때는 FACTOR_VERSION을 올린다. 응답에는 결과가 아니라 원본 입력값을 저장하므로
//   새 계수로 언제든 다시 계산할 수 있다.
export const FACTOR_VERSION = "2026.11-draft";

export const WEEKS_PER_YEAR = 52;
export const MONTHS_PER_YEAR = 12;

// 에너지 배출계수
export const EF = {
  electricity: 0.4781, // kg/kWh, 국가 전력 배출계수(참고)
  gas: 2.22, // kg/m³, 도시가스(LNG) 연소
};

// ── 이동 ──────────────────────────────────────

export const COMMUTE = {
  // 통학은 학기 중(16주 × 2학기)에만 한다고 본다. 방학 중 통학은 아직 다루지 않는다
  weeksPerYear: 32,
  // 문을 나서서 강의실에 닿기까지(걷기·환승·대기 포함) 평균 속도, km/h → 편도 시간을 거리로 환산
  speedKmh: { walk: 4.5, bike: 12, bus: 15, subway: 22, car: 25, taxi: 25, moto: 25 },
  // 1인 1km당 배출량, kg/인·km
  pkm: { walk: 0, bike: 0.005, bus: 0.065, subway: 0.03, car: 0.19, taxi: 0.21, moto: 0.1 },
};

export const HOME_TRIPS = {
  roundTripsPerYear: { none: 0, semester: 3, monthly: 18, weekly: 40, twicePlus: 80 },
  roundTripKm: 300, // 편도 150km (서울–대전 정도)
  pkm: 0.035, // KTX·고속버스 평균, kg/인·km
};

// 비행: 연간 탑승 거리(왕복) × 거리대별 계수(복사강제력 반영)
export const FLIGHTS = {
  none: { pkm: 0, ef: 0, note: "-" },
  domestic: { pkm: 1800, ef: 0.2, note: "제주 왕복 2회 (900km × 2)" },
  asia: { pkm: 5000, ef: 0.13, note: "도쿄·방콕 등 왕복 1회" },
  long: { pkm: 18000, ef: 0.12, note: "유럽·미주 왕복 1회" },
};

// ── 주거 ──────────────────────────────────────

// 1인 가구 기준 연간 사용량. elec·cool은 kWh, heat·hot은 도시가스 m³(지역·중앙난방은 m³ 환산)
export const HOUSING = {
  family: { elec: 2000, cool: 400, heat: 380, hot: 120, defaultHousehold: 4 },
  alone: { elec: 1450, cool: 350, heat: 220, hot: 80, defaultHousehold: 1 },
  dorm: { elec: 1100, cool: 300, heat: 180, hot: 70, defaultHousehold: 2 },
  boarding: { elec: 900, cool: 300, heat: 100, hot: 50, defaultHousehold: 1 },
  share: { elec: 1600, cool: 400, heat: 300, hot: 100, defaultHousehold: 3 },
};

// 한 명이 늘 때마다 가구 에너지가 25%씩 는다고 보고, 이를 인원수로 나눈다
export const EXTRA_PERSON_SHARE = 0.25;

// 냉난방 슬라이더 1~5단계(3 = 보통)의 사용량 배수
export const COOL_LEVEL = [0.3, 0.6, 1, 1.5, 2.1];
export const HEAT_LEVEL = [0.5, 0.75, 1, 1.3, 1.65];

// ── 식생활 ────────────────────────────────────

export const FOOD = {
  base: 1100, // 곡물·채소·유제품·가공식품 등 육류를 뺀 기본 식단, kg/년
  meatServing: 1.6, // 육류 1회(약 120g, 소 20%·돼지 45%·닭 35% 가중), kg/회
  servingsPerWeek: { rare: 0.5, low: 1.5, mid: 4, daily: 10 },
  mealOverhead: 0.3, // 배달·외식 1회에 더해지는 조리·운송 배출(포장재 제외), kg/회
};

// ── 소비 ──────────────────────────────────────

export const GOODS = {
  clothingItem: 12, // 옷·신발·가방 1개 평균, kg/개
  clothesMax: 10, // 슬라이더 최댓값 = "10개 이상"
  clothesOverflow: 12, // "10개 이상"을 계산할 때 쓰는 값
  parcel: 0.8, // 택배 1건(포장재 + 배송), kg/건
  parcelsMax: 20,
  parcelsOverflow: 24,
  cupsPerWeek: 5, // 테이크아웃 음료 주 5잔 가정
  cup: 0.04, // 일회용 컵·뚜껑·빨대, kg/개
  deliveryShare: 0.5, // 배달·외식 중 배달 비율 가정
  container: 0.25, // 배달 1회 일회용기, kg/회
  reuseRate: { rarely: 0.05, sometimes: 0.4, often: 0.8 },
};

// 간편 입력(대표값)의 항목별 상대 불확도. 결과 화면의 범위 표시에 쓴다
export const UNCERTAINTY = {
  commute: 0.3,
  homeTrips: 0.5,
  flights: 0.4,
  electricity: 0.3,
  cooling: 0.5,
  heating: 0.4,
  hotWater: 0.3,
  dietBase: 0.2,
  meat: 0.35,
  mealsOut: 0.5,
  clothes: 0.5,
  parcels: 0.4,
  disposables: 0.5,
};

// ── 자세히 입력 (v0.2) ─────────────────────────
// 간편 입력의 대표값을 직접 입력한 값으로 바꿀 때 쓰는 계수. 기본값은 간편 입력 결과와 같아지도록 맞췄다.

const KWH_PER_M3 = 10.4; // 도시가스 1m³로 내는 난방 열량을 전기로 낼 때의 kWh (보일러 효율 반영)

export const DETAIL = {
  kwhPerM3: KWH_PER_M3,
  // 통학: 학기 8개월 동안 월 횟수 → 연간 횟수
  semesterMonths: 8,
  // 자가용 연료별 배출 배수 (휘발유 = COMMUTE.pkm.car)
  carFuel: { gasoline: 1, diesel: 0.95, lpg: 0.9, hybrid: 0.6, ev: 0.35 },
  // 본가·장거리 이동 수단별 1인 1km당 배출량
  homeTripPkm: { mixed: HOME_TRIPS.pkm, train: 0.03, bus: 0.04, car: 0.19 },
  // 항공 왕복 1회 거리(km) = FLIGHTS의 연간 거리 ÷ 간편 입력이 가정한 횟수
  flightTripKm: { domestic: 900, asia: 5000, long: 18000 },
  // 난방 방식별 '도시가스 m³ 환산량' 1단위당 배출량, kg
  //   전기 난방: 1m³ 환산 × 10.4kWh × 전력 계수 / 지역·중앙난방: 열병합 평균으로 가스의 약 0.75배
  heatingEf: { gas: EF.gas, electric: KWH_PER_M3 * EF.electricity, district: 0.75 * EF.gas, unknown: EF.gas },
  // 냉난방 '보통'(간편 3단계)에 해당하는 사용 패턴: 하루 시간 × 사용 월수
  coolRef: { hours: 6, months: 3 },
  heatRef: { hours: 8, months: 4 },
  // 요금(원) → 사용량 환산 단가 (누진·기본요금 포함 평균)
  wonPerKwh: 160,
  wonPerM3: 1100,
  // 육류 1회(약 120g) 종류별 배출량, kg/회. 소 20%·돼지 45%·닭 35% 가중 평균이 FOOD.meatServing과 같다
  meatServing: { beef: 3.9, pork: 1.2, chicken: 0.8, fish: 0.7 },
  meatMix: { beef: 0.2, pork: 0.45, chicken: 0.35, fish: 0 },
  // 식사 장소별 1끼에 더해지는 조리·운송 배출, kg/끼 (직접 조리 = 기본 식단에 포함)
  mealOverhead: { campus: 0.05, out: FOOD.mealOverhead, delivery: FOOD.mealOverhead, convenience: 0.25, cook: 0 },
  // 중고 구매 1개는 새 제품 생산 배출의 10%로 본다 (세탁·운송)
  secondhandFactor: 0.1,
  // 해외직구 1건(포장재 + 국제 운송, 항공·해상 평균), kg/건. 국내 택배(GOODS.parcel)의 2.5배
  overseasParcel: 2,
};

// 자세히 입력으로 계산한 항목의 상대 불확도 (간편 입력보다 작다)
export const UNCERTAINTY_DIRECT = {
  commute: 0.15,
  homeTrips: 0.25,
  flights: 0.2,
  electricity: 0.1,
  cooling: 0.3,
  heating: 0.25,
  hotWater: 0.1,
  meat: 0.2,
  mealsOut: 0.3,
  clothes: 0.3,
  parcels: 0.2,
  disposables: 0.3,
};

// 비교 기준: 1.5℃ 목표에 맞춘 2030년 1인당 생활 탄소발자국 (Hot or Cool Institute, 2021)
export const TARGET_2030_KG = 2500;

// 30년생 소나무 한 그루의 연간 CO₂ 흡수량 (국립산림과학원)
export const PINE_KG_PER_YEAR = 6.6;
