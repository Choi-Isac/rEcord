// 간편 입력 문항: 칩(단일 선택), 슬라이더, 냉난방 이중 슬라이더

function ChipField({ q, value, onChange }) {
  return (
    <div className="chips" role="radiogroup" aria-labelledby={`q-${q.id}-label`}>
      {q.options.map((o) => (
        <label key={o.value} className={`chip-opt${value === o.value ? " is-selected" : ""}`}>
          <input type="radio" name={q.id} checked={value === o.value} onChange={() => onChange(q.id, o.value)} />
          <span className="chip-icon" aria-hidden="true">
            {o.icon}
          </span>
          <span className="chip-text">
            {o.label}
            {o.sub && <small>{o.sub}</small>}
          </span>
        </label>
      ))}
    </div>
  );
}

// steps가 있으면 간격이 고르지 않은 값 목록을 인덱스로 움직인다 (통학 시간: 1분 → 5분 간격)
function Slider({ id, label, value, min, max, steps, format, scale, onChange, isDefault }) {
  const indexed = Boolean(steps);
  const pos = indexed ? Math.max(0, steps.findIndex((s) => s >= value)) : value;
  return (
    <div className="slider">
      <div className="slider-head">
        {label && <label htmlFor={`s-${id}`}>{label}</label>}
        <output htmlFor={`s-${id}`} className="slider-value">
          {format(value)}
          {isDefault && <span className="default-tag">기본값</span>}
        </output>
      </div>
      <input
        id={`s-${id}`}
        className="range"
        type="range"
        min={indexed ? 0 : min}
        max={indexed ? steps.length - 1 : max}
        step={1}
        value={pos}
        aria-valuetext={format(value)}
        aria-labelledby={label ? undefined : `q-${id}-label`}
        onChange={(e) => {
          const v = Number(e.target.value);
          onChange(indexed ? steps[v] : v);
        }}
      />
      <div className="range-scale" aria-hidden="true">
        <span>{scale[0]}</span>
        <span>{scale[1]}</span>
      </div>
    </div>
  );
}

export default function Question({ q, index, answers, touched, skipped, missing, hint, onChange }) {
  const isDefault = q.type !== "chips" && !touched.includes(q.id);

  return (
    <div className={`q card${skipped ? " is-skipped" : ""}${missing ? " is-missing" : ""}`} id={`q-${q.id}`}>
      <div className="q-head">
        <span className="q-num" aria-hidden="true">
          {index}
        </span>
        <div>
          <h3 className="q-label" id={`q-${q.id}-label`}>
            {q.label}
          </h3>
          {q.hint && <p className="q-hint">{q.hint}</p>}
        </div>
      </div>

      {skipped ? (
        <p className="q-skip">통학하지 않는다면 건너뛰어도 돼요.</p>
      ) : (
        <>
          {q.type === "chips" && <ChipField q={q} value={answers[q.id]} onChange={onChange} />}
          {q.type === "slider" && (
            <Slider
              id={q.id}
              value={answers[q.id]}
              min={q.min}
              max={q.max}
              steps={q.steps}
              format={q.format}
              scale={q.scale}
              isDefault={isDefault}
              onChange={(v) => onChange(q.id, v)}
            />
          )}
          {q.type === "dual" && (
            <div className="dual">
              {q.sliders.map((s) => (
                <Slider
                  key={s.id}
                  id={s.id}
                  label={`${s.icon} ${s.label}`}
                  value={answers[s.id]}
                  min={q.min}
                  max={q.max}
                  format={q.format}
                  scale={q.scale}
                  isDefault={isDefault}
                  onChange={(v) => onChange(s.id, v, q.id)}
                />
              ))}
            </div>
          )}
          {hint && <p className="q-derived">{hint}</p>}
          {missing && <p className="q-missing">이 항목을 골라 주세요.</p>}
        </>
      )}
    </div>
  );
}
