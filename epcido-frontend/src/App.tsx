import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { SessionProvider } from "./context/SessionContext";
import { Layout } from "./components/Layout";
import { LoginPage } from "./pages/LoginPage";
import { TimeEntryPage } from "./pages/TimeEntryPage";
import { SupervisorApprovalPage } from "./pages/SupervisorApprovalPage";
import { PmApprovalPage } from "./pages/PmApprovalPage";
import { PlanningPage } from "./pages/PlanningPage";

export default function App() {
  return (
    <SessionProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<Layout />}>
            <Route index element={<Navigate to="/time-entry" replace />} />
            <Route path="time-entry" element={<TimeEntryPage />} />
            <Route path="approve-sv" element={<SupervisorApprovalPage />} />
            <Route path="approve-pm" element={<PmApprovalPage />} />
            <Route path="planning" element={<PlanningPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </SessionProvider>
  );
}
