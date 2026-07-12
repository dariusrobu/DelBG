"use client";

import { useState, useEffect, useCallback } from "react";
import { MenuItem } from "@/types";
import { getAllMenuItems, deleteMenuItem } from "@/lib/menus";

interface MenuListProps {
  onEdit: (item: MenuItem) => void;
  onAddNew: () => void;
}

export default function MenuList({ onEdit, onAddNew }: MenuListProps) {
  const [items, setItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);

  const loadItems = useCallback(async () => {
    setLoading(true);
    const data = await getAllMenuItems();
    data.sort((a, b) => b.date.localeCompare(a.date));
    setItems(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    loadItems();
  }, [loadItems]);

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this menu item?")) return;
    await deleteMenuItem(id);
    loadItems();
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr + "T00:00:00");
    return d.toLocaleDateString("ro-RO", {
      weekday: "short",
      day: "numeric",
      month: "short",
    });
  };

  return (
    <div className="space-y-3">
      {/* Add button */}
      <button
        onClick={onAddNew}
        className="w-full py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
      >
        + Add Today&apos;s Menu
      </button>

      {/* List */}
      {loading ? (
        <div className="text-center py-8 text-gray-400 text-sm">Loading...</div>
      ) : items.length === 0 ? (
        <div className="text-center py-8 text-gray-400 text-sm">
          No menus yet. Add today&apos;s menu!
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <div
              key={item.id}
              className="bg-white border border-gray-200 rounded-lg p-3 flex items-center justify-between"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {item.name}
                </p>
                <p className="text-xs text-gray-500">{formatDate(item.date)}</p>
                {item.description && (
                  <p className="text-xs text-gray-400 truncate mt-0.5">
                    {item.description}
                  </p>
                )}
              </div>
              <div className="flex gap-1 ml-2 shrink-0">
                <button
                  onClick={() => onEdit(item)}
                  className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                  aria-label="Edit"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </button>
                <button
                  onClick={() => handleDelete(item.id)}
                  className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  aria-label="Delete"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
