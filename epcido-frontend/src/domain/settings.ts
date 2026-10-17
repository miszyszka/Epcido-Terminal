// Ustawienia systemu — zmienia je administrator (ekran Ustawienia), zapisane w meta/settings.
// Funkcje domeny (terminy, obsada) czytają bieżące ustawienia stąd; model danych podmienia je
// przy każdej zmianie w bazie (DataContext → applySettings).

import type { SystemSettings } from "./types";

export const DEFAULT_SETTINGS: SystemSettings = {
  approveDayOffset: 7,
  approveTime: "23:59",
  exportDayOffset: 8,
  exportTime: "23:00",
  categories: ["KNAPP", "KARDEX", "FORTNA", "OTHER"],
  branches: ["Polska", "Wielka Brytania", "Niemcy", "Beneluks", "Skandynawia", "Francja", "Czechy"],
  minEpcidoShare: 50,
  breakMinDays: 5,
  longStretchWeeks: 8,
};

let current: SystemSettings = DEFAULT_SETTINGS;

export function getSettings(): SystemSettings {
  return current;
}

/** Scala zapisane ustawienia z domyślnymi (brakujące pola ze starszych wersji). */
export function normalizeSettings(saved: Partial<SystemSettings> | null | undefined): SystemSettings {
  const s = { ...DEFAULT_SETTINGS, ...(saved ?? {}) };
  return {
    ...s,
    categories: s.categories?.length ? s.categories : DEFAULT_SETTINGS.categories,
    branches: s.branches?.length ? s.branches : DEFAULT_SETTINGS.branches,
  };
}

export function applySettings(s: SystemSettings) {
  current = s;
}

/** „23:59" → [23, 59] */
export function parseTime(t: string): [number, number] {
  const [h, m] = t.split(":").map((x) => Number(x));
  return [Number.isFinite(h) ? h : 0, Number.isFinite(m) ? m : 0];
}

export const WEEKDAY_AFTER: { offset: number; label: string; short: string }[] = [
  { offset: 7, label: "poniedziałek", short: "pn" },
  { offset: 8, label: "wtorek", short: "wt" },
  { offset: 9, label: "środa", short: "śr" },
  { offset: 10, label: "czwartek", short: "czw" },
];

export function validateSettings(s: SystemSettings): string | null {
  const time = /^([01]\d|2[0-3]):[0-5]\d$/;
  if (!time.test(s.approveTime) || !time.test(s.exportTime)) return "Podaj godziny w formacie GG:MM.";
  const [ah, am] = parseTime(s.approveTime);
  const [eh, em] = parseTime(s.exportTime);
  const approve = s.approveDayOffset * 1440 + ah * 60 + am;
  const exp = s.exportDayOffset * 1440 + eh * 60 + em;
  if (exp <= approve) return "Wysyłka do Dataverse musi być po terminie zatwierdzania.";
  if (!s.categories.length) return "Potrzebna jest co najmniej jedna kategoria projektów.";
  if (new Set(s.categories.map((c) => c.toUpperCase())).size !== s.categories.length) return "Kategorie się powtarzają.";
  if (s.categories.some((c) => !/^[\p{L}\d][\p{L}\d &.-]{0,19}$/u.test(c))) return "Nazwa kategorii: litery i cyfry, do 20 znaków.";
  if (!s.branches.length) return "Potrzebny jest co najmniej jeden oddział.";
  if (s.minEpcidoShare < 0 || s.minEpcidoShare > 100) return "Udział EPCIDO: od 0 do 100%.";
  if (s.breakMinDays < 1 || s.breakMinDays > 30) return "Minimalna przerwa: od 1 do 30 dni.";
  if (s.longStretchWeeks < 2 || s.longStretchWeeks > 52) return "„Długo bez przerwy”: od 2 do 52 tygodni.";
  return null;
}
