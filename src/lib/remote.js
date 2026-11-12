// 응답을 Supabase에 보내기 (docs/데이터베이스-구조.md의 테이블 구조)
// 입력값·거주 지역은 통계·연구 활용에 동의한 응답만 보내고, 피드백은 동의와 관계없이 보낸다.
// 어디까지 보냈는지는 레코드의 remote에 기록해 두고, 실패한 부분은 다음에 결과 화면을 볼 때 다시 보낸다.
import { supabase } from "./supabase.js";

const DUPLICATE = "23505"; // 이미 보낸 행 (재시도 중 앞선 요청이 성공했던 경우)

async function insert(table, row) {
  const { error } = await supabase.from(table).insert(row);
  if (error && error.code !== DUPLICATE) throw error;
}

const blankToNull = (v) => (v ? v : null);
const profileKey = (p) => JSON.stringify([p.region]);

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
});

// 자세히 입력: 값과 펼쳐 본 문항을 detail 열(jsonb)에 함께 담는다. 펼쳐 보지도 않았으면 NULL
const detailColumn = ({ detail = {}, detailOpened = [] }) =>
  Object.keys(detail).length || detailOpened.length ? { values: detail, opened: detailOpened } : null;

const answersRow = ({ id, answers: a, defaultsUsed, ...record }) => ({
  response_id: id,
  commute_days: a.commuteDays,
  commute_minutes: a.commuteMinutes,
  commute_mode: a.commuteMode?.length ? a.commuteMode : null, // 여러 개 고를 수 있음(text[]). 통학하지 않으면 NULL
  home_trips: a.homeTrips,
  flights: a.flights,
  housing: a.housing,
  household: a.household,
  cooling: a.cooling,
  heating: a.heating,
  heating_type: a.heatingType ?? null,
  meat: a.meat,
  meals_out: a.mealsOut,
  clothes: a.clothes,
  parcels: a.parcels,
  reusable: a.reusable,
  defaults_used: defaultsUsed,
  parcels_domestic: record.detail?.parcels?.domestic ?? null,
  parcels_overseas: record.detail?.parcels?.overseas ?? null,
  detail: detailColumn(record),
});

// 피드백은 다시 입력할 수 있어 set_feedback 함수로 넣거나 덮어쓴다 (응답 1건에 피드백 1행).
// 동의하지 않은 응답의 피드백은 responses 행 없이 응답 id(무작위 UUID)로만 저장된다
const feedbackArgs = (id, f) => ({
  p_id: id,
  p_interest: f.interest ?? null,
  p_understand: f.understand ?? null,
  p_ease: f.ease ?? null,
  p_satisfaction: f.satisfaction ?? null,
  p_sufficiency: f.sufficiency ?? null,
  p_reuse: f.reuse ?? null,
  p_wish: f.wish ?? null,
  p_submitted_at: f.submittedAt,
});

const research = (record) => Boolean(record.consent?.research);

export const shouldSync = (record) => Boolean(supabase && (research(record) || record.feedback));

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

// 동의한 응답: 응답·답변을 먼저 보내고(지역은 이 행을 고친다) 지역을 보낸다. 피드백은 따로 보낸다
export async function syncRecord(record) {
  const done = { ...record.remote };
  if (research(record)) await syncResponse(record, done);
  await syncFeedback(record, done);
  return done;
}

async function syncResponse(record, done) {
  const profile = profileKey(record.profile);
  if (!done.response) {
    const ok = await step("입력값", async () => {
      await insert("responses", responseRow(record));
      await insert("response_answers", answersRow(record));
    });
    if (!ok) return;
    Object.assign(done, { response: true, profile });
  }
  if (done.profile !== profile) {
    const ok = await step("거주 지역", async () => {
      const { error } = await supabase.rpc("set_profile", {
        p_id: record.id,
        p_region: record.profile.region,
      });
      if (error) throw error;
    });
    if (ok) done.profile = profile;
  }
}

// 마지막으로 보낸 피드백의 시각(feedbackAt)과 다르면 보낸다 → 다시 입력하면 새 답으로 덮어씀
async function syncFeedback(record, done) {
  if (record.feedback && done.feedbackAt !== record.feedback.submittedAt) {
    const sentAt = record.feedback.submittedAt;
    const ok = await step("피드백", async () => {
      const { error } = await supabase.rpc("set_feedback", feedbackArgs(record.id, record.feedback));
      if (error) throw error;
    });
    if (ok) done.feedbackAt = sentAt;
  }
}
