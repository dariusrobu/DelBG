"use client";

import { useState, useEffect, useRef } from "react";
import { DailyManifest, Stop, Client, MenuItem, ManifestSection } from "@/types";
import { getAllClients, getAllTags } from "@/lib/clients";
import { getAllMenuItems } from "@/lib/menus";
import { updateManifest } from "@/lib/manifests";

interface ManifestFormProps {
  manifest: DailyManifest;
  onSave: () => void;
  onCancel: () => void;
}

export default function ManifestForm({ manifest, onSave, onCancel }: ManifestFormProps) {
  const [stops, setStops] = useState<Stop[]>(manifest.stops);
  const [sections, setSections] = useState<ManifestSection[]>(manifest.sections ?? []);
  const [clients, setClients] = useState<Client[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [clientSearch, setClientSearch] = useState("");
  const [filterTag, setFilterTag] = useState<string>("");
  const [allTags, setAllTags] = useState<string[]>([]);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const idCounter = useRef(0);

  useEffect(() => {
    (async () => {
      const [c, m, tags] = await Promise.all([getAllClients(), getAllMenuItems(), getAllTags()]);
      setClients(c);
      setMenuItems(m);
      setAllTags(tags);
      // Expand all sections by default
      setExpandedSections(new Set((manifest.sections ?? []).map((s) => s.id)));
    })();
  }, [manifest.sections]);

  const filteredClients = clients.filter((c) => {
    const matchesSearch = !clientSearch || (() => {
      const q = clientSearch.toLowerCase();
      return (
        c.name?.toLowerCase().includes(q) ||
        c.street.toLowerCase().includes(q) ||
        c.number.includes(q)
      );
    })();
    const matchesTag = !filterTag || c.tags?.includes(filterTag);
    return matchesSearch && matchesTag;
  });

  const getClient = (id: string) => clients.find((c) => c.id === id);

  // Group stops by section
  const sortedSections = [...sections].sort((a, b) => a.position - b.position);
  const stopsBySection = new Map<string, Stop[]>();
  for (const s of sortedSections) {
    stopsBySection.set(s.id, []);
  }
  const ungroupedStops: Stop[] = [];
  for (const stop of stops) {
    if (stop.sectionId && stopsBySection.has(stop.sectionId)) {
      stopsBySection.get(stop.sectionId)!.push(stop);
    } else {
      ungroupedStops.push(stop);
    }
  }

  // --- Stop handlers ---

  const handleAddClient = (clientId: string) => {
    idCounter.current += 1;
    const newStop: Stop = {
      id: `temp-${manifest.id}-${idCounter.current}`,
      clientId,
      menuItemId: menuItems.length > 0 ? menuItems[0].id : "",
      position: stops.length,
      status: "pending",
      isWalkIn: false,
    };
    setStops([...stops, newStop]);
  };

  const handleRemoveStop = (stopId: string) => {
    setStops(stops.filter((s) => s.id !== stopId));
  };

  const handleMoveStop = (index: number, direction: "up" | "down") => {
    const newStops = [...stops];
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newStops.length) return;
    [newStops[index], newStops[targetIndex]] = [newStops[targetIndex], newStops[index]];
    newStops.forEach((s, i) => (s.position = i));
    setStops(newStops);
  };

  const handleMenuChange = (stopId: string, menuItemId: string) => {
    setStops(stops.map((s) => (s.id === stopId ? { ...s, menuItemId } : s)));
  };

  const handleSectionChange = (stopId: string, sectionId: string) => {
    setStops(stops.map((s) =>
      s.id === stopId ? { ...s, sectionId: sectionId || undefined } : s
    ));
  };

  // --- Section handlers ---

  const handleAddSection = () => {
    idCounter.current += 1;
    const newSection: ManifestSection = {
      id: `sec-${manifest.id}-${idCounter.current}`,
      name: "",
      timeFrom: "",
      timeTo: "",
      position: sections.length,
    };
    setSections([...sections, newSection]);
    setExpandedSections((prev) => new Set(prev).add(newSection.id));
  };

  const handleUpdateSection = (sectionId: string, data: Partial<ManifestSection>) => {
    setSections(sections.map((s) => (s.id === sectionId ? { ...s, ...data } : s)));
  };

  const handleRemoveSection = (sectionId: string) => {
    // Move stops from this section to ungrouped
    setStops(stops.map((s) => (s.sectionId === sectionId ? { ...s, sectionId: undefined } : s)));
    setSections(sections.filter((s) => s.id !== sectionId));
    setExpandedSections((prev) => {
      const next = new Set(prev);
      next.delete(sectionId);
      return next;
    });
  };

  const handleMoveSection = (index: number, direction: "up" | "down") => {
    const sorted = [...sections].sort((a, b) => a.position - b.position);
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= sorted.length) return;
    [sorted[index], sorted[targetIndex]] = [sorted[targetIndex], sorted[index]];
    sorted.forEach((s, i) => (s.position = i));
    setSections(sorted);
  };

  const toggleSection = (sectionId: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(sectionId)) next.delete(sectionId);
      else next.add(sectionId);
      return next;
    });
  };

  // --- Save ---

  const handleSave = async () => {
    setSaving(true);
    await updateManifest(manifest.id, { stops, sections });
    setSaving(false);
    onSave();
  };

  // --- Render helpers ---

  const renderStop = (stop: Stop, index: number, globalIndex: number) => {
    const client = getClient(stop.clientId);
    const addr = client ? `Str. ${client.street} nr. ${client.number}` : "Unknown address";
    return (
      <div
        key={stop.id}
        className="bg-white border border-gray-200 rounded-lg p-2.5 flex items-center gap-2"
      >
        <span className="w-6 text-center text-xs text-gray-400 font-mono shrink-0">
          {globalIndex + 1}
        </span>

        <div className="flex flex-col shrink-0">
          <button
            onClick={() => handleMoveStop(index, "up")}
            disabled={index === 0}
            className="text-gray-300 hover:text-gray-600 disabled:opacity-30"
            aria-label="Move up"
          >
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
              <path d="M5.293 9.707l4-4a1 1 0 011.414 0l4 4a1 1 0 01-1.414 1.414L10 7.414l-3.293 3.293a1 1 0 01-1.414-1.414z" />
            </svg>
          </button>
          <button
            onClick={() => handleMoveStop(index, "down")}
            disabled={index === stops.length - 1}
            className="text-gray-300 hover:text-gray-600 disabled:opacity-30"
            aria-label="Move down"
          >
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
              <path d="M14.707 10.293l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 111.414-1.414L10 12.586l3.293-3.293a1 1 0 011.414 1.414z" />
            </svg>
          </button>
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-gray-900 truncate">
            {client?.name || addr}
          </p>
          <p className="text-xs text-gray-400 truncate">{addr}</p>
        </div>

        <select
          value={stop.sectionId ?? ""}
          onChange={(e) => handleSectionChange(stop.id, e.target.value)}
          className="text-xs border border-gray-200 rounded px-1.5 py-1 bg-gray-50 max-w-[100px] truncate"
        >
          <option value="">No section</option>
          {sortedSections.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name || `Section ${s.position + 1}`}
            </option>
          ))}
        </select>

        <select
          value={stop.menuItemId}
          onChange={(e) => handleMenuChange(stop.id, e.target.value)}
          className="text-xs border border-gray-200 rounded px-1.5 py-1 bg-gray-50 max-w-[100px] truncate"
        >
          {menuItems.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
          {menuItems.length === 0 && <option value="">No menus</option>}
        </select>

        <button
          onClick={() => handleRemoveStop(stop.id)}
          className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded shrink-0"
          aria-label="Remove"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    );
  };

  // Global index counter for numbering
  let globalIdx = 0;

  return (
    <div className="space-y-4 pb-20">
      {/* Sections */}
      <section>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-medium text-gray-700">
            Sections ({sections.length})
          </h3>
          <button
            onClick={handleAddSection}
            className="text-xs text-blue-600 font-medium hover:text-blue-700"
          >
            + Add Section
          </button>
        </div>

        {sections.length === 0 ? (
          <p className="text-xs text-gray-400 py-2">
            No sections yet. Add sections to group stops by time.
          </p>
        ) : (
          <div className="space-y-2">
            {[...sections]
              .sort((a, b) => a.position - b.position)
              .map((section, secIdx) => {
                const sectionStops = stopsBySection.get(section.id) ?? [];
                const isExpanded = expandedSections.has(section.id);
                return (
                  <div key={section.id} className="border border-gray-200 rounded-lg overflow-hidden">
                    {/* Section header */}
                    <div className="bg-gray-50 px-3 py-2 flex items-center gap-2">
                      <button
                        onClick={() => toggleSection(section.id)}
                        className="text-gray-400 hover:text-gray-600"
                      >
                        <svg className={`w-4 h-4 transition-transform ${isExpanded ? "rotate-90" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </button>

                      <input
                        type="text"
                        value={section.name}
                        onChange={(e) => handleUpdateSection(section.id, { name: e.target.value })}
                        placeholder="Section name"
                        className="flex-1 text-sm font-medium text-gray-900 bg-transparent border-none outline-none placeholder:text-gray-300"
                      />

                      <input
                        type="time"
                        value={section.timeFrom}
                        onChange={(e) => handleUpdateSection(section.id, { timeFrom: e.target.value })}
                        className="text-xs border border-gray-200 rounded px-1.5 py-0.5 bg-white"
                      />
                      <span className="text-xs text-gray-400">-</span>
                      <input
                        type="time"
                        value={section.timeTo}
                        onChange={(e) => handleUpdateSection(section.id, { timeTo: e.target.value })}
                        className="text-xs border border-gray-200 rounded px-1.5 py-0.5 bg-white"
                      />

                      <span className="text-xs text-gray-400 ml-1">{sectionStops.length}</span>

                      <div className="flex flex-col ml-1">
                        <button
                          onClick={() => handleMoveSection(secIdx, "up")}
                          disabled={secIdx === 0}
                          className="text-gray-300 hover:text-gray-600 disabled:opacity-30"
                        >
                          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M5.293 9.707l4-4a1 1 0 011.414 0l4 4a1 1 0 01-1.414 1.414L10 7.414l-3.293 3.293a1 1 0 01-1.414-1.414z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => handleMoveSection(secIdx, "down")}
                          disabled={secIdx === sections.length - 1}
                          className="text-gray-300 hover:text-gray-600 disabled:opacity-30"
                        >
                          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M14.707 10.293l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 111.414-1.414L10 12.586l3.293-3.293a1 1 0 011.414 1.414z" />
                          </svg>
                        </button>
                      </div>

                      <button
                        onClick={() => handleRemoveSection(section.id)}
                        className="p-1 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded ml-1"
                        aria-label="Remove section"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>

                    {/* Section stops */}
                    {isExpanded && (
                      <div className="p-2 space-y-1.5">
                        {sectionStops.length === 0 ? (
                          <p className="text-xs text-gray-400 py-2 text-center">
                            No stops in this section. Assign stops using the dropdown below each stop.
                          </p>
                        ) : (
                          sectionStops.map((stop) => {
                            const idx = stops.indexOf(stop);
                            const gIdx = globalIdx++;
                            return renderStop(stop, idx, gIdx);
                          })
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
          </div>
        )}
      </section>

      {/* Ungrouped stops */}
      {ungroupedStops.length > 0 && (
        <section>
          <h3 className="text-sm font-medium text-gray-700 mb-2">
            No section ({ungroupedStops.length})
          </h3>
          <div className="space-y-1.5">
            {ungroupedStops.map((stop) => {
              const idx = stops.indexOf(stop);
              const gIdx = globalIdx++;
              return renderStop(stop, idx, gIdx);
            })}
          </div>
        </section>
      )}

      {/* Total stop count when no sections */}
      {sections.length === 0 && stops.length > 0 && ungroupedStops.length === 0 && (
        <section>
          <h3 className="text-sm font-medium text-gray-700 mb-2">
            Stops ({stops.length})
          </h3>
          <div className="space-y-1.5">
            {stops.map((stop) => {
              const idx = stops.indexOf(stop);
              const gIdx = globalIdx++;
              return renderStop(stop, idx, gIdx);
            })}
          </div>
        </section>
      )}

      {/* Available clients */}
      <section>
        <h3 className="text-sm font-medium text-gray-700 mb-2">
          Add clients
        </h3>

        {/* Tag filter */}
        {allTags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-2">
            <button
              onClick={() => setFilterTag("")}
              className={`px-2.5 py-1 text-xs font-medium rounded-full transition-colors ${
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
                className={`px-2.5 py-1 text-xs font-medium rounded-full transition-colors ${
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

        <div className="relative mb-2">
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
            value={clientSearch}
            onChange={(e) => setClientSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
          />
        </div>

        {clients.length === 0 ? (
          <p className="text-sm text-gray-400 py-4 text-center">
            No clients in database. Add clients first from the Clients tab.
          </p>
        ) : filteredClients.length === 0 ? (
          <p className="text-sm text-gray-400 py-4 text-center">
            No clients match your search.
          </p>
        ) : (
          <div className="space-y-1 max-h-64 overflow-y-auto">
            {filteredClients.map((client) => {
              const addr = `Str. ${client.street} nr. ${client.number}`;
              return (
                <button
                  key={client.id}
                  onClick={() => handleAddClient(client.id)}
                  className="w-full bg-gray-50 hover:bg-blue-50 border border-gray-200 hover:border-blue-300 rounded-lg p-2.5 flex items-center gap-2 text-left transition-colors"
                >
                  <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  <div className="min-w-0">
                    <p className="text-sm text-gray-900 truncate">
                      {client.name || addr}
                    </p>
                    <p className="text-xs text-gray-400 truncate">{addr}</p>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </section>

      {/* Sticky save/cancel footer */}
      <div className="fixed bottom-0 left-0 right-0 z-20 bg-white border-t border-gray-200 px-4 py-3 flex gap-2">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex-1 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save Manifest"}
        </button>
        <button
          onClick={onCancel}
          className="py-2.5 px-6 bg-gray-200 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-300 transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
