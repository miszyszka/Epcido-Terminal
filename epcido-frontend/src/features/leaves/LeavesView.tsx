import { useMemo, useState } from "react";
import { Check, CalendarPlus, FileCheck2, Undo2, X } from "lucide-react";
import { useData, useModel, useUser } from "../../app/DataContext";
import { PageHeader } from "../../components/PageHeader";
import { EmploymentTag, PositionMark, ProjectDot } from "../../components/PersonBadge";
import { Segmented } from "../../components/Segmented";
import { SelectMenu } from "../../components/SelectMenu";
import { leaveImpact, leavesInScope } from "../../domain/leaves";
import { TRADE_PLURAL } from "../../domain/labels";
import { can, canDecideLeave } from "../../domain/permissions";
import { FIELD_POSITIONS } from "../../domain/staffing";
import type { Employee, LeaveRequest, Trade } from "../../domain/types";
import { leaveNote } from "../../domain/workflow";
import { addDays, eachDay, formatTimestamp, MONTHS_LONG, parseISO, startOfWeek, todayISO, weekdayIndex, type ISODate } from "../../lib/dates";
import { plural } from "../../lib/text";
import { LeaveDialog, workdays } from "./LeaveDialog";
import { leaveDates, LeaveKind, LeaveStatusBadge } from "./LeaveParts";

const CAL_DAY = 22;
const CAL_WEEKS = 8;

type TradeFilter = "all" | Trade;

/**
 * Urlopy i nieobecności: wnioski do akceptacji (z wpływem na obsadę projektu), L4 do potwierdzenia,
 * kalendarz nieobecności na 8 tygodni i ostatnie decyzje. Kto co widzi i akceptuje — uprawnienia
 * (domyślnie: supervisor i IM — swoje projekty, HR — wszyscy).
 */
export function LeavesView() {
  const model = useModel();
  const user = useUser();
  const today = todayISO();
  const seeAll = can(user, "leave.view") || can(user, "leave.approveAll");
  const scope = useMemo(() => leavesInScope(model, user, seeAll), [model, user, seeAll]);
  const decidable = (l: LeaveRequest) => canDecideLeave(model, user, l);
  const pending = scope.filter((l) => l.status === "PENDING" && decidable(l)).sort((a, b) => a.from.localeCompare(b.from));
  const waitingOthers = scope.filter((l) => l.status === "PENDING" && !decidable(l) && l.employeeId !== user.id);
  const sick = scope.filter((l) => l.type === "SICK" && l.status === "APPROVED" && !l.confirmedAt && decidable(l));
  const decided = scope
    .filter((l) => l.status !== "PENDING" && l.decidedAt)
    .sort((a, b) => (b.decidedAt ?? "").localeCompare(a.decidedAt ?? ""))
    .slice(0, 15);
  const [adding, setAdding] = useState<Employee | null>(null);
  const people = useMemo(() => {
    const ids = new Set<string>();
    if (seeAll) model.employees.filter((e) => FIELD_POSITIONS.includes(e.position) || e.position === "SUPERVISOR").forEach((e) => ids.add(e.id));
    for (const p of model.projects) {
      if (!seeAll && p.supervisorId !== user.id && p.installationManagerId !== user.id && p.projectManagerId !== user.id) continue;
      for (const a of model.assignmentsByProject.get(p.id) ?? []) if (!a.to || a.to >= today) ids.add(a.employeeId);
      if (p.supervisorId && p.supervisorId !== user.id) ids.add(p.supervisorId);
    }
    ids.delete(user.id);
    return [...ids].map((id) => model.employeeById.get(id)).filter((e): e is Employee => Boolean(e));
  }, [model, user.id, seeAll, today]);
  const canAdd = can(user, "leave.approveAll") || can(user, "leave.approveProject");

  return (
    <div className="page leaves">
      <PageHeader
        title="Urlopy"
        actions={
          canAdd && people.length > 0 ? (
            <SelectMenu
              variant="action"
              actionLabel={
                <>
                  <CalendarPlus size={16} aria-hidden /> Wpisz nieobecność za pracownika
                </>
              }
              ariaLabel="Wybierz pracownika"
              value={null}
              options={people.map((e) => ({ value: e.id, label: e.name, icon: <PositionMark employee={e} /> }))}
              onChange={(id) => setAdding(model.employeeById.get(id) ?? null)}
            />
          ) : undefined
        }
      />

      <section className="leaves__section" aria-label="Wnioski do akceptacji">
        <h2 className="section-title">
          Do akceptacji <em>{pending.length}</em>
        </h2>
        {pending.length === 0 ? (
          <p className="empty empty--inline">Nie ma wniosków, które czekają na Ciebie.</p>
        ) : (
          <ul className="leave-cards">
            {pending.map((l) => (
              <PendingCard key={l.id} leave={l} />
            ))}
          </ul>
        )}
        {waitingOthers.length > 0 && (
          <p className="leaves__others">
            Jeszcze {waitingOthers.length} {plural(waitingOthers.length, "wniosek czeka", "wnioski czekają", "wniosków czeka")} na akceptację innych osób (np. własne wnioski
            supervisorów).
          </p>
        )}
      </section>

      {sick.length > 0 && (
        <section className="leaves__section" aria-label="L4 do potwierdzenia">
          <h2 className="section-title">
            L4 — dokument do potwierdzenia <em>{sick.length}</em>
          </h2>
          <ul className="leave-rows">
            {sick.map((l) => (
              <SickRow key={l.id} leave={l} />
            ))}
          </ul>
        </section>
      )}

      <Calendar leaves={scope} today={today} />

      {decided.length > 0 && (
        <section className="leaves__section" aria-label="Ostatnie decyzje">
          <h2 className="section-title">Ostatnie decyzje</h2>
          <ul className="leave-rows">
            {decided.map((l) => (
              <DecidedRow key={l.id} leave={l} canUndo={decidable(l) && l.status === "APPROVED" && l.to >= today} />
            ))}
          </ul>
        </section>
      )}

      {adding && <LeaveDialog employee={adding} onClose={() => setAdding(null)} />}
    </div>
  );
}

