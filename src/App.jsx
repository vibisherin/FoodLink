import { BrowserRouter, Routes, Route } from "react-router-dom";
import { I18nProvider } from "./i18n/I18nContext";
import { AuthProvider } from "./context/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import ChatBot from "./components/ChatBot";
import Home from "./pages/Home";
import Login from "./pages/Login";
import Register from "./pages/Register";
import OAuthCallback from "./pages/OAuthCallback";
import Dashboard from "./pages/Dashboard";
import AdminDashboard from "./pages/AdminDashboard";
import FoodScanner from "./pages/FoodScanner";
import Profile from "./pages/Profile";
import "./index.css";

export default function App() {
  return (
    <I18nProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/admin/login" element={<Login adminOnly />} />
            <Route path="/oauth/callback" element={<OAuthCallback />} />
            <Route path="/dashboard" element={<ProtectedRoute roles={["restaurant", "ngo", "admin"]}><Dashboard /></ProtectedRoute>} />
            <Route path="/admin" element={<ProtectedRoute roles={["admin"]}><AdminDashboard /></ProtectedRoute>} />
            <Route path="/scanner" element={<ProtectedRoute roles={["restaurant", "ngo"]}><FoodScanner /></ProtectedRoute>} />
            <Route path="/profile" element={<ProtectedRoute roles={["restaurant", "ngo"]}><Profile /></ProtectedRoute>} />
          </Routes>
          <ChatBot />
        </BrowserRouter>
      </AuthProvider>
    </I18nProvider>
  );
}
