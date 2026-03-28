import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDownIcon } from "@heroicons/react/24/outline";
import { matchesWildcardText } from "../../utils/searchableSelect";

const PANEL_SIDE_MARGIN = 12;
const PANEL_GAP = 8;
const PANEL_MAX_HEIGHT = 320;
const PANEL_MIN_WIDTH = 220;

function isSearchableSelect(select) {
  return select instanceof HTMLSelectElement && !select.disabled && !select.multiple && select.size <= 1 && select.dataset.searchableSelectDisabled !== "true" && !select.closest('[data-searchable-select-disabled="true"]');
}

function getSelectOptions(select) {
  return Array.from(select.options).map((option, index) => ({
    index,
    value: option.value,
    label: (option.label || option.textContent || "").trim(),
    disabled: option.disabled,
    selected: option.selected,
  }));
}

function getSelectLabel(select) {
  if (select.labels?.length) {
    return Array.from(select.labels)
      .map((label) => label.textContent || "")
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
  }

  return select.getAttribute("aria-label") || select.name || "dropdown";
}

function getFirstEnabledIndex(options) {
  return options.findIndex((option) => !option.disabled);
}

function getNextEnabledIndex(options, startIndex, direction) {
  if (options.length === 0) {
    return -1;
  }

  let currentIndex = startIndex;
  for (let index = 0; index < options.length; index += 1) {
    currentIndex = (currentIndex + direction + options.length) % options.length;
    if (!options[currentIndex]?.disabled) {
      return currentIndex;
    }
  }

  return -1;
}

function getPanelStyle(select) {
  const rect = select.getBoundingClientRect();
  const width = Math.min(Math.max(rect.width, PANEL_MIN_WIDTH), window.innerWidth - PANEL_SIDE_MARGIN * 2);
  const left = Math.min(Math.max(rect.left, PANEL_SIDE_MARGIN), window.innerWidth - width - PANEL_SIDE_MARGIN);
  const maxHeight = Math.max(180, Math.min(PANEL_MAX_HEIGHT, window.innerHeight - rect.bottom - 24));

  return {
    left,
    top: Math.min(rect.bottom + PANEL_GAP, window.innerHeight - maxHeight - PANEL_SIDE_MARGIN),
    width,
    maxHeight,
  };
}

