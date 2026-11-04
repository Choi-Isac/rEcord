import { Route, Routes } from "react-router-dom";
import Layout from "./components/Layout.jsx";
import Home from "./pages/Home.jsx";
import StartPage from "./pages/StartPage.jsx";
import SimpleInputPage from "./pages/SimpleInputPage.jsx";
import ResultPage from "./pages/ResultPage.jsx";
import MethodPage from "./pages/MethodPage.jsx";
import NotFound from "./pages/NotFound.jsx";

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="calculator" element={<StartPage />} />
        <Route path="calculator/simple" element={<SimpleInputPage />} />
        <Route path="result" element={<ResultPage />} />
        <Route path="result/:id" element={<ResultPage />} />
        <Route path="method" element={<MethodPage />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
