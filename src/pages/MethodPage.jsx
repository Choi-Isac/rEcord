import { Link } from "react-router-dom";
import PageHead from "../components/PageHead.jsx";
import { ITEMS, householdShare } from "../lib/carbon/engine.js";
import {
  COMMUTE,
  COOL_LEVEL,
  EF,
  FACTOR_VERSION,
  FLIGHTS,
  FOOD,
  GOODS,
  HEAT_LEVEL,
  HOME_TRIPS,
  HOUSING,
  TARGET_2030_KG,
  UNCERTAINTY,
} from "../lib/carbon/factors.js";
import { CLIMATE_LEVELS, optionLabel } from "../lib/carbon/questions.js";
import { num } from "../lib/format.js";
import "./Method.css";

// 페이지의 모든 표는 계산 엔진과 같은 상수에서 만들어져, 계수를 바꾸면 이 페이지도 함께 바뀐다
function Table({ columns, rows }) {
  return (
    <div className="m-table-wrap">
      <table className="m-table">
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c}>{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              {r.map((cell, j) => (
                <td key={j}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const SECTIONS = [
  { id: "overview", label: "개요" },
  { id: "transport", label: "이동" },
  { id: "housing", label: "주거" },
  { id: "food", label: "식생활" },
  { id: "goods", label: "소비" },
  { id: "range", label: "범위" },
  { id: "limits", label: "한계" },
];

export default function MethodPage() {
  return (
    <>
      <PageHead title="계산 방법" description="간편 입력의 답을 어떤 값과 계수로 계산하는지 모두 공개해요." />
      <div className="wrap method">
        <nav className="m-toc" aria-label="목차">
          {SECTIONS.map((s) => (
            <a key={s.id} href={`#m-${s.id}`} onClick={(e) => {
              e.preventDefault();
              document.getElementById(`m-${s.id}`)?.scrollIntoView({ behavior: "smooth" });
            }}>
              {s.label}
            </a>
          ))}
        </nav>

        <div className="m-body">
          <section id="m-overview" className="card m-sec">
            <h2>개요</h2>
            <p>
              연간 탄소발자국은 {ITEMS.length}개 항목의 배출량을 더한 값이에요. 단위는 이산화탄소 외 온실가스까지 환산한{" "}
              <strong>kg CO₂e/년</strong>이에요.
            </p>
            <div className="formula">항목 배출량 = 활동량(거리·사용량·횟수) × 배출계수</div>
            <p>
              간편 입력에서 고른 칩과 슬라이더 값은 아래 표의 <strong>대표값</strong>으로 바꿔 계산해요. 그래서 결과에는{" "}
              <span className="badge-est">추정</span> 배지와 함께 가능성이 높은 범위를 표시해요.
            </p>
            <div className="note">
              <strong>배출계수 버전 {FACTOR_VERSION}</strong> — MVP 테스트용 잠정값이에요. 출처와 기준 연도를 확정하면 버전을
              올려 갱신해요. 응답은 결과가 아닌 원본 입력값으로 저장되므로, 계수가 바뀌면 지난 결과도 새 계수로 다시
              계산돼요.
            </div>
          </section>

          <section id="m-transport" className="card m-sec">
            <h2>🚌 이동</h2>
            <h3>통학</h3>
            <div className="formula">
              주 통학 일수 × 2(왕복) × 편도 거리 × 수단별 계수 × {COMMUTE.weeksPerYear}주
            </div>
            <p>
              편도 거리는 편도 시간에 수단별 평균 속도를 곱해 구해요. 걷고 기다리는 시간까지 포함한 '문에서 문까지' 속도예요.
              통학은 학기 중({COMMUTE.weeksPerYear}주)에만 한다고 봐요.
            </p>
            <Table
              columns={["통학 수단", "평균 속도 (km/h)", "배출계수 (kg/인·km)", "편도 40분이면"]}
              rows={Object.keys(COMMUTE.speedKmh).map((m) => [
                optionLabel("commuteMode", m),
                num(COMMUTE.speedKmh[m], 1),
                num(COMMUTE.pkm[m], 3),
                `${num((COMMUTE.speedKmh[m] * 40) / 60, 1)}km`,
              ])}
            />
            <h3>장거리 이동</h3>
            <div className="formula">
              연 왕복 횟수 × {HOME_TRIPS.roundTripKm}km(왕복) × {HOME_TRIPS.pkm} kg/인·km (KTX·고속버스 평균)
            </div>
            <Table
              columns={["선택", "연 왕복 횟수", "연 배출량 (kg)"]}
              rows={Object.entries(HOME_TRIPS.roundTripsPerYear).map(([k, n]) => [
                optionLabel("homeTrips", k),
                `${n}회`,
                num(n * HOME_TRIPS.roundTripKm * HOME_TRIPS.pkm),
              ])}
            />
            <h3>항공</h3>
            <p>거리대별 계수에는 높은 고도에서의 추가 온난화 효과(복사강제력)를 반영했어요.</p>
            <Table
              columns={["선택", "대표 이동", "연 탑승 거리", "계수 (kg/인·km)", "연 배출량 (kg)"]}
              rows={Object.entries(FLIGHTS).map(([k, f]) => [
                optionLabel("flights", k),
                f.note,
                `${num(f.pkm)}km`,
                num(f.ef, 2),
                num(f.pkm * f.ef),
              ])}
            />
          </section>

          <section id="m-housing" className="card m-sec">
            <h2>🏠 주거</h2>
            <div className="formula">
              (전기 + 냉방 × 냉방 단계 배수) × {EF.electricity} kg/kWh + (난방 × 난방 단계 배수 + 온수·조리) × {EF.gas}{" "}
              kg/m³ → × 나의 몫
            </div>
            <p>거주 형태마다 1인 가구 기준의 연간 에너지 사용량을 정해 두었어요. 지역·중앙난방은 도시가스 사용량으로 환산했어요.</p>
            <Table
              columns={["거주 형태", "전기 (kWh)", "냉방 (kWh)", "난방 (m³)", "온수·조리 (m³)", "기본 동거 인원"]}
              rows={Object.entries(HOUSING).map(([k, h]) => [
                optionLabel("housing", k),
                num(h.elec),
                num(h.cool),
                num(h.heat),
                num(h.hot),
                `${h.defaultHousehold}명`,
              ])}
            />
            <h3>냉난방 단계</h3>
            <Table
              columns={["단계", ...CLIMATE_LEVELS]}
              rows={[
                ["냉방 배수", ...COOL_LEVEL.map((v) => `×${v}`)],
                ["난방 배수", ...HEAT_LEVEL.map((v) => `×${v}`)],
              ]}
            />
            <h3>함께 사는 인원</h3>
            <p>
              한 명이 늘 때마다 가구 에너지가 25%씩 늘어난다고 보고, 이를 인원수로 나눠 나의 몫을 구해요. 함께 살수록 1인 몫이
              줄어들어요.
            </p>
            <Table
              columns={["인원", "1명", "2명", "3명", "4명 이상"]}
              rows={[["나의 몫", ...[1, 2, 3, 4].map((n) => `${num(householdShare(n) * 100)}%`)]]}
            />
          </section>

          <section id="m-food" className="card m-sec">
            <h2>🍚 식생활</h2>
            <div className="formula">
              기본 식단 {num(FOOD.base)}kg + 주 육류 횟수 × 52주 × {FOOD.meatServing}kg + 주 배달·외식 횟수 × 52주 ×{" "}
              {FOOD.mealOverhead}kg
            </div>
            <p>
              기본 식단은 곡물·채소·유제품 등 육류를 뺀 식사로, 모든 사람에게 같은 값을 써요. 육류 1회는 약 120g이고 소 20%·돼지
              45%·닭 35%로 가중했어요. 배달·외식은 조리·배송 과정에서 더해지는 배출만 따로 더해요(포장재는 소비의 일회용품).
            </p>
            <Table
              columns={["육류 섭취", "주 횟수(대표값)", "연 배출량 (kg)"]}
              rows={Object.entries(FOOD.servingsPerWeek).map(([k, n]) => [
                optionLabel("meat", k),
                `${n}회`,
                num(n * 52 * FOOD.meatServing),
              ])}
            />
          </section>

          <section id="m-goods" className="card m-sec">
            <h2>🛍️ 소비</h2>
            <Table
              columns={["항목", "계산", "비고"]}
              rows={[
                ["의류·잡화", `월 개수 × 12 × ${GOODS.clothingItem}kg`, `'10개 이상'은 ${GOODS.clothesOverflow}개로 계산`],
                ["택배", `월 건수 × 12 × ${GOODS.parcel}kg`, `포장재 + 배송, '20건 이상'은 ${GOODS.parcelsOverflow}건으로 계산`],
                [
                  "일회용품",
                  `(컵 주 ${GOODS.cupsPerWeek}잔 × ${GOODS.cup}kg + 배달 용기 × ${GOODS.container}kg) × 52 × (1 − 다회용 비율)`,
                  `배달·외식의 ${GOODS.deliveryShare * 100}%를 배달로 가정`,
                ],
              ]}
            />
            <Table
              columns={["텀블러·다회용기", ...Object.keys(GOODS.reuseRate).map((k) => optionLabel("reusable", k))]}
              rows={[["다회용 비율", ...Object.values(GOODS.reuseRate).map((v) => `${v * 100}%`)]]}
            />
          </section>

          <section id="m-range" className="card m-sec">
            <h2>↔️ 범위는 이렇게 계산해요</h2>
            <p>
              대표값이 실제와 다를 수 있는 정도(상대 불확도)를 항목마다 정하고, 항목들의 오차가 서로 독립이라고 보아 제곱합의
              제곱근으로 합쳤어요. 결과 화면의 범위는 <strong>추정값 ± 이 오차</strong>예요.
            </p>
            <Table
              columns={["항목", "상대 불확도"]}
              rows={ITEMS.map((i) => [i.label, `±${num(UNCERTAINTY[i.key] * 100)}%`])}
            />
            <p className="m-small">
              비교선: 2030년 1인 생활 탄소발자국 목표 {num(TARGET_2030_KG / 1000, 1)}톤은 1.5℃ 목표에 맞춘 값이에요(Hot or Cool
              Institute, 2021). 이 목표는 여가·서비스 등 이 계산기가 다루지 않는 영역까지 포함한 값이에요.
            </p>
          </section>

          <section id="m-limits" className="card m-sec">
            <h2>아직 다루지 않는 것</h2>
            <ul className="m-list">
              <li>전자기기 구매, 교재, 디지털 활동, 가전별 사용 시간 등 정밀 입력 항목 (다음 단계에서 추가 예정)</li>
              <li>요일별 통학, 방학 중 통학, 구간별 이동, 주말·여가 이동</li>
              <li>고지서 실측값(전기·가스 요금), 전기 난방 등 난방 방식별 차이</li>
              <li>대학 시설(강의실·도서관) 이용에 따른 배출</li>
            </ul>
            <p>
              결과는 대략적인 규모와 영역별 비중을 보여 주는 용도예요. 계산식에 대한 의견은 결과 화면 아래 의견 보내기를 이용해
              주세요.
            </p>
            <Link className="btn btn-primary" to="/calculator">
              계산해 보기 →
            </Link>
          </section>
        </div>
      </div>
    </>
  );
}
