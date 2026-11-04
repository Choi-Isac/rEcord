// 감축 제안: 입력값을 바꿔 다시 계산한 차이로 예상 감축량을 구한다
// 제안마다 줄이는 항목(item)을 정해 두어, 결과 화면에서 '가장 큰 항목'과 제안을 이어서 보여 준다
import { calculate, clothesCount, commuteKm, fillDefaults, parcelCount } from "./engine.js";
import { COMMUTE, FLIGHTS, HOME_TRIPS } from "./factors.js";

// 같은 거리를 다른 수단으로 이동 (시간은 수단 속도에 맞춰 다시 환산)
const switchMode = (a, mode) => ({
  ...a,
  commuteMode: mode,
  commuteMinutes: (commuteKm(a.commuteMode, a.commuteMinutes) / COMMUTE.speedKmh[mode]) * 60,
});

const itemValue = (a, key) => calculate(a).items.find((i) => i.key === key).value;

const HOME_TRIP_LEVELS = ["none", "semester", "monthly", "weekly", "twicePlus"];

// 간편 입력으로는 바꿀 수 없는 습관(대기전력·샤워 시간)은 해당 항목의 일정 비율을 줄인다고 가정
const STANDBY_SAVING = 0.1;
const SHOWER_SAVING = 0.15;

const CANDIDATES = [
  {
    id: "transit",
    item: "commute",
    icon: "🚇",
    title: "통학은 대중교통으로",
    desc: "같은 거리를 자가용·택시·오토바이 대신 지하철로 다니면 1km당 배출이 크게 줄어요.",
    when: (a) => a.commuteDays > 0 && ["car", "taxi", "moto"].includes(a.commuteMode),
    apply: (a) => switchMode(a, "subway"),
  },
  {
    id: "bike",
    item: "commute",
    icon: "🚲",
    title: "가까운 통학길은 자전거로",
    desc: "편도 5km 안팎이면 따릉이·자전거로도 비슷한 시간에 닿을 수 있어요.",
    when: (a) =>
      a.commuteDays > 0 && !["walk", "bike"].includes(a.commuteMode) && commuteKm(a.commuteMode, a.commuteMinutes) <= 5,
    apply: (a) => switchMode(a, "bike"),
  },
  {
    id: "busToSubway",
    item: "commute",
    icon: "🚇",
    title: "버스 대신 지하철로 통학",
    desc: "같은 거리라면 지하철이 버스보다 1km당 배출이 절반 정도예요.",
    when: (a) => a.commuteDays > 0 && a.commuteMode === "bus" && commuteKm(a.commuteMode, a.commuteMinutes) > 5,
    apply: (a) => switchMode(a, "subway"),
  },
  {
    id: "homeTrips",
    item: "homeTrips",
    icon: "🚆",
    title: "본가 방문은 한 번에 길게",
    desc: "다녀오는 횟수를 한 단계 줄이고, 한 번 갈 때 조금 더 오래 머물러 보세요.",
    when: (a) => a.homeTrips !== "none",
    apply: (a) => ({ ...a, homeTrips: HOME_TRIP_LEVELS[HOME_TRIP_LEVELS.indexOf(a.homeTrips) - 1] }),
  },
  {
    id: "rail",
    item: "flights",
    icon: "🚄",
    title: "국내 이동은 비행기 대신 KTX로",
    desc: "부산·여수 등 철도로 갈 수 있는 곳은 기차를 타면 같은 거리의 배출이 6분의 1 수준이에요.",
    when: (a) => a.flights === "domestic",
    saving: () => FLIGHTS.domestic.pkm * (FLIGHTS.domestic.ef - HOME_TRIPS.pkm),
  },
  {
    id: "fewerFlights",
    item: "flights",
    icon: "🧳",
    title: "해외여행은 한 번 갈 때 길게",
    desc: "해외여행 횟수를 2년에 한 번으로 줄이고, 대신 한 번에 머무는 기간을 늘려 보세요.",
    when: (a) => a.flights === "asia" || a.flights === "long",
    saving: (a) => itemValue(a, "flights") / 2,
  },
  {
    id: "standby",
    item: "electricity",
    icon: "🔌",
    title: "대기전력 끄고 LED 조명 쓰기",
    desc: "멀티탭 스위치로 쓰지 않는 기기의 대기전력을 끄고 LED 조명을 쓰면 전기 사용을 10% 정도 줄일 수 있어요.",
    when: () => true,
    saving: (a) => itemValue(a, "electricity") * STANDBY_SAVING,
  },
  {
    id: "cooling",
    item: "cooling",
    icon: "🌀",
    title: "에어컨은 26℃, 선풍기와 함께",
    desc: "설정 온도를 1℃ 올리고 선풍기를 같이 쓰면 냉방 전력을 한 단계 줄일 수 있어요.",
    when: (a) => a.cooling >= 2,
    apply: (a) => ({ ...a, cooling: a.cooling - 1 }),
  },
  {
    id: "heating",
    item: "heating",
    icon: "🧣",
    title: "난방은 20℃, 실내에서 한 겹 더",
    desc: "내복·조끼를 입고 쓰지 않는 방의 난방 밸브를 잠그면 난방을 한 단계 줄일 수 있어요.",
    when: (a) => a.heating >= 2,
    apply: (a) => ({ ...a, heating: a.heating - 1 }),
  },
  {
    id: "shower",
    item: "hotWater",
    icon: "🚿",
    title: "샤워 시간 2분 줄이기",
    desc: "샤워를 조금 짧게 하고 설거지는 받아서 하면 온수에 쓰는 가스를 15% 정도 줄일 수 있어요.",
    when: () => true,
    saving: (a) => itemValue(a, "hotWater") * SHOWER_SAVING,
  },
  {
    id: "meat",
    item: "meat",
    icon: "🥗",
    title: "고기 먹는 날을 조금 줄이기",
    desc: "주 2~3끼를 채식 메뉴로 바꾸거나, 소고기 대신 닭고기·두부를 골라 보세요.",
    when: (a) => a.meat !== "rare",
    apply: (a) => ({ ...a, meat: { daily: "mid", mid: "low", low: "rare" }[a.meat] }),
  },
  {
    id: "mealsOut",
    item: "mealsOut",
    icon: "🍱",
    title: "배달·외식 주 2회는 학식·직접 조리로",
    desc: "배달 대신 학식을 이용하면 오토바이 배송과 조리 과정의 배출이 줄어요.",
    when: (a) => a.mealsOut >= 1,
    apply: (a) => ({ ...a, mealsOut: Math.max(0, a.mealsOut - 2) }),
  },
  {
    id: "clothes",
    item: "clothes",
    icon: "👕",
    title: "새 옷 절반은 중고·교환으로",
    desc: "중고 거래, 교내 옷 교환 행사를 이용하면 새 옷 생산에서 나오는 배출을 피할 수 있어요.",
    when: (a) => a.clothes >= 1,
    apply: (a) => ({ ...a, clothes: clothesCount(a.clothes) / 2 }),
  },
  {
    id: "parcels",
    item: "parcels",
    icon: "📦",
    title: "택배는 모아서 한 번에",
    desc: "장바구니에 모았다가 한 번에 주문하면 포장재와 배송 횟수가 줄어요.",
    when: (a) => a.parcels >= 3,
    apply: (a) => ({ ...a, parcels: (parcelCount(a.parcels) * 2) / 3 }),
  },
  {
    id: "reusable",
    item: "disposables",
    icon: "🥤",
    title: "텀블러·다회용기 챙기기",
    desc: "카페와 배달에서 텀블러·다회용기를 쓰면 탄소중립포인트(녹색생활 실천)도 받을 수 있어요.",
    when: (a) => a.reusable !== "often",
    apply: (a) => ({ ...a, reusable: "often" }),
    point: true,
  },
];

