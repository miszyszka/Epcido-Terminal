import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Check, X } from "lucide-react";
import { useData, useModel, useUser } from "../../app/DataContext";
import { useQueue } from "../../app/hooks";
import { useUi } from "../../app/UiContext";
import { DayCard } from "../../components/DayCell";
import { Dialog } from "../../components/Dialog";
import { PageHeader } from "../../components/PageHeader";
import { PositionMark, ProjectDot } from "../../components/PersonBadge";
import { formatHoursTotal } from "../../domain/labels";
import { sumMinutes, type QueueItem } from "../../domain/workflow";
import { addDays, eachDay, formatDate, isoWeek, parseISO, startOfWeek, WEEKDAYS_SHORT, type ISODate } from "../../lib/dates";
import { matches } from "../../lib/search";
import { positions } from "../../lib/text";
import { DeadlineNote } from "./DeadlineNote";

const QUICK_REASONS = ["Sprawdź godzinę zakończenia", "Brak przerwy w raporcie", "Tego dnia nie było Cię na budowie", "Popraw projekt"];

/** Zatwierdzanie godzin — supervisor (zespół), Installation Manager (po supervisorach), administrator (wszystko). */
export function ApprovalsView() {
  const model = useModel();
  const user = useUser();
  const data = useData();
  const { search } = useUi();
  const queue = useQueue();
  const [params, setParams] = useSearchParams();
  const svFilter = params.get("sv");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [rejecting, setRejecting] = useState<QueueItem[] | null>(null);

  const items = useMemo(
    () =>
      queue.items.filter((it) => {
        const p = model.projectById.get(it.projectId)!;
        if (svFilter && p.supervisorId !== svFilter) return false;
        const e = model.employeeById.get(it.employeeId);
        return matches(search, p.name, p.number, p.customerName, e?.name);
      }),
    [queue.items, model, svFilter, search]
  );
  const byKey = useMemo(() => new Map(items.map((i) => [i.key, i])), [items]);
  const selectedItems = [...selected].map((k) => byKey.get(k)).filter((i): i is QueueItem => Boolean(i));
  const groups = useMemo(() => group(items), [items]);
  const overdue = items.filter((i) => i.overdue).length;
  const svName = svFilter ? model.employeeById.get(svFilter)?.name : null;

  const toggle = (keys: string[], on?: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev);
      const add = on ?? !keys.every((k) => next.has(k));
      keys.forEach((k) => (add ? next.add(k) : next.delete(k)));
      return next;
    });

  const approve = async (list: QueueItem[]) => {
    if (await data.approve(list)) setSelected((prev) => new Set([...prev].filter((k) => !list.some((i) => i.key === k))));
  };

  const isFinalLevel = user.role === "INSTALLATION_MANAGER";

  return (
    <div className="page">
      <PageHeader
        title="Zatwierdzanie godzin"
        description={
          isFinalLevel
            ? "Godziny zatwierdzone przez supervisorów i godziny samych supervisorów. Po Twoim zatwierdzeniu trafią do wtorkowej wysyłki."
            : "Godziny wpisane przez Twój zespół. Kliknij dzień, żeby go zaznaczyć, albo zatwierdź cały tydzień osoby."
        }
      />

      <section className="approve-hero" aria-label="Podsumowanie">
        <div className="approve-hero__numbers">
          <div className="big-stat">
            <span className="big-stat__value">{items.length}</span>
            <span className="big-stat__label">{positions(items.length).replace(/^\d+ /, "")} do zatwierdzenia</span>
          </div>
          <div className="big-stat">
            <span className="big-stat__value">{formatHoursTotal(sumMinutes(items))}</span>
            <span className="big-stat__label">godzin pracy</span>
          </div>
          {overdue > 0 && (
            <div className="big-stat big-stat--alert">
              <span className="big-stat__value">{overdue}</span>
              <span className="big-stat__label">po terminie</span>
            </div>
          )}
        </div>
        <div className="approve-hero__side">
          <DeadlineNote />
          {items.length > 0 && (
            <button type="button" className="btn btn--primary btn--lg" onClick={() => approve(items)}>
              <Check size={18} aria-hidden />
              Zatwierdź wszystko ({items.length})
            </button>
          )}
        </div>
      </section>

      {svName && (
        <div className="map-bar">
          <button
            type="button"
            className="chip chip--filter"
            onClick={() => {
              params.delete("sv");
              setParams(params);
            }}
          >
            Tylko projekty: {svName}
            <span className="chip__x" aria-hidden>
              ×
            </span>
          </button>
        </div>
      )}

      {selectedItems.length > 0 && (
        <div className="selection-bar" role="region" aria-label="Zaznaczone">
          <span>
            Zaznaczono <strong>{positions(selectedItems.length)}</strong>, {formatHoursTotal(sumMinutes(selectedItems))}
          </span>
          <div className="selection-bar__actions">
            <button type="button" className="btn btn--quiet btn--sm" onClick={() => setSelected(new Set())}>
              Wyczyść
            </button>
            <button type="button" className="btn btn--danger btn--sm" onClick={() => setRejecting(selectedItems)}>
              <X size={16} aria-hidden />
              Odrzuć
            </button>
            <button type="button" className="btn btn--primary btn--sm" onClick={() => approve(selectedItems)}>
              <Check size={16} aria-hidden />
              Zatwierdź zaznaczone
            </button>
          </div>
        </div>
      )}

      {items.length === 0 ? (
        <div className="empty empty--done">
          <p>
            <strong>Wszystko zatwierdzone.</strong> Nowe godziny pojawią się tutaj, gdy zespół je wpisze.
          </p>
        </div>
      ) : (
        <div className="pcards">
          {groups.map((g) => {
            const project = model.projectById.get(g.projectId)!;
            const sv = project.supervisorId ? model.employeeById.get(project.supervisorId) : null;
            const all = g.weeks.flatMap((w) => w.people.flatMap((p) => p.items));
            return (
              <article key={g.projectId} className="pcard">
                <header className="pcard__head">
                  <div className="pcard__id">
                    <span className="pcard__title is-static">
                      <ProjectDot color={project.color} />
                      <span>{project.name}</span>
                    </span>
                    <span className="pcard__number">{project.number}</span>
                  </div>
                  <div className="pcard__meta">
                    {sv && (
                      <span className="pcard__lead">
                        <PositionMark employee={sv} />
                        {sv.name}
                      </span>
                    )}
                  </div>
                  <div className="pcard__stats">
                    <span className="badge badge--pending">
                      {positions(all.length)}, {formatHoursTotal(sumMinutes(all))}
                    </span>
                    <button type="button" className="btn btn--secondary btn--sm" onClick={() => approve(all)}>
                      Zatwierdź projekt
                    </button>
                  </div>
                </header>
                {g.weeks.map((w) => (
                  <WeekBlock
                    key={w.week}
                    projectId={g.projectId}
                    week={w.week}
                    people={w.people}
                    selected={selected}
                    onToggle={toggle}
                    onApprove={approve}
                    onReject={(list) => setRejecting(list)}
                  />
                ))}
              </article>
            );
          })}
        </div>
      )}

      {rejecting && (
        <RejectDialog
          items={rejecting}
          onClose={() => setRejecting(null)}
          onReject={async (reason) => {
            if (await data.reject(rejecting, reason)) {
              setSelected((prev) => new Set([...prev].filter((k) => !rejecting.some((i) => i.key === k))));
              setRejecting(null);
            }
          }}
        />
      )}
    </div>
  );
}

