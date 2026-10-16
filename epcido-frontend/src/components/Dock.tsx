import { NavLink } from "react-router-dom";
import { ChartGantt, LayoutGrid, Network, Plus, Search, Users, X } from "lucide-react";
import { useUi } from "../app/UiContext";

const LINKS = [
  { to: "/mapa", label: "Mapa", icon: LayoutGrid },
  { to: "/os-czasu", label: "Oś czasu", icon: ChartGantt },
  { to: "/struktura", label: "Struktura", icon: Network },
  { to: "/ludzie", label: "Ludzie", icon: Users },
];

/** Pływająca nawigacja — ten sam wzór na komputerze i w telefonie (brandbook 5). */
export function Dock() {
  const { search, setSearch, openNewProject } = useUi();
  const [first, second, ...rest] = LINKS;

  return (
    <nav className="dock" aria-label="Nawigacja główna">
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
      <div className="dock__row">
        {[first, second].map((l) => (
          <DockLink key={l.to} {...l} />
        ))}
        <button type="button" className="dock__primary" onClick={openNewProject} aria-label="Nowy projekt" data-tip="Nowy projekt">
          <Plus size={24} strokeWidth={2.25} />
        </button>
        {rest.map((l) => (
          <DockLink key={l.to} {...l} />
        ))}
      </div>
    </nav>
  );
}

function DockLink({ to, label, icon: Icon }: (typeof LINKS)[number]) {
  return (
    <NavLink to={to} className={({ isActive }) => `dock__link ${isActive ? "is-active" : ""}`}>
      <Icon size={22} strokeWidth={1.9} aria-hidden />
      <span>{label}</span>
    </NavLink>
  );
}
