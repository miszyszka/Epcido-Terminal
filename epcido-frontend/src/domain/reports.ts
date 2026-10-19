// Raporty do Excela (administrator, ekran Raporty). Każdy raport to kolumny + wiersze liczone z modelu;
// plik .xlsx składa features/admin/ReportsView (biblioteka write-excel-file, ładowana dopiero przy pobraniu).

import type { Model } from "../app/DataContext";
import { addDays, eachDay, startOfWeek, isoWeek, parseISO, type ISODate } from "../lib/dates";
import { ABSENCE_LABEL, EMPLOYMENT_LABEL, formatMonths, isEpcido, POSITION_LABEL, workedMinutes } from "./labels";
import { epcidoShare, FIELD_POSITIONS, weeklyStaffing } from "./staffing";
import { problemSummary, sheetsFor } from "./timesheets";
import type { Employee, Project, Trade } from "./types";
import { isComplete } from "./workflow";

export type ReportId = "hours" | "sheets" | "people-hours" | "leaves" | "staffing" | "employees" | "withheld";

export interface ReportOptions {
  from: ISODate;
  to: ISODate;
  /** Puste = wszystkie projekty */
  projectIds: string[];
  trade: "all" | Trade;
  employment: "all" | "epcido" | "agency";
  status: "all" | "approved" | "sent";
}

export type CellValue = string | number | Date | null;

export interface ReportColumn {
  label: string;
  width: number;
  kind?: "text" | "date" | "hours" | "int" | "pct";
}

export interface ReportData {
  title: string;
  columns: ReportColumn[];
  rows: CellValue[][];
}

export const REPORTS: { id: ReportId; title: string; description: string; uses: (keyof ReportOptions)[] }[] = [
  { id: "hours", title: "Godziny — szczegółowo", description: "Każdy dzień każdej osoby: projekt, godziny od–do, przerwa, czas pracy, kto i kiedy zatwierdził, wysyłka.", uses: ["from", "to", "projectIds", "trade", "employment", "status"] },
  { id: "sheets", title: "Timesheety — projekt × tydzień", description: "Suma godzin projektu w tygodniu: elektrycy, mechanicy, nieobecności, status timesheetu.", uses: ["from", "to", "projectIds"] },
  { id: "people-hours", title: "Godziny na osobę", description: "Suma godzin i dni pracy każdej osoby w okresie, z podziałem na projekty.", uses: ["from", "to", "projectIds", "trade", "employment", "status"] },
  { id: "leaves", title: "Urlopy i nieobecności", description: "Wnioski w okresie: rodzaj, dni robocze, status, kto zaakceptował i kiedy.", uses: ["from", "to", "projectIds", "trade", "employment"] },
  { id: "staffing", title: "Obsada i zapotrzebowanie", description: "Projekt × tydzień: ilu elektryków i mechaników potrzeba, ilu jest w planie, braki, udział EPCIDO.", uses: ["from", "to", "projectIds"] },
  { id: "employees", title: "Pracownicy", description: "Lista ludzi w projektach: stanowisko, branża, umowa, staż łącznie i w kategoriach, projekt teraz.", uses: ["trade", "employment"] },
  { id: "withheld", title: "Wstrzymane timesheety", description: "Timesheety, które nie poszły do Dataverse, z listą braków.", uses: ["from", "to", "projectIds"] },
];

const hours = (min: number) => Math.round((min / 60) * 100) / 100;
const time = (min: number | null | undefined) => (min == null ? null : `${Math.floor(min / 60)}:${String(min % 60).padStart(2, "0")}`);
// Excel nie zna stref czasowych: daty i godziny zapisujemy jako „czas ścienny" w UTC (to, co widzi użytkownik),
// inaczej 5 paź 00:00 czasu polskiego zamieni się w 4 paź 22:00.
const date = (iso: ISODate) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
};
const stamp = (iso: string | null | undefined) => {
  if (!iso) return null;
  const t = new Date(iso);
  return new Date(Date.UTC(t.getFullYear(), t.getMonth(), t.getDate(), t.getHours(), t.getMinutes()));
};
const wall = (t: Date | null) => (t ? new Date(Date.UTC(t.getFullYear(), t.getMonth(), t.getDate(), t.getHours(), t.getMinutes())) : null);

function personPasses(e: Employee | undefined, o: ReportOptions) {
  if (!e) return false;
  if (o.trade !== "all" && e.trade !== o.trade) return false;
  if (o.employment === "epcido" && (!e.employment || !isEpcido(e))) return false;
  if (o.employment === "agency" && e.employment !== "AGENCY") return false;
  return true;
}

