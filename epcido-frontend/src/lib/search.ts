import type { Model } from "../app/DataContext";
import type { Employee, Project } from "../domain/types";

export function normalize(text: string): string {
  return text
    .toLocaleLowerCase("pl")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/ł/g, "l")
    .trim();
}

export function matches(query: string, ...fields: (string | null | undefined)[]): boolean {
  const q = normalize(query);
  if (!q) return true;
  return fields.some((f) => f && normalize(f).includes(q));
}

export interface ProjectMatch {
  project: Project;
  /** null = pokaż cały zespół; zbiór = pokaż tylko pasujące osoby */
  people: Set<string> | null;
}

/** Projekty pasujące do wyszukiwania: po projekcie/kliencie albo po osobach w zespole. */
export function searchProjects(model: Model, query: string): ProjectMatch[] {
  if (!normalize(query)) return model.projects.map((project) => ({ project, people: null }));
  const out: ProjectMatch[] = [];
  for (const project of model.projects) {
    if (matches(query, project.name, project.number, project.customerName, project.siteAddress, project.country)) {
      out.push({ project, people: null });
      continue;
    }
    const team = model.team(project.id);
    if (!team) continue;
    const people = [team.supervisor, team.installationManager, ...team.members].filter(
      (e): e is Employee => Boolean(e) && matches(query, e!.name)
    );
    if (people.length) out.push({ project, people: new Set(people.map((p) => p.id)) });
  }
  return out;
}

export function cityOf(project: Project): string {
  const parts = project.siteAddress.split(",").map((s) => s.trim()).filter(Boolean);
  return parts[parts.length - 1] || project.country;
}
