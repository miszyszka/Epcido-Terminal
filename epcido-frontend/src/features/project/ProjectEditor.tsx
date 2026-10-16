import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { useData, useModel, useUser } from "../../app/DataContext";
import { useUi } from "../../app/UiContext";
import { ProjectDot } from "../../components/PersonBadge";
import { Segmented } from "../../components/Segmented";
import { validateProject, type DraftAssignment } from "../../data/commands";
import { PROJECT_STATUS_LABEL } from "../../domain/labels";
import { can, canEditProject } from "../../domain/permissions";
import type { ProjectInput } from "../../domain/types";
import { newId } from "../../lib/random";
import { AssignDialog } from "./AssignDialog";
import { HistoryPanel } from "./HistoryPanel";
import { emptyProjectInput, ProjectForm, projectToInput } from "./ProjectForm";
import { TeamTimeline } from "./TeamTimeline";

/** Edytor projektu na pełnym ekranie: dane projektu po lewej, plan zespołu na osi czasu po prawej. */
export function ProjectEditor() {
  const { editor } = useUi();
  if (!editor) return null;
  // key: nowy egzemplarz edytora dla każdego projektu (czysty stan formularza)
  return <EditorInner key={`${editor.projectId ?? "new"}-${editor.rev}`} projectId={editor.projectId} initialTab={editor.tab} />;
}

function EditorInner({ projectId, initialTab }: { projectId: string | null; initialTab: "team" | "history" }) {
  const model = useModel();
  const user = useUser();
  const data = useData();
  const { closeEditor, openProject } = useUi();
  const project = projectId ? model.projectById.get(projectId) : undefined;

  const [values, setValues] = useState<ProjectInput>(() =>
    project ? projectToInput(project) : emptyProjectInput(model.projects, user.role === "PROJECT_MANAGER" ? user.id : null)
  );
  const [draft, setDraft] = useState<DraftAssignment[]>(() =>
    (projectId ? model.assignmentsByProject.get(projectId) ?? [] : []).map((a) => ({
      key: a.id,
      id: a.id,
      employeeId: a.employeeId,
      from: a.from,
      to: a.to,
    }))
  );
  const [tab, setTab] = useState<"team" | "history">(initialTab);
  const [attempted, setAttempted] = useState(false);
  const [assigning, setAssigning] = useState(false);
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
    const fieldsChanged = (Object.keys(original) as (keyof ProjectInput)[]).some((k) => (original[k] ?? "") !== (values[k] ?? ""));
    const existing = model.assignmentsByProject.get(project.id) ?? [];
    const teamChanged =
      existing.length !== draft.length ||
      draft.some((d) => {
        const a = existing.find((x) => x.id === d.id);
        return !a || a.from !== d.from || (a.to ?? null) !== (d.to ?? null);
      });
    return fieldsChanged || teamChanged;
  }, [project, values, draft, model.assignmentsByProject]);

  useEffect(() => {
    root.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !document.querySelector(".popover, .dialog")) closeEditor();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [closeEditor]);

  const set = <K extends keyof ProjectInput>(key: K, value: ProjectInput[K]) => setValues((v) => ({ ...v, [key]: value }));

  async function save() {
    setAttempted(true);
    if (Object.keys(validateProject(values, model.snapshot, projectId)).length > 0) return;
    setSaving(true);
    const id = await data.saveProject(projectId, values, draft);
    setSaving(false);
    // Otwórz ponownie z zapisanych danych — plan dostaje prawdziwe identyfikatory przypisań
    if (id) openProject(id, tab);
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
        <button type="button" className="btn btn--quiet" onClick={closeEditor}>
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
          <button type="button" className="btn btn--quiet" onClick={closeEditor}>
            {editable ? "Anuluj" : "Zamknij"}
          </button>
          {editable && (
            <button type="button" className="btn btn--primary" onClick={save} disabled={saving || (!!project && !dirty)}>
              {project ? "Zapisz zmiany" : "Utwórz projekt"}
            </button>
          )}
        </div>
      </header>

      <div className="editor__body">
        <aside className="editor__form" aria-label="Dane projektu">
          <h3 className="editor__heading">Dane projektu</h3>
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
                { value: "team", label: "Plan zespołu", count: draft.length },
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
            />
          ) : (
            project && <HistoryPanel projectId={project.id} />
          )}
        </main>
      </div>

      {assigning && (
        <AssignDialog
          projectId={projectId}
          projectStart={values.startDate}
          projectEnd={values.endDate}
          alreadyPlanned={new Set(draft.map((d) => d.employeeId))}
          onClose={() => setAssigning(false)}
          onAssign={(ids, from, to) => {
            setDraft((d) => [...d, ...ids.map((employeeId) => ({ key: newId("draft"), employeeId, from, to }))]);
            setAssigning(false);
          }}
        />
      )}
    </div>
  );
}
