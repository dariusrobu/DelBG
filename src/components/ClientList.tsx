"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Client } from "@/types";
import { getAllClients, deleteClient, searchClients, getAllTags, createClient } from "@/lib/clients";

interface ClientListProps {
  onEdit: (client: Client) => void;
  onAddNew: () => void;
}

export default function ClientList({ onEdit, onAddNew }: ClientListProps) {
  const [clients, setClients] = useState<Client[]>([]);
  const [query, setQuery] = useState("");
  const [filterTag, setFilterTag] = useState<string>("");
  const [allTags, setAllTags] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadClients = useCallback(async (q?: string) => {
    setLoading(true);
    const data = q ? await searchClients(q) : await getAllClients();
    setClients(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    loadClients(query);
    getAllTags().then(setAllTags);
  }, [loadClients, query]);

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this client?")) return;
    await deleteClient(id);
    loadClients(query);
  };

  const handleExport = () => {
    const data = JSON.stringify(clients, null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `delbg-clients-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    try {
      const text = await file.text();
      const data = JSON.parse(text);
      if (!Array.isArray(data)) {
        setImportMsg("Invalid file: expected a JSON array");
        return;
      }

      const existingIds = new Set(clients.map((c) => c.id));
      let imported = 0;
      let skipped = 0;

      for (const item of data) {
        if (!item.street || !item.number || typeof item.lat !== "number" || typeof item.lng !== "number") {
          skipped++;
          continue;
        }
        if (existingIds.has(item.id)) {
          skipped++;
          continue;
        }
        await createClient({
          name: item.name || undefined,
          street: item.street,
          number: item.number,
          bloc: item.bloc || undefined,
          apartment: item.apartment || undefined,
          lat: item.lat,
          lng: item.lng,
          phone: item.phone || undefined,
          notes: item.notes || undefined,
          tags: item.tags ?? [],
        });
        imported++;
      }

      setImportMsg(`Imported ${imported}, skipped ${skipped}`);
      loadClients(query);
    } catch {
      setImportMsg("Failed to parse file");
    }

    setTimeout(() => setImportMsg(null), 4000);
  };

  const filteredClients = filterTag
    ? clients.filter((c) => c.tags?.includes(filterTag))
    : clients;

  return (
    <div className="space-y-3">
      {/* Search */}
      <div className="relative">
        <svg
          className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
        <input
          type="text"
          placeholder="Search clients..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
        />
      </div>

      {/* Tag filter */}
      {allTags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setFilterTag("")}
            className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${
              filterTag === ""
                ? "bg-blue-600 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            All
          </button>
          {allTags.map((tag) => (
            <button
              key={tag}
              onClick={() => setFilterTag(filterTag === tag ? "" : tag)}
              className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${
                filterTag === tag
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {tag}
            </button>
          ))}
        </div>
      )}

      {/* Add button */}
      <button
        onClick={onAddNew}
        className="w-full py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
      >
        + Add New Client
      </button>

      {/* Import/Export */}
      <div className="flex gap-2">
        <button
          onClick={handleExport}
          disabled={clients.length === 0}
          className="flex-1 py-2 border border-gray-300 bg-white text-gray-700 text-xs font-medium rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-40"
        >
          ↓ Export clients
        </button>
        <button
          onClick={() => fileInputRef.current?.click()}
          className="flex-1 py-2 border border-gray-300 bg-white text-gray-700 text-xs font-medium rounded-lg hover:bg-gray-50 transition-colors"
        >
          ↑ Import clients
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          onChange={handleImport}
          className="hidden"
        />
      </div>
      {importMsg && (
        <p className="text-xs text-center text-gray-600 bg-gray-50 rounded-lg px-3 py-1.5">{importMsg}</p>
      )}

      {/* List */}
      {loading ? (
        <div className="text-center py-8 text-gray-400 text-sm">Loading...</div>
      ) : filteredClients.length === 0 ? (
        <div className="text-center py-8 text-gray-400 text-sm">
          {query || filterTag ? "No clients found" : "No clients yet. Add your first one!"}
        </div>
      ) : (
        <div className="space-y-2">
          {filteredClients.map((client) => {
            const address = `Str. ${client.street} nr. ${client.number}`;
            return (
              <div
                key={client.id}
                className="bg-white border border-gray-200 rounded-lg p-3 flex items-center justify-between"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {client.name || address}
                  </p>
                  <p className="text-xs text-gray-500 truncate">{address}</p>
                  {client.tags && client.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {client.tags.map((tag) => (
                        <span
                          key={tag}
                          className="px-1.5 py-0.5 bg-gray-100 text-gray-600 text-[10px] rounded"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex gap-1 ml-2 shrink-0">
                  <button
                    onClick={() => onEdit(client)}
                    className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    aria-label="Edit"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => handleDelete(client.id)}
                    className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    aria-label="Delete"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
