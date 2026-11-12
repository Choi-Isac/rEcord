import { CLIMATE_HOURS } from "./factors.js";

// 간편 입력 항목 (README '입력 데이터 항목'의 [간편] 표시)
// 칩(chips)은 반드시 골라야 하고, 슬라이더와 기본값(default)이 있는 칩은 기본값에서 시작해 원하면 조정한다.
// display: 칩을 보여 주는 방식 — "stops"(점을 잇는 막대, 슬라이더처럼), "people"(사람 칸), "cells"(설명이 붙은 칸)
// multiple: 여러 개 고를 수 있는 칩(값은 배열) / type "group": 한 문항 안의 여러 답(parts)

// 통학 편도 시간: 5~30분은 1분 간격, 30~120분은 5분 간격
export const COMMUTE_MINUTE_STEPS = [
  ...Array.from({ length: 26 }, (_, i) => 5 + i),
  ...Array.from({ length: 18 }, (_, i) => 35 + i * 5),
];

// 냉난방 하루 사용 시간 5칸. 값 1~5 = factors.js CLIMATE_HOURS의 순서
const hourCells = (captions) =>
  CLIMATE_HOURS.map((h, i) => ({
    value: i + 1,
    label: i === CLIMATE_HOURS.length - 1 ? `${h}시간 이상` : `${h}시간`,
    sub: captions[i],
  }));

// 통학 일수는 자세히 입력(요일 선택)이 있으면 그 요일 수를 따른다
const noCommute = (a, d) => (d?.commuteDays ? d.commuteDays.days.length : a.commuteDays) === 0;