function Person({ employee }: { employee: Employee }) {
  return (
    <span className="leave-person">
      <PositionMark employee={employee} />
      <strong>{employee.name}</strong>
      <EmploymentTag employee={employee} />
    </span>
  );
}

/** Wniosek do akceptacji: kto, kiedy, ile dni, w jakim projekcie i co to zrobi z obsadą. */
function PendingCard({ leave }: { leave: LeaveRequest }) {
  const model = useModel();
  const data = useData();
  const employee = model.employeeById.get(leave.employeeId);
  const impact = useMemo(() => leaveImpact(model, leave), [model, leave]);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  if (!employee) return null;
  const run = async (fn: () => Promise<boolean>) => {
    setBusy(true);
    await fn();
    setBusy(false);
  };
  return (
    <li className="leave-card">
      <div className="leave-card__who">
        <Person employee={employee} />
        <span className="leave-card__sub">Wniosek z {formatTimestamp(leave.createdAt)}</span>
      </div>
      <div className="leave-card__what">
        <LeaveKind leave={leave} />
        <div>
          <strong>{leaveDates(leave)}</strong>
          <span>{workdays(leave.from, leave.to)} dni roboczych</span>
          {leave.note && <em>„{leave.note}”</em>}
        </div>
      </div>
      <ul className="leave-card__impact">
        {impact.length === 0 && <li className="muted">W tym czasie bez zadania w projekcie.</li>}
        {impact.map((i) => {
          const short = i.need != null && i.after < i.need;
          return (
            <li key={i.project.id} className={short ? "is-short" : ""}>
              <ProjectDot color={i.project.color} />
              <span>
                <b>{i.project.name}</b>
                {i.trade ? (
                  <>
                    {" "}
                    · {TRADE_PLURAL[i.trade].toLowerCase()} w tygodniu {weekLabel(i.week)}:{" "}
                    <b className={`trade-num trade-num--${i.trade === "MECHANICAL" ? "me" : "el"}`}>
                      {i.before} → {i.after}
                      {i.need != null ? ` z ${i.need}` : ""}
                    </b>
                  </>
                ) : (
                  " · nadzór projektu"
                )}
                {i.others.length > 0 && (
                  <span className="leave-card__others">
                    {" "}
                    · w tym czasie wolne ma też: {i.others.map((o) => `${o.employee.name}${o.leave.status === "PENDING" ? " (wniosek)" : ""}`).join(", ")}
                  </span>
                )}
              </span>
            </li>
          );
        })}
      </ul>
      <div className="leave-card__actions">
        {rejecting ? (
          <div className="leave-card__reject">
            <input
              className="control"
              autoFocus
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Powód — zobaczy go pracownik"
              aria-label="Powód odrzucenia"
              maxLength={300}
            />
            <button type="button" className="btn btn--quiet btn--sm" onClick={() => setRejecting(false)}>
              Anuluj
            </button>
            <button
              type="button"
              className="btn btn--secondary btn--sm"
              disabled={busy || !reason.trim()}
              onClick={() => run(() => data.decideLeave({ leaveId: leave.id, approve: false, note: reason }))}
            >
              Odrzuć wniosek
            </button>
          </div>
        ) : (
          <>
            <button type="button" className="btn btn--quiet btn--sm" onClick={() => setRejecting(true)}>
              <X size={15} aria-hidden />
              Odrzuć
            </button>
            <button type="button" className="btn btn--primary btn--sm" disabled={busy} onClick={() => run(() => data.decideLeave({ leaveId: leave.id, approve: true }))}>
              <Check size={15} aria-hidden />
              Akceptuj
            </button>
          </>
        )}
      </div>
    </li>
  );
}

