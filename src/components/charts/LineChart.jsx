import { useLayoutEffect, useRef, useState } from "react";
import { toTon, tonDiff } from "../../lib/format.js";

// 계산 회차별 선 그래프. x는 회차 순서(같은 간격, 눈금은 날짜), y는 kg을 톤 눈금으로 보여 준다
// series: [{ key, name, color, values: number[], band?: [low, high][] }] — band는 가능성이 높은 범위(옅은 면)
// refLine: { value, label } 기준선 (예: 2030 목표)
// 세로축은 0이 아니라 값(범위 면 포함)의 최솟값~최댓값에 여유를 더한 구간으로 확대한다.
// 꺾은선은 길이가 아니라 위치로 읽으므로 0에서 시작하지 않아도 된다. 축 밖의 기준선은 그리지 않는다.
// trend: 계열이 하나일 때 구간마다 증감 색(줄면 good, 늘면 bad, 같으면 회색)으로 칠하고 범례를 단다.
//   증감은 화면에 보이는 톤 값끼리 비교한다(표기와 어긋나지 않게)
// 계열이 하나면 선 끝에 마지막 값을 직접 표시하고, 여럿이면 범례(ChartCard)와 툴팁으로 읽는다.
// 포인터·키보드(←→)로 회차를 고르면 세로선과 함께 그 회차의 모든 값을 툴팁으로 보여 준다
const PAD = { top: 14, bottom: 26, left: 40 };
const STEPS = [0.1, 0.2, 0.5, 1, 2, 5, 10]; // 눈금 간격(톤) 후보. 결과를 0.1톤 단위로 보여 주므로 0.1보다 잘게 나누지 않는다
const TREND = { down: "var(--good)", up: "var(--bad)", flat: "var(--viz-reference)" };

// 최솟값~최댓값에 위아래 여유(범위의 15%, 최소 0.2톤)를 더해 눈금 간격 maxSteps개 이하로 나눈다
function niceScale(minKg, maxKg, maxSteps) {
  const lo = minKg / 1000;
  const hi = maxKg / 1000;
  const pad = Math.max((hi - lo) * 0.15, 0.2);
  const step = STEPS.find((s) => (hi - lo + 2 * pad) / s <= maxSteps) ?? STEPS.at(-1);
  const bottom = Math.max(0, Math.floor((lo - pad) / step) * step);
  const top = Math.ceil((hi + pad) / step) * step;
  const ticks = [];
  for (let t = bottom; t <= top + 1e-9; t += step) ticks.push(Math.round(t * 1000));
  return { min: bottom * 1000, max: top * 1000, ticks };
}

const trendOf = (diff) => (diff < 0 ? "down" : diff > 0 ? "up" : "flat");

