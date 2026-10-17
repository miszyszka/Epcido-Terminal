import { useMemo, useState } from "react";
import { Download, FileSpreadsheet } from "lucide-react";
import { useData, useModel, useUser } from "../../app/DataContext";
import { useNow } from "../../app/hooks";
import { DatePicker } from "../../components/DatePicker";
import { PageHeader } from "../../components/PageHeader";
import { CategoryTag, ProjectDot } from "../../components/PersonBadge";
import { Segmented } from "../../components/Segmented";
import { categories } from "../../domain/labels";
import { buildReport, REPORTS, type CellValue, type ReportColumn, type ReportId, type ReportOptions } from "../../domain/reports";
import type { Trade } from "../../domain/types";
import { addDays, formatDate, startOfWeek, toISO, todayISO, type ISODate } from "../../lib/dates";

type Preset = "lastWeek" | "thisMonth" | "lastMonth" | "quarter" | "custom";

function presetRange(p: Preset, today: ISODate): [ISODate, ISODate] | null {
  const d = new Date(`${today}T12:00:00`);
  switch (p) {
    case "lastWeek": {
      const w = addDays(startOfWeek(today), -7);
      return [w, addDays(w, 6)];
    }
    case "thisMonth":
      return [toISO(new Date(d.getFullYear(), d.getMonth(), 1)), today];
    case "lastMonth":
      return [toISO(new Date(d.getFullYear(), d.getMonth() - 1, 1)), toISO(new Date(d.getFullYear(), d.getMonth(), 0))];
    case "quarter":
      return [addDays(today, -90), today];
    default:
      return null;
  }
}

const PREVIEW_ROWS = 8;

/**
 * Raporty do Excela: wybór raportu, zakresu dat, projektów, branży, umowy i stanu godzin; podgląd i pobranie .xlsx.
 * Każde pobranie zostaje w dzienniku zmian (kto, kiedy, jaki raport i zakres).
 */
