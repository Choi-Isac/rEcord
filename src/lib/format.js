export const num = (n, digits = 0) =>
  n.toLocaleString("ko-KR", { minimumFractionDigits: digits, maximumFractionDigits: digits });

// 화면에 보이는 값으로 반올림한 kg. 두 값의 차이를 보여 줄 때는 이 값끼리 빼야 표기와 맞는다
// (예: 3.76톤 → 3.8, 3.94톤 → 3.9 이면 차이는 0.2가 아니라 0.1)
export const tonValue = (kg) => Math.round(kg / 100) * 100; // 0.1톤 단위
export const kgValue = (kg) => (kg >= 100 ? Math.round(kg / 10) * 10 : Math.round(kg)); // 10kg 단위

// kg → "4.2" (톤, 소수 첫째 자리)
export const toTon = (kg) => num(tonValue(kg) / 1000, 1);

// 10 단위로 반올림한 kg (추정값이라 일의 자리는 의미가 없다)
export const roundKg = (kg) => num(kgValue(kg));

// 보이는 톤 값끼리의 차이(kg): a − b
export const tonDiff = (a, b) => tonValue(a) - tonValue(b);

// ISO 시각 → "2026.11.04"
export const formatDate = (iso) => {
  const d = new Date(iso);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
};

// 초 → "1분 12초"
export const formatDuration = (sec) => {
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return m ? `${m}분 ${s}초` : `${s}초`;
};
