// Defines public routes, the admin session gate, and the shared app shell.
import { useEffect, useState } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { getAdminSession } from "./api.js";
import Header from "./components/Header.jsx";
import Footer from "./components/Footer.jsx";
import PageShell from "./components/PageShell.jsx";
import Home from "./pages/Home.jsx";
import Verify from "./pages/Verify.jsx";
import Issuer from "./pages/Issuer.jsx";
import Lookup from "./pages/Lookup.jsx";
import NotFound from "./pages/NotFound.jsx";
import Login from "./pages/Login.jsx";

function ProtectedRoute({ children }) {
  const location = useLocation();
  const [sessionState, setSessionState] = useState("checking");

  useEffect(() => {
    let active = true;
    getAdminSession()
      .then(({ authenticated }) => {
        if (active) setSessionState(authenticated ? "authenticated" : "unauthenticated");
      })
      .catch(() => {
        if (active) setSessionState("unauthenticated");
      });

    return () => {
      active = false;
    };
  }, []);

  if (sessionState === "checking") {
    return <p className="loading-message" role="status">Checking admin session…</p>;
  }
  if (sessionState !== "authenticated") {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  return children;
}

function RoutedPage({ children }) {
  return <PageShell>{children}</PageShell>;
}

export default function App() {
  return (
    <div className="app-shell">
      <Header />
      <main className="container page-content">
        <Routes>
          <Route path="/" element={<RoutedPage><Home /></RoutedPage>} />
          <Route path="/verify" element={<RoutedPage><Verify /></RoutedPage>} />
          <Route
            path="/issuer"
            element={
              <RoutedPage>
                <ProtectedRoute><Issuer /></ProtectedRoute>
              </RoutedPage>
            }
          />
          <Route path="/lookup" element={<RoutedPage><Lookup /></RoutedPage>} />
          <Route path="/login" element={<RoutedPage><Login /></RoutedPage>} />
          <Route path="*" element={<RoutedPage><NotFound /></RoutedPage>} />
        </Routes>
      </main>
      <Footer />
    </div>
  );
}
