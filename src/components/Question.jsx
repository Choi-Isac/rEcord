// 간편 입력 문항: 칩(하나 또는 여러 개 선택), 칸, 점 막대, 슬라이더, 여러 답을 묶은 문항(난방) + 문항별 자세히 입력 펼침
import DetailPanel from "./DetailPanel.jsx";
import { DETAILS, canExpand, detailValues, hasDetail } from "../lib/carbon/details.js";
import { answerKeys, mustPick } from "../lib/carbon/questions.js";

// multiple이면 체크박스(값은 배열, 선택지 순서대로), 아니면 라디오. 기본값 그대로면 고른 칩에 '기본값'을 붙인다
function ChipField({ q, value, isDefault, onChange, labelId }) {
  const picked = q.multiple ? value ?? [] : [value];
  const toggle = (v) => q.options.filter((o) => (o.value === v ? !picked.includes(v) : picked.includes(o.value))).map((o) => o.value);
  return (
    <div className="chips" role={q.multiple ? "group" : "radiogroup"} aria-labelledby={labelId}>
      {q.options.map((o) => (
        <label key={o.value} className={`chip-opt${o.icon ? "" : " is-text"}${picked.includes(o.value) ? " is-selected" : ""}`}>
          <input
            type={q.multiple ? "checkbox" : "radio"}
            name={q.id}
            checked={picked.includes(o.value)}
            onChange={() => onChange(q.id, q.multiple ? toggle(o.value) : o.value)}
          />
          {o.icon && (
            <span className="chip-icon" aria-hidden="true">
              {o.icon}
            </span>
          )}
          <span className="chip-text">
            {o.label}
            {o.sub && <small>{o.sub}</small>}
            {isDefault && o.value === value && <span className="default-tag">기본값</span>}
          </span>
        </label>
      ))}
    </div>
  );
}

// 칸 고르기(냉난방 하루 시간): 칸마다 값과 알아보기 쉬운 설명을 함께 보여 준다
function CellsField({ q, value, isDefault, onChange, labelId }) {
  return (
    <div className="cells" role="radiogroup" aria-labelledby={labelId} style={{ "--n": q.options.length }}>
      {q.options.map((o) => (
        <label key={o.value} className={`cell${value === o.value ? " is-selected" : ""}`}>
          <input type="radio" name={q.id} checked={value === o.value} onChange={() => onChange(q.id, o.value)} />
          <span className="cell-value">{o.label}</span>
          <span className="cell-sub">{o.sub}</span>
          {isDefault && value === o.value && <span className="default-tag">기본값</span>}
        </label>
      ))}
    </div>
  );
}

// 인원 고르기: 사람 칸 중 하나를 누르면 그 칸과 왼쪽 칸이 모두 켜진다 (3번째 → ■■■□)
function PeopleField({ q, value, onChange }) {
  const picked = q.options.find((o) => o.value === value);
  return (
    <div className="people">
      <div className="people-cells" role="radiogroup" aria-labelledby={`q-${q.id}-label`}>
        {q.options.map((o) => (
          <label key={o.value} className={`people-cell${value != null && o.value <= value ? " is-on" : ""}`} title={o.label}>
            <input type="radio" name={q.id} checked={value === o.value} aria-label={o.label} onChange={() => onChange(q.id, o.value)} />
            <span aria-hidden="true">{o.icon}</span>
          </label>
        ))}
      </div>
      <span className={picked ? "people-value" : "people-value is-empty"}>{picked ? picked.label : "칸을 눌러 인원을 골라 주세요"}</span>
    </div>
  );
}

// 점을 잇는 막대(슬라이더 모양의 칩): 고른 점까지 막대가 채워진다.
// marker가 있으면(비행기) 고른 점 위로 옮겨 가고, 기본값 그대로면 고른 점 아래에 '기본값'을 붙인다
function StopsField({ q, value, isDefault, onChange }) {
  const n = q.options.length;
  const idx = q.options.findIndex((o) => o.value === value);
  const pos = `${(Math.max(idx, 0) / (n - 1)) * 100}%`;
  return (
    <div className={q.marker ? "stops has-marker" : "stops"} role="radiogroup" aria-labelledby={`q-${q.id}-label`} style={{ "--n": n }}>
      <div className="stops-track" aria-hidden="true">
        <span className="stops-fill" style={{ width: pos }} />
        {q.marker && (
          <span className={idx > 0 ? "stops-marker is-on" : "stops-marker"} style={{ left: pos }}>
            {q.marker}
          </span>
        )}
      </div>
      {q.options.map((o, i) => (
        <label key={o.value} className={`stops-stop${i === idx ? " is-selected" : ""}${i < idx ? " is-passed" : ""}`}>
          <input type="radio" name={q.id} checked={value === o.value} onChange={() => onChange(q.id, o.value)} />
          <span className="stops-dot" aria-hidden="true" />
          <span className="stops-text">
            {o.label}
            {o.sub && <small>{o.sub}</small>}
            {i === idx && isDefault && <span className="default-tag">기본값</span>}
          </span>
        </label>
      ))}
    </div>
  );
}