export const QUESTIONS = [
  // ── 이동
  {
    id: "commuteDays",
    category: "transport",
    type: "slider",
    label: "일주일에 며칠 학교에 가나요?",
    min: 0,
    max: 7,
    default: 4,
    format: (v) => (v === 0 ? "통학 안 함" : `주 ${v}일`),
    scale: ["0일", "7일"],
  },
  {
    id: "commuteMinutes",
    category: "transport",
    type: "slider",
    label: "통학 편도 시간은 얼마나 걸리나요?",
    hint: "집을 나서서 강의실에 도착할 때까지, 걷고 기다리는 시간도 포함해 주세요.",
    hintShort: "걷고 기다리는 시간도 포함해요.",
    steps: COMMUTE_MINUTE_STEPS,
    default: 40,
    format: (v) => `${v}분`,
    scale: ["5분", "120분"],
    skipWhen: noCommute,
  },
  {
    id: "commuteMode",
    category: "transport",
    type: "chips",
    label: "주로 어떤 수단으로 통학하나요?",
    hint: "갈아타면 모두 골라 주세요. 고른 수단을 같은 시간씩 탄다고 보고 계산해요.",
    hintShort: "갈아타면 모두 골라 주세요.",
    multiple: true,
    options: [
      { value: "walk", label: "도보", icon: "🚶" },
      { value: "bike", label: "자전거·킥보드", icon: "🚲" },
      { value: "bus", label: "버스", icon: "🚌" },
      { value: "subway", label: "지하철", icon: "🚇" },
      { value: "car", label: "자가용", icon: "🚗" },
      { value: "taxi", label: "택시", icon: "🚕" },
      { value: "moto", label: "오토바이", icon: "🛵" },
    ],
    skipWhen: noCommute,
  },
  {
    id: "homeTrips",
    category: "transport",
    type: "chips",
    label: "본가 방문 등 장거리 이동은 얼마나 자주 하나요?",
    hint: "기차·고속버스로 다른 도시에 다녀오는 왕복 기준이에요.",
    hintShort: "다른 도시 왕복 기준이에요.",
    options: [
      { value: "none", label: "거의 없음" },
      { value: "semester", label: "학기당 1~2회" },
      { value: "monthly", label: "월 1~2회" },
      { value: "weekly", label: "매주" },
      { value: "twicePlus", label: "주 2회 이상" },
    ],
  },
  {
    id: "flights",
    category: "transport",
    type: "chips",
    label: "최근 1년 동안 비행기를 어떻게 탔나요?",
    // 거리 막대: 가까운 곳에서 먼 곳 순서. 고른 곳 위로 비행기가 옮겨 간다
    display: "stops",
    marker: "✈️",
    options: [
      { value: "none", label: "타지 않았어요" },
      { value: "domestic", label: "국내 위주", sub: "제주 등" },
      { value: "asia", label: "아시아 해외여행", sub: "도쿄·방콕 등" },
      { value: "long", label: "장거리 해외여행", sub: "유럽·미주 등" },
    ],
  },

  // ── 주거
  {
    id: "housing",
    category: "housing",
    type: "chips",
    label: "어디에 살고 있나요?",
    options: [
      { value: "family", label: "본가", icon: "🏡" },
      { value: "alone", label: "자취", sub: "원룸·오피스텔·빌라", icon: "🏢" },
      { value: "dorm", label: "기숙사", icon: "🏫" },
      { value: "boarding", label: "하숙·고시원", icon: "🛏️" },
      { value: "share", label: "쉐어하우스", icon: "🧑‍🤝‍🧑" },
    ],
  },
  {
    id: "household",
    category: "housing",
    type: "chips",
    label: "나를 포함해 몇 명이 함께 사나요?",
    hint: "기숙사·하숙은 같은 방을 쓰는 인원을 골라 주세요.",
    hintShort: "기숙사·하숙은 같은 방 인원이에요.",
    // 거주 형태를 고르면 그 형태의 기본 인원이 미리 골라진다 → 직접 고르기 전까지는 기본값으로 센다
    autoDefault: true,
    // 칩 대신 사람 칸 넷: 누른 칸과 그 왼쪽 칸이 모두 켜진다 (■■■□ = 3명)
    display: "people",
    options: [
      { value: 1, label: "1명", icon: "👤" },
      { value: 2, label: "2명", icon: "👤" },
      { value: 3, label: "3명", icon: "👤" },
      { value: 4, label: "4명 이상", icon: "👤" },
    ],
  },
  {
    id: "cooling",
    category: "housing",
    type: "chips",
    display: "cells",
    label: "여름에 에어컨을 하루 몇 시간 켜나요?",
    hint: "에어컨을 켜는 날 기준, 하루 평균 시간을 골라 주세요.",
    hintShort: "켜는 날의 하루 평균이에요.",
    default: 3,
    options: hourCells(["땀날 때만 잠깐", "저녁에 몇 시간", "저녁부터 잠들 때까지", "잘 때도 켜 두는 편", "집에 있으면 계속"]),
  },
  {
    id: "heating",
    category: "housing",
    type: "group",
    label: "겨울에 난방은 어떤 방식으로, 하루 몇 시간 켜나요?",
    parts: [
      {
        id: "heatingType",
        type: "chips",
        label: "난방 방식",
        default: "unknown",
        options: [
          { value: "gas", label: "가스보일러", sub: "개별 도시가스" },
          { value: "electric", label: "전기 난방", sub: "히터·전기장판·온풍기" },
          { value: "district", label: "지역·중앙난방", sub: "아파트·기숙사 공용" },
          { value: "unknown", label: "잘 모름", sub: "관리비 포함 등" },
        ],
      },
      {
        id: "heating",
        type: "chips",
        display: "cells",
        label: "하루 난방 시간",
        default: 3,
        options: hourCells(["추울 때만 잠깐", "아침·저녁에 잠깐씩", "저녁부터 잠들 때까지", "잘 때도 켜 두는 편", "집에 있으면 계속"]),
      },
    ],
  },

  // ── 식생활
  {
    id: "meat",
    category: "food",
    type: "chips",
    label: "고기(소·돼지·닭)를 얼마나 자주 먹나요?",
    display: "stops",
    options: [
      { value: "rare", label: "거의 안 먹음" },
      { value: "low", label: "주 1~2회" },
      { value: "mid", label: "주 3~5회" },
      { value: "daily", label: "매일" },
    ],
  },
  {
    id: "mealsOut",
    category: "food",
    type: "slider",
    label: "배달·외식은 일주일에 몇 번 하나요?",
    hint: "학식과 직접 만든 식사는 빼고 세어 주세요.",
    min: 0,
    max: 14,
    default: 4,
    format: (v) => `주 ${v}회`,
    scale: ["0회", "14회"],
  },

  // ── 소비
  {
    id: "clothes",
    category: "goods",
    type: "slider",
    label: "새 옷·신발·가방을 한 달에 몇 개 사나요?",
    min: 0,
    max: 10,
    default: 2,
    format: (v) => (v === 10 ? "10개 이상" : `${v}개`),
    scale: ["0개", "10개 이상"],
  },
  {
    id: "parcels",
    category: "goods",
    type: "slider",
    label: "택배를 한 달에 몇 건 받나요?",
    min: 0,
    max: 20,
    default: 5,
    format: (v) => (v === 20 ? "20건 이상" : `${v}건`),
    scale: ["0건", "20건 이상"],
  },
  {
    id: "reusable",
    category: "goods",
    type: "chips",
    label: "텀블러·다회용기를 얼마나 쓰나요?",
    // 가운데(가끔)에서 시작하는 막대 — 슬라이더처럼 기본값으로 둘 수 있다
    display: "stops",
    default: "sometimes",
    options: [
      { value: "rarely", label: "거의 안 씀" },
      { value: "sometimes", label: "가끔" },
      { value: "often", label: "자주" },
    ],
  },
];

