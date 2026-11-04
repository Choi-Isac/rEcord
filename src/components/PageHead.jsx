import { Link } from "react-router-dom";

// 하위 페이지 상단의 크림슨 머리말 띠
export default function PageHead({ group, title, description, crumbs = [] }) {
  return (
    <div className="page-head">
      <div className="wrap">
        <div className="crumbs">
          <Link to="/">홈</Link>
          {group && <> › {group}</>}
          {crumbs.map((c) => (
            <span key={c.to}>
              {" › "}
              <Link to={c.to}>{c.label}</Link>
            </span>
          ))}
        </div>
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
    </div>
  );
}
