import React, { useEffect, useState } from "react";
import { CheckIcon, XMarkIcon } from "@heroicons/react/24/outline";
import Button_Toolbar from "../buttons/Button_Toolbar";
import Footer_Actions from "../footers/Footer_Actions";
import Modal from "../modals/Modal";
import Dropdown_Custom from "./Dropdown_Custom";
import { InputCheckbox } from "../Inputs";

const EMPTY_FILTERS = {};

/**
 * Shared multi-section filter dropup.
 *
 * Each section supplies its own options and state key. The component owns the
 * draft state so Apply/Cancel behavior is consistent wherever it is used.
 */
export default function Dropup_Filter({ isOpen, onClose, sections = [], filters = EMPTY_FILTERS, onApply, onClear, title = "Filters" }) {
  const [draftFilters, setDraftFilters] = useState(filters);

  useEffect(() => {
    if (isOpen) setDraftFilters(filters);
  }, [filters, isOpen]);

  const updateSection = (key, value) => {
    setDraftFilters((previous) => ({ ...previous, [key]: value }));
  };

  const handleClear = () => {
    const cleared = sections.reduce((result, section) => ({ ...result, [section.key]: section.type === "checkbox" ? false : [] }), { ...draftFilters });
    setDraftFilters(cleared);
    onClear?.(cleared);
  };

  const handleApply = () => {
    onApply?.(draftFilters);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      contentWidth
      footer={
        <Footer_Actions
          start={<Button_Toolbar icon={CheckIcon} label="Apply" onClick={handleApply} className="btn-outline-secondary" title="Apply filters" />}
          center={<Button_Toolbar icon={XMarkIcon} label="Cancel" onClick={onClose} className="btn-outline-secondary" title="Cancel" />}
          end={<Button_Toolbar icon={XMarkIcon} label="Clear" onClick={handleClear} className="btn-outline-secondary" title="Clear all filters" />}
        />
      }
    >
      <div className="d-flex flex-column gap-3 p-0">
        {sections.map((section) => {
          if (section.visibleWhen && draftFilters[section.visibleWhen.key] !== section.visibleWhen.value) return null;
          if (section.type === "checkbox") {
            return (
              <label key={section.key} className="align-items-center d-flex gap-2 small">
                <InputCheckbox checked={Boolean(draftFilters[section.key])} onChange={(event) => updateSection(section.key, event.target.checked)} />
                <span>{section.label}</span>
              </label>
            );
          }
          return (
            <Dropdown_Custom
              key={section.key}
              value={draftFilters[section.key] || []}
              onChange={(event) => updateSection(section.key, event.target.value)}
              options={section.options || []}
              multiSelect
              floatingLabel={section.label}
              placeholder={section.placeholder || `Search ${String(section.label || "options").toLowerCase()}...`}
              className="ui-control-sm"
            />
          );
        })}
        <div className="mt-2 small text-muted">Select one or more options, then choose Apply.</div>
      </div>
    </Modal>
  );
}
