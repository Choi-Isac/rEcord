export const num = (n, digits = 0) =>
  n.toLocaleString("ko-KR", { minimumFractionDigits: digits, maximumFractionDigits: digits });

// kg → "4.2" (톤, 소수 첫째 자리)
export const toTon = (kg) => num(kg / 1000, 1);

// 10 단위로 반올림한 kg (추정값이라 일의 자리는 의미가 없다)
export const roundKg = (kg) => num(kg >= 100 ? Math.round(kg / 10) * 10 : Math.round(kg));

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
