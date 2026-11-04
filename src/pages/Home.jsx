// 메인 화면: 헤더 메뉴바에서 고른 디자인을 보여 준다
import { useHomeDesign } from "../lib/design.jsx";
import HomeFootprint from "./HomeFootprint.jsx";
import HomeStory from "./HomeStory.jsx";
import HomeClassic from "./HomeClassic.jsx";

const DESIGNS = { footprint: HomeFootprint, story: HomeStory, classic: HomeClassic };

export default function Home() {
  const [design] = useHomeDesign();
  const Design = DESIGNS[design];
  return <Design />;
}
