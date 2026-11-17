// 내 기록 변화: 계산 기록 전체의 추이와, 고른 두 계산 사이의 항목별 증감·바뀐 답
import { useState } from "react";
import { Link } from "react-router-dom";
import PageHead from "../components/PageHead.jsx";
import ChartCard from "../components/charts/ChartCard.jsx";
import LineChart from "../components/charts/LineChart.jsx";
import { CATEGORIES } from "../lib/carbon/engine.js";
import { TARGET_2030_KG } from "../lib/carbon/factors.js";
import { CAT_COLORS } from "../lib/colors.js";
import { answerChanges, historyRows, itemChanges, shortDate } from "../lib/history.js";
import { useResponses } from "../lib/records.jsx";
import { formatDate, num, roundKg, toTon, tonDiff, tonValue } from "../lib/format.js";
import "../components/charts/charts.css";
import "./History.css";

const TARGET = { value: TARGET_2030_KG, label: `2030 목표 ${toTon(TARGET_2030_KG)}톤` };

// 증감 표시: ▼ 0.3톤 (줄면 좋음) / ▲ 0.2톤
function Delta({ diff, unit = "톤", format = (d) => toTon(Math.abs(d)) }) {
  if (diff === 0) return <span className="hs-delta">변화 없음</span>;
  return (
    <span className={`hs-delta ${diff < 0 ? "delta-good" : "delta-bad"}`}>
      {diff < 0 ? "▼" : "▲"} {format(diff)}
      {unit}
    </span>
  );
}

const optionText = (row) => `${row.n}회차 · ${formatDate(row.record.completedAt)} · ${toTon(row.result.total.value)}톤`;

