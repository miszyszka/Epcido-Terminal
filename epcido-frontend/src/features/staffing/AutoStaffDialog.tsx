import { useMemo, useState } from "react";
import { CalendarClock, Sparkles, TriangleAlert } from "lucide-react";
import { useModel } from "../../app/DataContext";
import { Dialog } from "../../components/Dialog";
import { CategoryTag, EmploymentTag, PositionMark } from "../../components/PersonBadge";
import { defaultTask, formatMonthsShort, isEpcido, TRADE_PLURAL } from "../../domain/labels";
import { assignmentEnd, candidatesFor, type Candidate } from "../../domain/staffing";
import type { DemandPhase, Project, Trade } from "../../domain/types";
import { addDays, formatDate, startOfWeek, todayISO, type ISODate } from "../../lib/dates";
import { plural } from "../../lib/text";
import { leaveDates } from "../leaves/LeaveParts";

/** Członek zespołu w planie (z modelu albo z niezapisanego planu w edytorze). */
export interface TeamItem {
  employeeId: string;
  from: ISODate;
  to: ISODate | null;
}

export interface ProposalItem {
  employeeId: string;
  projectId: string;
  from: ISODate;
  to: ISODate;
  task: string;
  breakDays?: number;
}

interface Group {
  phase: DemandPhase;
  index: number;
  trade: Trade;
  need: number;
  have: number;
  short: number;
  candidates: Candidate[];
  /** Dobrani automatycznie (zaznaczeni na start) */
  proposed: Set<string>;
}

const EXTRA = 3;

/**
 * Propozycja obsady: dla każdej przyszłej fazy i branży brakujący ludzie dobrani automatycznie —
 * najpierw ci, którzy mogą zacząć od startu fazy, EPCIDO przed agencją (żeby utrzymać minimalny udział),
 * bez urlopu w fazie, z największym doświadczeniem w kategorii projektu. Planning odznacza, kogo nie chce,
 * i dodaje resztę jednym kliknięciem.
 */
