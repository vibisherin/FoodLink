import { BrowserRouter, Routes, Route } from "react-router-dom";
import { FoodLinkProvider } from "./context/FoodLinkContext";
import Home from "./pages/Home";
import Dashboard from "./pages/Dashboard";
import FoodScanner from "./pages/FoodScanner";
import "./index.css";

export default function App() {
  return (
    <FoodLinkProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/scanner" element={<FoodScanner />} />
        </Routes>
      </BrowserRouter>
    </FoodLinkProvider>
  );
}
