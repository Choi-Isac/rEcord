// 감축 제안 (icon: 픽토그램 이름, components/Pictogram.jsx): 계산에 쓰는 양(resolve 결과)을 바꿔 다시 계산한 차이로 예상 감축량을 구한다
// 간편 입력이든 자세히 입력이든 같은 방식으로 동작한다
// 제안마다 줄이는 항목(item)을 정해 두어, 결과 화면에서 '가장 큰 항목'과 제안을 이어서 보여 준다
// 생활을 크게 바꾸라는 제안 대신, 지금 습관에서 한 번·한 끼·1℃처럼 작게 바꾸는 행동만 고른다
// 계정에서 습관 변경 난이도를 '쉬움'으로 고른 문항은 easy(두 배 정도 큰 버전: 이틀·두 끼·2℃)로 바꿔 제안한다.
// easy.when이 있으면 그 조건을 채울 때만 큰 버전을 쓰고, 아니면 기본 제안을 쓴다
import { calculateResolved, resolve } from "./engine.js";
import { COMMUTE, DETAIL, FLIGHTS, HOME_TRIPS } from "./factors.js";
import { FLEX_BLOCKED, FLEX_EASY, FLEX_HARD, flexLevel, flexWeight } from "../flexibility.js";

const itemValue = (r, key) => calculateResolved(r).items.find((i) => i.key === key).value;

const MEAT_KINDS = ["beef", "pork", "chicken"];
const meatTotal = (r) => MEAT_KINDS.reduce((s, k) => s + (r.meat[k] ?? 0), 0);
function fewerMeat(r, meals) {
  const f = (meatTotal(r) - meals) / meatTotal(r);
  return { ...r, meat: { ...r.meat, ...Object.fromEntries(MEAT_KINDS.map((k) => [k, (r.meat[k] ?? 0) * f])) } };
}

// 통학: 일주일 중 하루(통학 일수가 4일이면 1/4)만 다른 수단으로 바꾼다 (거리는 그대로). 쉬움이면 이틀
const commuting = (r) => r.commute.trips > 0;
const shareOf = (r, modes) => modes.reduce((s, m) => s + (r.commute.shares[m] ?? 0), 0);
const usesTaxi = (r) => r.commute.taxiTrips > 0;
// 통학 중 주 days일의 비율 (통학 일수보다 많으면 전부)
const daysShare = (r, days) => Math.min(1, (days * 2 * COMMUTE.weeksPerYear) / r.commute.trips);
function moveDays(r, from, to, days = 1) {
  const f = daysShare(r, days);
  const shares = { ...r.commute.shares };
  for (const m of from) {
    const moved = (shares[m] ?? 0) * f;
    shares[m] = (shares[m] ?? 0) - moved;
    shares[to] = (shares[to] ?? 0) + moved;
  }
  const taxiTrips = from.includes("taxi") ? r.commute.taxiTrips * (1 - f) : r.commute.taxiTrips;
  return { ...r, commute: { ...r.commute, shares, taxiTrips } };
}

// 간편 입력으로는 바꿀 수 없는 습관은 해당 항목의 일정 비율을 줄인다고 가정
// 냉난방 1℃: 한국에너지공단 안내(냉방 1℃ 올리면·난방 1℃ 낮추면 약 7% 절약)
const STANDBY_SAVING = 0.05; // 자기 전·외출할 때 멀티탭 끄기 (대기전력은 가정 전력의 약 6%)
const ONE_DEGREE_SAVING = 0.07;
const SHOWER_SAVING = 0.1; // 샤워 1~2분 줄이기
const REUSE_STEP = 0.2; // 텀블러·다회용기를 10번 중 2번 더 (쉬움이면 4번)

