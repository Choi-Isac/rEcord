// 감축 제안: 계산에 쓰는 양(resolve 결과)을 바꿔 다시 계산한 차이로 예상 감축량을 구한다
// 간편 입력이든 자세히 입력이든 같은 방식으로 동작한다
// 제안마다 줄이는 항목(item)을 정해 두어, 결과 화면에서 '가장 큰 항목'과 제안을 이어서 보여 준다
import { calculateResolved, resolve } from "./engine.js";
import { COOL_LEVEL, DETAIL, FLIGHTS, FOOD, HEAT_LEVEL, HOME_TRIPS } from "./factors.js";

const itemValue = (r, key) => calculateResolved(r).items.find((i) => i.key === key).value;

// 지금 값보다 작은 단계 중 가장 큰 것 (간편 입력의 '한 단계 줄이기'와 같다)
const levelBelow = (levels, v) => levels.filter((l) => l < v - 1e-9).at(-1);
const HOME_TRIP_LEVELS = Object.values(HOME_TRIPS.roundTripsPerYear).sort((x, y) => x - y);
const MEAT_LEVELS = Object.values(FOOD.servingsPerWeek).sort((x, y) => x - y);
const MEAT_KINDS = ["beef", "pork", "chicken"];

// 통학 비율 중 일부 수단을 다른 수단으로 옮긴다 (거리는 그대로). 택시를 줄이는 제안이면 택시 이용도 옮긴다
const commuting = (r) => r.commute.trips > 0;
const shareOf = (r, modes) => modes.reduce((s, m) => s + (r.commute.shares[m] ?? 0), 0);
const usesTaxi = (r) => r.commute.taxiTrips > 0;
function moveShares(r, from, to, { keepTaxi = false } = {}) {
  const shares = { ...r.commute.shares };
  for (const m of from) {
    shares[to] = (shares[to] ?? 0) + (shares[m] ?? 0);
    delete shares[m];
  }
  return { ...r, commute: { ...r.commute, shares, taxiTrips: keepTaxi ? r.commute.taxiTrips : 0 } };
}
const meatTotal = (r) => MEAT_KINDS.reduce((s, k) => s + (r.meat[k] ?? 0), 0);

// 간편 입력으로는 바꿀 수 없는 습관(대기전력·샤워 시간)은 해당 항목의 일정 비율을 줄인다고 가정
const STANDBY_SAVING = 0.1;
const SHOWER_SAVING = 0.15;
const REUSE_TARGET = 0.8; // 텀블러·다회용기 '자주' 쓰는 수준

