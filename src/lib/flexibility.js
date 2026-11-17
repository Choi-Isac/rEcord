// 습관 변경 난이도: 항목별로 바꾸기 어렵고 쉬운 정도 (계정마다 user_metadata.flexibility에 { 문항 id: 1~5 }로 저장)
// 감축 제안을 고를 때 쓴다: 1(불가)인 항목은 제안하지 않고, 2(어려움)는 다른 제안 뒤로 미루고,
// 4(가능)·5(쉬움)는 순서를 정할 때 감축량에 가중치(FLEX_WEIGHT)를 곱해 앞으로 당기고,
// 5(쉬움)는 조금 더 큰 제안(이틀·두 끼·2℃ 등)을 한다 (suggestions.js)
// 건강·가족·경제 사정처럼 민감해서 바꾸기 어려운 생활은 되도록 건드리지 않기 위한 것
export const FLEX_LEVELS = [
  { value: 1, short: "불가", label: "바꿀 수 없음" },
  { value: 2, short: "어려움", label: "바꾸기 어려움" },
  { value: 3, short: "보통", label: "보통" },
  { value: 4, short: "가능", label: "바꿀 수 있음" },
  { value: 5, short: "쉬움", label: "쉽게 바꿀 수 있음" },
];
export const FLEX_DEFAULT = 3; // 고르지 않은 항목
export const FLEX_BLOCKED = 1; // 제안하지 않음
export const FLEX_HARD = 2; // 뒤로 미룸
export const FLEX_EASY = 5; // 더 크게 제안
// 제안 순서용 가중치: 예상 감축량 × 가중치 순으로 고른다(화면의 감축량은 그대로). 고르지 않은 항목·보통은 1
export const FLEX_WEIGHT = { 4: 1.3, 5: 1.6 };
export const flexWeight = (level) => FLEX_WEIGHT[level] ?? 1;

// 간편 입력 문항(questions.js의 id)별 짧은 이름. 난방은 방식과 시간을 함께 본다
export const FLEX_ITEMS = [
  { id: "commuteDays", category: "transport", label: "통학 일수" },
  { id: "commuteMinutes", category: "transport", label: "통학 시간" },
  { id: "commuteMode", category: "transport", label: "통학 수단" },
  { id: "homeTrips", category: "transport", label: "본가 등 장거리 이동" },
  { id: "flights", category: "transport", label: "비행기 여행" },
  { id: "housing", category: "housing", label: "사는 곳" },
  { id: "household", category: "housing", label: "함께 사는 인원" },
  { id: "cooling", category: "housing", label: "냉방" },
  { id: "heating", category: "housing", label: "난방" },
  { id: "meat", category: "food", label: "고기 섭취" },
  { id: "mealsOut", category: "food", label: "배달·외식" },
  { id: "clothes", category: "goods", label: "옷·신발·가방 구매" },
  { id: "parcels", category: "goods", label: "택배" },
  { id: "reusable", category: "goods", label: "텀블러·다회용기" },
];

export const flexLevel = (flexibility, id) => flexibility?.[id] ?? FLEX_DEFAULT;