// 항목이 다루는 답변 키 (난방은 방식과 시간 2개)
export const answerKeys = (q) => (q.parts ?? [q]).map((p) => p.id);

// 답이 있는가 (여러 개 고르는 칩은 하나 이상)
export const hasValue = (v) => (Array.isArray(v) ? v.length > 0 : v != null);

// 반드시 골라야 하는 문항: 기본값이 없는 칩
export const mustPick = (q) => q.type === "chips" && q.default === undefined;

// 입력 시작 시 상태: 골라야 하는 칩은 미선택, 나머지는 기본값
export const emptyAnswers = () =>
  Object.fromEntries(QUESTIONS.flatMap((q) => (q.parts ?? [q]).map((p) => [p.id, p.default ?? null])));

// 기본값이 있는데 비어 있는 답(이전 버전의 초안)을 기본값으로 채운다
export function withDefaults(answers) {
  const empty = emptyAnswers();
  const out = Object.fromEntries(Object.entries({ ...empty, ...answers }).map(([k, v]) => [k, v ?? empty[k]]));
  // 통학 수단은 여러 개 고를 수 있다 (2026-11-11 이전 초안은 문자열 하나)
  if (typeof out.commuteMode === "string") out.commuteMode = [out.commuteMode];
  return out;
}

export const isSkipped = (q, answers, detail) => Boolean(q.skipWhen?.(answers, detail));

// 골라야 하는 칩은 골랐을 때, 기본값이 있는 문항은 직접 바꿨거나 자세히 입력했을 때 답한 것으로 센다
export const isAnswered = (q, answers, touched, detail) =>
  isSkipped(q, answers, detail) ||
  (mustPick(q) ? hasValue(answers[q.id]) : touched.includes(q.id) || Boolean(detail?.[q.id]));

// 기본값으로 둔 문항: 손대지 않은 슬라이더·기본값 있는 칩, 거주 형태에 맞춰 미리 골라진 동거 인원
const isDefaultValue = (q, answers, touched, detail) =>
  !isSkipped(q, answers, detail) &&
  !touched.includes(q.id) &&
  !detail?.[q.id] &&
  (!mustPick(q) || (q.autoDefault && hasValue(answers[q.id])));

// 진행도: 채운 문항 = 답한 문항(건너뛴 문항 포함) + 기본값으로 둔 문항. 칩을 안 고른 문항만 비어 있다
export function progressOf(qs, answers, touched, detail) {
  const defaults = qs.filter((q) => isDefaultValue(q, answers, touched, detail)).length;
  const filled = qs.filter((q) => isDefaultValue(q, answers, touched, detail) || isAnswered(q, answers, touched, detail)).length;
  return { answered: filled - defaults, defaults, filled, total: qs.length };
}

export const missingRequired = (answers, detail) =>
  QUESTIONS.filter((q) => mustPick(q) && !isSkipped(q, answers, detail) && !hasValue(answers[q.id]));

export const optionLabel = (id, value) =>
  QUESTIONS.flatMap((q) => q.parts ?? [q])
    .find((q) => q.id === id)
    ?.options?.find((o) => o.value === value)?.label;
