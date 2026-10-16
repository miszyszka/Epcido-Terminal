/** Polska odmiana liczebników: 1 osoba, 2 osoby, 5 osób. */
export function plural(n: number, one: string, few: string, many: string): string {
  if (n === 1) return one;
  const last = n % 10;
  const lastTwo = n % 100;
  return last >= 2 && last <= 4 && (lastTwo < 12 || lastTwo > 14) ? few : many;
}

export const people = (n: number) => `${n} ${plural(n, "osoba", "osoby", "osób")}`;
export const absences = (n: number) => `${n} ${plural(n, "nieobecność", "nieobecności", "nieobecności")}`;
export const projectsCount = (n: number) => `${n} ${plural(n, "projekt", "projekty", "projektów")}`;
export const positions = (n: number) => `${n} ${plural(n, "pozycja", "pozycje", "pozycji")}`;
export const daysCount = (n: number) => `${n} ${plural(n, "dzień", "dni", "dni")}`;