export default function SearchableSelectOverlay() {
  const [activeSelect, setActiveSelect] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [options, setOptions] = useState([]);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [panelStyle, setPanelStyle] = useState(null);
  const inputRef = useRef(null);
  const optionRefs = useRef([]);

  const closeOverlay = useCallback(() => {
    setActiveSelect(null);
    setOptions([]);
    setSearchTerm("");
    setHighlightedIndex(-1);
    setPanelStyle(null);
    optionRefs.current = [];
  }, []);

  const openOverlay = useCallback((select, initialSearch = "") => {
    if (!isSearchableSelect(select)) {
      return;
    }

    const nextOptions = getSelectOptions(select);
    const selectedIndex = nextOptions.findIndex((option) => option.selected && !option.disabled);

    setActiveSelect(select);
    setOptions(nextOptions);
    setSearchTerm(initialSearch);
    setPanelStyle(getPanelStyle(select));
    setHighlightedIndex(selectedIndex >= 0 ? selectedIndex : getFirstEnabledIndex(nextOptions));
  }, []);

  const filteredOptions = useMemo(() => {
    return options.filter((option) => matchesWildcardText(searchTerm, option.label, option.value));
  }, [options, searchTerm]);

  const selectedOption = useMemo(() => {
    return options.find((option) => option.selected) || null;
  }, [options]);

  useEffect(() => {
    if (!activeSelect) {
      return undefined;
    }

    const focusTimer = window.setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    }, 0);

    return () => {
      window.clearTimeout(focusTimer);
    };
  }, [activeSelect]);

  useEffect(() => {
    if (!activeSelect) {
      return undefined;
    }

    const handleViewportChange = () => {
      if (!document.contains(activeSelect)) {
        closeOverlay();
        return;
      }

      setPanelStyle(getPanelStyle(activeSelect));
    };

    const handleScroll = () => closeOverlay();

    window.addEventListener("resize", handleViewportChange);
    window.addEventListener("scroll", handleScroll, true);

    return () => {
      window.removeEventListener("resize", handleViewportChange);
      window.removeEventListener("scroll", handleScroll, true);
    };
  }, [activeSelect, closeOverlay]);

  useEffect(() => {
    const handleMouseDown = (event) => {
      const select = event.target instanceof Element ? event.target.closest("select") : null;
      if (!select || !isSearchableSelect(select)) {
        return;
      }

      event.preventDefault();
      openOverlay(select);
    };

    const handleKeyDown = (event) => {
      const select = event.target;
      if (!isSearchableSelect(select)) {
        return;
      }

      const isPlainCharacter = event.key.length === 1 && !event.altKey && !event.ctrlKey && !event.metaKey;
      const isOpenKey = event.key === "ArrowDown" || event.key === "ArrowUp" || event.key === "Enter" || event.key === " ";
      if (!isPlainCharacter && !isOpenKey) {
        return;
      }

      event.preventDefault();
      openOverlay(select, isPlainCharacter ? event.key : "");
    };

    document.addEventListener("mousedown", handleMouseDown, true);
    document.addEventListener("touchstart", handleMouseDown, { capture: true, passive: false });
    document.addEventListener("keydown", handleKeyDown, true);

    return () => {
      document.removeEventListener("mousedown", handleMouseDown, true);
      document.removeEventListener("touchstart", handleMouseDown, { capture: true });
      document.removeEventListener("keydown", handleKeyDown, true);
    };
  }, [openOverlay]);

  useEffect(() => {
    if (filteredOptions.length === 0) {
      setHighlightedIndex(-1);
      return;
    }

    setHighlightedIndex((currentIndex) => {
      if (filteredOptions[currentIndex] && !filteredOptions[currentIndex].disabled) {
        return currentIndex;
      }

      const selectedIndex = filteredOptions.findIndex((option) => option.selected && !option.disabled);
      if (selectedIndex >= 0) {
        return selectedIndex;
      }

      return getFirstEnabledIndex(filteredOptions);
    });
  }, [filteredOptions]);

  useEffect(() => {
    if (highlightedIndex < 0) {
      return;
    }

    optionRefs.current[highlightedIndex]?.scrollIntoView({ block: "nearest" });
  }, [highlightedIndex]);

  const commitSelection = useCallback(
    (option) => {
      if (!activeSelect || option.disabled) {
        return;
      }

      if (activeSelect.value !== option.value) {
        activeSelect.value = option.value;
        activeSelect.dispatchEvent(new Event("input", { bubbles: true }));
        activeSelect.dispatchEvent(new Event("change", { bubbles: true }));
      }

      closeOverlay();
      window.setTimeout(() => {
        activeSelect.focus({ preventScroll: true });
      }, 0);
    },
    [activeSelect, closeOverlay]
  );

  const handleInputKeyDown = (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      closeOverlay();
      activeSelect?.focus({ preventScroll: true });
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setHighlightedIndex((currentIndex) => getNextEnabledIndex(filteredOptions, currentIndex, 1));
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlightedIndex((currentIndex) => getNextEnabledIndex(filteredOptions, currentIndex, -1));
      return;
    }

    if (event.key === "Enter" && highlightedIndex >= 0) {
      event.preventDefault();
      commitSelection(filteredOptions[highlightedIndex]);
    }
  };

  if (!activeSelect || !panelStyle) {
    return null;
  }

  const label = getSelectLabel(activeSelect);

  return createPortal(
    <div className="searchable-select-overlay-root">
      <button type="button" className="searchable-select-backdrop" aria-label="Close searchable dropdown" onClick={closeOverlay} />
      <div className="searchable-select-panel" style={panelStyle} role="dialog" aria-modal="true" aria-label={label}>
        <div className="searchable-select-panel-header">
          <div className="searchable-select-input-shell">
            <input ref={inputRef} type="search" value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} onKeyDown={handleInputKeyDown} className="form-control searchable-select-input" placeholder={label ? `Search ${label}` : "Search options"} />
            <ChevronDownIcon className="searchable-select-input-icon" />
          </div>
          {selectedOption && !searchTerm && <div className="searchable-select-current-value">Selected: {selectedOption.label || "Blank value"}</div>}
        </div>

        <div className="searchable-select-options" role="listbox" aria-label={label}>
          {filteredOptions.length === 0 ? (
            <div className="searchable-select-empty-state">No matches found</div>
          ) : (
            filteredOptions.map((option, index) => {
              const isHighlighted = index === highlightedIndex;
              const isSelected = option.selected;

              return (
                <button
                  key={`${option.value}-${option.index}`}
                  ref={(element) => {
                    optionRefs.current[index] = element;
                  }}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  className={["searchable-select-option", isSelected ? "is-selected" : "", isHighlighted ? "is-highlighted" : ""].filter(Boolean).join(" ")}
                  disabled={option.disabled}
                  onClick={() => commitSelection(option)}
                  onMouseEnter={() => setHighlightedIndex(index)}
                >
                  <span className="searchable-select-option-label">{option.label || "Blank value"}</span>
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
