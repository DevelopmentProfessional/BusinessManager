import React, { useState, useMemo } from 'react';
import { 
  PencilIcon, 
  TrashIcon, 
  MagnifyingGlassIcon,
  ChevronUpIcon,
  ChevronDownIcon,
} from '@heroicons/react/24/outline';

export default function MobileTable({ 
  data = [], 
  columns = [], 
  onEdit, 
  onDelete, 
  loading = false,
  emptyMessage = "No data available",
  rightActions, // optional: (item) => ReactNode, renders after Edit button on right
}) {
  const [searchTerms, setSearchTerms] = useState({});
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
  const [activeSearch, setActiveSearch] = useState(null);

  // Filter and sort data
  const processedData = useMemo(() => {
    let filtered = data;

    // Apply search filters
    Object.entries(searchTerms).forEach(([columnKey, searchTerm]) => {
      if (searchTerm.trim()) {
        filtered = filtered.filter(item => {
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
        
        if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return filtered;
  }, [data, searchTerms, sortConfig]);

  const handleSort = (columnKey) => {
    setSortConfig(prev => ({
      key: columnKey,
      direction: prev.key === columnKey && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const handleSearch = (columnKey, value) => {
    setSearchTerms(prev => ({
      ...prev,
      [columnKey]: value
    }));
  };

  const toggleSearch = (columnKey) => {
    setActiveSearch(activeSearch === columnKey ? null : columnKey);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-32">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Table content area */}
      <div className="flex-1 overflow-x-auto">
        {processedData.length > 0 ? (
          <div className="min-w-full">
            {processedData.map((item, index) => (
              <div 
                key={item.id || index} 
                className="bg-white border-b border-gray-200 p-4 flex items-center gap-3"
              >
                {/* Delete button - leftmost (optional) */}
                {onDelete && (
                  <button
                    onClick={() => onDelete(item)}
                    className="flex-shrink-0 p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="Delete"
                  >
                    <TrashIcon className="h-5 w-5" />
                  </button>
                )}

                {/* Content area - flexible */}
                <div className="flex-1 grid gap-2 min-w-0" style={{ gridTemplateColumns: `repeat(${columns.length}, 1fr)` }}>
                  {columns.map((column) => (
                    <div key={column.key} className="min-w-0">
                      <div className="text-sm text-gray-900 truncate">
                        {column.render ? column.render(item[column.key], item) : item[column.key]}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Right actions: Edit (optional) + custom */}
                {onEdit && (
                  <button
                    onClick={() => onEdit(item)}
                    className="flex-shrink-0 p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    title="Edit"
                  >
                    <PencilIcon className="h-5 w-5" />
                  </button>
                )}
                {typeof rightActions === 'function' ? rightActions(item) : null}
              </div>
            ))}
          </div>
        ) : null}
      </div>

      {/* Table footer controls - Fixed at bottom */}
      <div className="bg-white border-t border-gray-200 p-4 space-y-3">
        <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${columns.length}, 1fr)` }}>
          {columns.map((column) => (
            <div key={column.key} className="min-w-0">
              {/* Column title with search toggle */}
              <button
                onClick={() => toggleSearch(column.key)}
                className="w-full text-left text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors mb-1"
              >
                {column.title}
              </button>

              {/* Search input (when active) */}
              {activeSearch === column.key && (
                <div className="relative mb-2">
                  <input
                    type="text"
                    placeholder={`Search ${column.title.toLowerCase()}...`}
                    value={searchTerms[column.key] || ''}
                    onChange={(e) => handleSearch(column.key, e.target.value)}
                    className="w-full pl-8 pr-3 py-1 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                    autoFocus
                  />
                  <MagnifyingGlassIcon className="absolute left-2 top-1.5 h-4 w-4 text-gray-400" />
                </div>
              )}

              {/* Sort toggle */}
              <button
                onClick={() => handleSort(column.key)}
                className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 transition-colors"
              >
                Sort
                {sortConfig.key === column.key ? (
                  sortConfig.direction === 'asc' ? (
                    <ChevronUpIcon className="h-3 w-3" />
                  ) : (
                    <ChevronDownIcon className="h-3 w-3" />
                  )
                ) : (
                  <div className="h-3 w-3" />
                )}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
