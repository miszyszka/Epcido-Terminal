import { useMemo, useState } from "react";
import type { Model } from "../app/DataContext";
import { ownProjects, projectOwnerName, projectScope, seesOtherProjects, type ProjectScope } from "../domain/permissions";
import type { Employee, Project } from "../domain/types";
import { Segmented } from "./Segmented";

export type ScopeValue = "mine" | "other" | "all";

export interface Scope {
  /** Czy w ogóle pokazywać filtr — tylko gdy ktoś widzi cudze projekty (Installation Manager, administrator) */
  showScope: boolean;
  value: ScopeValue;
  set: (v: ScopeValue) => void;
  pass: (project: Project) => boolean;
  scopeOf: (project: Project) => ProjectScope;
  ownerName: (project: Project) => string | null;
  counts: { mine: number; other: number; all: number };
}

/**
 * Installation Manager widzi wszystkie projekty firmy, więc w każdym widoku musi wiedzieć,
 * które są jego, a które prowadzi inny IM — i móc odfiltrować jedne od drugich.
 */
export function useScope(model: Model, user: Employee, defaultValue: ScopeValue = "all"): Scope {
  const showScope = useMemo(() => seesOtherProjects(model, user), [model, user]);
  const [value, set] = useState<ScopeValue>(defaultValue);
  return useMemo(() => {
    const mine = ownProjects(model, user).length;
    const effective: ScopeValue = showScope ? value : "all";
    return {
      showScope,
      value: effective,
      set,
      scopeOf: (p: Project) => projectScope(model, user, p),
      ownerName: (p: Project) => projectOwnerName(model, p),
      pass: (p: Project) => {
        if (effective === "all") return true;
        const s = projectScope(model, user, p);
        return effective === "mine" ? s === "mine" : s === "other";
      },
      counts: { mine, other: model.projects.length - mine, all: model.projects.length },
    };
  }, [model, user, showScope, value]);
}

export function ScopeFilter({ scope, label = "Projekty" }: { scope: Scope; label?: string }) {
  if (!scope.showScope) return null;
  return (
    <Segmented<ScopeValue>
      label={label}
      value={scope.value}
      onChange={scope.set}
      options={[
        { value: "mine", label: "Moje", count: scope.counts.mine },
        { value: "other", label: "Innych IM", count: scope.counts.other },
        { value: "all", label: "Wszystkie", count: scope.counts.all },
      ]}
    />
  );
}

/** Znacznik przy projekcie: „moje" albo nazwisko Installation Managera, który go prowadzi. */
export function ProjectScopeMark({ scope, project }: { scope: Scope; project: Project }) {
  if (!scope.showScope) return null;
  const mine = scope.scopeOf(project) === "mine";
  const owner = scope.ownerName(project);
  return (
    <span className={`scope-mark ${mine ? "is-mine" : "is-other"}`} data-tip={mine ? "Twój projekt" : owner ? `Prowadzi: ${owner}` : "Projekt innego zespołu"}>
      {mine ? "moje" : owner ?? "inny IM"}
    </span>
  );
}
