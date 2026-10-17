import {
  ArrowLeftRight,
  CalendarDays,
  ChartGantt,
  CheckCheck,
  Clock3,
  FileSpreadsheet,
  Gauge,
  LayoutGrid,
  Network,
  Settings2,
  ShieldCheck,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { Route } from "../domain/permissions";

/** Nazwy i ikony ekranów — wspólne dla docku i wyszukiwarki. */
export const NAV_META: Record<Route, { label: string; icon: LucideIcon; keywords?: string[] }> = {
  "/pulpit": { label: "Pulpit", icon: Gauge, keywords: ["supervisorzy", "dashboard"] },
  "/zatwierdzanie": { label: "Zatwierdzanie", icon: CheckCheck, keywords: ["godziny", "timesheet", "akceptacja"] },
  "/moje-godziny": { label: "Moje godziny", icon: Clock3, keywords: ["wpis", "czas pracy", "nieobecność", "urlop", "L4"] },
  "/mapa": { label: "Mapa", icon: LayoutGrid, keywords: ["plan projektów", "kropki"] },
  "/os-czasu": { label: "Oś czasu", icon: ChartGantt, keywords: ["godziny od do", "timeline"] },
  "/struktura": { label: "Struktura", icon: Network, keywords: ["zespoły", "drzewo"] },
  "/ludzie": { label: "Ludzie", icon: Users, keywords: ["pracownicy", "elektrycy", "mechanicy", "staż", "agencja"] },
  "/urlopy": { label: "Urlopy", icon: CalendarDays, keywords: ["nieobecności", "L4", "wnioski", "akceptacja urlopów", "kalendarz"] },
  "/obsada": { label: "Obsada", icon: ArrowLeftRight, keywords: ["przesunięcia", "planowanie", "kto się zwalnia", "przerwy", "zapotrzebowanie"] },
  "/raporty": { label: "Raporty", icon: FileSpreadsheet, keywords: ["excel", "xlsx", "eksport", "zestawienie godzin"] },
  "/uzytkownicy": { label: "Użytkownicy", icon: ShieldCheck, keywords: ["uprawnienia", "role", "konta", "HR", "dodaj użytkownika"] },
  "/ustawienia": { label: "Ustawienia", icon: Settings2, keywords: ["terminy", "wysyłka", "kategorie", "oddziały", "dataverse"] },
};
