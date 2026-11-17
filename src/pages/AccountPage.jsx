import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import PageHead from "../components/PageHead.jsx";
import { CATEGORIES, calculate } from "../lib/carbon/engine.js";
import { FLEX_ITEMS, FLEX_LEVELS } from "../lib/flexibility.js";
import { TARGET_2030_KG } from "../lib/carbon/factors.js";
import { shortDate } from "../lib/history.js";
import LineChart from "../components/charts/LineChart.jsx";
import "../components/charts/charts.css";
import {
  NICKNAME_MAX,
  PASSWORD_HINT,
  PASSWORD_MAX,
  PASSWORD_TOO_LONG,
  PASSWORD_PROBLEM,
  USERNAME_HINT,
  USERNAME_RULE,
  authMessage,
  cleanNickname,
  normalizeUsername,
  passwordOk,
  useAuth,
} from "../lib/auth.jsx";
import { useResponses } from "../lib/records.jsx";
import { MOCK } from "../lib/supabase.js";
import { formatDate, toTon, tonDiff } from "../lib/format.js";
import "./Account.css";

// 가입 안내 (동의 문구와 같은 공식 어투)
const NICKNAME_HINT = `${NICKNAME_MAX}자 이하 · 중복 가능 · 공백 시 아이디로 표시`;

const ACCOUNT_POLICY = [
  "아이디, 비밀번호와 선택 입력한 닉네임 외의 정보는 수집하지 않습니다. 닉네임에는 실명 등 개인을 알아볼 수 있는 정보를 쓰지 마십시오.",
  "계산 기록은 계정에 저장되어 다른 기기에서도 확인할 수 있으며, 계정을 삭제하면 함께 삭제됩니다.",
  "통계·연구 활용에 동의한 응답은 계정과 연결되지 않은 상태로 저장됩니다.",
  "비밀번호는 복구할 수 없으므로 잊지 않도록 보관해 주십시오.",
];