// 제안 목록: focusItem(가장 큰 항목)을 줄이는 제안 중 가장 효과가 큰 것을 맨 앞에,
// 나머지는 예상 감축량 순. 한 항목에 제안이 몰리지 않게 항목당 하나씩만 고른다
export function suggest(answers, { limit = 3, focusItem } = {}) {
  const a = fillDefaults(answers);
  const base = calculate(a).total.value;
  const ranked = CANDIDATES.filter((c) => c.when(a))
    .map((c) => ({ ...c, saving: c.saving ? c.saving(a) : base - calculate(c.apply(a)).total.value }))
    .filter((c) => c.saving >= 1)
    .sort((x, y) => y.saving - x.saving);

  const focus = ranked.find((c) => c.item === focusItem);
  const picked = focus ? [{ ...focus, isFocus: true }] : [];
  for (const c of ranked) {
    if (picked.length >= limit) break;
    if (!picked.some((p) => p.item === c.item)) picked.push(c);
  }
  return picked;
}

// '가장 큰 항목' 카드의 설명
export const ITEM_NOTES = {
  commute: "통학은 학기 내내 반복되어, 하루의 작은 차이도 1년이면 크게 쌓여요.",
  homeTrips: "본가 방문처럼 정기적인 장거리 이동은 횟수가 많을수록 빠르게 늘어나요.",
  flights: "비행기는 짧은 시간에 많은 연료를 써서, 한 번의 여행이 1년 통학보다 클 수 있어요.",
  electricity: "조명·가전의 전기는 발전 과정에서 배출이 생겨요. 함께 사는 인원이 적을수록 1인 몫이 커져요.",
  cooling: "에어컨은 가정 전력 중 계절에 따라 가장 크게 변하는 항목이에요.",
  heating: "겨울철 난방은 가정 에너지 배출에서 가장 큰 비중을 차지하는 경우가 많아요.",
  hotWater: "온수와 조리에 쓰는 가스도 매일 쓰는 만큼 꾸준히 쌓여요.",
  meat: "육류, 특히 소고기는 같은 양의 곡물·채소보다 배출량이 수십 배 커요.",
  mealsOut: "배달·외식은 조리와 배송 과정에서 집밥보다 배출이 더해져요.",
  clothes: "새 옷은 원료 재배부터 염색·운송까지 생산 과정의 배출이 커요.",
  parcels: "택배는 포장재와 마지막 배송 구간에서 배출이 생겨요.",
  disposables: "일회용 컵과 배달 용기는 하나하나는 작아도 자주 쓰면 쌓여요.",
};
