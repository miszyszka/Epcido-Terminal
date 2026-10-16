import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { PanelLeftOpen } from "lucide-react";
import { DataProvider, useData, useUser } from "./app/DataContext";
import { SessionProvider, useSession } from "./app/SessionContext";
import { UiProvider } from "./app/UiContext";
import { DevPanel } from "./components/DevPanel";
import { Dock } from "./components/Dock";
import { DataGate } from "./components/StateScreens";
import { Toasts } from "./components/Toasts";
import { TooltipLayer } from "./components/TooltipLayer";
import { TopBar } from "./components/TopBar";
import { canOpen, homeFor } from "./domain/permissions";
import { ApprovalsView } from "./features/approvals/ApprovalsView";
import { BrandbookView } from "./features/brandbook/BrandbookView";
import { DashboardView } from "./features/dashboard/DashboardView";
import { MapView } from "./features/map/MapView";
import { PeopleView } from "./features/people/PeopleView";
import { ProjectEditor } from "./features/project/ProjectEditor";
import { StructureView } from "./features/structure/StructureView";
import { TimelineView } from "./features/timeline/TimelineView";
import { MyHoursView } from "./features/worker/MyHoursView";

export default function App() {
  return (
    <BrowserRouter>
      <SessionProvider>
        <UiProvider>
          <DataProvider>
            <Layout />
            <TooltipLayer />
          </DataProvider>
        </UiProvider>
      </SessionProvider>
    </BrowserRouter>
  );
}

/**
 * Układ: po lewej panel roboczy (prototyp), po prawej aplikacja.
 * Aplikacja żyje w ramce (.app-frame), więc podgląd mobilny to ta sama aplikacja w węższej ramce —
 * style reagują na szerokość ramki (container queries), a nie okna przeglądarki.
 */
function Layout() {
  const { preview, panelOpen, setPanelOpen } = useSession();
  const { model, user } = useData();

  const app = (
    <div className="app-frame">
      <div className="app-scroll">
        <div className="shell">
          <TopBar />
          <main className="shell__main">
            <AppRoutes />
          </main>
        </div>
        <Dock />
        {model && user && <ProjectEditor />}
        <Toasts />
      </div>
    </div>
  );

  return (
    <div className={`layout ${panelOpen ? "has-panel" : ""}`}>
      {panelOpen ? (
        <DevPanel />
      ) : (
        <button type="button" className="devpanel-tab" onClick={() => setPanelOpen(true)} aria-label="Pokaż panel roboczy">
          <PanelLeftOpen size={18} aria-hidden />
          <span>Panel roboczy</span>
        </button>
      )}
      <div className={`stage stage--${preview}`}>
        {preview === "mobile" ? (
          <div className="device" aria-label="Podgląd: telefon">
            {app}
          </div>
        ) : (
          app
        )}
      </div>
    </div>
  );
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/brandbook" element={<BrandbookView />} />
      <Route
        path="*"
        element={
          <DataGate>
            <Guarded />
          </DataGate>
        }
      />
    </Routes>
  );
}

/** Ekrany zależne od roli. Adres spoza uprawnień przekierowuje na ekran startowy roli. */
function Guarded() {
  const user = useUser();
  const location = useLocation();
  if (location.pathname === "/" || !canOpen(user, location.pathname)) return <Navigate to={homeFor(user)} replace />;
  return (
    <Routes>
      <Route path="/pulpit" element={<DashboardView />} />
      <Route path="/zatwierdzanie" element={<ApprovalsView />} />
      <Route path="/moje-godziny" element={<MyHoursView />} />
      <Route path="/mapa" element={<MapView />} />
      <Route path="/os-czasu" element={<TimelineView />} />
      <Route path="/struktura" element={<StructureView />} />
      <Route path="/ludzie" element={<PeopleView />} />
      <Route path="*" element={<Navigate to={homeFor(user)} replace />} />
    </Routes>
  );
}
