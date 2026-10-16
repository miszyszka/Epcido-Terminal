import { NavLink } from "react-router-dom";
import { useData } from "../app/DataContext";
import { useQueue } from "../app/hooks";
import { countTimesheets } from "../domain/workflow";
import { PLANNING_TOOLS, routesFor } from "../domain/permissions";
import { NAV_META } from "./navMeta";

/**
 * Pływająca nawigacja na wysokość ikon — pozycje zależą od roli (domain/permissions.ts).
 * Narzędzia tylko dla Planningu (Obsada) stoją osobno, za kreską.
 */
export function Dock() {
  const { user } = useData();
  const queue = useQueue();
  if (!user) return null;
  const routes = routesFor(user);
  if (routes.length <= 1) return null;
  const main = routes.filter((r) => !PLANNING_TOOLS.includes(r));
  const tools = routes.filter((r) => PLANNING_TOOLS.includes(r));
  const pending = countTimesheets(queue.items);

  const link = (to: (typeof routes)[number], tool = false) => {
    const { label, icon: Icon } = NAV_META[to];
    const count = to === "/zatwierdzanie" ? pending : 0;
    return (
      <NavLink
        key={to}
        to={to}
        className={({ isActive }) => `dock__link ${isActive ? "is-active" : ""} ${tool ? "dock__link--tool" : ""}`}
        data-tip={label}
        aria-label={count ? `${label}: ${count} do zatwierdzenia` : label}
      >
        <span className="dock__icon">
          <Icon size={20} strokeWidth={1.9} aria-hidden />
          {count > 0 && <span className="dock__badge">{count > 999 ? "999+" : count}</span>}
        </span>
        <span className="dock__label">{label}</span>
      </NavLink>
    );
  };

  return (
    <nav className="dock" aria-label="Nawigacja główna">
      {main.map((r) => link(r))}
      {tools.length > 0 && <span className="dock__divider" aria-hidden />}
      {tools.map((r) => link(r, true))}
    </nav>
  );
}
