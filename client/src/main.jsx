import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import "./index.css";
import useStore from "./lib/store";

import Welcome    from "./pages/Welcome";
import Discovery  from "./pages/Discovery";
import Results    from "./pages/Results";
import Creation   from "./pages/Creation";
import Hub        from "./pages/Hub";
import Dashboard  from "./pages/Dashboard";

function RequireAuth({ children }) {
  const token = useStore(s => s.token);
  return token ? children : <Navigate to="/" replace />;
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/"            element={<Welcome />} />
        <Route path="/discovery"   element={<RequireAuth><Discovery /></RequireAuth>} />
        <Route path="/results"     element={<RequireAuth><Results /></RequireAuth>} />
        <Route path="/creation/:id" element={<RequireAuth><Creation /></RequireAuth>} />
        <Route path="/hub/:id"     element={<RequireAuth><Hub /></RequireAuth>} />
        <Route path="/dashboard"   element={<RequireAuth><Dashboard /></RequireAuth>} />
        <Route path="*"            element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<React.StrictMode><App /></React.StrictMode>);
