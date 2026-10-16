// Daty jako napisy YYYY-MM-DD w czasie lokalnym (bez stref).
// Dzień pracy to data kalendarzowa, nie moment w czasie — patrz PLAN_I_ARCHITEKTURA.md, sekcja 9.

export type ISODate = string;

const pad = (n: number) => String(n).padStart(2, "0");

export function toISO(d: Date): ISODate {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function parseISO(iso: ISODate): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function todayISO(): ISODate {
  return toISO(new Date());
}

export function addDays(iso: ISODate, n: number): ISODate {
  const d = parseISO(iso);
  d.setDate(d.getDate() + n);
  return toISO(d);
}

/** 0 = poniedziałek … 6 = niedziela */
export function weekdayIndex(iso: ISODate): number {
  return (parseISO(iso).getDay() + 6) % 7;
}

export function startOfWeek(iso: ISODate): ISODate {
  return addDays(iso, -weekdayIndex(iso));
}

export function daysBetween(from: ISODate, to: ISODate): number {
  const ms = parseISO(to).getTime() - parseISO(from).getTime();
  return Math.round(ms / 86_400_000);
}

export function eachDay(from: ISODate, to: ISODate): ISODate[] {
  const out: ISODate[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}

/** Numer tygodnia ISO-8601 (tydzień z pierwszym czwartkiem roku). */
export function isoWeek(iso: ISODate): { year: number; week: number } {
  const d = parseISO(iso);
  const thursday = new Date(d);
  thursday.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const year = thursday.getFullYear();
  const jan4 = new Date(year, 0, 4);
  const week =
    1 +
    Math.round(
      ((thursday.getTime() - jan4.getTime()) / 86_400_000 - 3 + ((jan4.getDay() + 6) % 7)) / 7
    );
  return { year, week };
}

export function isWeekend(iso: ISODate): boolean {
  return weekdayIndex(iso) >= 5;
}

export const WEEKDAYS_SHORT = ["Pn", "Wt", "Śr", "Cz", "Pt", "So", "Nd"];
const WEEKDAYS_LOWER = ["pn", "wt", "śr", "cz", "pt", "so", "nd"];
export const MONTHS_SHORT = ["sty", "lut", "mar", "kwi", "maj", "cze", "lip", "sie", "wrz", "paź", "lis", "gru"];
export const MONTHS_LONG = [
  "styczeń",
  "luty",
  "marzec",
  "kwiecień",
  "maj",
  "czerwiec",
  "lipiec",
  "sierpień",
  "wrzesień",
  "październik",
  "listopad",
  "grudzień",
];

/** „13 paź 2026" */
export function formatDate(iso: ISODate | null | undefined): string {
  if (!iso) return "—";
  const d = parseISO(iso);
  return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]} ${d.getFullYear()}`;
}

/** „wt, 13 paź" */
export function formatDay(iso: ISODate): string {
  const d = parseISO(iso);
  return `${WEEKDAYS_LOWER[weekdayIndex(iso)]}, ${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`;
}

/** 420 → „7:00" */
export function formatMinutes(min: number | undefined): string {
  if (min === undefined) return "—";
  return `${Math.floor(min / 60)}:${pad(min % 60)}`;
}

/** Data i godzina zdarzenia z audytu: „16 paź 2026, 13:42" */
export function formatTimestamp(isoTimestamp: string): string {
  const d = new Date(isoTimestamp);
  return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]} ${d.getFullYear()}, ${d.getHours()}:${pad(d.getMinutes())}`;
}
