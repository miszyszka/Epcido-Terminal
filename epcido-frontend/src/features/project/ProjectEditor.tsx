import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { useData, useModel, useUser } from "../../app/DataContext";
import { useUi } from "../../app/UiContext";
import { ProjectDot } from "../../components/PersonBadge";
import { Segmented } from "../../components/Segmented";
import { validateProject, type DraftAssignment } from "../../data/commands";
import { defaultTask, PROJECT_STATUS_LABEL } from "../../domain/labels";
import { can, canEditProject } from "../../domain/permissions";
import type { ProjectInput } from "../../domain/types";
import { newId } from "../../lib/random";
import { AssignDialog } from "./AssignDialog";
import { HistoryPanel } from "./HistoryPanel";
import { emptyProjectInput, ProjectForm, projectToInput } from "./ProjectForm";
import { TeamTimeline } from "./TeamTimeline";
import { AutoStaffDialog } from "../staffing/AutoStaffDialog";

/** Edytor projektu na pełnym ekranie: dane projektu po lewej, plan zespołu na osi czasu po prawej. */
export function ProjectEditor() {
  const { editor } = useUi();
  if (!editor) return null;
  // key: nowy egzemplarz edytora dla każdego projektu (czysty stan formularza)
  return <EditorInner key={`${editor.projectId ?? "new"}-${editor.rev}`} projectId={editor.projectId} initialTab={editor.tab} focus={Boolean(editor.focus)} />;
}

