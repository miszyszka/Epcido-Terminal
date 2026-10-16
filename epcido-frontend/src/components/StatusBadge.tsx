import type { TimeEntryStatus } from "../types";

const LABELS: Record<TimeEntryStatus, string> = {
  DRAFT: "Szkic",
  SUBMITTED: "Wysłane — czeka na SV",
  SUPERVISOR_APPROVED: "Zaakceptowane przez SV — czeka na PM",
  PM_APPROVED: "Zaakceptowane przez PM",
  REJECTED: "Odrzucone",
};

const CLASS: Record<TimeEntryStatus, string> = {
  DRAFT: "badge-draft",
  SUBMITTED: "badge-submitted",
  SUPERVISOR_APPROVED: "badge-supervisor-approved",
  PM_APPROVED: "badge-pm-approved",
  REJECTED: "badge-rejected",
};

export function StatusBadge({ status }: { status: TimeEntryStatus }) {
  return <span className={`badge ${CLASS[status]}`}>{LABELS[status]}</span>;
}
