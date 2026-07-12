"use client";

import { useState, useEffect, useCallback } from "react";
import { DailyManifest } from "@/types";
import {
  getAllManifests,
  cloneMostRecentManifest,
  deleteManifest,
} from "@/lib/manifests";

interface ManifestListProps {
  onEdit: (manifest: DailyManifest) => void;
  onDrive: (manifestId: string) => void;
  onAddNew: () => void;
}

export default function ManifestList({ onEdit, onDrive, onAddNew }: ManifestListProps) {
  const [manifests, setManifests] = useState<DailyManifest[]>([]);
  const [loading, setLoading] = useState(true);

  const loadManifests = useCallback(async () => {
    setLoading(true);
    const data = await getAllManifests();
    setManifests(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    loadManifests();
  }, [loadManifests]);

  const handleClone = async () => {
    const today = new Date().toISOString().split("T")[0];
    const manifest = await cloneMostRecentManifest(today);
    onEdit(manifest);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this manifest?")) return;
    await deleteManifest(id);
    loadManifests();
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr + "T00:00:00");
    return d.toLocaleDateString("ro-RO", {
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  return (
    <div className="space-y-3">
      {/* Action buttons */}
      <div className="flex gap-2">
        <button
          onClick={handleClone}
          className="flex-1 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
        >
          Clone Most Recent
        </button>
        <button
          onClick={onAddNew}
          className="py-2.5 px-4 bg-gray-200 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-300 transition-colors"
        >
          Blank
        </button>
      </div>

      {/* List */}
      {loading ? (
        <div className="text-center py-8 text-gray-400 text-sm">Loading...</div>
      ) : manifests.length === 0 ? (
        <div className="text-center py-8 text-gray-400 text-sm">
          No manifests yet. Create your first one!
        </div>
      ) : (
        <div className="space-y-2">
          {manifests.map((manifest) => {
            const delivered = manifest.stops.filter(
              (s) => s.status === "delivered"
            ).length;
            const skipped = manifest.stops.filter(
              (s) => s.status === "skipped"
            ).length;
            const total = manifest.stops.length;

            return (
              <div
                key={manifest.id}
                className="bg-white border border-gray-200 rounded-lg p-3"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {formatDate(manifest.date)}
                    </p>
                    <p className="text-xs text-gray-500">
                      {total} stop{total !== 1 ? "s" : ""}
                      {delivered > 0 && (
                        <span className="text-green-600"> · {delivered} delivered</span>
                      )}
                      {skipped > 0 && (
                        <span className="text-red-500"> · {skipped} skipped</span>
                      )}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => onDrive(manifest.id)}
                      className="p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                      aria-label="Drive this route"
                      title="Start driving"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                      </svg>
                    </button>
                    <button
                      onClick={() => onEdit(manifest)}
                      className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      aria-label="Edit"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => handleDelete(manifest.id)}
                      className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      aria-label="Delete"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