function AuthForm() {
  const { signIn, signUp } = useAuth();
  const { responses } = useResponses();
  const [mode, setMode] = useState("login"); // login | signup
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [nickname, setNickname] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const signup = mode === "signup";
  const id = normalizeUsername(username);
  // 고쳐야 할 첫 문제 (없으면 빈 문자열)
  const problem = !id
    ? "아이디를 입력해 주세요."
    : signup && !USERNAME_RULE.test(id)
      ? `아이디는 ${USERNAME_HINT}로 정해 주세요.`
      : !password
        ? "비밀번호를 입력해 주세요."
        : signup && password.length > PASSWORD_MAX
          ? PASSWORD_TOO_LONG
          : signup && !passwordOk(password)
            ? PASSWORD_PROBLEM
            : signup && password !== confirm
              ? "비밀번호 확인이 일치하지 않아요."
              : signup && !agreed
                ? "가입 안내를 확인해 주세요."
                : "";

  const submit = async (e) => {
    e.preventDefault();
    if (problem) return setError(problem);
    setBusy(true);
    setError("");
    try {
      await (signup ? signUp(id, password, nickname) : signIn(id, password));
    } catch (err) {
      setError(authMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const switchMode = (next) => {
    setMode(next);
    setError("");
    setConfirm("");
  };

  return (
    <form className="card account-card" onSubmit={submit} noValidate>
      <div className="account-tabs" role="tablist" aria-label="로그인 또는 가입">
        <button type="button" role="tab" aria-selected={!signup} onClick={() => switchMode("login")}>
          로그인
        </button>
        <button type="button" role="tab" aria-selected={signup} onClick={() => switchMode("signup")}>
          가입하기
        </button>
      </div>

      <label className="account-field">
        <span>아이디</span>
        <input
          className="input"
          name="username"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />
        {signup && <small>{USERNAME_HINT}</small>}
      </label>
      {signup && (
        <label className="account-field">
          <span>
            닉네임 <em>(선택)</em>
          </span>
          <input
            className="input"
            name="nickname"
            autoComplete="nickname"
            maxLength={NICKNAME_MAX}
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
          />
          <small>{NICKNAME_HINT}</small>
        </label>
      )}
      <label className="account-field">
        <span>비밀번호</span>
        <input
          className="input"
          type="password"
          name="password"
          autoComplete={signup ? "new-password" : "current-password"}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {signup && <small>{PASSWORD_HINT}</small>}
      </label>
      {signup && (
        <>
          <label className="account-field">
            <span>비밀번호 확인</span>
            <input
              className="input"
              type="password"
              name="confirm"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
          </label>
          <div className="account-policy">
            <ul>
              {ACCOUNT_POLICY.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
            <label className="check">
              <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
              <span>
                <strong>[필수] 위 내용을 확인했습니다.</strong>
              </span>
            </label>
          </div>
        </>
      )}

      {responses.length > 0 && (
        <p className="account-note">이 기기에 저장된 계산 기록 {responses.length}개도 계정에 함께 저장돼요.</p>
      )}
      {error && (
        <p className="account-error" role="alert">
          {error}
        </p>
      )}
      <button className="btn btn-primary btn-block" disabled={busy}>
        {busy ? "처리 중…" : signup ? "가입하고 로그인" : "로그인"}
      </button>
    </form>
  );
}

const STATUS_TEXT = {
  loading: "계정 기록을 불러오는 중…",
  saving: "계정에 저장하는 중…",
  saved: "모든 기록이 계정에 저장됐어요",
  error: "계정에 저장하지 못했어요",
};

// 닉네임 바꾸기: 누르면 그 자리에서 입력 칸으로 바뀐다
function Nickname() {
  const { username, nickname, updateNickname } = useAuth();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const start = () => {
    setValue(nickname === username ? "" : nickname);
    setError("");
    setEditing(true);
  };
  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await updateNickname(value);
      setEditing(false);
    } catch (err) {
      setError(authMessage(err));
    } finally {
      setBusy(false);
    }
  };

  if (!editing)
    return (
      <div className="account-who">
        <p>
          <strong>{nickname}</strong> 님
        </p>
        <p className="account-id">
          아이디 {username}
          <button type="button" className="link-btn" onClick={start}>
            닉네임 바꾸기
          </button>
        </p>
      </div>
    );
  return (
    <form className="account-nick" onSubmit={save}>
      <label className="account-field">
        <span>닉네임</span>
        <input
          className="input"
          name="nickname"
          autoComplete="nickname"
          maxLength={NICKNAME_MAX}
          placeholder={username}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          autoFocus
        />
        <small>{NICKNAME_HINT}</small>
      </label>
      {error && (
        <p className="account-error" role="alert">
          {error}
        </p>
      )}
      <div className="account-nick-actions">
        <button className="btn btn-primary btn-sm" disabled={busy || cleanNickname(value) === (nickname === username ? "" : nickname)}>
          {busy ? "저장 중…" : "저장"}
        </button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditing(false)} disabled={busy}>
          취소
        </button>
      </div>
    </form>
  );
}

// 습관 변경 난이도: 감축 제안을 고를 때 쓴다 (flexibility.js, suggestions.js)
// 누르면 바로 계정에 저장하고, 고른 단계를 다시 누르면 선택을 지운다('보통'으로 봄)
function Flexibility() {
  const { flexibility, updateFlexibility } = useAuth();
  const [local, setLocal] = useState(flexibility);
  const [state, setState] = useState("idle"); // idle | saving | saved | error
  const saving = useRef(Promise.resolve());

  const choose = (id, value) => {
    const next = { ...local };
    if (next[id] === value) delete next[id];
    else next[id] = value;
    setLocal(next);
    setState("saving");
    // 차례로 저장해 마지막 선택이 남게 한다
    saving.current = saving.current.then(() =>
      updateFlexibility(next).then(
        () => setState("saved"),
        () => {
          setState("error");
          setLocal(flexibility);
        }
      )
    );
  };

  // 결과 화면의 '습관 변경 난이도' 링크로 오면 이 영역으로 스크롤한다
  const location = useLocation();
  const section = useRef(null);
  // 평소에는 접어 두고, 결과 화면의 링크로 오면 펼친다
  const [open, setOpen] = useState(location.state?.focus === "flex");
  useEffect(() => {
    if (location.state?.focus !== "flex") return;
    setOpen(true);
    // 페이지를 바꿀 때 맨 위로 올리는 Layout보다 뒤에 실행되도록 다음 프레임에
    requestAnimationFrame(() => {
      const top = section.current.getBoundingClientRect().top + window.scrollY - 80; // 고정 헤더 높이만큼 띄운다
      window.scrollTo({ top, behavior: "smooth" });
    });
  }, [location.state]);

  const picked = Object.keys(local).length;
  return (
    <section ref={section} id="flex" className={`card account-card account-flex${open ? " is-open" : ""}`}>
      <div className="flex-head">
        <div className="flex-title">
          <h2 className="account-title">습관 변경 난이도</h2>
          <button
            type="button"
            className="flex-toggle"
            aria-expanded={open}
            aria-controls="flex-body"
            onClick={() => setOpen((v) => !v)}
          >
            {open ? "접기 ▴" : "펼치기 ▾"}
          </button>
        </div>
        <p className="account-note" hidden={!open}>
          감축 제안을 고를 때 참고해요. <b>불가</b>로 고른 항목은 제안하지 않고, <b>어려움</b>은 다른 제안 뒤로 미뤄요. <b>가능</b>·<b>쉬움</b>은 앞쪽에 먼저 제안하고, <b>쉬움</b>은 조금 더 크게 제안해요.
          고르지 않은 항목은 보통으로 봐요.
        </p>
        <p className={`account-status is-${state}`} role="status">
          {state === "saving"
            ? "저장하는 중…"
            : state === "saved"
              ? "계정에 저장됐어요"
              : state === "error"
                ? "저장하지 못했어요. 다시 골라 주세요."
                : `${FLEX_ITEMS.length}개 중 ${picked}개 골랐어요`}
        </p>
      </div>
      <div className="flex-groups" id="flex-body" hidden={!open}>
        {CATEGORIES.map((c) => (
          <div key={c.key} className="flex-group">
            <h3>
              <span aria-hidden="true">{c.icon}</span> {c.label}
            </h3>
            {FLEX_ITEMS.filter((it) => it.category === c.key).map((it) => (
              <div key={it.id} className="flex-row">
                <span className="flex-label" id={`flex-${it.id}`}>
                  {it.label}
                </span>
                <div className="flex-scale" role="radiogroup" aria-labelledby={`flex-${it.id}`}>
                  {FLEX_LEVELS.map((l) => (
                    <button
                      key={l.value}
                      type="button"
                      role="radio"
                      aria-checked={local[it.id] === l.value}
                      title={l.label}
                      className={`flex-opt flex-${l.value}`}
                      onClick={() => choose(it.id, l.value)}
                    >
                      {l.short}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}

function Account() {
  const { signOut, deleteAccount } = useAuth();
  const { responses, account } = useResponses();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // 최근 계산이 위로. 바로 앞 계산과의 차이로 변화를 보여 준다
  const rows = responses
    .map((r) => ({ record: r, total: calculate(r.answers, r.detail ?? {}).total.value }))
    // 차이는 화면에 보이는 톤 값끼리 (표기와 어긋나지 않게)
    .map((row, i, all) => ({ ...row, diff: i > 0 ? tonDiff(row.total, all[i - 1].total) : null }))
    .reverse();

  const logout = async () => {
    await account.flush();
    const pending = account.pendingCount();
    if (pending && !window.confirm(`계정에 저장되지 않은 기록 ${pending}개가 이 기기에서 지워져요. 그래도 로그아웃할까요?`)) return;
    setBusy(true);
    await signOut();
    account.clearLocal();
    setBusy(false);
  };

  const remove = async () => {
    if (!window.confirm("계정과 계정에 저장된 계산 기록을 모두 삭제할까요? 삭제하면 되돌릴 수 없어요.")) return;
    setBusy(true);
    setError("");
    try {
      await deleteAccount();
      account.clearLocal();
    } catch (err) {
      setError(authMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="account-grid">
      <section className="card account-card">
        <Nickname />
        <p className={`account-status is-${account.status}`} role="status">
          {STATUS_TEXT[account.status] ?? ""}
          {account.status === "error" && (
            <>
              {" "}
              <button type="button" className="link-btn" onClick={account.retry}>
                다시 시도
              </button>
            </>
          )}
        </p>
        <p className="account-note">계산 기록은 이 계정으로 로그인한 모든 기기에서 볼 수 있어요.</p>
        {error && (
          <p className="account-error" role="alert">
            {error}
          </p>
        )}
        <div className="account-actions">
          <button type="button" className="btn btn-ghost btn-sm" onClick={logout} disabled={busy}>
            로그아웃
          </button>
          <button type="button" className="link-btn account-delete" onClick={remove} disabled={busy}>
            계정 삭제
          </button>
        </div>
      </section>

      <section className="card account-card">
        {/* 기록이 둘 이상이면 총 배출량 흐름을 작게 보여 주고, 자세한 변화는 '내 기록 변화'에서 */}
        <div className="account-records-head">
          <h2 className="account-title">내 계산 기록</h2>
          {rows.length > 1 && (
            <Link className="account-more" to="/account/history">
              변화 자세히 보기 →
            </Link>
          )}
        </div>
        {rows.length > 1 && (
          <LineChart
            height={150}
            trend
            labels={[...rows].reverse().map((r) => shortDate(r.record.completedAt))}
            ariaLabel={`회차별 총 배출량: ${[...rows].reverse().map((r) => `${toTon(r.total)}톤`).join(", ")}`}
            refLine={{ value: TARGET_2030_KG, label: `2030 목표 ${toTon(TARGET_2030_KG)}톤` }}
            series={[{ key: "total", name: "총 배출량", color: "var(--viz-accent)", values: [...rows].reverse().map((r) => r.total) }]}
          />
        )}
        {rows.length ? (
          <ol className="account-records">
            {rows.map(({ record, total, diff }) => (
              <li key={record.id}>
                <Link to={`/result/${record.id}`}>
                  <span className="ar-date">
                    {formatDate(record.completedAt)}
                    <small>{record.semester.replace("-", "년 ")}학기</small>
                  </span>
                  <span className="ar-total">
                    <b>{toTon(total)}</b>톤
                  </span>
                  <span className={`ar-diff${!diff ? "" : diff < 0 ? " is-down" : " is-up"}`}>
                    {diff == null ? "첫 계산" : diff === 0 ? "변화 없음" : `${diff < 0 ? "▼" : "▲"} ${toTon(Math.abs(diff))}톤`}
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        ) : (
          <p className="account-note">
            아직 계산 기록이 없어요. <Link to="/calculator">계산하러 가기 →</Link>
          </p>
        )}
      </section>

      <Flexibility />
    </div>
  );
}

export default function AccountPage() {
  const { enabled, ready, user } = useAuth();
  return (
    <>
      <PageHead
        title={user ? "내 계정" : "로그인"}
        description={
          user
            ? "다른 기기에서 계산한 기록까지 모아 보고, 학기마다 얼마나 달라졌는지 확인할 수 있어요."
            : "로그인하면 계산 기록을 다른 기기에서도 보고, 학기마다 다시 계산해 변화를 비교할 수 있어요. 로그인하지 않아도 계산기는 그대로 쓸 수 있어요."
        }
        mobileDescription={user ? "기기와 학기를 넘어 기록을 모아 봐요." : "로그인하면 다른 기기에서도 기록을 볼 수 있어요."}
      />
      <div className="wrap account">
        {MOCK && (
          <p className="account-mock">
            개발용 가짜 로그인 모드예요. 계정과 기록은 이 브라우저 안에만 저장되고 서버로는 아무것도 보내지 않아요.
          </p>
        )}
        {!enabled ? (
          <p className="account-note">이 환경에는 서버가 연결되어 있지 않아 로그인을 쓸 수 없어요.</p>
        ) : !ready ? null : user ? (
          <Account />
        ) : (
          <AuthForm />
        )}
      </div>
    </>
  );
}
