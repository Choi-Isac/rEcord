// Supabase 클라이언트: 접속 정보는 .env.local(VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY)에서 읽는다
// 값이 없으면(예: .env.local 없이 빌드) null이 되고, 응답은 이 브라우저에만 저장되며 로그인도 쓸 수 없다
import { createClient } from "@supabase/supabase-js";
import { createMockClient } from "./mockSupabase.js";

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
const configured = Boolean(url && key);
// npm run dev:mock: 서버 대신 브라우저 안의 가짜 Supabase로 로그인 이후 화면을 둘러본다 (연구용 전송은 끔).
// 배포 빌드에서는 MODE가 "production"이라 이 분기와 mockSupabase.js가 빠진다
export const MOCK = import.meta.env.MODE === "mock";

// 로그인 세션을 쓰는 클라이언트: 계정과 계정별 계산 기록(user_records)에 쓴다
// HashRouter라 주소의 #은 화면 경로다. 로그인 결과를 주소에서 읽지 않는다(아이디·비밀번호 로그인만 씀)
export const supabase = MOCK
  ? createMockClient()
  : configured
    ? createClient(url, key, { auth: { detectSessionInUrl: false } })
    : null;

// 통계·연구용 전송(remote.js)은 로그인 여부와 관계없이 늘 익명(anon)으로 보낸다.
// 세션을 저장하지도 공유하지도 않는 별도 클라이언트라, 연구용 응답이 계정과 이어지지 않는다
export const researchDb = MOCK
  ? null
  : configured
    ? createClient(url, key, {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, storageKey: "record-research" },
      })
    : null;
