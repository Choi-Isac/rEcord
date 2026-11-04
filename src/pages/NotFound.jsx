import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <div className="wrap">
      <div className="empty" style={{ paddingTop: 96 }}>
        <h2>페이지를 찾을 수 없어요</h2>
        <p>주소가 바뀌었거나 없는 페이지예요.</p>
        <Link className="btn btn-primary" to="/">
          홈으로
        </Link>
      </div>
    </div>
  );
}