// steps가 있으면 간격이 고르지 않은 값 목록을 인덱스로 움직인다 (통학 시간: 1분 → 5분 간격)
function Slider({ id, value, min, max, steps, format, scale, onChange, isDefault }) {
  const indexed = Boolean(steps);
  const pos = indexed ? Math.max(0, steps.findIndex((s) => s >= value)) : value;
  return (
    <div className="slider">
      <div className="slider-head">
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
        aria-labelledby={`q-${id}-label`}
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
        <span className="detail-toggle-icon" aria-hidden="true">
          {open ? "−" : "+"}
        </span>
        {open ? "자세히 입력 접기" : detail ? "자세히 입력 고치기" : "자세히 입력하기"}
      </button>
      {!expandable && <span className="detail-wait">먼저 위에서 골라 주세요</span>}
      {expandable && !detail && !open && <span className="detail-hint">정확한 숫자를 알면 결과가 더 정확해져요</span>}
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
  const isDefault = !mustPick(q) && !touched.includes(q.id) && !detail;
  // 자세히 입력이 간편 입력을 대신하는 답은, 저장된 자세히 입력이 있으면 흐리게 막는다
  // (replaces: false → 대신하지 않음, 배열 → 그 답만 대신함: 난방은 시간만)
  const replaces = DETAILS[q.id]?.replaces;
  const replaced = !detail || replaces === false ? [] : Array.isArray(replaces) ? replaces : answerKeys(q);
  const overridden = replaced.length > 0;

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
          {q.hint && (
            <p className="q-hint">
              {q.hintShort ? (
                <>
                  <span className="only-desktop">{q.hint}</span>
                  <span className="only-mobile">{q.hintShort}</span>
                </>
              ) : (
                q.hint
              )}
            </p>
          )}
        </div>
      </div>

      {skipped ? (
        <p className="q-skip">통학하지 않는다면 건너뛰어도 돼요.</p>
      ) : (
        <>
          {q.type === "group" ? (
            <div className="q-parts">
              {q.parts.map((p) => (
                <Overridable key={p.id} on={replaced.includes(p.id)}>
                  <p className="q-part-label" id={`q-${p.id}-part`}>
                    {p.label}
                  </p>
                  <SimpleField
                    q={p}
                    labelId={`q-${p.id}-part`}
                    answers={answers}
                    isDefault={isDefault}
                    onChange={(key, value) => onChange(key, value, q.id)}
                  />
                </Overridable>
              ))}
            </div>
          ) : (
            <Overridable on={overridden}>
              <SimpleField q={q} labelId={`q-${q.id}-label`} answers={answers} isDefault={isDefault} onChange={onChange} />
            </Overridable>
          )}
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

// 자세히 입력이 대신하는 간편 입력은 흐리게 하고 막는다
function Overridable({ on, children }) {
  return (
    <div className={on ? "q-simple is-overridden" : "q-simple"} inert={on ? "" : undefined}>
      {children}
    </div>
  );
}

function SimpleField({ q, labelId, answers, isDefault, onChange }) {
  const value = answers[q.id];
  if (q.display === "people") return <PeopleField q={q} value={value} onChange={onChange} />;
  if (q.display === "stops") return <StopsField q={q} value={value} isDefault={isDefault} onChange={onChange} />;
  if (q.display === "cells") return <CellsField q={q} value={value} isDefault={isDefault} onChange={onChange} labelId={labelId} />;
  if (q.type === "chips") return <ChipField q={q} value={value} isDefault={isDefault} onChange={onChange} labelId={labelId} />;
  return (
    <Slider
      id={q.id}
      value={value}
      min={q.min}
      max={q.max}
      steps={q.steps}
      format={q.format}
      scale={q.scale}
      isDefault={isDefault}
      onChange={(v) => onChange(q.id, v)}
    />
  );
}