// 배달에서 먼저, 모자라면 외식에서 주 n회를 학식으로 옮긴다
function toCampus(r, n) {
  const fromDelivery = Math.min(n, r.meals.delivery ?? 0);
  const fromOut = n - fromDelivery;
  return {
    ...r,
    meals: {
      ...r.meals,
      delivery: (r.meals.delivery ?? 0) - fromDelivery,
      out: (r.meals.out ?? 0) - fromOut,
      campus: (r.meals.campus ?? 0) + n,
    },
  };
}

const CANDIDATES = [
  {
    id: "transit",
    question: "commuteMode",
    item: "commute",
    icon: "subway",
    title: "일주일에 하루는 대중교통으로",
    desc: "자가용·택시·오토바이로 다니는 날 중 하루만 지하철·버스를 타도 통학 배출이 줄어요.",
    when: (r) => commuting(r) && (shareOf(r, ["car", "taxi", "moto"]) > 0 || usesTaxi(r)),
    apply: (r) => moveDays(r, ["car", "taxi", "moto"], "subway"),
    easy: {
      title: "일주일에 이틀은 대중교통으로",
      desc: "자가용·택시·오토바이로 다니는 날 중 이틀을 지하철·버스로 바꾸면 통학 배출이 더 크게 줄어요.",
      apply: (r) => moveDays(r, ["car", "taxi", "moto"], "subway", 2),
    },
  },
  {
    id: "bike",
    question: "commuteMode",
    item: "commute",
    icon: "bike",
    title: "날씨 좋은 날 하루는 자전거로",
    desc: "편도 5km 안팎이면 따릉이·자전거로도 비슷한 시간에 닿을 수 있어요.",
    when: (r) => commuting(r) && r.commute.km <= 5 && (shareOf(r, ["walk", "bike"]) < 1 || usesTaxi(r)),
    apply: (r) => moveDays(r, Object.keys(r.commute.shares).filter((m) => m !== "walk" && m !== "bike"), "bike"),
    easy: {
      title: "날씨 좋은 날 이틀은 자전거로",
      desc: "편도 5km 안팎이면 따릉이·자전거로도 비슷한 시간에 닿을 수 있어요. 일주일에 이틀이면 효과가 두 배예요.",
      apply: (r) => moveDays(r, Object.keys(r.commute.shares).filter((m) => m !== "walk" && m !== "bike"), "bike", 2),
    },
  },
  {
    id: "busToSubway",
    question: "commuteMode",
    item: "commute",
    icon: "subway",
    title: "일주일에 하루는 버스 대신 지하철로",
    desc: "같은 거리라면 지하철이 버스보다 1km당 배출이 절반 정도예요. 갈아타는 길이 비슷한 날에 골라 보세요.",
    when: (r) => commuting(r) && shareOf(r, ["bus"]) > 0 && r.commute.km > 5,
    apply: (r) => moveDays(r, ["bus"], "subway"),
    easy: {
      title: "일주일에 이틀은 버스 대신 지하철로",
      desc: "같은 거리라면 지하철이 버스보다 1km당 배출이 절반 정도예요. 갈아타는 길이 비슷한 날 이틀을 골라 보세요.",
      apply: (r) => moveDays(r, ["bus"], "subway", 2),
    },
  },
  {
    id: "homeTripsTrain",
    question: "homeTrips",
    item: "homeTrips",
    icon: "train",
    title: "본가 갈 때 네 번 중 한 번은 기차·버스로",
    desc: "자가용 대신 KTX·고속버스를 타면 같은 거리의 배출이 5분의 1 정도예요.",
    when: (r) => r.homeTrips.perYear > 0 && r.homeTrips.pkm > DETAIL.homeTripPkm.mixed,
    apply: (r) => ({
      ...r,
      homeTrips: { ...r.homeTrips, pkm: r.homeTrips.pkm * 0.75 + DETAIL.homeTripPkm.mixed * 0.25 },
    }),
    easy: {
      title: "본가 갈 때 두 번 중 한 번은 기차·버스로",
      desc: "자가용 대신 KTX·고속버스를 타면 같은 거리의 배출이 5분의 1 정도예요. 절반만 바꿔도 크게 줄어요.",
      apply: (r) => ({
        ...r,
        homeTrips: { ...r.homeTrips, pkm: r.homeTrips.pkm * 0.5 + DETAIL.homeTripPkm.mixed * 0.5 },
      }),
    },
  },
  {
    id: "homeTrips",
    question: "homeTrips",
    item: "homeTrips",
    icon: "calendar",
    title: "본가 방문은 다른 일정과 묶어서",
    desc: "연휴나 시험이 끝난 날처럼 갈 일이 겹칠 때 묶어 다녀오면, 열 번 중 한 번만 줄여도 이만큼 줄어요.",
    when: (r) => r.homeTrips.perYear >= 10,
    apply: (r) => ({ ...r, homeTrips: { ...r.homeTrips, perYear: r.homeTrips.perYear * 0.9 } }),
    easy: {
      desc: "연휴나 시험이 끝난 날처럼 갈 일이 겹칠 때 묶어 다녀오면, 열 번 중 두 번만 줄여도 이만큼 줄어요.",
      apply: (r) => ({ ...r, homeTrips: { ...r.homeTrips, perYear: r.homeTrips.perYear * 0.8 } }),
    },
  },
  {
    id: "rail",
    question: "flights",
    item: "flights",
    icon: "train",
    title: "국내 여행 한 번은 비행기 대신 KTX로",
    desc: "부산·여수처럼 기차로 갈 수 있는 곳은 KTX를 타면 같은 거리의 배출이 6분의 1 수준이에요.",
    when: (r) => r.flights.domestic > 0,
    saving: (r) =>
      Math.min(1, r.flights.domestic) * DETAIL.flightTripKm.domestic * (FLIGHTS.domestic.ef - HOME_TRIPS.pkm),
    easy: {
      title: "국내 여행 두 번은 비행기 대신 KTX로",
      desc: "부산·여수처럼 기차로 갈 수 있는 곳은 KTX를 타면 같은 거리의 배출이 6분의 1 수준이에요.",
      when: (r) => r.flights.domestic >= 2,
      saving: (r) => 2 * DETAIL.flightTripKm.domestic * (FLIGHTS.domestic.ef - HOME_TRIPS.pkm),
    },
  },
  {
    id: "standby",
    item: "electricity",
    icon: "plug",
    title: "자기 전에 멀티탭 끄기",
    desc: "쓰지 않는 기기의 대기전력만 꺼도 전기 사용을 5% 정도 줄일 수 있어요.",
    when: () => true,
    saving: (r) => itemValue(r, "electricity") * STANDBY_SAVING,
  },
  {
    id: "cooling",
    question: "cooling",
    item: "cooling",
    icon: "aircon",
    title: "에어컨 온도 1℃ 올리기",
    desc: "1℃만 올려도 냉방 전력이 7% 정도 줄어요. 선풍기를 함께 틀면 덥게 느껴지지 않아요.",
    when: (r) => r.coolMult > 0,
    saving: (r) => itemValue(r, "cooling") * ONE_DEGREE_SAVING,
    easy: {
      title: "에어컨 온도 2℃ 올리기",
      desc: "1℃마다 냉방 전력이 7% 정도 줄어, 2℃면 14% 정도예요. 선풍기를 함께 틀면 덥게 느껴지지 않아요.",
      saving: (r) => itemValue(r, "cooling") * ONE_DEGREE_SAVING * 2,
    },
  },
  {
    id: "heating",
    question: "heating",
    item: "heating",
    icon: "thermometer",
    title: "난방 온도 1℃ 낮추기",
    desc: "실내에서 얇은 겉옷을 하나 걸치고 1℃만 낮춰도 난방 에너지가 7% 정도 줄어요.",
    when: (r) => r.heatMult > 0,
    saving: (r) => itemValue(r, "heating") * ONE_DEGREE_SAVING,
    easy: {
      title: "난방 온도 2℃ 낮추기",
      desc: "실내에서 겉옷을 하나 걸치고 2℃ 낮추면 난방 에너지가 14% 정도 줄어요(1℃마다 7% 정도).",
      saving: (r) => itemValue(r, "heating") * ONE_DEGREE_SAVING * 2,
    },
  },
  {
    id: "shower",
    item: "hotWater",
    icon: "shower",
    title: "샤워 1~2분 짧게",
    desc: "샤워를 조금만 짧게 해도 온수에 쓰는 가스를 10% 정도 줄일 수 있어요.",
    when: () => true,
    saving: (r) => itemValue(r, "hotWater") * SHOWER_SAVING,
  },
  {
    id: "meat",
    question: "meat",
    item: "meat",
    icon: "salad",
    title: "일주일에 한 끼는 고기 없는 메뉴로",
    desc: "한 끼만 비빔밥·두부 요리처럼 고기 없는 메뉴를 골라 보세요.",
    when: (r) => meatTotal(r) > 1,
    // 소·돼지·닭을 같은 비율로 줄여 주 1회분을 뺀다 (생선은 그대로)
    apply: (r) => fewerMeat(r, 1),
    easy: {
      title: "일주일에 두 끼는 고기 없는 메뉴로",
      desc: "두 끼를 비빔밥·두부 요리처럼 고기 없는 메뉴로 골라 보세요.",
      when: (r) => meatTotal(r) > 2,
      apply: (r) => fewerMeat(r, 2),
    },
  },
  {
    id: "mealsOut",
    question: "mealsOut",
    item: "mealsOut",
    icon: "campus",
    title: "일주일에 한 번은 배달 대신 학식",
    desc: "배달 한 번을 학식으로 바꾸면 배송과 일회용 용기에서 나오는 배출이 줄어요.",
    when: (r) => (r.meals.out ?? 0) + (r.meals.delivery ?? 0) >= 1,
    apply: (r) => toCampus(r, 1),
    easy: {
      title: "일주일에 두 번은 배달 대신 학식",
      desc: "배달 두 번을 학식으로 바꾸면 배송과 일회용 용기에서 나오는 배출이 더 크게 줄어요.",
      when: (r) => (r.meals.out ?? 0) + (r.meals.delivery ?? 0) >= 2,
      apply: (r) => toCampus(r, 2),
    },
  },
  {
    id: "clothes",
    question: "clothes",
    item: "clothes",
    icon: "shirt",
    title: "옷 살 때 가끔은 중고로",
    desc: "네 번 살 때 한 번만 중고 거래나 교내 옷 교환을 이용해도 새 옷 생산 배출을 피할 수 있어요.",
    when: (r) => r.clothes.perMonth > 0 && r.clothes.secondhand < 1,
    apply: (r) => ({ ...r, clothes: { ...r.clothes, secondhand: r.clothes.secondhand + (1 - r.clothes.secondhand) / 4 } }),
    easy: {
      title: "옷 살 때 두 번에 한 번은 중고로",
      desc: "새 옷 대신 두 번에 한 번 중고 거래나 교내 옷 교환을 이용하면 새 옷 생산 배출을 그만큼 피할 수 있어요.",
      apply: (r) => ({ ...r, clothes: { ...r.clothes, secondhand: r.clothes.secondhand + (1 - r.clothes.secondhand) / 2 } }),
    },
  },
  {
    id: "parcels",
    question: "parcels",
    item: "parcels",
    icon: "parcel",
    title: "택배는 장바구니에 모아 한 번에",
    desc: "급하지 않은 물건은 모았다가 주문하면 네 번 받을 택배가 세 번으로 줄어요.",
    when: (r) => r.parcels.domestic + r.parcels.overseas >= 4,
    apply: (r) => ({ ...r, parcels: { domestic: r.parcels.domestic * 0.75, overseas: r.parcels.overseas * 0.75 } }),
    easy: {
      desc: "급하지 않은 물건은 모았다가 주문하면 네 번 받을 택배가 두 번으로 줄어요.",
      apply: (r) => ({ ...r, parcels: { domestic: r.parcels.domestic * 0.5, overseas: r.parcels.overseas * 0.5 } }),
    },
  },
  {
    id: "reusable",
    question: "reusable",
    item: "disposables",
    icon: "tumbler",
    title: "텀블러·다회용기 조금 더 챙기기",
    desc: "10번 중 2번만 더 챙겨도 일회용 컵·용기가 줄고, 탄소중립포인트(녹색생활 실천)도 받을 수 있어요.",
    when: (r) => r.disposables.tumbler < 1 || r.disposables.deliveryReuse < 1,
    apply: (r) => ({
      ...r,
      disposables: {
        ...r.disposables,
        tumbler: Math.min(1, r.disposables.tumbler + REUSE_STEP),
        deliveryReuse: Math.min(1, r.disposables.deliveryReuse + REUSE_STEP),
      },
    }),
    easy: {
      title: "텀블러·다회용기 더 자주 챙기기",
      desc: "10번 중 4번만 더 챙겨도 일회용 컵·용기가 크게 줄고, 탄소중립포인트(녹색생활 실천)도 받을 수 있어요.",
      apply: (r) => ({
        ...r,
        disposables: {
          ...r.disposables,
          tumbler: Math.min(1, r.disposables.tumbler + REUSE_STEP * 2),
          deliveryReuse: Math.min(1, r.disposables.deliveryReuse + REUSE_STEP * 2),
        },
      }),
    },
    point: true,
  },
];

