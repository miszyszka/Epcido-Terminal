import { ArrowLeftRight, ChartGantt, CheckCheck, Clock3, Gauge, LayoutGrid, Network, Users, type LucideIcon } from "lucide-react";
import type { Route } from "../domain/permissions";

/** Nazwy i ikony ekranów — wspólne dla docku i wyszukiwarki. */
export const NAV_META: Record<Route, { label: string; icon: LucideIcon; keywords?: string[] }> = {
  "/pulpit": { label: "Pulpit", icon: Gauge, keywords: ["supervisorzy", "dashboard"] },
  "/zatwierdzanie": { label: "Zatwierdzanie", icon: CheckCheck, keywords: ["godziny", "timesheet", "akceptacja"] },
  "/moje-godziny": { label: "Moje godziny", icon: Clock3, keywords: ["wpis", "czas pracy", "nieobecność"] },
  "/mapa": { label: "Mapa", icon: LayoutGrid, keywords: ["plan projektów", "kropki"] },
  "/os-czasu": { label: "Oś czasu", icon: ChartGantt, keywords: ["godziny od do", "timeline"] },
  "/struktura": { label: "Struktura", icon: Network, keywords: ["zespoły", "drzewo"] },
  "/ludzie": { label: "Ludzie", icon: Users, keywords: ["pracownicy", "elektrycy", "mechanicy"] },
  "/obsada": { label: "Obsada", icon: ArrowLeftRight, keywords: ["przesunięcia", "planowanie", "kto się zwalnia", "przerwy"] },
};