function SickRow({ leave }: { leave: LeaveRequest }) {
  const model = useModel();
  const data = useData();
  const employee = model.employeeById.get(leave.employeeId);
  if (!employee) return null;
  return (
    <li className="leave-row">
      <Person employee={employee} />
      <LeaveKind leave={leave} />
      <span className="leave-row__dates">{leaveDates(leave)}</span>
      <span className="muted">zgłoszone {formatTimestamp(leave.createdAt)}</span>
      <button type="button" className="btn btn--secondary btn--sm" onClick={() => data.confirmSickNote(leave.id)}>
        <FileCheck2 size={15} aria-hidden />
        Potwierdź dokument
      </button>
    </li>
  );
}

function DecidedRow({ leave, canUndo }: { leave: LeaveRequest; canUndo: boolean }) {
  const model = useModel();
  const data = useData();
  const employee = model.employeeById.get(leave.employeeId);
  if (!employee) return null;
  return (
    <li className="leave-row">
      <Person employee={employee} />
      <LeaveKind leave={leave} />
      <span className="leave-row__dates">{leaveDates(leave)}</span>
      <LeaveStatusBadge leave={leave} />
      <span className="muted leave-row__when">
        {leave.decidedAt ? formatTimestamp(leave.decidedAt) : ""}
        {leave.status === "REJECTED" && leave.decisionNote ? ` — „${leave.decisionNote}”` : ""}
      </span>
      {canUndo ? (
        <button
          type="button"
          className="btn btn--quiet btn--sm"
          data-tip={leave.from < todayISO() ? "Urlop już trwa — skończy się wczoraj, dni od dziś znikną z timesheetu" : "Cofnij akceptację — dni znikną z timesheetu"}
          onClick={() => data.cancelLeave({ leaveId: leave.id })}
        >
          <Undo2 size={15} aria-hidden />
          Cofnij
        </button>
      ) : (
        <span />
      )}
    </li>
  );
}

