// 메인 화면의 '내 최근 결과' 카드: 과거 기록이 있을 때 최근 값, 지난 계산 대비 변화, 최근 기록 흐름을 보여 준다
import { Link } from "react-router-dom";
import { calculate } from "../lib/carbon/engine.js";
import { useAuth } from "../lib/auth.jsx";
import { useResponses } from "../lib/records.jsx";
import { formatDate, toTon, tonDiff } from "../lib/format.js";
import "./HistoryCard.css";

const TREND_COUNT = 4; // 흐름에 보여 줄 최근 기록 수

// 기록 요약: 최근 기록과 그 결과, 바로 앞 기록과의 차이(화면 표기 기준), 최근 몇 개의 값
export function useHistory() {
  const { responses } = useResponses();
  if (!responses.length) return null;
  const totals = responses.map((r) => ({ record: r, total: calculate(r.answers, r.detail ?? {}).total.value }));
  const last = totals.at(-1);
  const prev = totals.at(-2);
  return {
    count: totals.length,
    last: last.record,
    result: calculate(last.record.answers, last.record.detail ?? {}),
    diff: prev ? tonDiff(last.total, prev.total) : null,
    trend: totals.slice(-TREND_COUNT),
  };
}

// 지난 계산 대비: ▼ 0.1톤 / ▲ 0.2톤 / 변화 없음
export function DiffText({ diff }) {
  if (diff == null) return null;
  if (diff === 0) return <span className="hist-diff">지난 계산과 같아요</span>;
  return (
    <span className={`hist-diff ${diff < 0 ? "is-down" : "is-up"}`}>
      지난 계산보다 {toTon(Math.abs(diff))}톤 {diff < 0 ? "▼" : "▲"}
    </span>
  );
}

export const countText = (count) => (count === 1 ? "첫 계산" : `${count}번째 계산`);

// 결과 보기 + 계정(로그인했으면 모든 기록, 아니면 로그인 권유)
export function HistoryLinks({ last }) {
  const { enabled, user } = useAuth();
  return (
    <div className="hist-links">
      <Link to={`/result/${last.id}`}>결과 보기 →</Link>
      {enabled && <Link to="/account">{user ? "모든 기록 보기 →" : "로그인하고 기록 저장하기 →"}</Link>}
    </div>
  );
}

export default function HistoryCard({ className = "" }) {
  const history = useHistory();
  if (!history) return null;
  const { count, last, result, diff, trend } = history;
  return (
    <div className={`card hist ${className}`}>
      <div className="hist-head">
        <span>내 최근 결과</span>
        <span>
          {formatDate(last.completedAt)} · {countText(count)}
        </span>
      </div>
      <div className="hist-main">
        <strong>{toTon(result.total.value)}</strong>
        <small>톤/년</small>
        <DiffText diff={diff} />
      </div>
      {trend.length > 1 && (
        <ol className="hist-trend" aria-label="최근 기록 흐름">
          {trend.map(({ record, total }) => (
            <li key={record.id}>
              <span>{formatDate(record.completedAt).slice(2)}</span>
              <b>{toTon(total)}</b>
            </li>
          ))}
        </ol>
      )}
      <HistoryLinks last={last} />
    </div>
  );
}
