import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { DataProvider } from "./app/DataContext";
import { UiProvider } from "./app/UiContext";
import { Dock } from "./components/Dock";
import { DataGate } from "./components/StateScreens";
import { Toasts } from "./components/Toasts";
import { TooltipLayer } from "./components/TooltipLayer";
import { TopLine } from "./components/TopLine";
import { BrandbookView } from "./features/brandbook/BrandbookView";
import { MapView } from "./features/map/MapView";
import { PeopleView } from "./features/people/PeopleView";
import { ProjectDrawer } from "./features/project/ProjectDrawer";
import { StructureView } from "./features/structure/StructureView";
import { TimelineView } from "./features/timeline/TimelineView";

export default function App() {
  return (
    <BrowserRouter>
      <UiProvider>
        <DataProvider>
          <div className="shell">
            <TopLine />
            <main className="shell__main">
              <Routes>
                <Route path="/brandbook" element={<BrandbookView />} />
                <Route
                  path="*"
                  element={
                    <DataGate>
                      <Routes>
                        <Route path="/" element={<Navigate to="/mapa" replace />} />
                        <Route path="/mapa" element={<MapView />} />
                        <Route path="/os-czasu" element={<TimelineView />} />
                        <Route path="/struktura" element={<StructureView />} />
                        <Route path="/ludzie" element={<PeopleView />} />
                        <Route path="*" element={<Navigate to="/mapa" replace />} />
                      </Routes>
                    </DataGate>
                  }
                />
              </Routes>
            </main>
            <Dock />
            <ProjectDrawer />
            <Toasts />
            <TooltipLayer />
          </div>
        </DataProvider>
      </UiProvider>
    </BrowserRouter>
  );
}