function WeekBlock({
  projectId,
  week,
  people,
  selected,
  onToggle,
  onApprove,
  onReject,
}: {
  projectId: string;
  week: ISODate;
  people: { employeeId: string; items: QueueItem[] }[];
  selected: Set<string>;
  onToggle: (keys: string[], on?: boolean) => void;
  onApprove: (items: QueueItem[]) => void;
  onReject: (items: QueueItem[]) => void;
}) {
  const model = useModel();
  const days = eachDay(week, addDays(week, 6));
  const overdue = people.some((p) => p.items.some((i) => i.overdue));
  const all = people.flatMap((p) => p.items);
  return (
    <section className="week-block">
      <div className="week-block__head">
        <strong>
          tydz. {isoWeek(week).week}, {formatDate(week).replace(/ \d{4}$/, "")} – {formatDate(addDays(week, 6))}
        </strong>
        {overdue && <span className="badge badge--absent">Po terminie</span>}
        <button
          type="button"
          className="btn btn--quiet btn--sm"
          onClick={() => onToggle(all.map((i) => i.key))}
        >
          {all.every((i) => selected.has(i.key)) ? "Odznacz tydzień" : "Zaznacz tydzień"}
        </button>
      </div>
      <div className="pcard__scroll">
        <table className="days days--detailed days--approve">
          <thead>
            <tr className="days__numbers">
              <th className="days__corner" scope="col">
                <span className="sr-only">Osoba</span>
              </th>
              {days.map((d, i) => (
                <th key={d} scope="col" className={i >= 5 ? "is-weekend" : i === 0 ? "is-cutoff" : ""}>
                  <span className="days__dow">{WEEKDAYS_SHORT[i]}</span>
                  <b>{parseISO(d).getDate()}</b>
                </th>
              ))}
              <th scope="col" className="days__sum">
                Do zatw.
              </th>
              <th scope="col">
                <span className="sr-only">Akcje</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {people.map(({ employeeId, items }) => {
              const e = model.employeeById.get(employeeId);
              const keyByDate = new Map(items.map((i) => [i.date, i]));
              return (
                <tr key={employeeId}>
                  <th scope="row" className="days__person">
                    {e && <PositionMark employee={e} />}
                    <span className="days__name">{e?.name ?? employeeId}</span>
                  </th>
                  {days.map((d, i) => {
                    const item = keyByDate.get(d);
                    const entry = model.entry(projectId, employeeId, d);
                    return (
                      <td key={d} className={i >= 5 ? "is-weekend" : i === 0 ? "is-cutoff" : ""}>
                        {item ? (
                          <DayCard entry={entry} selected={selected.has(item.key)} onClick={() => onToggle([item.key])} />
                        ) : (
                          <DayCard entry={entry} />
                        )}
                      </td>
                    );
                  })}
                  <td className="days__sum">
                    <strong>{formatHoursTotal(sumMinutes(items))}</strong>
                    <span>{positions(items.length)}</span>
                  </td>
                  <td className="days__actions">
                    <button type="button" className="btn btn--primary btn--sm" onClick={() => onApprove(items)}>
                      Zatwierdź
                    </button>
                    <button type="button" className="icon-btn icon-btn--sm" onClick={() => onReject(items)} aria-label={`Odrzuć: ${e?.name}`}>
                      <X size={16} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function RejectDialog({ items, onClose, onReject }: { items: QueueItem[]; onClose: () => void; onReject: (reason: string) => void }) {
  const [reason, setReason] = useState("");
  return (
    <Dialog
      title={`Odrzuć ${positions(items.length)}`}
      description="Pracownik zobaczy powód przy dniu i poprawi godziny."
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn--quiet" onClick={onClose}>
            Anuluj
          </button>
          <button type="button" className="btn btn--danger" onClick={() => onReject(reason)} disabled={!reason.trim()}>
            Odrzuć
          </button>
        </>
      }
    >
      <div className="reasons">
        {QUICK_REASONS.map((r) => (
          <button key={r} type="button" className={`chip chip--choice ${reason === r ? "is-selected" : ""}`} onClick={() => setReason(r)}>
            {r}
          </button>
        ))}
      </div>
      <label className="field">
        <span className="field__label">Powód</span>
        <textarea className="control control--area" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />
      </label>
    </Dialog>
  );
}

function group(items: QueueItem[]) {
  const projects = new Map<string, Map<ISODate, Map<string, QueueItem[]>>>();
  for (const it of items) {
    const week = startOfWeek(it.date);
    const weeks = projects.get(it.projectId) ?? new Map();
    const people = weeks.get(week) ?? new Map();
    people.set(it.employeeId, [...(people.get(it.employeeId) ?? []), it]);
    weeks.set(week, people);
    projects.set(it.projectId, weeks);
  }
  return [...projects.entries()].map(([projectId, weeks]) => ({
    projectId,
    weeks: [...weeks.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([week, people]) => ({
        week,
        people: [...people.entries()]
          .map(([employeeId, list]) => ({ employeeId, items: list }))
          .sort((a, b) => a.employeeId.localeCompare(b.employeeId, "pl", { numeric: true })),
      })),
  }));
}