function EditorInner({ projectId, initialTab, focus }: { projectId: string | null; initialTab: "team" | "history"; focus: boolean }) {
  const model = useModel();
  const user = useUser();
  const data = useData();
  const { closeEditor, openProject, confirm } = useUi();
  const project = projectId ? model.projectById.get(projectId) : undefined;

  const [values, setValues] = useState<ProjectInput>(() =>
    project ? projectToInput(project) : emptyProjectInput(model.projects, user.position === "PROJECT_MANAGER" ? user.id : null)
  );
  const [draft, setDraft] = useState<DraftAssignment[]>(() =>
    (projectId ? model.assignmentsByProject.get(projectId) ?? [] : []).map((a) => ({
      key: a.id,
      id: a.id,
      employeeId: a.employeeId,
      from: a.from,
      to: a.to,
      task: a.task ?? null,
    }))
  );
  const [tab, setTab] = useState<"team" | "history">(initialTab);
  const [attempted, setAttempted] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [proposing, setProposing] = useState(false);
  const [formOpen, setFormOpen] = useState(!focus || !projectId);
  const [saving, setSaving] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  const editable = project ? canEditProject(user, project) : can(user, "project.create");
  const canPlan = editable && can(user, "team.plan");
  const errors = useMemo(
    () => (attempted ? validateProject(values, model.snapshot, projectId) : {}),
    [attempted, values, model.snapshot, projectId]
  );

  const dirty = useMemo(() => {
    if (!project) return true;
    const original = projectToInput(project);
    const fieldsChanged = (Object.keys(original) as (keyof ProjectInput)[]).some(
      (k) => JSON.stringify(original[k] ?? "") !== JSON.stringify(values[k] ?? "")
    );
    const existing = model.assignmentsByProject.get(project.id) ?? [];
    const teamChanged =
      existing.length !== draft.length ||
      draft.some((d) => {
        const a = existing.find((x) => x.id === d.id);
        return !a || a.from !== d.from || (a.to ?? null) !== (d.to ?? null) || (a.task ?? null) !== (d.task ?? null);
      });
    return fieldsChanged || teamChanged;
  }, [project, values, draft, model.assignmentsByProject]);

  /** Wyjście z edytora: niezapisane zmiany nie znikają bez pytania. */
  const leave = useCallback(async () => {
    if (project && dirty) {
      const ok = await confirm({
        title: "Porzucić niezapisane zmiany?",
        lines: ["Plan i dane projektu wrócą do stanu zapisanego w bazie."],
        confirmLabel: "Porzuć zmiany",
        cancelLabel: "Wróć do edycji",
        tone: "danger",
      });
      if (!ok) return;
    }
    closeEditor();
  }, [project, dirty, confirm, closeEditor]);

  useEffect(() => {
    root.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !document.querySelector(".popover, .dialog, .psheet")) void leave();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [leave]);

  const set = <K extends keyof ProjectInput>(key: K, value: ProjectInput[K]) => setValues((v) => ({ ...v, [key]: value }));

  /** Co dokładnie zmieni zapis — planista potwierdza to przed dotknięciem bazy. */
  const changeLines = useMemo(() => {
    if (!project) return [`Nowy projekt: ${values.name || "bez nazwy"}`, `Zespół w planie: ${new Set(draft.map((d) => d.employeeId)).size} os.`];
    const lines: string[] = [];
    const original = projectToInput(project);
    const fields: [keyof ProjectInput, string][] = [
      ["name", "nazwa"],
      ["number", "numer"],
      ["startDate", "start"],
      ["endDate", "koniec"],
      ["status", "status"],
      ["category", "kategoria"],
      ["branch", "oddział"],
      ["supervisorId", "supervisor"],
      ["installationManagerId", "Installation Manager"],
      ["projectManagerId", "Project Manager"],
      ["demand", "zapotrzebowanie"],
    ];
    for (const [key, label] of fields) {
      if (JSON.stringify(original[key] ?? "") !== JSON.stringify(values[key] ?? "")) lines.push(`Zmiana: ${label}`);
    }
    const existing = model.assignmentsByProject.get(project.id) ?? [];
    const added = draft.filter((d) => !d.id).length;
    const removed = existing.filter((a) => !draft.some((d) => d.id === a.id)).length;
    const moved = draft.filter((d) => {
      const a = existing.find((x) => x.id === d.id);
      return a && (a.from !== d.from || (a.to ?? null) !== (d.to ?? null) || (a.task ?? null) !== (d.task ?? null));
    }).length;
    if (added) lines.push(`Nowe zadania w planie: ${added}`);
    if (moved) lines.push(`Zmienione zadania: ${moved}`);
    if (removed) lines.push(`Usunięte z planu: ${removed}`);
    return lines.length ? lines : ["Bez widocznych zmian"];
  }, [project, values, draft, model.assignmentsByProject]);

  async function save() {
    setAttempted(true);
    if (Object.keys(validateProject(values, model.snapshot, projectId)).length > 0) return;
    const ok = await confirm({
      title: project ? `Zapisać zmiany w ${project.name}?` : "Utworzyć projekt?",
      description: project ? "Zmiany zobaczą od razu wszyscy — także zespół w terenie." : undefined,
      lines: changeLines,
      confirmLabel: project ? "Zapisz zmiany" : "Utwórz projekt",
    });
    if (!ok) return;
    setSaving(true);
    const id = await data.saveProject(projectId, values, draft);
    setSaving(false);
    // Otwórz ponownie z zapisanych danych — plan dostaje prawdziwe identyfikatory przypisań
    if (id) openProject(id, tab, !formOpen);
  }

  if (projectId && !project) {
    return (
      <div className="editor" role="dialog" aria-modal="true">
        <div className="editor__bar">
          <button type="button" className="btn btn--quiet" onClick={closeEditor}>
            <ArrowLeft size={18} aria-hidden />
            Wróć
          </button>
        </div>
        <p className="empty">Ten projekt został usunięty albo jeszcze się nie wczytał.</p>
      </div>
    );
  }

  return (
    <div className="editor" role="dialog" aria-modal="true" aria-label={project ? project.name : "Nowy projekt"} tabIndex={-1} ref={root}>
      <header className="editor__bar">
        <button type="button" className="btn btn--quiet" onClick={() => void leave()}>
          <ArrowLeft size={18} aria-hidden />
          Wróć
        </button>
        <div className="editor__title">
          <h2>
            <ProjectDot color={values.color} />
            {project ? values.name || project.name : "Nowy projekt"}
          </h2>
          {project && (
            <span className="badge badge--status">{PROJECT_STATUS_LABEL[project.status]}</span>
          )}
          {project && !dirty && <span className="muted editor__saved">Wszystko zapisane</span>}
          {project && dirty && <span className="editor__unsaved">Niezapisane zmiany</span>}
        </div>
        <div className="editor__actions">
          <button type="button" className="btn btn--quiet" onClick={() => void leave()}>
            {editable ? "Anuluj" : "Zamknij"}
          </button>
          {editable && (
            <button type="button" className="btn btn--primary" onClick={save} disabled={saving || (!!project && !dirty)}>
              {project ? "Zapisz zmiany" : "Utwórz projekt"}
            </button>
          )}
        </div>
      </header>

      <div className={`editor__body ${formOpen ? "" : "is-collapsed"}`}>
        {!formOpen && (
          <button type="button" className="editor__expand" onClick={() => setFormOpen(true)} data-tip="Pokaż dane projektu">
            <PanelLeftOpen size={18} aria-hidden />
            <span>Dane projektu</span>
          </button>
        )}
        <aside className="editor__form" aria-label="Dane projektu" hidden={!formOpen}>
          <div className="editor__heading-row">
            <h3 className="editor__heading">Dane projektu</h3>
            {project && (
              <button type="button" className="icon-btn icon-btn--sm" onClick={() => setFormOpen(false)} aria-label="Zwiń dane projektu" data-tip="Zwiń — plan na całą szerokość">
                <PanelLeftClose size={18} />
              </button>
            )}
          </div>
          {!editable && <p className="notice">Dane projektu zmienia Planning lub Project Manager tego projektu.</p>}
          <ProjectForm values={values} onChange={set} errors={errors} projectId={projectId} readOnly={!editable} />
        </aside>

        <main className="editor__main">
          <div className="editor__main-head">
            <Segmented
              label="Widok"
              value={tab}
              onChange={setTab}
              options={[
                { value: "team", label: "Plan zespołu", count: new Set(draft.map((d) => d.employeeId)).size },
                ...(project ? [{ value: "history" as const, label: "Historia zmian" }] : []),
              ]}
            />
          </div>
          {tab === "team" ? (
            <TeamTimeline
              projectId={projectId}
              start={values.startDate || project?.startDate || model.projects[0]?.startDate}
              end={values.endDate}
              supervisorId={values.supervisorId}
              draft={draft}
              onChange={setDraft}
              editable={canPlan}
              onAssign={() => setAssigning(true)}
              demand={values.demand}
              onPropose={can(user, "staffing.plan") && project ? () => setProposing(true) : undefined}
            />
          ) : (
            project && <HistoryPanel projectId={project.id} />
          )}
        </main>
      </div>

      {proposing && project && (
        <AutoStaffDialog
          project={{ ...project, ...values }}
          team={draft.map((d) => ({ employeeId: d.employeeId, from: d.from, to: d.to }))}
          onClose={() => setProposing(false)}
          onApply={(items) =>
            setDraft((d) => [...d, ...items.map((it) => ({ key: newId("draft"), employeeId: it.employeeId, from: it.from, to: it.to, task: it.task }))])
          }
        />
      )}
      {assigning && (
        <AssignDialog
          projectId={projectId}
          projectStart={values.startDate}
          projectEnd={values.endDate}
          alreadyPlanned={new Set(draft.map((d) => d.employeeId))}
          onClose={() => setAssigning(false)}
          onAssign={(ids, from, to, task) => {
            setDraft((d) => [
              ...d,
              ...ids.map((employeeId) => ({
                key: newId("draft"),
                employeeId,
                from,
                to,
                task: task || defaultTask(model.employeeById.get(employeeId)?.trade),
              })),
            ]);
            setAssigning(false);
          }}
        />
      )}
    </div>
  );
}
