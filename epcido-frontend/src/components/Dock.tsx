import { NavLink } from "react-router-dom";
import { ChartGantt, CheckCheck, Clock3, Gauge, LayoutGrid, Network, Search, Users, X } from "lucide-react";
import { useData } from "../app/DataContext";
import { useQueue } from "../app/hooks";
import { useUi } from "../app/UiContext";
import { routesFor, type Route } from "../domain/permissions";

const META: Record<Route, { label: string; icon: typeof LayoutGrid }> = {
  "/pulpit": { label: "Pulpit", icon: Gauge },
  "/zatwierdzanie": { label: "Zatwierdzanie", icon: CheckCheck },
  "/moje-godziny": { label: "Moje godziny", icon: Clock3 },
  "/mapa": { label: "Mapa", icon: LayoutGrid },
  "/os-czasu": { label: "Oś czasu", icon: ChartGantt },
  "/struktura": { label: "Struktura", icon: Network },
  "/ludzie": { label: "Ludzie", icon: Users },
};

const SEARCHABLE: Route[] = ["/mapa", "/os-czasu", "/struktura", "/ludzie", "/zatwierdzanie", "/pulpit"];

/** Pływająca nawigacja — pozycje zależą od roli (domain/permissions.ts). */
export function Dock() {
  const { user } = useData();
  const { search, setSearch } = useUi();
  const queue = useQueue();
  if (!user) return null;
  const routes = routesFor(user);
  const searchable = routes.some((r) => SEARCHABLE.includes(r));
  if (routes.length <= 1 && !searchable) return null;

  return (
    <nav className="dock" aria-label="Nawigacja główna">
      {searchable && (
        <label className="dock__search">
          <Search size={18} aria-hidden />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Szukaj projektu, klienta lub osoby"
            aria-label="Szukaj projektu, klienta lub osoby"
          />
          {search && (
            <button type="button" className="dock__clear" onClick={() => setSearch("")} aria-label="Wyczyść wyszukiwanie">
              <X size={16} />
            </button>
          )}
        </label>
      )}
      <div className="dock__row" style={{ gridTemplateColumns: `repeat(${routes.length}, 1fr)` }}>
        {routes.map((to) => {
          const { label, icon: Icon } = META[to];
          const count = to === "/zatwierdzanie" ? queue.items.length : 0;
          return (
            <NavLink key={to} to={to} className={({ isActive }) => `dock__link ${isActive ? "is-active" : ""}`}>
              <span className="dock__icon">
                <Icon size={22} strokeWidth={1.9} aria-hidden />
                {count > 0 && <span className="dock__badge">{count > 999 ? "999+" : count}</span>}
              </span>
              <span>{label}</span>
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}
