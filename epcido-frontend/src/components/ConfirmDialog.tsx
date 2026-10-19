import { useUi } from "../app/UiContext";
import { Dialog } from "./Dialog";

/**
 * Pytanie przed zapisem. Nic nie trafia do bazy, zanim ktoś tego nie potwierdzi —
 * w szczególności przesunięcia ludzi w planie, gdzie jedno kliknięcie zmienia tydzień kilku osobom.
 */
export function ConfirmHost() {
  const { confirmState, resolveConfirm } = useUi();
  if (!confirmState) return null;
  const { title, lines, description, confirmLabel = "Zapisz zmiany", cancelLabel = "Wróć do edycji", tone = "default" } = confirmState;
  return (
    <Dialog
      title={title}
      description={description}
      onClose={() => resolveConfirm(false)}
      footer={
        <>
          <button type="button" className="btn btn--quiet" onClick={() => resolveConfirm(false)}>
            {cancelLabel}
          </button>
          <button type="button" className={`btn ${tone === "danger" ? "btn--danger" : "btn--primary"}`} onClick={() => resolveConfirm(true)} autoFocus>
            {confirmLabel}
          </button>
        </>
      }
    >
      {lines && lines.length > 0 && (
        <ul className="confirm-list">
          {lines.map((l, i) => (
            <li key={`${i}-${l}`}>{l}</li>
          ))}
        </ul>
      )}
    </Dialog>
  );
}
