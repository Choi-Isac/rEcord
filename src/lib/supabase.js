// Supabase 클라이언트: 접속 정보는 .env.local(VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY)에서 읽는다
// 값이 없으면(예: .env.local 없이 빌드) null이 되고, 응답은 이 브라우저에만 저장된다
import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = url && key ? createClient(url, key) : null;
