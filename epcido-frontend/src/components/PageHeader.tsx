import type { ReactNode } from "react";

interface PageHeaderProps {
  title: string;
  actions?: ReactNode;
}

/** Tytuł ekranu — bez podpisu pod spodem (brandbook 4.1). Akcje po prawej. */
export function PageHeader({ title, actions }: PageHeaderProps) {
  return (
    <header className="page-head">
      <h1 className="page-title">{title}</h1>
      {actions && <div className="page-head__actions">{actions}</div>}
    </header>
  );
}
