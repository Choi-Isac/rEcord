// 응답을 Supabase에 보내기 (docs/데이터베이스-구조.md의 테이블 구조)
// 통계·연구 활용에 동의한 응답만 보낸다. 동의하지 않은 응답은 이 브라우저에만 남는다.
// 어디까지 보냈는지는 레코드의 remote에 기록해 두고, 실패한 부분은 다음에 결과 화면을 볼 때 다시 보낸다.
import { supabase } from "./supabase.js";

const DUPLICATE = "23505"; // 이미 보낸 행 (재시도 중 앞선 요청이 성공했던 경우)

async function insert(table, row) {
  const { error } = await supabase.from(table).insert(row);
  if (error && error.code !== DUPLICATE) throw error;
}

const blankToNull = (v) => (v ? v : null);
const profileKey = (p) => JSON.stringify([p.region, p.university, p.department]);

const responseRow = (r) => ({
  id: r.id,
  schema_version: r.schemaVersion,
  factor_version: r.factorVersion,
  input_mode: r.inputMode,
  semester: r.semester,
  started_at: r.startedAt,
  completed_at: r.completedAt,
  duration_sec: r.durationSec,
  consent_service: r.consent.service,
  consent_research: r.consent.research,
  consent_at: r.consent.agreedAt ?? r.startedAt,
  region: blankToNull(r.profile.region),
  university: blankToNull(r.profile.university),
  department: blankToNull(r.profile.department),
});

const answersRow = ({ id, answers: a, defaultsUsed }) => ({
  response_id: id,
  commute_days: a.commuteDays,
  commute_minutes: a.commuteMinutes,
  commute_mode: a.commuteDays === 0 ? null : a.commuteMode,
  home_trips: a.homeTrips,
  flights: a.flights,
  housing: a.housing,
  household: a.household,
  cooling: a.cooling,
  heating: a.heating,
  meat: a.meat,
  meals_out: a.mealsOut,
  clothes: a.clothes,
  parcels: a.parcels,
  reusable: a.reusable,
  defaults_used: defaultsUsed,
});

const feedbackRow = (id, f) => ({
  response_id: id,
  understand: f.understand,
  trust: f.trust,
  intent: f.intent,
  revisit: f.revisit,
  submitted_at: f.submittedAt,
});

export const shouldSync = (record) => Boolean(supabase && record.consent?.research);

// 실패한 단계만 다음에 다시 보낸다
async function step(name, run) {
  try {
    await run();
    return true;
  } catch (error) {
    console.warn(`응답(${name})을 서버에 저장하지 못했어요. 다음에 다시 시도해요.`, error.message ?? error);
    return false;
  }
}

// 응답·답변을 먼저 보내고(지역·피드백은 이 행을 참조), 지역과 피드백은 서로 따로 보낸다
export async function syncRecord(record) {
  const done = { ...record.remote };
  const profile = profileKey(record.profile);

  if (!done.response) {
    const ok = await step("입력값", async () => {
      await insert("responses", responseRow(record));
      await insert("response_answers", answersRow(record));
    });
    if (!ok) return done;
    Object.assign(done, { response: true, profile });
  }
  if (done.profile !== profile) {
    const ok = await step("지역·대학·학과", async () => {
      const { error } = await supabase.rpc("set_profile", {
        p_id: record.id,
        p_region: record.profile.region,
        p_university: record.profile.university,
        p_department: record.profile.department,
      });
      if (error) throw error;
    });
    if (ok) done.profile = profile;
  }
  if (record.feedback && !done.feedback) {
    if (await step("피드백", () => insert("feedback", feedbackRow(record.id, record.feedback)))) done.feedback = true;
  }
  return done;
}
