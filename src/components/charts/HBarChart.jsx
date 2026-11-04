import { num } from "../../lib/format.js";

// 가로 막대: 값은 막대 끝에 직접 표시하므로 툴팁 없이도 모두 읽힌다
// items: [{ name, value, color?, highlight?, tag? }] — tag: 이름 옆 작은 표시 (예: 직접 입력)
export default function HBarChart({ items, unit = "", color, format = num }) {
  const max = Math.max(...items.map((d) => d.value));
  return (
    <ul className="hbar" role="list">
      {items.map((d) => (
        <li key={d.name} className={`hbar-row${d.highlight ? " is-highlight" : ""}`}>
          <span className="hbar-name">
            {d.name}
            {d.tag && (
              <span className="hbar-tag" title={d.tag}>
                <span aria-hidden="true">✓</span>
                <span className="sr-only">{d.tag}</span>
              </span>
            )}
          </span>
          <span className="hbar-track">
            <span className="hbar-fill" style={{ width: `${(d.value / max) * 100}%`, background: d.color ?? color }} />
            <span className="hbar-value">
              {format(d.value)}
              {unit}
            </span>
          </span>
        </li>
      ))}
    </ul>
  );
}
