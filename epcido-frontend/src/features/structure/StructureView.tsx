import { useModel } from "../../app/DataContext";
import { useUi } from "../../app/UiContext";
import { PageHeader } from "../../components/PageHeader";
import { PersonChip, PositionMark, ProjectDot } from "../../components/PersonBadge";
import type { Employee } from "../../domain/types";
import { matches } from "../../lib/search";
import { people as peopleCount, projectsCount } from "../../lib/text";

/** Drzewko podległości: Installation Manager → projekt i Supervisor → zespół. */
export function StructureView() {
  const model = useModel();
  const { search, openProject } = useUi();
  const ims = model.employees.filter((e) => e.position === "INSTALLATION_MANAGER");
  const orphanProjects = model.projects.filter((p) => !p.installationManagerId);
  const bench = model.employees.filter(
    (e) =>
      (e.position === "TEAM_LEADER" || e.position === "ELECTRICIAN" || e.position === "MECHANIC") &&
      !model.assignmentByEmployee.has(e.id)
  );

  const visibleProjects = (projectIds: string[]) =>
    projectIds
      .map((id) => model.team(id)!)
      .filter((t) =>
        matches(
          search,
          t.project.name,
          t.project.number,
          t.project.customerName,
          t.supervisor?.name,
          t.installationManager?.name,
          ...t.members.map((m) => m.name)
        )
      );

  return (
    <div className="page">
      <PageHeader
        title="Struktura zespołów"
        description="Kto komu podlega. Team Leaderzy są na tym samym poziomie co elektrycy i mechanicy — różni ich rola na budowie, nie miejsce w strukturze."
      />

      <div className="org">
        {ims.map((im) => {
          const projectIds = model.projects.filter((p) => p.installationManagerId === im.id).map((p) => p.id);
          const teams = visibleProjects(projectIds);
          if (search && teams.length === 0 && !matches(search, im.name)) return null;
          const people = teams.reduce((n, t) => n + t.members.length + (t.supervisor ? 1 : 0), 0);
          return (
            <section key={im.id} className="org-col" aria-label={im.name}>
              <div className="org-node org-node--im">
                <PositionMark employee={im} />
                <div>
                  <strong>{im.name}</strong>
                  <span className="org-node__meta">
                    {projectsCount(projectIds.length)}, {peopleCount(people)}
                  </span>
                </div>
              </div>
              <ul className="org-branch">
                {teams.map((t) => (
                  <li key={t.project.id} className="org-project">
                    <button type="button" className="org-project__head" onClick={() => openProject(t.project.id)}>
                      <ProjectDot color={t.project.color} />
                      <span className="org-project__name">{t.project.name}</span>
                      <span className="org-project__number">{t.project.number}</span>
                    </button>
                    <div className="org-sv">
                      {t.supervisor ? (
                        <>
                          <PositionMark employee={t.supervisor} />
                          <span>{t.supervisor.name}</span>
                        </>
                      ) : (
                        <button type="button" className="btn btn--quiet btn--sm" onClick={() => openProject(t.project.id)}>
                          Wybierz supervisora
                        </button>
                      )}
                    </div>
                    <div className="org-team">
                      {t.members.length === 0 ? (
                        <p className="org-team__empty">Zespół jeszcze pusty.</p>
                      ) : (
                        <>
                          <TeamGroup label="Team Leaderzy" people={t.teamLeaders} />
                          <TeamGroup label="Elektrycy" people={t.electricians} />
                          <TeamGroup label="Mechanicy" people={t.mechanics} />
                        </>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}

        {orphanProjects.length > 0 && (
          <section className="org-col" aria-label="Projekty bez Installation Managera">
            <div className="org-node">
              <div>
                <strong>Bez Installation Managera</strong>
                <span className="org-node__meta">{projectsCount(orphanProjects.length)}</span>
              </div>
            </div>
            <ul className="org-branch">
              {orphanProjects.map((p) => (
                <li key={p.id} className="org-project">
                  <button type="button" className="org-project__head" onClick={() => openProject(p.id, "details")}>
                    <ProjectDot color={p.color} />
                    <span className="org-project__name">{p.name}</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>

      <section className="bench">
        <h2 className="section-title">Bez zespołu</h2>
        <p className="section-lead">
          {bench.length === 0
            ? "Każdy jest przypisany do projektu."
            : `Na przydział czeka: ${peopleCount(bench.length)}. Dodasz je w zespole projektu albo na liście ludzi.`}
        </p>
        <div className="bench__groups">
          <TeamGroup label="Team Leaderzy" people={bench.filter((e) => e.position === "TEAM_LEADER")} />
          <TeamGroup label="Elektrycy" people={bench.filter((e) => e.position === "ELECTRICIAN")} />
          <TeamGroup label="Mechanicy" people={bench.filter((e) => e.position === "MECHANIC")} />
        </div>
      </section>
    </div>
  );
}

function TeamGroup({ label, people }: { label: string; people: Employee[] }) {
  if (people.length === 0) return null;
  return (
    <div className="team-group">
      <div className="team-group__label">
        {label} <span>{people.length}</span>
      </div>
      <div className="team-group__chips">
        {people.map((p) => (
          <PersonChip key={p.id} employee={p} />
        ))}
      </div>
    </div>
  );
}
