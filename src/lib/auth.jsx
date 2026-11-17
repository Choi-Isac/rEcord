// 로그인: 아이디 + 비밀번호 (이메일 등 다른 개인정보는 받지 않는다)
// Supabase 로그인은 이메일 형식의 계정 이름을 요구하므로, 아이디를 실제로 쓰이지 않는 주소(아이디@ACCOUNT_DOMAIN)로 바꿔 넘긴다.
// 메일은 보내지 않는다: Supabase의 이메일 확인(Confirm email)을 꺼 두어야 한다 (docs/데이터베이스-구조.md)
import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "./supabase.js";

export const USERNAME_RULE = /^[a-z0-9_]{4,20}$/;
export const USERNAME_HINT = "영문 소문자·숫자·밑줄(_) 4~20자";
// 비밀번호: 영문과 숫자를 각각 1자 이상 포함한 8자 이상, 공백 불가 (64자를 넘으면 따로 안내)
export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 64;
export const PASSWORD_HINT = `영문·숫자 포함 ${PASSWORD_MIN}자 이상 · 공백 불가`;
export const passwordOk = (pw) =>
  pw.length >= PASSWORD_MIN && pw.length <= PASSWORD_MAX && /[A-Za-z]/.test(pw) && /\d/.test(pw) && !/\s/.test(pw);
export const PASSWORD_PROBLEM = `비밀번호는 영문과 숫자를 포함한 ${PASSWORD_MIN}자 이상으로, 공백 없이 정해 주세요.`;
export const PASSWORD_TOO_LONG = `비밀번호는 ${PASSWORD_MAX}자 이하로 정해 주세요.`;
// 닉네임: 화면에 보이는 이름. 다른 사람과 같아도 되고, 비워 두면 아이디로 보인다
export const NICKNAME_MAX = 12;
export const cleanNickname = (s) => s.replace(/\s+/g, " ").trim().slice(0, NICKNAME_MAX);
// .invalid는 실제 메일 주소가 될 수 없는 예약 도메인 (RFC 2606)
const ACCOUNT_DOMAIN = "users.record.invalid";

export const normalizeUsername = (s) => s.trim().toLowerCase();
const toEmail = (username) => `${normalizeUsername(username)}@${ACCOUNT_DOMAIN}`;
export const usernameOf = (user) => user?.user_metadata?.username ?? user?.email?.split("@")[0] ?? "";
export const nicknameOf = (user) => user?.user_metadata?.nickname || usernameOf(user);

// Supabase 오류 → 화면 문구
const MESSAGES = [
  [/already registered|already been registered|already exists/i, "이미 쓰고 있는 아이디예요."],
  [/invalid login credentials/i, "아이디 또는 비밀번호가 맞지 않아요."],
  [/email not confirmed/i, "가입 확인 설정이 켜져 있어 로그인할 수 없어요. 관리자에게 알려 주세요."],
  [/signups? not allowed|signup.*disabled/i, "지금은 가입을 받지 않고 있어요."],
  [/password should|weak password|password.*(characters|length)/i, PASSWORD_PROBLEM],
  [/rate limit|too many/i, "요청이 너무 많아요. 잠시 뒤에 다시 시도해 주세요."],
  [/failed to fetch|network|load failed/i, "서버에 연결하지 못했어요. 인터넷 연결을 확인해 주세요."],
];
export const authMessage = (error) =>
  MESSAGES.find(([re]) => re.test(error?.message ?? ""))?.[1] ?? "처리하지 못했어요. 잠시 뒤에 다시 시도해 주세요.";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(!supabase); // 저장된 로그인 상태를 읽었는지

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);
      setReady(true);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, session) => setUser(session?.user ?? null));
    return () => data.subscription.unsubscribe();
  }, []);

  const signUp = async (username, password, nickname = "") => {
    const { data, error } = await supabase.auth.signUp({
      email: toEmail(username),
      password,
      options: { data: { username: normalizeUsername(username), nickname: cleanNickname(nickname) } },
    });
    if (error) throw error;
    // 이메일 확인이 켜져 있으면 세션 없이 가입만 된다
    if (!data.session) throw new Error("Email not confirmed");
  };

  const signIn = async (username, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email: toEmail(username), password });
    if (error) throw error;
  };

  // 닉네임 바꾸기 (빈 값이면 아이디로 보인다). 바뀐 계정 정보는 onAuthStateChange로 들어온다
  const updateNickname = async (nickname) => {
    const { error } = await supabase.auth.updateUser({ data: { nickname: cleanNickname(nickname) } });
    if (error) throw error;
  };

  // 습관 변경 난이도 (flexibility.js). 전체를 한 번에 저장한다
  const updateFlexibility = async (flexibility) => {
    const { error } = await supabase.auth.updateUser({ data: { flexibility } });
    if (error) throw error;
  };

  // 이 기기에서만 로그아웃한다 (다른 기기의 로그인은 그대로)
  const signOut = () => supabase.auth.signOut({ scope: "local" });

  // 계정 삭제: 서버 함수가 본인 계정과 계정 기록(user_records)을 함께 지운다
  const deleteAccount = async () => {
    const { error } = await supabase.rpc("delete_my_account");
    if (error) throw error;
    await supabase.auth.signOut({ scope: "local" });
  };

  const value = {
    enabled: Boolean(supabase),
    ready,
    user,
    username: usernameOf(user),
    nickname: nicknameOf(user),
    flexibility: user?.user_metadata?.flexibility ?? {},
    signUp,
    signIn,
    updateNickname,
    updateFlexibility,
    signOut,
    deleteAccount,
  };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