export default function HistoryPage() {
  const { responses } = useResponses();
  const rows = historyRows(responses);
  const [fromId, setFromId] = useState(null);
  const [toId, setToId] = useState(null);

  const head = (
    <PageHead
      title="내 기록 변화"
      description="계산할 때마다 탄소발자국이 어떻게 달라졌는지, 무엇이 바뀌었는지 자세히 보여 드려요."
      mobileDescription="계산할 때마다 무엇이 달라졌는지 보여 드려요."
      crumbs={[{ to: "/account", label: "내 계정" }]}
    />
  );
  if (rows.length < 2)
    return (
      <>
        {head}
        <div className="wrap">
          <div className="card empty">
            <h2>비교할 기록이 아직 부족해요</h2>
            <p>계산 기록이 두 개 이상이면 변화를 보여 드려요. 다음 학기에 다시 계산해 보세요.</p>
            <Link className="btn btn-primary" to="/calculator">
              다시 계산하기 →
            </Link>
          </div>
        </div>
      </>
    );

  const first = rows[0];
  const last = rows.at(-1);
  const from = rows.find((r) => r.record.id === fromId) ?? first;
  const to = rows.find((r) => r.record.id === toId) ?? last;
  const labels = rows.map((r) => shortDate(r.record.completedAt));
  const totalDiff = tonDiff(last.result.total.value, first.result.total.value);
  const pct = (totalDiff / tonValue(first.result.total.value)) * 100;
  const items = from === to ? [] : itemChanges(from, to);
  const answers = from === to ? [] : answerChanges(from, to);
  const maxItem = Math.max(1, ...items.map((c) => Math.abs(c.diff)));
  const pairDiff = tonDiff(to.result.total.value, from.result.total.value);

  return (
    <>
      {head}
      <div className="wrap history">
        {/* 요약: 첫 계산 → 최근 계산 */}
        <section className="hs-stats" aria-label="요약">
          <div className="card hs-stat">
            <span>첫 계산 · {formatDate(first.record.completedAt)}</span>
            <strong>{toTon(first.result.total.value)}톤</strong>
          </div>
          <div className="card hs-stat">
            <span>최근 계산 · {formatDate(last.record.completedAt)}</span>
            <strong>{toTon(last.result.total.value)}톤</strong>
          </div>
          <div className="card hs-stat">
            <span>첫 계산 대비</span>
            <strong>
              <Delta diff={totalDiff} />
            </strong>
            {totalDiff !== 0 && <small>{num(Math.abs(pct), 0)}% {totalDiff < 0 ? "줄었어요" : "늘었어요"}</small>}
          </div>
          <div className="card hs-stat">
            <span>계산 횟수</span>
            <strong>{rows.length}번</strong>
          </div>
        </section>

        <ChartCard
          title="총 배출량"
          subtitle="연간 톤 CO₂e · 옅은 면은 가능성이 높은 범위"
          table={{
            columns: ["회차", "날짜", "총 배출량(톤)", "범위(톤)"],
            rows: rows.map((r) => [
              `${r.n}회차`,
              formatDate(r.record.completedAt),
              toTon(r.result.total.value),
              `${toTon(r.result.total.low)}~${toTon(r.result.total.high)}`,
            ]),
          }}
        >
          <LineChart
            labels={labels}
            ariaLabel={`회차별 총 배출량: ${rows.map((r) => `${toTon(r.result.total.value)}톤`).join(", ")}`}
            refLine={TARGET}
            trend
            series={[
              {
                key: "total",
                name: "총 배출량",
                color: "var(--viz-accent)",
                values: rows.map((r) => r.result.total.value),
                band: rows.map((r) => [r.result.total.low, r.result.total.high]),
              },
            ]}
          />
        </ChartCard>

        <ChartCard
          title="영역별 배출량"
          subtitle="연간 톤 CO₂e"
          legend={CATEGORIES.map((c) => ({ name: c.label, color: CAT_COLORS[c.key], kind: "line" }))}
          table={{
            columns: ["회차", "날짜", ...CATEGORIES.map((c) => `${c.label}(톤)`)],
            rows: rows.map((r) => [
              `${r.n}회차`,
              formatDate(r.record.completedAt),
              ...CATEGORIES.map((c) => toTon(r.result.byCategory[c.key].value)),
            ]),
          }}
        >
          <LineChart
            labels={labels}
            ariaLabel="회차별 영역별 배출량"
            series={CATEGORIES.map((c) => ({
              key: c.key,
              name: c.label,
              color: CAT_COLORS[c.key],
              values: rows.map((r) => r.result.byCategory[c.key].value),
            }))}
          />
        </ChartCard>

        {/* 두 계산 비교 */}
        <section className="card hs-compare" aria-labelledby="hs-compare-title">
          <div className="hs-compare-head">
            <h2 id="hs-compare-title">두 계산 비교</h2>
            <div className="hs-pick">
              <label>
                <span>기준</span>
                <select className="select" value={from.record.id} onChange={(e) => setFromId(e.target.value)}>
                  {rows.map((r) => (
                    <option key={r.record.id} value={r.record.id}>
                      {optionText(r)}
                    </option>
                  ))}
                </select>
              </label>
              <span className="hs-arrow" aria-hidden="true">
                →
              </span>
              <label>
                <span>비교</span>
                <select className="select" value={to.record.id} onChange={(e) => setToId(e.target.value)}>
                  {rows.map((r) => (
                    <option key={r.record.id} value={r.record.id}>
                      {optionText(r)}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>

          {from === to ? (
            <p className="hs-note">서로 다른 두 계산을 골라 주세요.</p>
          ) : (
            <>
              <p className="hs-pair">
                {toTon(from.result.total.value)}톤 → <b>{toTon(to.result.total.value)}톤</b> <Delta diff={pairDiff} />
              </p>

              <div className="hs-compare-grid">
                <div>
                  <h3>항목별 증감</h3>
                  {items.length ? (
                    <ul className="hs-items">
                      {items.map((c) => (
                        <li key={c.key}>
                          <span className="hs-item-name">
                            <i style={{ background: CAT_COLORS[c.category] }} aria-hidden="true" />
                            {c.label}
                          </span>
                          {/* 가운데 기준선에서 줄면 왼쪽, 늘면 오른쪽 */}
                          <span className="hs-bar" aria-hidden="true">
                            <span
                              className={c.diff < 0 ? "is-down" : "is-up"}
                              style={{ width: `${(Math.abs(c.diff) / maxItem) * 50}%` }}
                            />
                          </span>
                          <span className="hs-item-val">
                            <Delta diff={c.diff} unit="kg" format={(d) => num(Math.abs(d))} />
                            <small>
                              {roundKg(c.before)} → {roundKg(c.after)}kg
                            </small>
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="hs-note">항목별 배출량이 같아요.</p>
                  )}
                </div>

                <div>
                  <h3>바뀐 답</h3>
                  {answers.length ? (
                    <>
                      {/* 맞물려 계산되는 답은 묶음(통학 등)으로: 바뀐 답은 모두 보여 주고, 증감은 묶음이 바꾼 항목들의 합 */}
                      <ul className="hs-answers">
                        {answers.map((g) => (
                          <li key={g.id} className={g.label ? "is-group" : ""}>
                            {g.label && <span className="hs-group-name">{g.label}</span>}
                            <ul className="hs-group-changes">
                              {g.changes.map((c) => (
                                <li key={c.id}>
                                  <span className="hs-answer-name">
                                    {c.label}
                                    {c.detail && <em>자세히 입력</em>}
                                  </span>
                                  <span className="hs-answer-val">
                                    {c.before} <span aria-hidden="true">→</span>
                                    <span className="sr-only">에서</span> <b>{c.after}</b>
                                  </span>
                                </li>
                              ))}
                              {!g.changes.length && <li className="hs-answer-val">자세히 입력한 값이 바뀌었어요</li>}
                            </ul>
                            {/* 여러 항목에 걸치면 항목별 내역 (항목별 증감과 같은 값) */}
                            {g.items.length > 1 && (
                              <span className="hs-answer-items">
                                {g.items.map((c) => `${c.label} ${c.diff < 0 ? "▼" : "▲"}${num(Math.abs(c.diff))}kg`).join(" · ")}
                              </span>
                            )}
                            <span className="hs-answer-effect">
                              <Delta diff={g.effect} unit="kg" format={(d) => num(Math.abs(d))} />
                            </span>
                          </li>
                        ))}
                      </ul>
                      <p className="hs-foot">
                        서로 맞물려 계산되는 답은 묶어서 보여 줘요. 증감은 그 답들이 바꾼 항목별 증감의 합이에요.
                      </p>
                    </>
                  ) : (
                    <p className="hs-note">간편 입력 답은 같아요.</p>
                  )}
                </div>
              </div>

              <div className="hs-links">
                <Link to={`/result/${from.record.id}`}>{from.n}회차 결과 보기 →</Link>
                <Link to={`/result/${to.record.id}`}>{to.n}회차 결과 보기 →</Link>
              </div>
            </>
          )}
        </section>
      </div>
    </>
  );
}
