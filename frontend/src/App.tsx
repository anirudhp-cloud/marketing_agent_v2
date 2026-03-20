import { Routes, Route, Navigate, useNavigate, useLocation } from "react-router-dom";
import { useEffect, useRef } from "react";
import { WizardLayout } from "@/components/wizard/WizardLayout";
import SetupPage from "@/pages/SetupPage";
import AudiencePage from "@/pages/AudiencePage";
import GoalsPage from "@/pages/GoalsPage";
import CreativePage from "@/pages/CreativePage";
import ReviewPage from "@/pages/ReviewPage";
import VariantsPage from "@/pages/VariantsPage";
import CalendarPage from "@/pages/CalendarPage";
import SchedulePage from "@/pages/SchedulePage";
import EngagePage from "@/pages/EngagePage";

export default function App() {
  const navigate = useNavigate();
  const location = useLocation();
  const hasRedirected = useRef(false);

  // On fresh page load (full refresh), redirect to /setup
  useEffect(() => {
    if (!hasRedirected.current) {
      hasRedirected.current = true;
      localStorage.removeItem("campaign_session_dict");
      if (location.pathname !== "/setup") {
        navigate("/setup", { replace: true });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <div className="ambient-glow" />
      <Routes>
        <Route element={<WizardLayout />}>
          <Route path="/setup" element={<SetupPage />} />
          <Route path="/audience" element={<AudiencePage />} />
          <Route path="/goals" element={<GoalsPage />} />
          <Route path="/creative" element={<CreativePage />} />
          <Route path="/review" element={<ReviewPage />} />
          <Route path="/variants" element={<VariantsPage />} />
          <Route path="/calendar" element={<CalendarPage />} />
          <Route path="/schedule" element={<SchedulePage />} />
          <Route path="/engage" element={<EngagePage />} />
          <Route path="*" element={<Navigate to="/setup" replace />} />
        </Route>
      </Routes>
    </>
  );
}
