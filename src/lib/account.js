// 계정별 계산 기록 (user_records 테이블, 본인 행만 읽고 쓸 수 있음 — docs/데이터베이스-구조.md)
// 응답 레코드(docs/응답-데이터-스키마.md)를 통째로 data 열에 담는다. 통계·연구용 테이블과는 연결하지 않는다
import { supabase } from "./supabase.js";

const TABLE = "user_records";

export async function pullRecords() {
  const { data, error } = await supabase.from(TABLE).select("data");
  if (error) throw error;
  return data.map((row) => row.data);
}

export async function pushRecords(userId, records) {
  const rows = records.map((r) => ({ user_id: userId, id: r.id, data: r, updated_at: stampOf(r) }));
  const { error } = await supabase.from(TABLE).upsert(rows, { onConflict: "user_id,id" });
  if (error) throw error;
}

// 마지막으로 고친 시각 (예전 레코드는 updatedAt이 없어 완료 시각)
export const stampOf = (r) => r.updatedAt ?? r.completedAt;

// 계정 기록과 이 기기 기록을 합친다: 같은 응답은 더 나중에 고친 쪽, 순서는 계산한 날짜순
export function mergeRecords(server, local) {
  const map = new Map(server.map((r) => [r.id, r]));
  for (const r of local) {
    const s = map.get(r.id);
    if (!s || stampOf(r) > stampOf(s)) map.set(r.id, r);
  }
  return [...map.values()].sort((a, b) => a.completedAt.localeCompare(b.completedAt));
}
