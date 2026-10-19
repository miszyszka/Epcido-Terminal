import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { Terminal } from "lucide-react";
import { DataProvider, useData, useUser } from "./app/DataContext";
import { SessionProvider, useSession } from "./app/SessionContext";
import { UiProvider } from "./app/UiContext";
import { ConfirmHost } from "./components/ConfirmDialog";
import { DevPanel } from "./components/DevPanel";
import { Dock } from "./components/Dock";
import { PersonSheetHost } from "./components/PersonSheet";
import { DataGate } from "./components/StateScreens";
import { Toasts } from "./components/Toasts";
import { TooltipLayer } from "./components/TooltipLayer";
import { TopBar } from "./components/TopBar";
import { canOpen, homeFor } from "./domain/permissions";
import { ApprovalsView } from "./features/approvals/ApprovalsView";
import { BrandbookView } from "./features/brandbook/BrandbookView";
import { DashboardView } from "./features/dashboard/DashboardView";
import { EntryDialogHost } from "./features/hours/EntryDialog";
import { MapView } from "./features/map/MapView";
import { PeopleView } from "./features/people/PeopleView";
import { StaffingView } from "./features/staffing/StaffingView";
import { ProjectEditor } from "./features/project/ProjectEditor";
import { StructureView } from "./features/structure/StructureView";
import { TimelineView } from "./features/timeline/TimelineView";
import { MyHoursView } from "./features/worker/MyHoursView";
import { LeavesView } from "./features/leaves/LeavesView";
import { ReportsView } from "./features/admin/ReportsView";
import { SettingsView } from "./features/admin/SettingsView";
import { UsersView } from "./features/admin/UsersView";

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
 *
 * Warstwa `#epcido-overlay` leży w ramce, ale poza przewijaniem (.app-scroll): okna dialogowe,
 * podgląd osoby i komunikaty są dzięki temu zawsze na środku widocznego ekranu, nawet gdy strona
 * pod spodem jest zjechana na sam dół.
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
      </div>
      <Dock />
      <div className="overlay-layer" id="epcido-overlay" />
      {model && user && <ProjectEditor />}
      {model && user && <EntryDialogHost />}
      {model && user && <PersonSheetHost />}
      <ConfirmHost />
      <Toasts />
    </div>
  );

  return (
    <div className={`layout ${panelOpen ? "has-panel" : ""}`}>
      {panelOpen ? (
        <DevPanel />
      ) : (
        <button type="button" className="devpanel-tab" onClick={() => setPanelOpen(true)} aria-label="Pokaż panel roboczy">
          <Terminal size={16} aria-hidden />
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
      <Route path="/obsada" element={<StaffingView />} />
      <Route path="/urlopy" element={<LeavesView />} />
      <Route path="/raporty" element={<ReportsView />} />
      <Route path="/uzytkownicy" element={<UsersView />} />
      <Route path="/ustawienia" element={<SettingsView />} />
      <Route path="*" element={<Navigate to={homeFor(user)} replace />} />
    </Routes>
  );
}
