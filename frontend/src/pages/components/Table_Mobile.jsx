import React, { useState, useMemo } from "react";
import { PencilIcon, XMarkIcon, MagnifyingGlassIcon, ChevronUpIcon, ChevronDownIcon } from "@heroicons/react/24/outline";
import Gate_Permission from "./Gate_Permission";
import Button_Icon from "./Button_Icon";

export default function Table_Mobile({
  data = [],
  columns = [],
  onEdit,
  onDelete,
  loading = false,
  emptyMessage = "No data available",
  rightActions, // optional: (item) => ReactNode, renders after Edit button on right
  editPermission, // optional: { page, permission } for edit button
  deletePermission, // optional: { page, permission } for delete button
}) {
  const [searchTerms, setSearchTerms] = useState({});
  const [sortConfig, setSortConfig] = useState({ key: null, direction: "asc" });
  const [activeSearch, setActiveSearch] = useState(null);

  // Filter and sort data
  const processedData = useMemo(() => {
    let filtered = data;

    // Apply search filters
    Object.entries(searchTerms).forEach(([columnKey, searchTerm]) => {
      if (searchTerm.trim()) {
        filtered = filtered.filter((item) => {
          const value = item[columnKey];
          return value && value.toString().toLowerCase().includes(searchTerm.toLowerCase());
        });
      }
    });

    // Apply sorting
    if (sortConfig.key) {
      filtered = [...filtered].sort((a, b) => {
        const aVal = a[sortConfig.key];
        const bVal = b[sortConfig.key];

        if (aVal < bVal) return sortConfig.direction === "asc" ? -1 : 1;
        if (aVal > bVal) return sortConfig.direction === "asc" ? 1 : -1;
        return 0;
      });
    }

    return filtered;
  }, [data, searchTerms, sortConfig]);

  const handleSort = (columnKey) => {
    setSortConfig((prev) => ({
      key: columnKey,
      direction: prev.key === columnKey && prev.direction === "asc" ? "desc" : "asc",
    }));
  };

  const handleSearch = (columnKey, value) => {
    setSearchTerms((prev) => ({
      ...prev,
      [columnKey]: value,
    }));
  };

  const toggleSearch = (columnKey) => {
    setActiveSearch(activeSearch === columnKey ? null : columnKey);
  };

  if (loading) {
    return (
      <div className="flex h-32 items-center justify-center">
        <div className="animate-spin border-b-2 border-blue-600 h-8 rounded-full w-8"></div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Table content area - scrolls internally, does not make page scrollable */}
      <div className="flex-1 min-h-0 overflow-auto">
        {processedData.length > 0 ? (
          <div className="min-w-full">
            {processedData.map((item, index) => (
              <div key={item.id || index} className="bg-white border-b border-gray-200 flex gap-3 items-center p-1">
                {/* Delete button - leftmost (optional) */}
                {onDelete && (
                  <Gate_Permission page={deletePermission?.page} permission={deletePermission?.permission} hide={!deletePermission}>
                    <Button_Icon icon={XMarkIcon} label="Delete" onClick={() => onDelete(item)} variant="danger" className="!p-2 flex-shrink-0" />
                  </Gate_Permission>
                )}

                {/* Content area - flexible */}
                <div className="flex-1 gap-2 grid min-w-0" style={{ gridTemplateColumns: `repeat(${columns.length}, 1fr)` }}>
                  {columns.map((column) => (
                    <div key={column.key} className="min-w-0">
                      <div className="text-gray-900 text-sm truncate">{column.render ? column.render(item[column.key], item) : item[column.key]}</div>
                    </div>
                  ))}
                </div>

                {/* Right actions: Edit (optional) + custom */}
                {onEdit && (
                  <Gate_Permission page={editPermission?.page} permission={editPermission?.permission} hide={!editPermission}>
                    <Button_Icon icon={PencilIcon} label="Edit" onClick={() => onEdit(item)} variant="ghost" className="!p-2 dark:hover:bg-blue-900/30 dark:text-blue-400 flex-shrink-0 hover:bg-blue-50 text-blue-600" />
                  </Gate_Permission>
                )}
                {typeof rightActions === "function" ? rightActions(item) : null}
              </div>
            ))}
          </div>
        ) : null}
      </div>

      {/* Table footer controls - fixed at bottom, does not scroll */}
      <footer className="app-footer-search app-footer-shell bg-white border-gray-200 border-t dark:bg-gray-800 dark:border-gray-700 flex-shrink-0">
        <div className="app-footer-padding app-standard-footer">
          <div className="app-footer-stack">
            <div className="gap-3 grid" style={{ gridTemplateColumns: `repeat(${columns.length}, 1fr)` }}>
              {columns.map((column) => (
                <div key={column.key} className="min-w-0">
                  {/* Column title with search toggle */}
                  <button onClick={() => toggleSearch(column.key)} className="font-medium hover:text-gray-900 mb-1 text-gray-700 text-left text-sm transition-colors w-full">
                    {column.title}
                  </button>

                  {/* Search input (when active) */}
                  {activeSearch === column.key && (
                    <div className="mb-2 relative">
                      <input
                        type="text"
                        placeholder={`Search ${column.title.toLowerCase()}...`}
                        value={searchTerms[column.key] || ""}
                        onChange={(e) => handleSearch(column.key, e.target.value)}
                        className="app-search-input border border-gray-300 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 pl-1 pr-1 w-full"
                        autoFocus
                      />
                      <MagnifyingGlassIcon className="absolute h-4 left-2 text-gray-400 top-1.5 w-4" />
                    </div>
                  )}

                  {/* Sort toggle */}
                  <button onClick={() => handleSort(column.key)} className="flex gap-1 hover:text-gray-700 items-center text-gray-500 text-xs transition-colors">
                    Sort
                    {sortConfig.key === column.key ? sortConfig.direction === "asc" ? <ChevronUpIcon className="h-3 w-3" /> : <ChevronDownIcon className="h-3 w-3" /> : <div className="h-3 w-3" />}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
