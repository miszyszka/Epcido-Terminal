import { useModel, useUser } from "../../app/DataContext";
import { useUi } from "../../app/UiContext";
import { PageHeader } from "../../components/PageHeader";
import { PositionMark, ProjectDot } from "../../components/PersonBadge";
import type { Employee } from "../../domain/types";
import { can, canEditProject, visibleProjects as allowedProjects } from "../../domain/permissions";
import { todayISO } from "../../lib/dates";
import { people as peopleCount, projectsCount } from "../../lib/text";

/** Drzewko podległości: Installation Manager → projekt i Supervisor → zespół. */
export function StructureView() {
  const model = useModel();
  const user = useUser();
  const { openProject } = useUi();
  const today = todayISO();
  const allowed = new Set(allowedProjects(model, user).map((p) => p.id));
  const scoped = model.projects.filter((p) => allowed.has(p.id));
  const ims = model.employees.filter((e) => e.position === "INSTALLATION_MANAGER" && scoped.some((p) => p.installationManagerId === e.id));
  const orphanProjects = scoped.filter((p) => !p.installationManagerId);
  const bench = model.employees.filter(
    (e) =>
      (e.position === "TEAM_LEADER" || e.position === "ELECTRICIAN" || e.position === "MECHANIC") &&
      !model.activeAssignment(e.id, today)
  );
  const showBench = can(user, "staffing.plan") || can(user, "team.plan");
  const open = (id: string) => {
    const p = model.projectById.get(id);
    if (p && canEditProject(user, p)) openProject(id);
  };

  const visibleProjects = (projectIds: string[]) => projectIds.map((id) => model.team(id)!);

  return (
    <div className="page">
      <PageHeader title="Struktura zespołów" />

      <div className="org">
        {ims.map((im) => {
          const projectIds = scoped.filter((p) => p.installationManagerId === im.id).map((p) => p.id);
          const teams = visibleProjects(projectIds);
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
                    <button type="button" className="org-project__head" onClick={() => open(t.project.id)}>
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
                        <button type="button" className="btn btn--quiet btn--sm" onClick={() => open(t.project.id)}>
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
                  <button type="button" className="org-project__head" onClick={() => open(p.id)}>
                    <ProjectDot color={p.color} />
                    <span className="org-project__name">{p.name}</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>

      {showBench && (
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
      )}
    </div>
  );
}

/** Grupa osób — zawsze jedna osoba w wierszu, grupy jedna pod drugą. */
function TeamGroup({ label, people }: { label: string; people: Employee[] }) {
  if (people.length === 0) return null;
  return (
    <div className="team-group">
      <div className="team-group__label">
        {label} <span>{people.length}</span>
      </div>
      <ul className="team-group__list">
        {people.map((p) => (
          <li key={p.id}>
            <PositionMark employee={p} />
            <span>{p.name}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
