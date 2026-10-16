import { useMemo, useRef, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Plus, Search, X } from "lucide-react";
import { useData } from "../app/DataContext";
import { useUi } from "../app/UiContext";
import { POSITION_LABEL } from "../domain/labels";
import { can, canEditProject, canOpen, routesFor, visibleProjects } from "../domain/permissions";
import type { Employee, Project } from "../domain/types";
import { todayISO } from "../lib/dates";
import { cityOf, normalize } from "../lib/search";
import { NAV_META } from "./navMeta";
import { PositionMark, ProjectDot } from "./PersonBadge";

interface Result {
  key: string;
  group: string;
  label: string;
  hint?: string;
  icon: ReactNode;
  run: () => void;
}

const LIMIT = 6;

/**
 * Wyszukiwarka u góry ekranu: już przy pierwszych literach podpowiada projekty, ludzi, ekrany i akcje,
 * do których zalogowana osoba ma dostęp. Enter otwiera pierwszą podpowiedź.
 */
export function GlobalSearch() {
  const { model, user } = useData();
  const { openProject, openNewProject } = useUi();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const input = useRef<HTMLInputElement>(null);

  const results = useMemo<Result[]>(() => {
    const q = normalize(query);
    if (!q || !model || !user) return [];
    const hit = (...fields: (string | null | undefined)[]) => fields.some((f) => f && normalize(f).includes(q));
    const out: Result[] = [];
    const today = todayISO();

    // Ekrany i akcje
    const screens = routesFor(user)
      .filter((r) => hit(NAV_META[r].label, ...(NAV_META[r].keywords ?? [])))
      .map<Result>((r) => {
        const Icon = NAV_META[r].icon;
        return { key: `s-${r}`, group: "Ekrany", label: NAV_META[r].label, icon: <Icon size={16} aria-hidden />, run: () => navigate(r) };
      });
    if (can(user, "project.create") && hit("Dodaj nowy projekt", "nowy projekt", "utwórz"))
      screens.unshift({ key: "a-new", group: "Ekrany", label: "Dodaj nowy projekt", icon: <Plus size={16} aria-hidden />, run: openNewProject });

    // Projekty
    const projects = visibleProjects(model, user)
      .filter((p) => hit(p.name, p.number, p.customerName, p.siteAddress, p.country, p.dataverseNumber))
      .slice(0, LIMIT)
      .map<Result>((p: Project) => ({
        key: `p-${p.id}`,
        group: "Projekty",
        label: p.name,
        hint: `${p.number} · ${p.customerName}, ${cityOf(p)}`,
        icon: <ProjectDot color={p.color} />,
        run: () => (canEditProject(user, p) ? openProject(p.id) : navigate(`/os-czasu?projekt=${p.id}`)),
      }));

    // Ludzie: wszyscy (lista ludzi) albo zespoły widocznych projektów
    const pool = new Map<string, Employee>();
    if (can(user, "people.view")) model.employees.forEach((e) => pool.set(e.id, e));
    else
      for (const p of visibleProjects(model, user)) {
        const t = model.team(p.id);
        [t?.supervisor, ...(t?.members ?? [])].forEach((e) => e && pool.set(e.id, e));
      }
    const people = [...pool.values()]
      .filter((e) => hit(e.name, POSITION_LABEL[e.position]))
      .slice(0, LIMIT)
      .map<Result>((e) => {
        const current = model.projectsOf(e.id, today)[0];
        return {
          key: `e-${e.id}`,
          group: "Ludzie",
          label: e.name,
          hint: `${POSITION_LABEL[e.position]}${current ? ` · ${current.name}` : ""}`,
          icon: <PositionMark employee={e} />,
          run: () => navigate(canOpen(user, "/ludzie") ? `/ludzie?osoba=${e.id}` : `/os-czasu?osoba=${e.id}`),
        };
      });

    // Zatwierdzanie u supervisora (IM, administrator)
    const approvals =
      can(user, "hours.approveFinal") && canOpen(user, "/zatwierdzanie")
        ? [...pool.values()]
            .filter((e) => e.position === "SUPERVISOR" && hit(e.name))
            .slice(0, 3)
            .map<Result>((e) => ({
              key: `z-${e.id}`,
              group: "Zatwierdzanie",
              label: `Godziny od ${e.name}`,
              icon: <ArrowRight size={16} aria-hidden />,
              run: () => navigate(`/zatwierdzanie?sv=${e.id}`),
            }))
        : [];

    out.push(...projects, ...people, ...approvals, ...screens.slice(0, LIMIT));
    return out;
  }, [query, model, user, navigate, openProject, openNewProject]);

  if (!user || routesFor(user).length <= 1) return null;

  const choose = (r: Result | undefined) => {
    if (!r) return;
    r.run();
    setQuery("");
    setOpen(false);
    input.current?.blur();
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(results.length - 1, a + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(0, a - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      choose(results[active]);
    } else if (e.key === "Escape") {
      setQuery("");
      setOpen(false);
    }
  };

  const show = open && query.trim().length > 0;

  return (
    <div className={`gsearch ${show ? "is-open" : ""}`}>
      <label className="gsearch__field">
        <Search size={18} aria-hidden />
        <input
          ref={input}
          type="search"
          value={query}
          placeholder="Szukaj projektu, osoby lub ekranu"
          aria-label="Szukaj projektu, osoby lub ekranu"
          role="combobox"
          aria-expanded={show}
          aria-controls="gsearch-list"
          aria-activedescendant={show && results[active] ? `gsearch-${results[active].key}` : undefined}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => window.setTimeout(() => setOpen(false), 120)}
          onKeyDown={onKey}
        />
        {query && (
          <button type="button" className="gsearch__clear" onMouseDown={(e) => e.preventDefault()} onClick={() => setQuery("")} aria-label="Wyczyść">
            <X size={16} />
          </button>
        )}
      </label>
      {show && (
        <div className="gsearch__panel" id="gsearch-list" role="listbox" aria-label="Podpowiedzi">
          {results.length === 0 ? (
            <p className="gsearch__empty">Nic nie pasuje do „{query.trim()}".</p>
          ) : (
            results.map((r, i) => {
              const header = i === 0 || results[i - 1].group !== r.group ? r.group : null;
              return (
                <div key={r.key}>
                  {header && <div className="gsearch__group">{header}</div>}
                  <button
                    id={`gsearch-${r.key}`}
                    type="button"
                    role="option"
                    aria-selected={i === active}
                    className={`gsearch__item ${i === active ? "is-active" : ""}`}
                    onMouseDown={(e) => e.preventDefault()}
                    onMouseEnter={() => setActive(i)}
                    onClick={() => choose(r)}
                  >
                    <span className="gsearch__icon">{r.icon}</span>
                    <span className="gsearch__label">{r.label}</span>
                    {r.hint && <span className="gsearch__hint">{r.hint}</span>}
                  </button>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