export function ReportsView() {
  const model = useModel();
  const user = useUser();
  const data = useData();
  const now = useNow();
  const today = todayISO();
  const [report, setReport] = useState<ReportId>("hours");
  const [preset, setPreset] = useState<Preset>("lastWeek");
  const initial = presetRange("lastWeek", today)!;
  const [from, setFrom] = useState<ISODate>(initial[0]);
  const [to, setTo] = useState<ISODate>(initial[1]);
  const [category, setCategory] = useState<string>("all");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [trade, setTrade] = useState<"all" | Trade>("all");
  const [employment, setEmployment] = useState<"all" | "epcido" | "agency">("all");
  const [status, setStatus] = useState<"all" | "approved" | "sent">("all");
  const [busy, setBusy] = useState(false);
  const meta = REPORTS.find((r) => r.id === report)!;
  const uses = (k: keyof ReportOptions) => meta.uses.includes(k);

  const projectChoices = model.projects.filter((p) => category === "all" || p.category === category);
  const projectIds = picked.size ? [...picked] : category === "all" ? [] : projectChoices.map((p) => p.id);
  const options: ReportOptions = { from, to, projectIds, trade, employment, status };
  const result = useMemo(() => buildReport(model, report, options, now), [model, report, from, to, projectIds.join(","), trade, employment, status, now]); // eslint-disable-line react-hooks/exhaustive-deps

  const applyPreset = (p: Preset) => {
    setPreset(p);
    const r = presetRange(p, today);
    if (r) {
      setFrom(r[0]);
      setTo(r[1]);
    }
  };

  async function download() {
    setBusy(true);
    try {
      const { default: writeXlsxFile } = await import("write-excel-file/browser");
      const header = result.columns.map((c) => ({ value: c.label, fontWeight: "bold" as const, backgroundColor: "#EAF1F0", textColor: "#0F3D3A" }));
      const rows = result.rows.map((r) => r.map((v, i) => cell(v, result.columns[i])));
      const scope = [
        uses("from") ? `${formatDate(from)} – ${formatDate(to)}` : null,
        projectIds.length ? `${projectIds.length} projektów` : uses("projectIds") ? "wszystkie projekty" : null,
      ]
        .filter(Boolean)
        .join(", ");
      const fileName = `epcido-${report}-${uses("from") ? `${from}_${to}` : today}.xlsx`;
      await writeXlsxFile([header, ...rows], {
        sheet: result.title,
        columns: result.columns.map((c) => ({ width: c.width })),
        stickyRowsCount: 1,
      }).toFile(fileName);
      await data.logReport(`Pobrano raport „${meta.title}” (${result.rows.length} wierszy${scope ? `; ${scope}` : ""}) — ${user.name}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page reports">
      <PageHeader title="Raporty" />
      <div className="reports__layout">
        <nav className="reports__list" aria-label="Rodzaj raportu">
          {REPORTS.map((r) => (
            <button key={r.id} type="button" className={`report-tile ${r.id === report ? "is-active" : ""}`} onClick={() => setReport(r.id)} aria-pressed={r.id === report}>
              <FileSpreadsheet size={18} aria-hidden />
              <span>
                <strong>{r.title}</strong>
                <span>{r.description}</span>
              </span>
            </button>
          ))}
        </nav>

        <section className="reports__main" aria-label="Opcje i podgląd">
          <div className="reports__options">
            {uses("from") && (
              <div className="ropt">
                <span className="ropt__label">Zakres dat</span>
                <Segmented<Preset>
                  label="Zakres"
                  value={preset}
                  onChange={applyPreset}
                  options={[
                    { value: "lastWeek", label: "Poprzedni tydzień" },
                    { value: "thisMonth", label: "Ten miesiąc" },
                    { value: "lastMonth", label: "Poprzedni miesiąc" },
                    { value: "quarter", label: "90 dni" },
                    { value: "custom", label: "Własny" },
                  ]}
                />
                <div className="ropt__dates">
                  <DatePicker
                    value={from}
                    onChange={(v) => {
                      if (!v) return;
                      setPreset("custom");
                      setFrom(v);
                      if (v > to) setTo(v);
                    }}
                  />
                  <span aria-hidden>–</span>
                  <DatePicker
                    value={to}
                    min={from}
                    rangeStart={from}
                    onChange={(v) => {
                      if (!v) return;
                      setPreset("custom");
                      setTo(v);
                    }}
                  />
                </div>
              </div>
            )}
            {uses("projectIds") && (
              <div className="ropt">
                <span className="ropt__label">Projekty {picked.size ? <em>wybrano {picked.size}</em> : <em>{category === "all" ? "wszystkie" : `wszystkie ${category}`}</em>}</span>
                <Segmented<string>
                  label="Kategoria"
                  value={category}
                  onChange={(c) => {
                    setCategory(c);
                    setPicked(new Set());
                  }}
                  options={[{ value: "all", label: "Wszystkie" }, ...categories().map((c) => ({ value: c, label: c }))]}
                />
                <div className="ropt__projects">
                  {projectChoices.map((p) => {
                    const on = picked.has(p.id);
                    return (
                      <button
                        key={p.id}
                        type="button"
                        className={`chip chip--choice ${on ? "is-selected" : ""}`}
                        aria-pressed={on}
                        onClick={() =>
                          setPicked((s) => {
                            const n = new Set(s);
                            if (n.has(p.id)) n.delete(p.id);
                            else n.add(p.id);
                            return n;
                          })
                        }
                      >
                        <ProjectDot color={p.color} />
                        {p.name}
                        {category === "all" && <CategoryTag category={p.category} />}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            <div className="ropt ropt--row">
              {uses("trade") && (
                <div>
                  <span className="ropt__label">Branża</span>
                  <Segmented<"all" | Trade>
                    label="Branża"
                    value={trade}
                    onChange={setTrade}
                    options={[
                      { value: "all", label: "Obie" },
                      { value: "ELECTRICAL", label: "Elektrycy" },
                      { value: "MECHANICAL", label: "Mechanicy" },
                    ]}
                  />
                </div>
              )}
              {uses("employment") && (
                <div>
                  <span className="ropt__label">Umowa</span>
                  <Segmented<"all" | "epcido" | "agency">
                    label="Umowa"
                    value={employment}
                    onChange={setEmployment}
                    options={[
                      { value: "all", label: "Wszyscy" },
                      { value: "epcido", label: "EPCIDO" },
                      { value: "agency", label: "Agencja" },
                    ]}
                  />
                </div>
              )}
              {uses("status") && (
                <div>
                  <span className="ropt__label">Godziny</span>
                  <Segmented<"all" | "approved" | "sent">
                    label="Stan godzin"
                    value={status}
                    onChange={setStatus}
                    options={[
                      { value: "all", label: "Wszystkie" },
                      { value: "approved", label: "Zatwierdzone" },
                      { value: "sent", label: "Wysłane" },
                    ]}
                  />
                </div>
              )}
            </div>
          </div>

          <div className="reports__preview">
            <header>
              <h2>
                {meta.title} <em>{result.rows.length} wierszy</em>
              </h2>
              <button type="button" className="btn btn--primary" disabled={busy || result.rows.length === 0} onClick={download}>
                <Download size={17} aria-hidden />
                Pobierz Excel (.xlsx)
              </button>
            </header>
            {result.rows.length === 0 ? (
              <p className="empty empty--inline">Brak danych dla tych ustawień.</p>
            ) : (
              <div className="reports__table">
                <table className="table table--compact">
                  <thead>
                    <tr>
                      {result.columns.map((c) => (
                        <th key={c.label} scope="col">
                          {c.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {result.rows.slice(0, PREVIEW_ROWS).map((r, i) => (
                      <tr key={i}>
                        {r.map((v, j) => (
                          <td key={j} className={result.columns[j].kind && result.columns[j].kind !== "text" && result.columns[j].kind !== "date" ? "num" : ""}>
                            {show(v, result.columns[j])}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {result.rows.length > PREVIEW_ROWS && <p className="reports__more">… i jeszcze {result.rows.length - PREVIEW_ROWS} wierszy w pliku</p>}
              </div>
            )}
            <p className="reports__note">Pobranie raportu zostaje w dzienniku zmian. Raport zawiera dane osobowe — nie przesyłaj go poza firmę.</p>
          </div>
        </section>
      </div>
    </div>
  );
}

function show(v: CellValue, c: ReportColumn): string {
  if (v === null || v === undefined) return "—";
  if (v instanceof Date)
    return v.getUTCHours() || v.getUTCMinutes()
      ? v.toLocaleString("pl-PL", { dateStyle: "short", timeStyle: "short", timeZone: "UTC" })
      : v.toLocaleDateString("pl-PL", { timeZone: "UTC" });
  if (typeof v === "number") {
    if (c.kind === "hours") return v.toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    if (c.kind === "pct") return `${Math.round(v * 100)}%`;
    return String(v);
  }
  return v;
}

function cell(v: CellValue, c: ReportColumn) {
  if (v === null || v === undefined) return null;
  if (v instanceof Date) {
    const withTime = v.getUTCHours() !== 0 || v.getUTCMinutes() !== 0;
    return { value: v, type: Date, format: withTime ? "dd.mm.yyyy hh:mm" : "dd.mm.yyyy" };
  }
  if (typeof v === "number") {
    if (c.kind === "hours") return { value: v, type: Number, format: "0.00" };
    if (c.kind === "pct") return { value: v, type: Number, format: "0%" };
    return { value: v, type: Number };
  }
  return { value: v, type: String };
}
