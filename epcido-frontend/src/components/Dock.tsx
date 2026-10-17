import { NavLink } from "react-router-dom";
import { useData } from "../app/DataContext";
import { usePendingLeaves, useQueue } from "../app/hooks";
import { countTimesheets } from "../domain/workflow";
import { ADMIN_TOOLS, PLANNING_TOOLS, routesFor, type Route } from "../domain/permissions";
import { NAV_META } from "./navMeta";

/**
 * Pływająca nawigacja na wysokość ikon — pozycje zależą od uprawnień (domain/permissions.ts).
 * Narzędzia Planningu (Obsada) stoją osobno, za kreską; narzędzia administratora — same ikony.
 * Licznik (do zatwierdzenia, wnioski) jest pigułką za nazwą, w jednej linii z ikoną.
 */
export function Dock() {
  const { user } = useData();
  const queue = useQueue();
  const leaves = usePendingLeaves();
  if (!user) return null;
  const routes = routesFor(user);
  if (routes.length <= 1) return null;
  const main = routes.filter((r) => !PLANNING_TOOLS.includes(r) && !ADMIN_TOOLS.includes(r));
  const tools = routes.filter((r) => PLANNING_TOOLS.includes(r));
  const admin = routes.filter((r) => ADMIN_TOOLS.includes(r));
  const counts: Partial<Record<Route, number>> = {
    "/zatwierdzanie": countTimesheets(queue.items),
    "/urlopy": leaves.length,
  };

  const link = (to: Route, kind: "main" | "tool" | "admin" = "main") => {
    const { label, icon: Icon } = NAV_META[to];
    const count = counts[to] ?? 0;
    return (
      <NavLink
        key={to}
        to={to}
        className={({ isActive }) => `dock__link dock__link--${kind} ${isActive ? "is-active" : ""} ${count ? "has-count" : ""}`}
        data-tip={kind === "admin" ? label : undefined}
        aria-label={count ? `${label}: ${count} do rozpatrzenia` : label}
      >
        <Icon size={20} strokeWidth={1.9} aria-hidden />
        <span className="dock__label">{label}</span>
        {count > 0 && <span className="dock__count">{count > 99 ? "99+" : count}</span>}
      </NavLink>
    );
  };

  return (
    <nav className="dock" aria-label="Nawigacja główna">
      {main.map((r) => link(r))}
      {tools.length > 0 && <span className="dock__divider" aria-hidden />}
      {tools.map((r) => link(r, "tool"))}
      {admin.length > 0 && <span className="dock__divider" aria-hidden />}
      {admin.map((r) => link(r, "admin"))}
    </nav>
  );
}
