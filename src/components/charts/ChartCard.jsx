import { useState } from "react";

// 차트 카드: 제목·범례·표 보기 전환. 표 보기는 툴팁 없이도 모든 값을 확인할 수 있게 한다
// cardRef: 다른 카드가 이 카드의 높이에 맞출 때 쓴다 (결과 화면의 항목별 배출량)
export default function ChartCard({ title, subtitle, legend, table, children, className = "", cardRef }) {
  const [asTable, setAsTable] = useState(false);

  return (
    <div className={`card chart-card ${className}`} ref={cardRef}>
      <div className="chart-head">
        <div>
          <h3>{title}</h3>
          {subtitle && <p>{subtitle}</p>}
        </div>
        {table && (
          <button className="table-toggle" onClick={() => setAsTable((v) => !v)} aria-pressed={asTable}>
            {asTable ? "차트로 보기" : "표로 보기"}
          </button>
        )}
      </div>

      {legend && legend.length > 1 && !asTable && (
        <ul className="legend">
          {legend.map((l) => (
            <li key={l.name}>
              <i className={`key key-${l.kind || "rect"}`} style={{ background: l.color }} aria-hidden="true" />
              {l.name}
            </li>
          ))}
        </ul>
      )}

      {asTable ? (
        <div className="chart-table-wrap">
          <table className="chart-table">
            <thead>
              <tr>
                {table.columns.map((c) => (
                  <th key={c}>{c}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {table.rows.map((row, i) => (
                <tr key={i}>
                  {row.map((cell, j) => (
                    <td key={j}>{cell}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        children
      )}
    </div>
  );
}