/** Kalendarz nieobecności: osoby z urlopem w ciągu 8 tygodni; zaakceptowane pełne, czekające kreskowane. */
function Calendar({ leaves, today }: { leaves: LeaveRequest[]; today: ISODate }) {
  const model = useModel();
  const [trade, setTrade] = useState<TradeFilter>("all");
  const from = startOfWeek(today);
  const to = addDays(from, CAL_WEEKS * 7 - 1);
  const days = eachDay(from, to);
  const active = leaves.filter((l) => (l.status === "APPROVED" || l.status === "PENDING") && l.from <= to && l.to >= from);
  const byPerson = new Map<string, LeaveRequest[]>();
  for (const l of active) byPerson.set(l.employeeId, [...(byPerson.get(l.employeeId) ?? []), l]);
  const rows = [...byPerson.entries()]
    .map(([id, list]) => ({ employee: model.employeeById.get(id)!, list }))
    .filter((r) => r.employee && (trade === "all" || r.employee.trade === trade))
    .sort((a, b) => a.list[0].from.localeCompare(b.list[0].from) || a.employee.name.localeCompare(b.employee.name, "pl", { numeric: true }));
  const x = (d: ISODate) => (Math.round((parseISO(d).getTime() - parseISO(from).getTime()) / 86_400_000)) * CAL_DAY;
  const weekendBg = `repeating-linear-gradient(90deg, transparent 0 ${5 * CAL_DAY}px, var(--sand-50) ${5 * CAL_DAY}px ${7 * CAL_DAY}px)`;

  return (
    <section className="leaves__section" aria-label="Kalendarz nieobecności">
      <header className="leaves__cal-head">
        <h2 className="section-title">
          Kalendarz nieobecności <em>{rows.length}</em>
        </h2>
        <Segmented<TradeFilter>
          label="Branża"
          value={trade}
          onChange={setTrade}
          options={[
            { value: "all", label: "Wszyscy" },
            { value: "ELECTRICAL", label: "Elektrycy" },
            { value: "MECHANICAL", label: "Mechanicy" },
          ]}
        />
        <span className="leaves__legend">
          <i className="cal-swatch cal-swatch--leave" /> urlop
          <i className="cal-swatch cal-swatch--sick" /> L4
          <i className="cal-swatch cal-swatch--pending" /> czeka na akceptację
        </span>
      </header>
      <div className="cal-scroll">
        <div className="cal" style={{ width: 240 + days.length * CAL_DAY }}>
          <div className="cal__head">
            <div className="cal__corner">Osoba</div>
            <div className="cal__days">
              {days.map((d) => {
                const dt = parseISO(d);
                return (
                  <span key={d} className={`${weekdayIndex(d) >= 5 ? "is-weekend" : ""} ${d === today ? "is-today" : ""} ${dt.getDate() === 1 || d === from ? "is-month" : ""}`}>
                    {dt.getDate() === 1 || d === from ? <b>{MONTHS_LONG[dt.getMonth()].slice(0, 3)}</b> : null}
                    {dt.getDate()}
                  </span>
                );
              })}
            </div>
          </div>
          {rows.length === 0 && <p className="empty empty--inline">W najbliższych tygodniach nikt nie ma urlopu.</p>}
          {rows.map(({ employee, list }) => {
            const project = model.projectsOf(employee.id)[0];
            return (
              <div key={employee.id} className="cal__row">
                <div className="cal__name">
                  <PositionMark employee={employee} />
                  <span>{employee.name}</span>
                  {project && <ProjectDot color={project.color} />}
                </div>
                <div className="cal__track" style={{ backgroundImage: weekendBg }}>
                  {list.map((l) => {
                    const a = l.from < from ? from : l.from;
                    const b = l.to > to ? to : l.to;
                    const width = x(b) - x(a) + CAL_DAY;
                    return (
                      <span
                        key={l.id}
                        className={`cal__leave cal__leave--${l.status === "PENDING" ? "pending" : l.type === "SICK" ? "sick" : "leave"}`}
                        style={{ left: x(a), width }}
                        data-tip={`${employee.name}\n${leaveDates(l)}\n${leaveNote(l)}`}
                      >
                        {width > 50 && <span>{l.type === "SICK" ? "L4" : l.status === "PENDING" ? "wniosek" : l.type === "OTHER" ? "inna" : "urlop"}</span>}
                      </span>
                    );
                  })}
                  {today >= from && today <= to && <span className="cal__today" style={{ left: x(today) + CAL_DAY / 2 }} />}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function weekLabel(week: ISODate) {
  const d = parseISO(week);
  return `${d.getDate()}.${String(d.getMonth() + 1).padStart(2, "0")}`;
}
