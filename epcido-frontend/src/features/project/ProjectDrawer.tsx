import { useNavigate } from "react-router-dom";
import { useData } from "../../app/DataContext";
import { useUi, type ProjectTab } from "../../app/UiContext";
import { Drawer } from "../../components/Drawer";
import { ProjectDot } from "../../components/PersonBadge";
import { PROJECT_STATUS_LABEL } from "../../domain/labels";
import { cityOf } from "../../lib/search";
import { HistoryPanel } from "./HistoryPanel";
import { PROJECT_FORM_ID, ProjectForm } from "./ProjectForm";
import { TeamPanel } from "./TeamPanel";

const TABS: { id: ProjectTab; label: string }[] = [
  { id: "team", label: "Zespół" },
  { id: "details", label: "Dane projektu" },
  { id: "history", label: "Historia zmian" },
];

export function ProjectDrawer() {
  const { drawer, closeDrawer, openProject } = useUi();
  const data = useData();
  const navigate = useNavigate();
  const model = data.model;
  if (!drawer || !model) return null;

  if (drawer.kind === "new") {
    return (
      <Drawer
        title="Nowy projekt"
        subtitle="Po utworzeniu dodasz supervisora i zespół."
        onClose={closeDrawer}
        contentKey="new"
        footer={
          <>
            <button type="button" className="btn btn--quiet" onClick={closeDrawer}>
              Anuluj
            </button>
            <button type="submit" form={PROJECT_FORM_ID} className="btn btn--primary">
              Utwórz projekt
            </button>
          </>
        }
      >
        <ProjectForm
          onSubmit={async (input) => {
            const id = await data.createProject(input);
            if (id) openProject(id, "team");
          }}
        />
      </Drawer>
    );
  }

  const project = model.projectById.get(drawer.projectId);
  if (!project) {
    return (
      <Drawer title="Projekt nie istnieje" onClose={closeDrawer}>
        <p>Ten projekt został usunięty albo jeszcze się nie wczytał.</p>
      </Drawer>
    );
  }

  const tab = drawer.tab;
  return (
    <Drawer
      contentKey={`${project.id}-${tab}`}
      onClose={closeDrawer}
      title={
        <>
          <ProjectDot color={project.color} />
          {project.name}
        </>
      }
      subtitle={
        <>
          <span>
            {project.number}, {project.customerName}, {cityOf(project)}
          </span>
          <span className={`badge badge--status badge--${project.status.toLowerCase()}`}>{PROJECT_STATUS_LABEL[project.status]}</span>
        </>
      }
      footer={
        tab === "details" ? (
          <>
            <button type="button" className="btn btn--quiet" onClick={() => openProject(project.id, "team")}>
              Anuluj
            </button>
            <button type="submit" form={PROJECT_FORM_ID} className="btn btn--primary">
              Zapisz zmiany
            </button>
          </>
        ) : (
          <button
            type="button"
            className="btn btn--secondary"
            onClick={() => {
              closeDrawer();
              navigate(`/os-czasu?projekt=${project.id}`);
            }}
          >
            Pokaż na osi czasu
          </button>
        )
      }
    >
      <div className="tabs" role="tablist" aria-label="Sekcje projektu">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            className={`tabs__tab ${tab === t.id ? "is-active" : ""}`}
            onClick={() => openProject(project.id, t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div role="tabpanel">
        {tab === "team" && <TeamPanel projectId={project.id} />}
        {tab === "details" && (
          <ProjectForm
            key={project.id + project.updatedAt}
            initial={project}
            onSubmit={async (input) => {
              const ok = await data.updateProject(project.id, input);
              if (ok) openProject(project.id, "team");
            }}
          />
        )}
        {tab === "history" && <HistoryPanel projectId={project.id} />}
      </div>
    </Drawer>
  );
}
