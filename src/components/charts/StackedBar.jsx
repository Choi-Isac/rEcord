import { useState } from "react";
import { num } from "../../lib/format.js";

// 100% 누적 막대 한 줄 + 값이 들어간 범례
export default function StackedBar({ items, colors, unit = "" }) {
  const [active, setActive] = useState(null);
  const total = items.reduce((s, d) => s + d.value, 0);
  const pct = (v) => (v / total) * 100;

  return (
    <div className="stacked">
      <div className="stacked-bar" onPointerLeave={() => setActive(null)}>
        {items.map((d, i) => (
          <span
            key={d.name}
            className={`stacked-seg${active === i ? " is-active" : ""}`}
            style={{ flexGrow: d.value, background: colors[i] }}
            tabIndex={0}
            aria-label={`${d.name} ${num(d.value)}${unit}, ${num(pct(d.value), 1)}%`}
            onPointerEnter={() => setActive(i)}
            onFocus={() => setActive(i)}
            onBlur={() => setActive(null)}
          />
        ))}
      </div>
      <ul className="stacked-legend">
        {items.map((d, i) => (
          <li key={d.name} className={active === i ? "is-active" : ""}>
            <i className="key key-rect" style={{ background: colors[i] }} aria-hidden="true" />
            <span className="name">{d.name}</span>
            <strong>
              {num(d.value)}
              {unit}
            </strong>
            <span className="pct">{num(pct(d.value), 1)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