export function AutoStaffDialog({
  project,
  team,
  onApply,
  onClose,
}: {
  project: Project;
  team: TeamItem[];
  /** Zwrócenie `false` oznacza, że zapis nie doszedł do skutku (np. planista nie potwierdził) — okno zostaje otwarte. */
  onApply: (items: ProposalItem[]) => boolean | void | Promise<boolean | void>;
  onClose: () => void;
}) {
  const model = useModel();
  const today = todayISO();
  const projectEnd = project.endDate ?? addDays(project.startDate, 180);
  const end = (t: TeamItem) => t.to ?? projectEnd;

  const groups = useMemo(() => {
    const out: Group[] = [];
    const taken = new Set<string>();
    const share = { epcido: 0, agency: 0 };
    for (const t of team) {
      const e = model.employeeById.get(t.employeeId);
      if (!e || end(t) < today) continue;
      if (isEpcido(e)) share.epcido++;
      else share.agency++;
    }
    const minShare = model.settings.minEpcidoShare / 100;
    project.demand
      .filter((d) => d.to >= today)
      .forEach((phase, index) => {
        for (const trade of ["ELECTRICAL", "MECHANICAL"] as Trade[]) {
          const need = trade === "ELECTRICAL" ? phase.electricians : phase.mechanics;
          if (!need) continue;
          // Najsłabszy tydzień fazy w planie zespołu
          let have = Infinity;
          for (let w = startOfWeek(phase.from < today ? today : phase.from); w <= phase.to; w = addDays(w, 7)) {
            const friday = addDays(w, 4);
            const ids = new Set(
              team.filter((t) => t.from <= friday && end(t) >= w && model.employeeById.get(t.employeeId)?.trade === trade).map((t) => t.employeeId)
            );
            have = Math.min(have, ids.size);
          }
          if (!Number.isFinite(have)) have = 0;
          const short = Math.max(0, need - have);
          const inPhase = new Set(team.filter((t) => t.from <= phase.to && end(t) >= phase.from).map((t) => t.employeeId));
          const preferEpcido = share.agency >= share.epcido * (1 / Math.max(minShare, 0.01) - 1);
          const all = candidatesFor(model, project, phase, trade, today, preferEpcido).filter((c) => !inPhase.has(c.employee.id) && !taken.has(c.employee.id));
          // Dobór z pilnowaniem udziału EPCIDO
          const picked: Candidate[] = [];
          const rest: Candidate[] = [];
          for (const c of all) {
            if (picked.length >= short) {
              rest.push(c);
              continue;
            }
            const total = share.epcido + share.agency + 1;
            const wouldBe = (share.epcido + (c.epcido ? 1 : 0)) / total;
            const epcidoLeft = all.some((x) => x.epcido && !picked.includes(x) && x !== c);
            if (!c.epcido && wouldBe < minShare && epcidoLeft) {
              rest.push(c);
              continue;
            }
            picked.push(c);
            taken.add(c.employee.id);
            if (c.epcido) share.epcido++;
            else share.agency++;
          }
          out.push({
            phase,
            index,
            trade,
            need,
            have,
            short,
            candidates: [...picked, ...rest.slice(0, EXTRA + Math.max(0, short - picked.length))],
            proposed: new Set(picked.map((c) => c.employee.id)),
          });
        }
      });
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [model, project, team, today]);

  const [checked, setChecked] = useState<Set<string>>(
    () => new Set(groups.flatMap((g) => g.candidates.filter((c) => g.proposed.has(c.employee.id)).map((c) => key(g, c))))
  );
  const [busy, setBusy] = useState(false);
  const chosen = groups.flatMap((g) => g.candidates.filter((c) => checked.has(key(g, c))).map((c) => ({ g, c })));
  const duplicate = new Set<string>();
  const seen = new Set<string>();
  for (const { c } of chosen) {
    if (seen.has(c.employee.id)) duplicate.add(c.employee.id);
    seen.add(c.employee.id);
  }
  const currentPeople = team.filter((t) => end(t) >= today).map((t) => model.employeeById.get(t.employeeId)).filter(Boolean);
  const after = [...currentPeople, ...chosen.map((x) => x.c.employee)];
  const pct = after.length ? Math.round((after.filter((e) => e && isEpcido(e)).length / after.length) * 100) : 100;
  const totalShort = groups.reduce((s, g) => s + g.short, 0);

  return (
    <Dialog
      title={`Propozycja obsady: ${project.name}`}
      description={
        <span className="auto__desc">
          <CategoryTag category={project.category} /> {totalShort ? `Brakuje ${totalShort} ${plural(totalShort, "osoby", "osób", "osób")} w przyszłych fazach.` : "Wszystkie fazy są obsadzone."}
        </span>
      }
      onClose={onClose}
      size="lg"
      footer={
        <>
          <span className={`auto__share ${pct < model.settings.minEpcidoShare ? "is-warn" : ""}`}>
            Zaznaczono {chosen.length} · EPCIDO po zmianie: <b>{pct}%</b>
          </span>
          <button type="button" className="btn btn--quiet" onClick={onClose}>
            Anuluj
          </button>
          <button
            type="button"
            className="btn btn--primary"
            disabled={busy || chosen.length === 0 || duplicate.size > 0}
            onClick={async () => {
              setBusy(true);
              const done = await onApply(
                chosen.map(({ g, c }) => ({
                  employeeId: c.employee.id,
                  projectId: project.id,
                  from: c.start,
                  to: g.phase.to,
                  task: defaultTask(g.trade),
                  breakDays: c.breakDays || undefined,
                }))
              );
              setBusy(false);
              if (done !== false) onClose();
            }}
          >
            <Sparkles size={16} aria-hidden />
            Dodaj do planu ({chosen.length})
          </button>
        </>
      }
    >
      {groups.length === 0 && <p className="notice notice--quiet">Projekt nie ma przyszłych faz zapotrzebowania. PM dodaje je w danych projektu.</p>}
      {duplicate.size > 0 && (
        <p className="notice notice--warn">
          <TriangleAlert size={16} aria-hidden /> Ta sama osoba jest zaznaczona w dwóch fazach — zostaw ją w jednej.
        </p>
      )}
      {groups.map((g) => (
        <section key={`${g.phase.id}-${g.trade}`} className="auto__group">
          <header className="auto__head">
            <span className={`trade-dot trade-dot--${g.trade === "MECHANICAL" ? "me" : "el"}`} aria-hidden />
            <strong>
              Faza {g.index + 1} · {TRADE_PLURAL[g.trade]}
            </strong>
            <span className="muted">
              {formatDate(g.phase.from).replace(/ \d{4}$/, "")} – {formatDate(g.phase.to)}
            </span>
            <span className={`auto__need ${g.short ? "is-short" : "is-ok"}`}>
              {g.have}/{g.need}
              {g.short ? ` · brakuje ${g.short}` : " · obsadzone"}
            </span>
          </header>
          {g.candidates.length === 0 && g.short > 0 && <p className="muted auto__none">Nikt z tej branży nie jest wolny w tej fazie — trzeba szukać poza obecną załogą.</p>}
          <ul className="auto__list">
            {g.candidates.map((c) => {
              const k = key(g, c);
              const on = checked.has(k);
              return (
                <li key={k}>
                  <label className={`auto__row ${on ? "is-on" : ""} ${duplicate.has(c.employee.id) && on ? "is-dup" : ""}`}>
                    <input
                      type="checkbox"
                      checked={on}
                      onChange={() =>
                        setChecked((s) => {
                          const n = new Set(s);
                          if (n.has(k)) n.delete(k);
                          else n.add(k);
                          return n;
                        })
                      }
                    />
                    <PositionMark employee={c.employee} />
                    <span className="auto__name">{c.employee.name}</span>
                    <EmploymentTag employee={c.employee} />
                    <span className={c.experience > 0 ? "auto__exp" : "auto__exp is-none"}>
                      {project.category} {formatMonthsShort(c.experience)}
                    </span>
                    <span className={c.lateDays ? "auto__late" : "auto__ok"}>
                      {c.lateDays ? `od ${formatDate(c.start).replace(/ \d{4}$/, "")}` : g.phase.from < today ? "od zaraz" : "od startu fazy"}
                      {c.breakDays ? `, po przerwie ${c.breakDays} dni` : ""}
                    </span>
                    {c.leave && (
                      <span className="auto__leave" data-tip={`Urlop ${leaveDates(c.leave)}${c.leave.status === "PENDING" ? " (wniosek)" : ""}`}>
                        <CalendarClock size={13} aria-hidden /> urlop {leaveDates(c.leave).replace(/ \d{4}$/, "")}
                      </span>
                    )}
                    <span className="muted auto__now">
                      {c.outlook.currentProject ? `teraz ${c.outlook.currentProject.name}${c.outlook.chain ? ` do ${formatDate(assignmentEnd(model, c.outlook.current!)).replace(/ \d{4}$/, "")}` : ""}` : "wolny"}
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </Dialog>
  );
}

function key(g: Group, c: Candidate) {
  return `${g.phase.id}|${g.trade}|${c.employee.id}`;
}
