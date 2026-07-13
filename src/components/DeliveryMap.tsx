"use client";

import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";
import "leaflet.markercluster";
import { Client, ManifestSection, DailyManifest } from "@/types";
import { getAllTags } from "@/lib/clients";

// Fix for default marker icons in Leaflet with bundlers
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

const SEBES_CENTER: [number, number] = [45.95, 23.57];
const DEFAULT_ZOOM = 13;

interface DeliveryMapProps {
  clients: Client[];
  onClientSelect: (client: Client) => void;
  sections?: ManifestSection[];
  clientSectionMap?: Map<string, string>;
  manifests: DailyManifest[];
  selectedManifestId: string | null;
  onManifestSelect: (id: string | null) => void;
}

export default function DeliveryMap({
  clients,
  onClientSelect,
  sections = [],
  clientSectionMap = new Map(),
  manifests,
  selectedManifestId,
  onManifestSelect,
}: DeliveryMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const [filterTag, setFilterTag] = useState<string>("");
  const [filterSection, setFilterSection] = useState<string | null>(null);
  const [allTags, setAllTags] = useState<string[]>([]);

  useEffect(() => {
    getAllTags().then(setAllTags);
  }, []);

  // Reset section filter when manifest changes
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    setFilterSection(null);
  }, [selectedManifestId]);

  const sortedSections = [...sections].sort((a, b) => a.position - b.position);

  // Clients with no section assignment (for "No section" pill)
  const unsectionedClientIds = new Set(
    clients
      .filter((c) => !clientSectionMap.has(c.id))
      .map((c) => c.id)
  );

  const filteredClients = clients.filter((c) => {
    if (typeof c.lat !== "number" || typeof c.lng !== "number") return false;
    const matchesTag = !filterTag || c.tags?.includes(filterTag);
    const matchesSection =
      filterSection === null ||
      (filterSection === "__none__"
        ? !clientSectionMap.has(c.id)
        : clientSectionMap.get(c.id) === filterSection);
    return matchesTag && matchesSection;
  });

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    const map = L.map(mapRef.current, {
      center: SEBES_CENTER,
      zoom: DEFAULT_ZOOM,
      zoomControl: false,
    });

    L.control.zoom({ position: "bottomright" }).addTo(map);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map);

    // Marker cluster group
    const markers = L.markerClusterGroup({
      maxClusterRadius: 50,
      spiderfyOnMaxZoom: true,
      showCoverageOnHover: false,
      zoomToBoundsOnClick: true,
    });

    filteredClients.forEach((client) => {
      const marker = L.marker([client.lat, client.lng]);

      const label = `Str. ${client.street} nr. ${client.number}`;
      marker.bindTooltip(label, {
        permanent: false,
        direction: "top",
        offset: [0, -10],
      });

      marker.on("click", () => {
        onClientSelect(client);
      });

      markers.addLayer(marker);
    });

    map.addLayer(markers);

    mapInstanceRef.current = map;

    // Fit bounds after layout settles to avoid _leaflet_pos error
    if (filteredClients.length > 0) {
      requestAnimationFrame(() => {
        if (!mapInstanceRef.current) return;
        const bounds = L.latLngBounds(
          filteredClients.map((c) => [c.lat, c.lng] as [number, number])
        );
        map.fitBounds(bounds, { padding: [40, 40] });
      });
    }

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, [filteredClients, onClientSelect]);

  const hasManifests = manifests.length > 0;
  const hasSections = sortedSections.length > 0;
  const hasTags = allTags.length > 0;
  const hasFilters = hasManifests || hasTags;

  if (!hasFilters) {
    return (
      <div className="fixed inset-0 w-full h-full" style={{ zIndex: 0 }}>
        <div ref={mapRef} className="w-full h-full" />
      </div>
    );
  }

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr + "T00:00:00");
    return d.toLocaleDateString("ro-RO", { weekday: "short", day: "numeric", month: "short" });
  };

  return (
    <div className="fixed inset-0 w-full h-full" style={{ zIndex: 0 }}>
      {/* Filter bar */}
      <div className="absolute top-2 left-2 right-2 z-[1000] flex flex-col gap-1.5 bg-white/95 backdrop-blur-sm rounded-lg p-2 shadow-md">
        {/* Manifest selector */}
        {hasManifests && (
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-gray-500 shrink-0">Manifest</span>
            <select
              value={selectedManifestId ?? ""}
              onChange={(e) => onManifestSelect(e.target.value || null)}
              className="flex-1 min-w-0 text-xs bg-gray-100 text-gray-700 rounded-md px-2 py-1.5 border-0 focus:ring-2 focus:ring-blue-500"
            >
              <option value="">None</option>
              {manifests.map((m) => (
                <option key={m.id} value={m.id}>
                  {formatDate(m.date)} — {m.stops.length} stop{m.stops.length !== 1 ? "s" : ""}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Section filters */}
        {hasSections && (
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => setFilterSection(null)}
              className={`px-2.5 py-1 text-xs font-medium rounded-full transition-colors ${
                filterSection === null
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              All
            </button>
            {sortedSections.map((sec) => {
              const count = clients.filter(
                (c) => clientSectionMap.get(c.id) === sec.id
              ).length;
              return (
                <button
                  key={sec.id}
                  onClick={() =>
                    setFilterSection(filterSection === sec.id ? null : sec.id)
                  }
                  className={`px-2.5 py-1 text-xs font-medium rounded-full transition-colors ${
                    filterSection === sec.id
                      ? "bg-blue-600 text-white"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  {sec.name || `Section ${sec.position + 1}`}
                  {count > 0 && ` (${count})`}
                </button>
              );
            })}
            {unsectionedClientIds.size > 0 && (
              <button
                onClick={() =>
                  setFilterSection(
                    filterSection === "__none__" ? null : "__none__"
                  )
                }
                className={`px-2.5 py-1 text-xs font-medium rounded-full transition-colors ${
                  filterSection === "__none__"
                    ? "bg-blue-600 text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                No section ({unsectionedClientIds.size})
              </button>
            )}
          </div>
        )}

        {/* Tag filters */}
        {hasTags && (
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => setFilterTag("")}
              className={`px-2.5 py-1 text-xs font-medium rounded-full transition-colors ${
                filterTag === ""
                  ? "bg-gray-200 text-gray-700"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              All tags
            </button>
            {allTags.map((tag) => (
              <button
                key={tag}
                onClick={() => setFilterTag(filterTag === tag ? "" : tag)}
                className={`px-2.5 py-1 text-xs font-medium rounded-full transition-colors ${
                  filterTag === tag
                    ? "bg-gray-700 text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {tag}
              </button>
            ))}
          </div>
        )}
      </div>
      <div ref={mapRef} className="w-full h-full" />
    </div>
  );
}
