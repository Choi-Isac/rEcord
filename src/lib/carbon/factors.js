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
  // 통학은 학기 중(16주 × 2학기)에만 한다고 본다. 방학 중 통학은 정밀 입력 항목
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

// 비교 기준: 1.5℃ 목표에 맞춘 2030년 1인당 생활 탄소발자국 (Hot or Cool Institute, 2021)
export const TARGET_2030_KG = 2500;

// 30년생 소나무 한 그루의 연간 CO₂ 흡수량 (국립산림과학원)
export const PINE_KG_PER_YEAR = 6.6;