const CANDIDATES = [
  {
    id: "transit",
    item: "commute",
    icon: "🚇",
    title: "통학은 대중교통으로",
    desc: "같은 거리를 자가용·택시·오토바이 대신 지하철로 다니면 1km당 배출이 크게 줄어요.",
    when: (r) => commuting(r) && (shareOf(r, ["car", "taxi", "moto"]) > 0 || usesTaxi(r)),
    apply: (r) => moveShares(r, ["car", "taxi", "moto"], "subway"),
  },
  {
    id: "bike",
    item: "commute",
    icon: "🚲",
    title: "가까운 통학길은 자전거로",
    desc: "편도 5km 안팎이면 따릉이·자전거로도 비슷한 시간에 닿을 수 있어요.",
    when: (r) => commuting(r) && r.commute.km <= 5 && (shareOf(r, ["walk", "bike"]) < 1 || usesTaxi(r)),
    apply: (r) => ({ ...r, commute: { ...r.commute, shares: { bike: 1 }, taxiTrips: 0 } }),
  },
  {
    id: "busToSubway",
    item: "commute",
    icon: "🚇",
    title: "버스 대신 지하철로 통학",
    desc: "같은 거리라면 지하철이 버스보다 1km당 배출이 절반 정도예요.",
    when: (r) => commuting(r) && shareOf(r, ["bus"]) > 0 && r.commute.km > 5,
    apply: (r) => moveShares(r, ["bus"], "subway", { keepTaxi: true }),
  },
  {
    id: "homeTrips",
    item: "homeTrips",
    icon: "🚆",
    title: "본가 방문은 한 번에 길게",
    desc: "다녀오는 횟수를 한 단계 줄이고, 한 번 갈 때 조금 더 오래 머물러 보세요.",
    when: (r) => r.homeTrips.perYear > 0,
    apply: (r) => ({ ...r, homeTrips: { ...r.homeTrips, perYear: levelBelow(HOME_TRIP_LEVELS, r.homeTrips.perYear) } }),
  },
  {
    id: "rail",
    item: "flights",
    icon: "🚄",
    title: "국내 이동은 비행기 대신 KTX로",
    desc: "부산·여수 등 철도로 갈 수 있는 곳은 기차를 타면 같은 거리의 배출이 6분의 1 수준이에요.",
    when: (r) => r.flights.domestic > 0,
    saving: (r) => r.flights.domestic * DETAIL.flightTripKm.domestic * (FLIGHTS.domestic.ef - HOME_TRIPS.pkm),
  },
  {
    id: "fewerFlights",
    item: "flights",
    icon: "🧳",
    title: "해외여행은 한 번 갈 때 길게",
    desc: "해외여행 횟수를 2년에 한 번으로 줄이고, 대신 한 번에 머무는 기간을 늘려 보세요.",
    when: (r) => r.flights.asia > 0 || r.flights.long > 0,
    apply: (r) => ({ ...r, flights: { ...r.flights, asia: r.flights.asia / 2, long: r.flights.long / 2 } }),
  },
  {
    id: "standby",
    item: "electricity",
    icon: "🔌",
    title: "대기전력 끄고 LED 조명 쓰기",
    desc: "멀티탭 스위치로 쓰지 않는 기기의 대기전력을 끄고 LED 조명을 쓰면 전기 사용을 10% 정도 줄일 수 있어요.",
    when: () => true,
    saving: (r) => itemValue(r, "electricity") * STANDBY_SAVING,
  },
  {
    id: "cooling",
    item: "cooling",
    icon: "🌀",
    title: "에어컨은 26℃, 선풍기와 함께",
    desc: "설정 온도를 1℃ 올리고 선풍기를 같이 쓰면 냉방 전력을 한 단계 줄일 수 있어요.",
    when: (r) => levelBelow(COOL_LEVEL, r.coolMult) !== undefined,
    apply: (r) => ({ ...r, coolMult: levelBelow(COOL_LEVEL, r.coolMult) }),
  },
  {
    id: "heating",
    item: "heating",
    icon: "🧣",
    title: "난방은 20℃, 실내에서 한 겹 더",
    desc: "내복·조끼를 입고 쓰지 않는 방의 난방 밸브를 잠그면 난방을 한 단계 줄일 수 있어요.",
    when: (r) => levelBelow(HEAT_LEVEL, r.heatMult) !== undefined,
    apply: (r) => ({ ...r, heatMult: levelBelow(HEAT_LEVEL, r.heatMult) }),
  },
  {
    id: "shower",
    item: "hotWater",
    icon: "🚿",
    title: "샤워 시간 2분 줄이기",
    desc: "샤워를 조금 짧게 하고 설거지는 받아서 하면 온수에 쓰는 가스를 15% 정도 줄일 수 있어요.",
    when: () => true,
    saving: (r) => itemValue(r, "hotWater") * SHOWER_SAVING,
  },
  {
    id: "meat",
    item: "meat",
    icon: "🥗",
    title: "고기 먹는 날을 조금 줄이기",
    desc: "주 2~3끼를 채식 메뉴로 바꾸거나, 소고기 대신 닭고기·두부를 골라 보세요.",
    when: (r) => levelBelow(MEAT_LEVELS, meatTotal(r)) !== undefined,
    // 소·돼지·닭을 같은 비율로 줄여 한 단계 아래 섭취량에 맞춘다 (생선은 그대로)
    apply: (r) => {
      const f = levelBelow(MEAT_LEVELS, meatTotal(r)) / meatTotal(r);
      return { ...r, meat: { ...r.meat, ...Object.fromEntries(MEAT_KINDS.map((k) => [k, (r.meat[k] ?? 0) * f])) } };
    },
  },
  {
    id: "mealsOut",
    item: "mealsOut",
    icon: "🍱",
    title: "배달·외식 주 2회는 학식·직접 조리로",
    desc: "배달 대신 학식을 이용하면 오토바이 배송과 조리 과정의 배출이 줄어요.",
    when: (r) => (r.meals.out ?? 0) + (r.meals.delivery ?? 0) >= 1,
    // 배달·외식을 지금 비율대로 합계 2회 줄이고 직접 조리로 옮긴다
    apply: (r) => {
      const out = r.meals.out ?? 0;
      const delivery = r.meals.delivery ?? 0;
      const cut = Math.min(2, out + delivery) / (out + delivery);
      return {
        ...r,
        meals: { ...r.meals, out: out * (1 - cut), delivery: delivery * (1 - cut), cook: (r.meals.cook ?? 0) + (out + delivery) * cut },
      };
    },
  },
  {
    id: "clothes",
    item: "clothes",
    icon: "👕",
    title: "새 옷 절반은 중고·교환으로",
    desc: "중고 거래, 교내 옷 교환 행사를 이용하면 새 옷 생산에서 나오는 배출을 피할 수 있어요.",
    when: (r) => r.clothes.perMonth > 0 && r.clothes.secondhand < 1,
    apply: (r) => ({ ...r, clothes: { ...r.clothes, secondhand: r.clothes.secondhand + (1 - r.clothes.secondhand) / 2 } }),
  },
  {
    id: "parcels",
    item: "parcels",
    icon: "📦",
    title: "택배는 모아서 한 번에",
    desc: "장바구니에 모았다가 한 번에 주문하면 포장재와 배송 횟수가 줄어요.",
    when: (r) => r.parcels.domestic + r.parcels.overseas >= 3,
    apply: (r) => ({ ...r, parcels: { domestic: (r.parcels.domestic * 2) / 3, overseas: (r.parcels.overseas * 2) / 3 } }),
  },
  {
    id: "reusable",
    item: "disposables",
    icon: "🥤",
    title: "텀블러·다회용기 챙기기",
    desc: "카페와 배달에서 텀블러·다회용기를 쓰면 탄소중립포인트(녹색생활 실천)도 받을 수 있어요.",
    when: (r) => r.disposables.tumbler < REUSE_TARGET || r.disposables.deliveryReuse < REUSE_TARGET,
    apply: (r) => ({
      ...r,
      disposables: {
        ...r.disposables,
        tumbler: Math.max(r.disposables.tumbler, REUSE_TARGET),
        deliveryReuse: Math.max(r.disposables.deliveryReuse, REUSE_TARGET),
      },
    }),
    point: true,
  },
];

// 제안 목록: focusItem(가장 큰 항목)을 줄이는 제안 중 가장 효과가 큰 것을 맨 앞에,
// 나머지는 예상 감축량 순. 한 항목에 제안이 몰리지 않게 항목당 하나씩만 고른다
export function suggest(answers, { detail, limit = 3, focusItem } = {}) {
  const r = resolve(answers, detail);
  const base = calculateResolved(r).total.value;
  const ranked = CANDIDATES.filter((c) => c.when(r))
    .map((c) => ({ ...c, saving: c.saving ? c.saving(r) : base - calculateResolved(c.apply(r)).total.value }))
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
