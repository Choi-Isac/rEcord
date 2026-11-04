// 결과 화면의 거주 지역별 포인트 제도 안내 (MVP는 안내 링크만 제공, 연동하지 않음)
export const REGIONS = [
  "서울", "부산", "대구", "인천", "광주", "대전", "울산", "세종", "경기",
  "강원", "충북", "충남", "전북", "전남", "경북", "경남", "제주",
];

const GREEN_LIFE = {
  name: "탄소중립포인트 녹색생활 실천",
  desc: "텀블러·다회용컵, 전자영수증, 배달 다회용기, 리필스테이션 이용 등으로 포인트를 받아요. 전국 누구나 참여할 수 있어요.",
  url: "https://www.cpoint.or.kr",
};

export function pointPrograms(region) {
  if (!region) return [];
  if (region === "서울") {
    return [
      {
        name: "서울시 에코마일리지",
        desc: "전기·가스·수도 사용량을 이전보다 줄이면 마일리지를 받아요. 요금을 직접 내는 서울시민이 대상이에요.",
        url: "https://ecomileage.seoul.go.kr",
      },
      GREEN_LIFE,
    ];
  }
  return [
    {
      name: "탄소중립포인트 에너지",
      desc: "전기·가스·수도 사용량을 이전보다 줄이면 포인트를 받아요. 요금을 직접 내는 가구가 대상이에요(서울 제외).",
      url: "https://www.cpoint.or.kr",
    },
    GREEN_LIFE,
  ];
}
