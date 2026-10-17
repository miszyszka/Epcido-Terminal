import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronDown } from "lucide-react";
import { useModel, useUser } from "../../app/DataContext";
import { useUi } from "../../app/UiContext";
import { useNow } from "../../app/hooks";
import { MissedMark } from "../../components/DayCell";
import { CategoryTag, PositionMark, ProjectDot } from "../../components/PersonBadge";
import { projectStats } from "../../domain/aggregate";
import { PROJECT_STATUS_LABEL } from "../../domain/labels";
import { timesheetsNom } from "../../domain/workflow";
import { isoWeek } from "../../lib/dates";
import { canEditProject } from "../../domain/permissions";
import type { Project } from "../../domain/types";
import { formatDate, type ISODate } from "../../lib/dates";
import { cityOf } from "../../lib/search";
import { ProjectDays } from "./ProjectDays";

interface ProjectCardProps {
  project: Project;
  days: ISODate[];
  today: ISODate;
  variant: "compact" | "detailed";
  /** Pokaż tylko te osoby (wyszukiwanie po nazwisku) */
  only?: Set<string> | null;
  /** Bez nagłówka dni — nagłówek jest wspólny, przyklejony u góry strony */
  hideDaysHead?: boolean;
  collapsed?: boolean;
  onToggle?: () => void;
}

/** Karta projektu: nagłówek z liczbami + siatka dni. Ta sama na mapie i osi czasu. */
export function ProjectCard({ project, days, today, variant, only, collapsed, onToggle, hideDaysHead }: ProjectCardProps) {
  const model = useModel();
  const user = useUser();
  const { openProject } = useUi();
  const navigate = useNavigate();
  const from = days[0];
  const to = days[days.length - 1];
  const rows = useMemo(
    () => model.rows(project.id, from, to).filter((r) => !only || only.has(r.employee.id)),
    [model, project.id, from, to, only]
  );
  const now = useNow();
  const stats = useMemo(() => projectStats(model, project.id, now, from, to), [model, project.id, now, from, to]);
  const supervisor = project.supervisorId ? model.employeeById.get(project.supervisorId) : null;
  const editable = canEditProject(user, project);

  const openTitle = () => {
    if (editable) openProject(project.id);
    else if (variant === "compact") navigate(`/os-czasu?projekt=${project.id}`);
  };

  return (
    <article className={`pcard pcard--${variant}`}>
      <header className="pcard__head">
        {onToggle && (
          <button
            type="button"
            className={`disclosure ${collapsed ? "is-collapsed" : ""}`}
            onClick={onToggle}
            aria-expanded={!collapsed}
            aria-label={`${collapsed ? "Rozwiń" : "Zwiń"} ${project.name}`}
          >
            <ChevronDown size={18} />
          </button>
        )}
        <div className="pcard__id">
          <button type="button" className="pcard__title" onClick={openTitle} disabled={!editable && variant !== "compact"}>
            <ProjectDot color={project.color} />
            <span>{project.name}</span>
          </button>
          <span className="pcard__number">{project.number}</span>
          <CategoryTag category={project.category} />
        </div>
        <div className="pcard__meta">
          <span>
            {project.customerName}, {cityOf(project)}
          </span>
          {supervisor && (
            <span className="pcard__lead">
              <PositionMark employee={supervisor} />
              {supervisor.name}
            </span>
          )}
        </div>
        {/* Po prawej tylko to, co wymaga działania: do zatwierdzenia i niewysłany tydzień. Wysłane widać po ptaszkach i paskach. */}
        <div className="pcard__stats">
          {project.status === "PLANNED" && (
            <span className="badge badge--status">
              {PROJECT_STATUS_LABEL.PLANNED}, start {formatDate(project.startDate)}
            </span>
          )}
          {stats.pending > 0 && <span className="badge badge--pending">Do zatwierdzenia: {timesheetsNom(stats.pending)}</span>}
          {stats.withheldWeeks.length > 0 && (
            <span className="badge badge--alarm" data-tip="Timesheet z błędami (brak zatwierdzenia albo wpisu) — nie poszedł do Dataverse. Poprawia administrator.">
              <MissedMark size={10} />
              Nie wysłany: {stats.withheldWeeks.map((w) => `tydz. ${isoWeek(w).week}`).join(", ")}
            </span>
          )}
        </div>
      </header>
      {!collapsed && (
        <div className="pcard__scroll">
          <ProjectDays project={project} rows={rows} days={days} today={today} variant={variant} hideHead={hideDaysHead} />
        </div>
      )}
    </article>
  );
}