export default function LineChart({ labels, series, refLine, height = 220, ariaLabel, trend = false }) {
  const wrap = useRef(null);
  const [width, setWidth] = useState(600);
  const [active, setActive] = useState(null); // 고른 회차
  const clipId = useRef(`lc-clip-${Math.random().toString(36).slice(2)}`).current;

  useLayoutEffect(() => {
    const el = wrap.current;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    setWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  const n = labels.length;
  const single = series.length === 1;
  const colored = trend && single && n > 1;
  const right = single ? 52 : 14;
  const plotW = Math.max(40, width - PAD.left - right);
  const plotH = height - PAD.top - PAD.bottom;
  const all = series.flatMap((s) => [...s.values, ...(s.band ?? []).flat()]);
  // 눈금 간격은 그래프 높이에 맞춰 (간격 하나에 36px 이상, 최대 4개)
  const { min, max, ticks } = niceScale(Math.min(...all), Math.max(...all), Math.max(2, Math.min(4, Math.floor(plotH / 36))));
  const x = (i) => PAD.left + (n === 1 ? plotW / 2 : (i * plotW) / (n - 1));
  const y = (v) => PAD.top + plotH * (1 - (v - min) / (max - min));
  const showRef = refLine && refLine.value >= min && refLine.value <= max;
  const linePath = (vals) => vals.map((v, i) => `${i ? "L" : "M"}${x(i)},${y(v)}`).join("");
  const bandPath = (band) =>
    `${band.map(([, hi], i) => `${i ? "L" : "M"}${x(i)},${y(hi)}`).join("")}` +
    `${[...band].reverse().map(([lo], j) => `L${x(n - 1 - j)},${y(lo)}`).join("")}Z`;

  // 증감: 회차 i는 바로 앞 회차와 비교 (첫 회차는 없음)
  const vals0 = series[0].values;
  const diffAt = (i) => (i > 0 ? tonDiff(vals0[i], vals0[i - 1]) : null);
  const dotColor = (s, i) => (colored && i > 0 ? TREND[trendOf(diffAt(i))] : s.color);

  // x 눈금: 좁으면 몇 개만 (처음과 마지막은 늘). 날짜 하나에 약 72px.
  // 마지막 날짜는 오른쪽 끝에 맞춰 왼쪽으로 뻗으므로, 그 앞 날짜는 90px 이상 떨어져 있을 때만
  const room = Math.max(2, Math.floor(plotW / 72));
  const every = Math.ceil(n / room);
  const gap = plotW / Math.max(1, n - 1);
  const showLabel = (i) => i === 0 || i === n - 1 || (i % every === 0 && i * gap >= 90 && (n - 1 - i) * gap >= 90);

  const pick = (clientX) => {
    const rect = wrap.current.getBoundingClientRect();
    const px = clientX - rect.left - PAD.left;
    setActive(n === 1 ? 0 : Math.min(n - 1, Math.max(0, Math.round((px / plotW) * (n - 1)))));
  };
  const onKey = (e) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    setActive((i) => Math.min(n - 1, Math.max(0, (i ?? n - 1) + (e.key === "ArrowRight" ? 1 : -1))));
  };

  const tipLeft = active == null ? 0 : x(active);
  const flip = tipLeft > width / 2;
  const used = colored ? new Set(vals0.slice(1).map((_, j) => trendOf(diffAt(j + 1)))) : null;

  return (
    <div className="line-chart">
      <div className="lc-plot" ref={wrap} style={{ height }}>
        <svg
          width={width}
          height={height}
          role="img"
          aria-label={ariaLabel}
          tabIndex={0}
          onPointerMove={(e) => pick(e.clientX)}
          onPointerDown={(e) => pick(e.clientX)}
          onPointerLeave={() => setActive(null)}
          onFocus={() => setActive((i) => i ?? n - 1)}
          onBlur={() => setActive(null)}
          onKeyDown={onKey}
        >
          <defs>
            <clipPath id={clipId}>
              <rect x={PAD.left} y={PAD.top} width={plotW} height={plotH} />
            </clipPath>
          </defs>
          {ticks.map((t) => (
            <g key={t}>
              <line className="lc-grid" x1={PAD.left} x2={PAD.left + plotW} y1={y(t)} y2={y(t)} />
              <text className="lc-tick" x={PAD.left - 8} y={y(t) + 4} textAnchor="end">
                {`${toTon(t)}톤`}
              </text>
            </g>
          ))}
          {labels.map((l, i) =>
            showLabel(i) ? (
              <text
                key={i}
                className="lc-tick"
                x={x(i)}
                y={height - 6}
                textAnchor={n > 1 && i === 0 ? "start" : n > 1 && i === n - 1 ? "end" : "middle"}
              >
                {l}
              </text>
            ) : null
          )}
          {showRef && (
            <g>
              <line className="lc-ref" x1={PAD.left} x2={PAD.left + plotW} y1={y(refLine.value)} y2={y(refLine.value)} />
              <text className="lc-ref-label" x={PAD.left + 4} y={y(refLine.value) - 5}>
                {refLine.label}
              </text>
            </g>
          )}
          {series.map(
            (s) =>
              s.band &&
              n > 1 && <path key={`b-${s.key}`} d={bandPath(s.band)} fill={s.color} opacity={0.1} clipPath={`url(#${clipId})`} />
          )}
          {active != null && <line className="lc-cross" x1={x(active)} x2={x(active)} y1={PAD.top} y2={PAD.top + plotH} />}
          {series.map((s) => (
            <g key={s.key}>
              {n > 1 &&
                (colored ? (
                  // 구간마다 증감 색
                  s.values.slice(1).map((v, j) => (
                    <line
                      key={j}
                      x1={x(j)}
                      y1={y(s.values[j])}
                      x2={x(j + 1)}
                      y2={y(v)}
                      stroke={TREND[trendOf(diffAt(j + 1))]}
                      strokeWidth={2.5}
                      strokeLinecap="round"
                    />
                  ))
                ) : (
                  <path d={linePath(s.values)} fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
                ))}
              {s.values.map((v, i) => (
                <circle key={i} className="lc-dot" cx={x(i)} cy={y(v)} r={i === active ? 5.5 : 4} fill={dotColor(s, i)} />
              ))}
            </g>
          ))}
          {single && (
            <text className="lc-end" x={x(n - 1) + 9} y={y(vals0[n - 1]) + 4}>
              {toTon(vals0[n - 1])}톤
            </text>
          )}
        </svg>

        {active != null && (
          <div className={`lc-tip${flip ? " is-flip" : ""}`} style={{ left: tipLeft }} role="status">
            <div className="lc-tip-head">{labels[active]}</div>
            {series.map((s) => (
              <div key={s.key} className="lc-tip-row">
                <i style={{ background: dotColor(s, active) }} aria-hidden="true" />
                <strong>{toTon(s.values[active])}톤</strong>
                <span>{s.name}</span>
                {colored && diffAt(active) != null && (
                  <small className={`lc-tip-diff is-${trendOf(diffAt(active))}`}>
                    지난 계산보다{" "}
                    {diffAt(active) === 0
                      ? "같아요"
                      : `${toTon(Math.abs(diffAt(active)))}톤 ${diffAt(active) < 0 ? "▼" : "▲"}`}
                  </small>
                )}
                {s.band && (
                  <small>
                    범위 {toTon(s.band[active][0])}~{toTon(s.band[active][1])}톤
                  </small>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 증감 색 범례 (그려진 색만) */}
      {colored && (
        <ul className="lc-trend-legend">
          {used.has("down") && (
            <li>
              <i style={{ background: TREND.down }} aria-hidden="true" />
              줄었어요
            </li>
          )}
          {used.has("up") && (
            <li>
              <i style={{ background: TREND.up }} aria-hidden="true" />
              늘었어요
            </li>
          )}
          {used.has("flat") && (
            <li>
              <i style={{ background: TREND.flat }} aria-hidden="true" />
              같아요
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