function projectsOf(model: Model, o: ReportOptions): Project[] {
  return o.projectIds.length ? model.projects.filter((p) => o.projectIds.includes(p.id)) : model.projects;
}

export function buildReport(model: Model, id: ReportId, o: ReportOptions, now: Date): ReportData {
  const name = (id: string | null | undefined) => (id ? model.employeeById.get(id)?.name ?? id : "");
  const sheets = sheetsFor(model, now);
  const projects = projectsOf(model, o);

  switch (id) {
    case "hours": {
      const rows: CellValue[][] = [];
      for (const p of projects) {
        for (const [employeeId, days] of model.entries.get(p.id) ?? []) {
          const e = model.employeeById.get(employeeId);
          if (!personPasses(e, o)) continue;
          for (const [d, entry] of days) {
            if (d < o.from || d > o.to) continue;
            const sheet = sheets.of(p.id, d);
            const sent = sheet?.status === "sent";
            if (o.status === "approved" && !isComplete(p, employeeId, entry)) continue;
            if (o.status === "sent" && !sent) continue;
            rows.push([
              date(d),
              isoWeek(d).week,
              p.number,
              p.name,
              p.category,
              e!.name,
              POSITION_LABEL[e!.position],
              e!.employment ? EMPLOYMENT_LABEL[e!.employment] : "",
              entry.kind === "WORK" ? "Praca" : ABSENCE_LABEL[entry.absence ?? "OTHER"],
              entry.kind === "WORK" ? time(entry.start) : null,
              entry.kind === "WORK" ? time(entry.end) : null,
              entry.kind === "WORK" ? entry.breakMin ?? 0 : null,
              hours(workedMinutes(entry)),
              entry.status === "PM_APPROVED" ? "Zatwierdzone" : entry.status === "SUPERVISOR_APPROVED" ? "Zatwierdzone przez SV" : "Do zatwierdzenia",
              name(entry.svApprovedBy),
              stamp(entry.svApprovedAt),
              name(entry.finalApprovedBy),
              stamp(entry.finalApprovedAt),
              sent ? "Wysłane" : sheet?.status === "withheld" ? "Wstrzymane" : sheet?.status === "closed" ? "Zamknięte" : "Otwarte",
            ]);
          }
        }
      }
      rows.sort((a, b) => (a[0] as Date).getTime() - (b[0] as Date).getTime() || String(a[3]).localeCompare(String(b[3]), "pl", { numeric: true }) || String(a[5]).localeCompare(String(b[5]), "pl", { numeric: true }));
      return {
        title: "Godziny",
        columns: [
          { label: "Data", width: 12, kind: "date" },
          { label: "Tydzień", width: 8, kind: "int" },
          { label: "Nr projektu", width: 11 },
          { label: "Projekt", width: 16 },
          { label: "Kategoria", width: 10 },
          { label: "Osoba", width: 20 },
          { label: "Stanowisko", width: 14 },
          { label: "Umowa", width: 9 },
          { label: "Rodzaj", width: 18 },
          { label: "Od", width: 7 },
          { label: "Do", width: 7 },
          { label: "Przerwa (min)", width: 12, kind: "int" },
          { label: "Godziny", width: 9, kind: "hours" },
          { label: "Status", width: 18 },
          { label: "Supervisor", width: 18 },
          { label: "Zatwierdzone (SV)", width: 18, kind: "date" },
          { label: "Installation Manager", width: 20 },
          { label: "Zatwierdzone (IM)", width: 18, kind: "date" },
          { label: "Timesheet", width: 12 },
        ],
        rows,
      };
    }
    case "sheets": {
      const rows: CellValue[][] = [];
      for (const p of projects) {
        for (let w = startOfWeek(o.from); w <= o.to; w = addDays(w, 7)) {
          const sheet = sheets.get(p.id, w);
          let el = 0;
          let me = 0;
          let absent = 0;
          let people = 0;
          for (const [employeeId, days] of model.entries.get(p.id) ?? []) {
            const t = model.employeeById.get(employeeId)?.trade;
            let any = false;
            for (const d of eachDay(w, addDays(w, 6))) {
              const entry = days.get(d);
              if (!entry) continue;
              any = true;
              if (entry.kind === "ABSENCE") absent++;
              else if (t === "MECHANICAL") me += workedMinutes(entry);
              else el += workedMinutes(entry);
            }
            if (any) people++;
          }
          if (!sheet && !people) continue;
          const status = sheet?.status === "sent" ? "Wysłany" : sheet?.status === "closed" ? "Zamknięty" : sheet?.status === "withheld" ? "Wstrzymany" : "Otwarty";
          rows.push([p.number, p.name, isoWeek(w).week, date(w), date(addDays(w, 6)), people, hours(el), hours(me), hours(el + me), absent, status, wall(sheet?.sentAt ?? null)]);
        }
      }
      return {
        title: "Timesheety",
        columns: [
          { label: "Nr projektu", width: 11 },
          { label: "Projekt", width: 16 },
          { label: "Tydzień", width: 8, kind: "int" },
          { label: "Od", width: 12, kind: "date" },
          { label: "Do", width: 12, kind: "date" },
          { label: "Osoby", width: 8, kind: "int" },
          { label: "Godziny elektryków", width: 16, kind: "hours" },
          { label: "Godziny mechaników", width: 16, kind: "hours" },
          { label: "Godziny razem", width: 13, kind: "hours" },
          { label: "Dni nieobecności", width: 14, kind: "int" },
          { label: "Status", width: 12 },
          { label: "Wysyłka", width: 18, kind: "date" },
        ],
        rows,
      };
    }
    case "people-hours": {
      const map = new Map<string, { e: Employee; p: Project; min: number; days: number; absent: number }>();
      for (const p of projects) {
        for (const [employeeId, days] of model.entries.get(p.id) ?? []) {
          const e = model.employeeById.get(employeeId);
          if (!personPasses(e, o)) continue;
          for (const [d, entry] of days) {
            if (d < o.from || d > o.to) continue;
            if (o.status === "approved" && !isComplete(p, employeeId, entry)) continue;
            if (o.status === "sent" && sheets.of(p.id, d)?.status !== "sent") continue;
            const key = `${employeeId}|${p.id}`;
            const row = map.get(key) ?? { e: e!, p, min: 0, days: 0, absent: 0 };
            if (entry.kind === "ABSENCE") row.absent++;
            else {
              row.min += workedMinutes(entry);
              row.days++;
            }
            map.set(key, row);
          }
        }
      }
      const rows = [...map.values()]
        .sort((a, b) => a.e.name.localeCompare(b.e.name, "pl", { numeric: true }) || a.p.number.localeCompare(b.p.number))
        .map((r) => [r.e.name, POSITION_LABEL[r.e.position], r.e.employment ? EMPLOYMENT_LABEL[r.e.employment] : "", r.p.number, r.p.name, r.days, hours(r.min), r.absent] as CellValue[]);
      return {
        title: "Godziny na osobę",
        columns: [
          { label: "Osoba", width: 20 },
          { label: "Stanowisko", width: 14 },
          { label: "Umowa", width: 9 },
          { label: "Nr projektu", width: 11 },
          { label: "Projekt", width: 16 },
          { label: "Dni pracy", width: 10, kind: "int" },
          { label: "Godziny", width: 10, kind: "hours" },
          { label: "Dni nieobecności", width: 14, kind: "int" },
        ],
        rows,
      };
    }
    case "leaves": {
      const ids = new Set(projects.map((p) => p.id));
      const rows = model.leaves
        .filter((l) => l.from <= o.to && l.to >= o.from)
        .filter((l) => personPasses(model.employeeById.get(l.employeeId), o))
        .filter((l) => !o.projectIds.length || (model.assignmentsByEmployee.get(l.employeeId) ?? []).some((a) => ids.has(a.projectId) && a.from <= l.to && (!a.to || a.to >= l.from)))
        .sort((a, b) => a.from.localeCompare(b.from))
        .map((l) => {
          const e = model.employeeById.get(l.employeeId)!;
          const workdays = eachDay(l.from, l.to).filter((d) => parseISO(d).getDay() % 6 !== 0).length;
          const status = l.status === "PENDING" ? "Czeka na akceptację" : l.status === "APPROVED" ? "Zaakceptowany" : l.status === "REJECTED" ? "Odrzucony" : "Anulowany";
          return [e.name, POSITION_LABEL[e.position], ABSENCE_LABEL[l.type], date(l.from), date(l.to), workdays, status, stamp(l.createdAt), l.decidedByName ?? "", stamp(l.decidedAt), l.type === "SICK" ? (l.confirmedByName ? `Tak (${l.confirmedByName})` : "Nie") : "", l.decisionNote ?? "", l.note ?? ""] as CellValue[];
        });
      return {
        title: "Urlopy",
        columns: [
          { label: "Osoba", width: 20 },
          { label: "Stanowisko", width: 14 },
          { label: "Rodzaj", width: 20 },
          { label: "Od", width: 12, kind: "date" },
          { label: "Do", width: 12, kind: "date" },
          { label: "Dni robocze", width: 11, kind: "int" },
          { label: "Status", width: 18 },
          { label: "Zgłoszono", width: 18, kind: "date" },
          { label: "Decyzja", width: 18 },
          { label: "Data decyzji", width: 18, kind: "date" },
          { label: "L4 potwierdzone", width: 18 },
          { label: "Powód decyzji", width: 28 },
          { label: "Uwagi", width: 28 },
        ],
        rows,
      };
    }
    case "staffing": {
      const weeks: ISODate[] = [];
      for (let w = startOfWeek(o.from); w <= o.to; w = addDays(w, 7)) weeks.push(w);
      const rows: CellValue[][] = [];
      for (const p of projects) {
        const ws = weeklyStaffing(model, p, weeks);
        ws.forEach((w) => {
          if (!w.active) return;
          const share = epcidoShare(model, w.people);
          rows.push([p.number, p.name, p.category, isoWeek(w.week).week, date(w.week), w.needElectrical, w.electrical, w.shortElectrical, w.needMechanical, w.mechanical, w.shortMechanical, w.leaveElectrical + w.leaveMechanical, share.pct / 100]);
        });
      }
      return {
        title: "Obsada",
        columns: [
          { label: "Nr projektu", width: 11 },
          { label: "Projekt", width: 16 },
          { label: "Kategoria", width: 10 },
          { label: "Tydzień", width: 8, kind: "int" },
          { label: "Od", width: 12, kind: "date" },
          { label: "Elektrycy — potrzeba", width: 18, kind: "int" },
          { label: "Elektrycy — w planie", width: 18, kind: "int" },
          { label: "Elektrycy — brak", width: 15, kind: "int" },
          { label: "Mechanicy — potrzeba", width: 18, kind: "int" },
          { label: "Mechanicy — w planie", width: 18, kind: "int" },
          { label: "Mechanicy — brak", width: 15, kind: "int" },
          { label: "Na urlopie", width: 10, kind: "int" },
          { label: "Udział EPCIDO", width: 13, kind: "pct" },
        ],
        rows,
      };
    }
    case "employees": {
      const today = now.toISOString().slice(0, 10);
      const cats = model.settings.categories;
      const rows = model.employees
        .filter((e) => FIELD_POSITIONS.includes(e.position) && e.active !== false && personPasses(e, o))
        .map((e) => {
          const p = model.projectsOf(e.id, today)[0];
          return [
            e.name,
            POSITION_LABEL[e.position],
            e.trade === "MECHANICAL" ? "Mechanika" : e.trade === "ELECTRICAL" ? "Elektryka" : "",
            e.employment ? EMPLOYMENT_LABEL[e.employment] : "",
            e.employment ? (isEpcido(e) ? "EPCIDO" : "Agencja") : "",
            e.experience?.totalMonths ?? 0,
            ...cats.map((c) => e.experience?.byCategory?.[c] ?? 0),
            p?.name ?? "bez przydziału",
            e.experience ? formatMonths(e.experience.totalMonths) : "",
          ] as CellValue[];
        });
      return {
        title: "Pracownicy",
        columns: [
          { label: "Osoba", width: 20 },
          { label: "Stanowisko", width: 14 },
          { label: "Branża", width: 11 },
          { label: "Umowa", width: 9 },
          { label: "EPCIDO / agencja", width: 15 },
          { label: "Staż łącznie (mies.)", width: 17, kind: "int" },
          ...cats.map((c) => ({ label: `Staż ${c} (mies.)`, width: 15, kind: "int" as const })),
          { label: "Projekt teraz", width: 16 },
          { label: "Staż słownie", width: 16 },
        ],
        rows,
      };
    }
    case "withheld": {
      const rows: CellValue[][] = [];
      for (const s of sheets.withheld(projects.map((p) => p.id), 26)) {
        if (s.week > o.to || addDays(s.week, 6) < o.from) continue;
        const p = model.projectById.get(s.projectId)!;
        for (const pr of s.problems)
          rows.push([p.number, p.name, isoWeek(s.week).week, date(s.week), name(pr.employeeId), date(pr.date), pr.kind === "missing" ? "Brak wpisu" : "Brak zatwierdzenia", problemSummary(s)]);
      }
      return {
        title: "Wstrzymane",
        columns: [
          { label: "Nr projektu", width: 11 },
          { label: "Projekt", width: 16 },
          { label: "Tydzień", width: 8, kind: "int" },
          { label: "Od", width: 12, kind: "date" },
          { label: "Osoba", width: 20 },
          { label: "Dzień", width: 12, kind: "date" },
          { label: "Błąd", width: 18 },
          { label: "Podsumowanie timesheetu", width: 36 },
        ],
        rows,
      };
    }
  }
}