// 제안 목록: focusItem(가장 큰 항목)을 줄이는 제안 중 가장 효과가 큰 것을 맨 앞에,
// 나머지는 예상 감축량 순. 한 항목에 제안이 몰리지 않게 항목당 하나씩만 고른다
// flexibility(계정의 습관 변경 난이도): '불가' 항목은 빼고, '어려움' 항목은 다른 제안이 모자랄 때만 뒤에 넣고,
// '쉬움' 항목은 큰 버전(easy)으로 바꿔 계산한다(isEasy 표시). 순서는 예상 감축량 × 난이도 가중치('가능' 1.3, '쉬움' 1.6)로
// 정해 바꾸기 쉬운 항목을 앞으로 당긴다(가장 큰 항목 제안이 맨 앞인 것은 그대로). 관련 문항이 없는 제안(멀티탭·샤워)은 '보통'으로 본다
export function suggest(answers, { detail, limit = 3, focusItem, flexibility } = {}) {
  const r = resolve(answers, detail);
  const base = calculateResolved(r).total.value;
  const level = (c) => (c.question ? flexLevel(flexibility, c.question) : undefined) ?? 3;
  const hard = (c) => level(c) <= FLEX_HARD;
  const savingOf = (c) => (c.saving ? c.saving(r) : base - calculateResolved(c.apply(r)).total.value);
  // 큰 버전이 이미 한계에 닿아(통학 하루뿐, 다회용기 거의 매번 등) 기본보다 크지 않으면 기본 제안을 쓴다
  const sized = (c) => {
    const normal = { ...c, saving: savingOf(c) };
    if (level(c) !== FLEX_EASY || !c.easy || !(c.easy.when ?? c.when)(r)) return normal;
    const big = savingOf({ saving: c.easy.saving, apply: c.easy.apply });
    return big > normal.saving ? { ...normal, ...c.easy, when: c.when, saving: big, isEasy: true } : normal;
  };
  const ranked = CANDIDATES.filter((c) => c.when(r) && level(c) > FLEX_BLOCKED)
    .map(sized)
    .filter((c) => c.saving >= 1)
    .sort((x, y) => hard(x) - hard(y) || y.saving * flexWeight(level(y)) - x.saving * flexWeight(level(x)));

  const focus = ranked.find((c) => c.item === focusItem && !hard(c));
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
