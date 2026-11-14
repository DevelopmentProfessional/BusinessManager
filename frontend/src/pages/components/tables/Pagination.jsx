import React from "react";
import { ChevronLeftIcon, ChevronRightIcon } from "@heroicons/react/24/outline";
import Button_App from "../buttons/Button_App";

export default function Pagination({ page, totalPages, onPageChange, totalItems, pageSize, className = "" }) {
  const safePage = Math.max(1, page);
  const safeTotalPages = Math.max(1, totalPages);
  const hasSummary = Number.isFinite(totalItems) && Number.isFinite(pageSize) && pageSize > 0;
  const start = hasSummary && totalItems > 0 ? (safePage - 1) * pageSize + 1 : 0;
  const end = hasSummary ? Math.min(safePage * pageSize, totalItems) : 0;

  return (
    <nav className={`align-items-center d-flex flex-wrap gap-2 justify-content-between ${className}`.trim()} aria-label="Pagination">
      {hasSummary ? <span className="ui-small-muted">{totalItems > 0 ? `${start}-${end} of ${totalItems}` : "0 results"}</span> : <span className="ui-small-muted">Page {safePage} of {safeTotalPages}</span>}
      <div className="ui-flex-center-gap-2">
        <Button_App icon={ChevronLeftIcon} label="Previous" compact variant="secondary" onClick={() => onPageChange(Math.max(1, safePage - 1))} disabled={safePage <= 1} />
        <span className="small text-muted" aria-current="page">
          Page {safePage} of {safeTotalPages}
        </span>
        <Button_App icon={ChevronRightIcon} label="Next" compact variant="secondary" onClick={() => onPageChange(Math.min(safeTotalPages, safePage + 1))} disabled={safePage >= safeTotalPages} />
      </div>
    </nav>
  );
}
