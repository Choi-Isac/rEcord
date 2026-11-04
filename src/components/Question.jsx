// 간편 입력 문항: 칩(단일 선택), 슬라이더, 냉난방 이중 슬라이더 + 문항별 자세히 입력 펼침
import DetailPanel from "./DetailPanel.jsx";
import { DETAILS, canExpand, detailValues, hasDetail } from "../lib/carbon/details.js";

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

// 자세히 입력 열기/닫기와 상태 (펼칠 수 있는 문항만)
function DetailToggle({ q, answers, detail, open, onToggle, onReset }) {
  if (!hasDetail(q)) return null;
  const expandable = canExpand(q, answers);
  const spec = DETAILS[q.id];
  return (
    <div className="detail-bar">
      <button
        type="button"
        className="detail-toggle"
        aria-expanded={open}
        aria-controls={`detail-${q.id}`}
        disabled={!expandable}
        onClick={onToggle}
      >
        {open ? "자세히 입력 접기 ▴" : "자세히 입력 ▾"}
      </button>
      {!expandable && <span className="detail-wait">먼저 위에서 골라 주세요</span>}
      {detail && (
        <>
          {!open && spec.summary && <span className="detail-summary">{spec.summary(detail)}</span>}
          <button type="button" className="link-btn detail-reset" onClick={onReset}>
            간편 입력으로 되돌리기
          </button>
        </>
      )}
    </div>
  );
}

export default function Question({ q, index, answers, touched, skipped, missing, hint, onChange, detailProps }) {
  const { detail, open, onToggle, onReset, onDetailChange, onDetailCommit } = detailProps;
  const isDefault = q.type !== "chips" && !touched.includes(q.id) && !detail;
  // 자세히 입력이 간편 입력을 대신하는 문항은, 저장된 자세히 입력이 있으면 간편 입력을 흐리게 막는다
  const overridden = Boolean(detail) && DETAILS[q.id]?.replaces !== false;

  return (
    <div className={`q card${skipped ? " is-skipped" : ""}${missing ? " is-missing" : ""}`} id={`q-${q.id}`}>
      <div className="q-head">
        <span className="q-num" aria-hidden="true">
          {index}
        </span>
        <div>
          <h3 className="q-label" id={`q-${q.id}-label`}>
            {q.label}
            {detail && !skipped && <span className="badge-direct">직접 입력</span>}
          </h3>
          {q.hint && <p className="q-hint">{q.hint}</p>}
        </div>
      </div>

      {skipped ? (
        <p className="q-skip">통학하지 않는다면 건너뛰어도 돼요.</p>
      ) : (
        <>
          <div className={overridden ? "q-simple is-overridden" : "q-simple"} inert={overridden ? "" : undefined}>
            <SimpleField q={q} answers={answers} isDefault={isDefault} onChange={onChange} />
          </div>
          {overridden && (
            <p className="q-override">
              자세히 입력한 값으로 계산해요.{DETAILS[q.id].toSimple && " 위 칸은 그 값에 가장 가까운 간편 입력이에요."}
            </p>
          )}
          {hint && !overridden && <p className="q-derived">{hint}</p>}
          {missing && <p className="q-missing">이 항목을 골라 주세요.</p>}

          <DetailToggle q={q} answers={answers} detail={detail} open={open} onToggle={onToggle} onReset={onReset} />
          {open && canExpand(q, answers) && (
            <DetailPanel
              q={q}
              values={detailValues(q, answers, detail ? { [q.id]: detail } : null)}
              onChange={onDetailChange}
              onCommit={onDetailCommit}
            />
          )}
        </>
      )}
    </div>
  );
}

function SimpleField({ q, answers, isDefault, onChange }) {
  if (q.type === "chips") return <ChipField q={q} value={answers[q.id]} onChange={onChange} />;
  if (q.type === "slider")
    return (
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
    );
  return (
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
  );
}
