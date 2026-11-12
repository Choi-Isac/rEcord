import { Link } from "react-router-dom";

// 하위 페이지 상단의 크림슨 머리말 띠. mobileDescription: 휴대폰에서 대신 보여 줄 짧은 설명
export default function PageHead({ group, title, description, mobileDescription, crumbs = [] }) {
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
        {description &&
          (mobileDescription ? (
            <p>
              <span className="only-desktop">{description}</span>
              <span className="only-mobile">{mobileDescription}</span>
            </p>
          ) : (
            <p>{description}</p>
          ))}
      </div>
    </div>
  );
}
