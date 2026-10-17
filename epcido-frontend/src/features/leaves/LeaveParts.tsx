import { ABSENCE_LABEL, ABSENCE_SHORT } from "../../domain/labels";
import type { LeaveRequest } from "../../domain/types";
import { formatDate, formatTimestamp } from "../../lib/dates";

/** „12 – 16 paź 2026" albo „12 paź 2026". */
export function leaveDates(l: Pick<LeaveRequest, "from" | "to">): string {
  if (l.from === l.to) return formatDate(l.from);
  const a = formatDate(l.from);
  const b = formatDate(l.to);
  return l.from.slice(0, 4) === l.to.slice(0, 4) ? `${a.replace(/ \d{4}$/, "")} – ${b}` : `${a} – ${b}`;
}

/** Stan wniosku jako plakietka: czeka (żółta), zaakceptowany (zielona), L4 (terakota), odrzucony / anulowany. */
export function LeaveStatusBadge({ leave }: { leave: LeaveRequest }) {
  if (leave.type === "SICK" && leave.status === "APPROVED")
    return (
      <span className="badge badge--absent" data-tip={leave.confirmedByName ? `Dokument potwierdził ${leave.confirmedByName}` : "Dokument czeka na potwierdzenie HR"}>
        L4{leave.confirmedAt ? " · potwierdzone" : " · dokument do HR"}
      </span>
    );
  if (leave.status === "PENDING") return <span className="badge badge--pending">Czeka na akceptację</span>;
  if (leave.status === "APPROVED")
    return (
      <span className="badge badge--approved" data-tip={leave.decidedAt ? formatTimestamp(leave.decidedAt) : undefined}>
        Zaakceptował {leave.decidedByName ?? "—"}
      </span>
    );
  if (leave.status === "REJECTED") return <span className="badge badge--neutral">Odrzucony</span>;
  return <span className="badge badge--neutral">Anulowany</span>;
}

export function LeaveKind({ leave }: { leave: LeaveRequest }) {
  return (
    <span className={`leave-kind leave-kind--${leave.type.toLowerCase()}`} data-tip={ABSENCE_LABEL[leave.type]}>
      {ABSENCE_SHORT[leave.type]}
    </span>
  );
}
