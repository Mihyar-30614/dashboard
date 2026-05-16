import { useEffect } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import Login from "./auth/Login";
import Shell from "./layout/Shell";
import AppPage from "./pages/AppPage";
import { useMe } from "./api/hooks";

function Protected({ children }: { children: React.ReactNode }) {
  const { data, isLoading } = useMe();
  if (isLoading) return <div style={{ padding: 20 }}>Loading…</div>;
  if (!data) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  useEffect(() => {
    const t = localStorage.getItem("theme");
    if (t) document.documentElement.dataset.theme = t;
    else if (matchMedia("(prefers-color-scheme: dark)").matches)
      document.documentElement.dataset.theme = "dark";
  }, []);
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/*"
        element={
          <Protected>
            <Shell />
          </Protected>
        }
      >
        <Route index element={<div>Overview placeholder</div>} />
        <Route path="app/:slug" element={<AppPage />} />
        <Route path="settings" element={<div>Settings placeholder</div>} />
      </Route>
    </Routes>
  );
}
