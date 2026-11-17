// 계산 기록 목록: 이 브라우저(localStorage)에 저장하고, 로그인하면 계정(user_records)과 맞춘다.
// - 로그인하면 계정 기록을 불러와 이 기기 기록과 합친다 (이 기기에만 있던 기록도 계정에 저장)
// - 그 뒤로는 새로 계산하거나 고친 기록만 계정에 저장한다. 실패하면 다음 변경·재시도 때 다시 보낸다
// - 로그아웃하면 이 기기의 기록과 입력 중이던 답을 지운다 (계정에는 남아 있음)
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { useAuth } from "./auth.jsx";
import { mergeRecords, pullRecords, pushRecords } from "./account.js";
import { DRAFT_KEY, RESPONSES_KEY } from "./responses.js";
import { useStoredState } from "./storage.js";

const RecordsContext = createContext(null);

export function RecordsProvider({ children }) {
  const [responses, setResponses] = useStoredState(RESPONSES_KEY, []);
  const { user } = useAuth();
  const uid = user?.id ?? null;

  const [linked, setLinked] = useState(null); // 계정 기록과 처음 합치기를 마친 계정 id
  const [status, setStatus] = useState("idle"); // idle | loading | saving | saved | error
  const [attempt, setAttempt] = useState(0); // 불러오기에 실패했을 때 다시 시도
  const synced = useRef(new Map()); // 응답 id → 계정에 마지막으로 저장한 내용(JSON)
  const latest = useRef(responses);
  latest.current = responses;
  const queue = useRef(Promise.resolve());

  const unsynced = () => latest.current.filter((r) => synced.current.get(r.id) !== JSON.stringify(r));

  // 로그인하면 계정 기록을 불러와 합친다
  useEffect(() => {
    setLinked(null);
    synced.current = new Map();
    if (!uid) return setStatus("idle");
    let alive = true;
    setStatus("loading");
    pullRecords().then(
      (server) => {
        if (!alive) return;
        synced.current = new Map(server.map((r) => [r.id, JSON.stringify(r)]));
        setResponses((local) => mergeRecords(server, local));
        setLinked(uid);
      },
      () => alive && setStatus("error")
    );
    return () => {
      alive = false;
    };
  }, [uid, attempt, setResponses]);

  // 바뀐 기록을 계정에 저장한다. 저장은 한 번에 하나씩 차례로 (나중 내용이 먼저 저장된 내용을 덮도록)
  const flush = useCallback(() => {
    queue.current = queue.current.then(async () => {
      if (!uid || linked !== uid) return;
      const changed = unsynced();
      if (!changed.length) return setStatus("saved");
      setStatus("saving");
      try {
        await pushRecords(uid, changed);
        changed.forEach((r) => synced.current.set(r.id, JSON.stringify(r)));
        setStatus(unsynced().length ? "saving" : "saved");
      } catch {
        setStatus("error");
      }
    });
    return queue.current;
  }, [uid, linked]);

  useEffect(() => {
    flush();
  }, [responses, flush]);

  // 연결이 돌아오면 못 보낸 기록을 다시 보낸다
  useEffect(() => {
    window.addEventListener("online", flush);
    return () => window.removeEventListener("online", flush);
  }, [flush]);

  const add = (record) => setResponses((list) => [...list, { ...record, updatedAt: record.completedAt }]);
  const update = (id, patch) =>
    setResponses((list) => list.map((r) => (r.id === id ? { ...r, ...patch, updatedAt: new Date().toISOString() } : r)));

  // 로그아웃·계정 삭제 뒤: 이 기기에서 기록과 입력 중이던 답을 지운다
  const clearLocal = () => {
    setResponses([]);
    try {
      localStorage.removeItem(DRAFT_KEY);
    } catch {
      /* 저장소를 쓸 수 없는 환경 */
    }
  };

  const account = {
    status: uid && linked !== uid && status !== "error" ? "loading" : status,
    flush,
    retry: () => (linked === uid ? flush() : setAttempt((n) => n + 1)),
    // 계정에 아직 저장되지 않은 기록 수 (불러오기 전이면 이 기기의 기록 전부)
    pendingCount: () => (!uid ? 0 : linked === uid ? unsynced().length : latest.current.length),
    clearLocal,
  };
  return <RecordsContext.Provider value={{ responses, add, update, account }}>{children}</RecordsContext.Provider>;
}

export const useResponses = () => useContext(RecordsContext);
