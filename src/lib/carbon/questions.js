// 간편 입력 13개 항목 (README '입력 데이터 항목'의 [간편] 표시)
// 칩(chips)은 반드시 골라야 하고, 슬라이더는 기본값에서 시작해 원하면 조정한다.

// 통학 편도 시간: 5~30분은 1분 간격, 30~120분은 5분 간격
export const COMMUTE_MINUTE_STEPS = [
  ...Array.from({ length: 26 }, (_, i) => 5 + i),
  ...Array.from({ length: 18 }, (_, i) => 35 + i * 5),
];

export const CLIMATE_LEVELS = ["아주 적게", "적게", "보통", "많이", "아주 많이"];

const noCommute = (a) => a.commuteDays === 0;

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
    options: [
      { value: "none", label: "거의 없음", icon: "🏠" },
      { value: "semester", label: "학기당 1~2회", icon: "🗓️" },
      { value: "monthly", label: "월 1~2회", icon: "🚆" },
      { value: "weekly", label: "매주", icon: "🔁" },
      { value: "twicePlus", label: "주 2회 이상", icon: "⏩" },
    ],
  },
  {
    id: "flights",
    category: "transport",
    type: "chips",
    label: "최근 1년 동안 비행기를 어떻게 탔나요?",
    options: [
      { value: "none", label: "타지 않았어요", icon: "🙅" },
      { value: "domestic", label: "국내 위주", icon: "🛫" },
      { value: "asia", label: "아시아 해외여행", icon: "🌏" },
      { value: "long", label: "장거리 해외여행", icon: "🌍" },
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
      { value: "alone", label: "자취", sub: "원룸·오피스텔·빌라", icon: "🏠" },
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
    options: [
      { value: 1, label: "1명", icon: "🧍" },
      { value: 2, label: "2명", icon: "👥" },
      { value: 3, label: "3명", icon: "👪" },
      { value: 4, label: "4명 이상", icon: "👨‍👩‍👧‍👦" },
    ],
  },
  {
    id: "climate",
    category: "housing",
    type: "dual",
    label: "냉난방은 얼마나 쓰나요?",
    hint: "주변 사람들과 비교해 어느 정도인지 골라 주세요.",
    sliders: [
      { id: "cooling", label: "냉방 (에어컨)", icon: "❄️" },
      { id: "heating", label: "난방", icon: "🔥" },
    ],
    min: 1,
    max: 5,
    default: 3,
    format: (v) => CLIMATE_LEVELS[v - 1],
    scale: ["적음", "많음"],
  },

  // ── 식생활
  {
    id: "meat",
    category: "food",
    type: "chips",
    label: "고기(소·돼지·닭)를 얼마나 자주 먹나요?",
    options: [
      { value: "rare", label: "거의 안 먹음", icon: "🥦" },
      { value: "low", label: "주 1~2회", icon: "🍳" },
      { value: "mid", label: "주 3~5회", icon: "🍗" },
      { value: "daily", label: "매일", icon: "🥩" },
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
    options: [
      { value: "rarely", label: "거의 안 씀", icon: "🥤" },
      { value: "sometimes", label: "가끔", icon: "🔁" },
      { value: "often", label: "자주", icon: "♻️" },
    ],
  },
];

// 항목이 다루는 답변 키 (냉난방은 슬라이더 2개)
export const answerKeys = (q) => (q.type === "dual" ? q.sliders.map((s) => s.id) : [q.id]);

// 입력 시작 시 상태: 칩은 미선택, 슬라이더는 기본값
export const emptyAnswers = () =>
  Object.fromEntries(QUESTIONS.flatMap((q) => answerKeys(q).map((k) => [k, q.type === "chips" ? null : q.default])));

export const isSkipped = (q, answers) => Boolean(q.skipWhen?.(answers));

// 칩은 골랐을 때, 슬라이더는 직접 움직였을 때 답한 것으로 센다
export const isAnswered = (q, answers, touched) =>
  isSkipped(q, answers) || (q.type === "chips" ? answers[q.id] != null : touched.includes(q.id));

export const missingRequired = (answers) =>
  QUESTIONS.filter((q) => q.type === "chips" && !isSkipped(q, answers) && answers[q.id] == null);

export const optionLabel = (id, value) => QUESTIONS.find((q) => q.id === id)?.options?.find((o) => o.value === value)?.label;
