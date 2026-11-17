// 개발용 가짜 Supabase (npm run dev:mock). 서버 없이 로그인 이후 화면을 둘러보기 위한 것.
// 앱이 쓰는 기능(가입·로그인·로그아웃·닉네임·계정 기록·계정 삭제)만 이 브라우저의 localStorage에서 흉내 낸다.
// 비밀번호도 그대로 저장하므로 개발에만 쓴다. 배포 빌드(mode production)에는 포함되지 않는다(supabase.js)
const KEY = "mock:supabase";

const load = () => {
  try {
    return { users: [], records: {}, session: null, ...JSON.parse(localStorage.getItem(KEY)) };
  } catch {
    return { users: [], records: {}, session: null };
  }
};
const save = (db) => localStorage.setItem(KEY, JSON.stringify(db));
const fail = (message, status = 400) => ({ name: "AuthApiError", message, status });
const wait = () => new Promise((r) => setTimeout(r, 300)); // 서버를 기다리는 느낌

export function createMockClient() {
  const listeners = new Set();
  const userJson = (u) => ({ id: u.id, email: u.email, user_metadata: u.meta, aud: "authenticated" });
  const sessionOf = (u) => ({ access_token: "mock", token_type: "bearer", user: userJson(u) });
  const current = (db) => db.users.find((u) => u.id === db.session) ?? null;
  const emit = (event, session) => listeners.forEach((cb) => cb(event, session));
  const signIn = (db, u) => {
    db.session = u.id;
    save(db);
    const session = sessionOf(u);
    emit("SIGNED_IN", session);
    return { data: { user: session.user, session }, error: null };
  };

  const auth = {
    async getSession() {
      const u = current(load());
      return { data: { session: u ? sessionOf(u) : null }, error: null };
    },
    onAuthStateChange(cb) {
      listeners.add(cb);
      return { data: { subscription: { unsubscribe: () => listeners.delete(cb) } } };
    },
    async signUp({ email, password, options }) {
      await wait();
      const db = load();
      if (db.users.some((u) => u.email === email)) return { data: {}, error: fail("User already registered", 422) };
      const u = { id: crypto.randomUUID(), email, password, meta: options?.data ?? {} };
      db.users.push(u);
      return signIn(db, u);
    },
    async signInWithPassword({ email, password }) {
      await wait();
      const db = load();
      const u = db.users.find((x) => x.email === email && x.password === password);
      return u ? signIn(db, u) : { data: {}, error: fail("Invalid login credentials") };
    },
    async updateUser({ data }) {
      await wait();
      const db = load();
      const u = current(db);
      if (!u) return { data: {}, error: fail("Auth session missing!", 401) };
      Object.assign(u.meta, data);
      save(db);
      emit("USER_UPDATED", sessionOf(u));
      return { data: { user: userJson(u) }, error: null };
    },
    async signOut() {
      const db = load();
      db.session = null;
      save(db);
      emit("SIGNED_OUT", null);
      return { error: null };
    },
  };

  async function rpc(name) {
    await wait();
    if (name !== "delete_my_account") return { data: null, error: fail(`mock: ${name} 없음`, 404) };
    const db = load();
    db.users = db.users.filter((u) => u.id !== db.session);
    delete db.records[db.session];
    save(db);
    return { data: null, error: null };
  }

  // user_records만 흉내 낸다: select(본인 기록), upsert(본인 기록 넣기·덮어쓰기)
  const from = (table) => ({
    async select() {
      await wait();
      const db = load();
      if (table !== "user_records" || !db.session) return { data: null, error: fail("permission denied", 401) };
      return { data: Object.values(db.records[db.session] ?? {}).map((data) => ({ data })), error: null };
    },
    async upsert(rows) {
      await wait();
      const db = load();
      if (table !== "user_records" || !db.session) return { error: fail("permission denied", 401) };
      const mine = (db.records[db.session] ??= {});
      for (const row of [].concat(rows)) mine[row.id] = row.data;
      save(db);
      return { error: null };
    },
  });

  return { auth, rpc, from };
}
