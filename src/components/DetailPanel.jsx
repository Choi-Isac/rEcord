// 자세히 입력 패널: 문항 아래에 펼쳐지는 정확한 값 입력 (필드 정의는 src/lib/carbon/details.js)
import { DETAILS, WEEKDAYS } from "../lib/carbon/details.js";

// 숫자 칸: 비우면 null, 범위를 넘으면 최댓값으로
function NumberInput({ id, value, min, max, step, unit, onChange, onBlur, label, placeholder }) {
  return (
    <span className="d-num">
      <input
        id={id}
        className="input"
        type="number"
        inputMode="decimal"
        min={min}
        max={max}
        step={step}
        value={value ?? ""}
        placeholder={placeholder}
        aria-label={label}
        onChange={(e) => {
          if (e.target.value === "") return onChange(null);
          const v = Number(e.target.value);
          if (Number.isFinite(v)) onChange(Math.min(max ?? Infinity, Math.max(min ?? -Infinity, v)));
        }}
        onBlur={onBlur}
      />
      {unit && <span className="d-unit">{unit}</span>}
    </span>
  );
}

function Choice({ options, value, onChange, label }) {
  return (
    <div className="d-choice" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} type="button" role="radio" aria-checked={value === o.value} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Shares({ f, value, onChange }) {
  const total = f.options.reduce((s, o) => s + (Number(value[o.value]) || 0), 0);
  return (
    <div className="d-shares">
      {f.options.map((o) => (
        <label key={o.value} className="d-share">
          <span>
            <span aria-hidden="true">{o.icon}</span> {o.label}
          </span>
          <NumberInput
            value={value[o.value] ?? 0}
            min={0}
            max={100}
            step={5}
            unit="%"
            label={`${o.label} 비율`}
            onChange={(v) => onChange({ ...value, [o.value]: v ?? 0 })}
          />
        </label>
      ))}
      <p className={`d-total${total === 100 ? "" : " is-off"}`} role="status">
        합계 {total}%{total === 100 ? "" : total === 0 ? " · 비율을 넣어 주세요" : " · 100%가 아니면 적은 비율대로 나눠 계산해요"}
      </p>
    </div>
  );
}

export default function DetailPanel({ q, values, onChange, onCommit }) {
  const spec = DETAILS[q.id];
  const set = (key) => (v) => onChange({ ...values, [key]: v });

  return (
    <div className="detail" id={`detail-${q.id}`}>
      <p className="detail-intro">{spec.intro}</p>
      <div className="detail-fields">
        {spec.fields.map((f, i) => {
          if (f.showIf && !f.showIf(values)) return null;
          const id = `d-${q.id}-${f.key ?? i}`;
          switch (f.type) {
            case "heading":
              return (
                <h4 key={i} className="detail-heading">
                  {f.label}
                </h4>
              );
            case "total": {
              const total = f.keys.reduce((s, k) => s + (Number(values[k]) || 0), 0);
              return (
                <p key={i} className={`d-total${f.max && total > f.max ? " is-off" : ""}`} role="status">
                  합계 {total}
                  {f.unit}
                  {f.max && total > f.max ? ` · ${f.max}${f.unit}를 넘었어요` : ""}
                </p>
              );
            }
            case "days":
              return (
                <div key={f.key} className="d-days" role="group" aria-label="통학 요일">
                  {WEEKDAYS.map((d, di) => {
                    const on = values.days.includes(di);
                    return (
                      <button
                        key={d}
                        type="button"
                        aria-pressed={on}
                        onClick={() => set("days")(on ? values.days.filter((x) => x !== di) : [...values.days, di].sort())}
                      >
                        {d}
                      </button>
                    );
                  })}
                  <span className="d-days-count">주 {values.days.length}일</span>
                </div>
              );
            case "shares":
              return <Shares key={f.key} f={f} value={values.shares} onChange={set("shares")} />;
            case "choice":
              return (
                <div key={f.key} className="d-row">
                  <span className="d-label">{f.label}</span>
                  <Choice options={f.options} value={values[f.key]} label={f.label} onChange={set(f.key)} />
                </div>
              );
            case "percent":
              return (
                <div key={f.key} className="d-row">
                  <label className="d-label" htmlFor={id}>
                    {f.label}
                  </label>
                  <span className="d-percent">
                    <input
                      id={id}
                      className="range"
                      type="range"
                      min={0}
                      max={100}
                      step={10}
                      value={values[f.key]}
                      aria-valuetext={`${values[f.key]}%`}
                      onChange={(e) => set(f.key)(Number(e.target.value))}
                    />
                    <output htmlFor={id}>{values[f.key]}%</output>
                  </span>
                </div>
              );
            case "bill":
              return (
                <div key={f.key} className="d-row">
                  <label className="d-label" htmlFor={id}>
                    {f.label}
                  </label>
                  <span className="d-bill">
                    <NumberInput
                      id={id}
                      value={values[f.key]}
                      min={0}
                      step={1}
                      label={f.label}
                      onChange={set(f.key)}
                    />
                    <Choice
                      options={f.units}
                      value={values[f.unitKey]}
                      label={`${f.label} 단위`}
                      onChange={set(f.unitKey)}
                    />
                  </span>
                </div>
              );
            default:
              return (
                <div key={f.key} className="d-row">
                  <label className="d-label" htmlFor={id}>
                    {f.label}
                  </label>
                  <NumberInput
                    id={id}
                    value={values[f.key]}
                    min={f.min}
                    max={f.max}
                    step={f.step}
                    unit={f.unit}
                    placeholder={f.placeholder?.(values)}
                    onChange={set(f.key)}
                    onBlur={onCommit}
                  />
                </div>
              );
          }
        })}
      </div>
    </div>
  );
}
