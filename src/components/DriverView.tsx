"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { DailyManifest, Stop, Client, MenuItem } from "@/types";
import { getManifest, updateManifest } from "@/lib/manifests";
import { getAllClients } from "@/lib/clients";
import { getAllMenuItems } from "@/lib/menus";
import { getMarkerIcons } from "./markerIcons";

const SEBES_CENTER: [number, number] = [45.95, 23.57];
const DEFAULT_ZOOM = 13;

interface DriverViewProps {
  manifestId: string;
  onBack: () => void;
}

interface WalkInForm {
  name: string;
  street: string;
  number: string;
  bloc: string;
  apartment: string;
  phone: string;
  lat: number | null;
  lng: number | null;
}

const emptyWalkIn: WalkInForm = {
  name: "",
  street: "",
  number: "",
  bloc: "",
  apartment: "",
  phone: "",
  lat: null,
  lng: null,
};

export default function DriverView({ manifestId, onBack }: DriverViewProps) {
  const [manifest, setManifest] = useState<DailyManifest | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [selectedStop, setSelectedStop] = useState<Stop | null>(null);
  const [loading, setLoading] = useState(true);

  // Walk-in form state
  const [showWalkIn, setShowWalkIn] = useState(false);
  const [walkIn, setWalkIn] = useState<WalkInForm>(emptyWalkIn);
  const [dropMode, setDropMode] = useState(false);

  // Section filter state — null = "All"
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null);

  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersRef = useRef<Map<string, L.Marker>>(new Map());

  // Load data
  useEffect(() => {
    (async () => {
      const [m, c, mi] = await Promise.all([
        getManifest(manifestId),
        getAllClients(),
        getAllMenuItems(),
      ]);
      setManifest(m ?? null);
      setClients(c);
      setMenuItems(mi);
      setLoading(false);
    })();
  }, [manifestId]);

  const getClient = useCallback(
    (id: string) => clients.find((c) => c.id === id),
    [clients]
  );

  const getMenuName = useCallback(
    (id: string) => menuItems.find((m) => m.id === id)?.name ?? "—",
    [menuItems]
  );

  const getSectionName = useCallback(
    (id: string | undefined) => {
      if (!id || !manifest) return null;
      return manifest.sections.find((s) => s.id === id)?.name ?? null;
    },
    [manifest]
  );

  const getStopCoords = (stop: Stop): [number, number] | null => {
    if (stop.isWalkIn && stop.walkInLat != null && stop.walkInLng != null) {
      return [stop.walkInLat, stop.walkInLng];
    }
    const client = getClient(stop.clientId);
    if (client) return [client.lat, client.lng];
    return null;
  };

  const addStopMarker = (map: L.Map, stop: Stop) => {
    const coords = getStopCoords(stop);
    if (!coords) return;

    const marker = L.marker(coords, {
      icon: getMarkerIcons()[stop.status],
    }).addTo(map);

    const addr = stop.isWalkIn
      ? `${stop.walkInStreet || "?"} nr. ${stop.walkInNumber || "?"}`
      : `Str. ${getClient(stop.clientId)?.street || "?"} nr. ${getClient(stop.clientId)?.number || "?"}`;
    marker.bindTooltip(addr, {
      permanent: false,
      direction: "top",
      offset: [0, -10],
    });

    marker.on("click", () => {
      setSelectedStop(stop);
    });

    markersRef.current.set(stop.id, marker);
  };

  // Initialize map
  /* eslint-disable react-hooks/exhaustive-deps */
  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current || loading || !manifest) return;

    const map = L.map(mapRef.current, {
      center: SEBES_CENTER,
      zoom: DEFAULT_ZOOM,
      zoomControl: false,
    });

    L.control.zoom({ position: "bottomright" }).addTo(map);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>',
      maxZoom: 19,
    }).addTo(map);

    // Add markers for each stop
    manifest.stops.forEach((stop) => {
      addStopMarker(map, stop);
    });

    // Fit bounds if there are stops
    if (manifest.stops.length > 0) {
      const coords: [number, number][] = manifest.stops
        .map((s) => getStopCoords(s))
        .filter(Boolean) as [number, number][];
      if (coords.length > 0) {
        map.fitBounds(coords, { padding: [40, 40] });
      }
    }

    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
      markersRef.current.clear();
    };
  }, [loading, manifest]);
  /* eslint-enable react-hooks/exhaustive-deps */

  // Update marker dimming when activeSectionId changes
  useEffect(() => {
    if (!manifest) return;

    markersRef.current.forEach((marker, stopId) => {
      const stop = manifest.stops.find((s) => s.id === stopId);
      if (!stop) return;

      if (activeSectionId === null) {
        // "All" — full opacity
        marker.setOpacity(1);
        marker.getElement()?.classList.remove("driver-dimmed");
      } else if (stop.sectionId === activeSectionId) {
        // In selected section — highlight
        marker.setOpacity(1);
        marker.getElement()?.classList.remove("driver-dimmed");
      } else {
        // Not in selected section — dim
        marker.setOpacity(0.3);
        marker.getElement()?.classList.add("driver-dimmed");
      }
    });
  }, [activeSectionId, manifest]);

  const handleStatusChange = async (stopId: string, status: "pending" | "delivered" | "skipped") => {
    if (!manifest) return;

    // Optimistic UI: update marker immediately
    const marker = markersRef.current.get(stopId);
    if (marker) {
      marker.setIcon(getMarkerIcons()[status]);
    }

    // Update in state
    const updatedStops = manifest.stops.map((s) =>
      s.id === stopId
        ? { ...s, status, completedAt: new Date().toISOString() }
        : s
    );
    const updatedManifest = { ...manifest, stops: updatedStops };
    setManifest(updatedManifest);

    if (selectedStop?.id === stopId) {
      setSelectedStop(null);
    }

    await updateManifest(manifest.id, { stops: updatedStops });
  };

  const handleAddWalkIn = async () => {
    if (!manifest || !walkIn.street || !walkIn.number) return;

    const newStop: Stop = {
      id: `walkin-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      clientId: "",
      menuItemId: manifest.stops[0]?.menuItemId || "",
      position: manifest.stops.length,
      status: "pending",
      isWalkIn: true,
      sectionId: activeSectionId ?? undefined,
      walkInName: walkIn.name || undefined,
      walkInStreet: walkIn.street,
      walkInNumber: walkIn.number,
      walkInBloc: walkIn.bloc || undefined,
      walkInApartment: walkIn.apartment || undefined,
      walkInPhone: walkIn.phone || undefined,
      walkInLat: walkIn.lat ?? undefined,
      walkInLng: walkIn.lng ?? undefined,
    };

    const updatedStops = [...manifest.stops, newStop];
    const updatedManifest = { ...manifest, stops: updatedStops };
    setManifest(updatedManifest);
    await updateManifest(manifest.id, { stops: updatedStops });

    if (mapInstanceRef.current && newStop.walkInLat != null && newStop.walkInLng != null) {
      addStopMarker(mapInstanceRef.current, newStop);
    }

    setShowWalkIn(false);
    setWalkIn(emptyWalkIn);
    setDropMode(false);
  };

  // Enable drop mode click handler
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const map = mapInstanceRef.current;

    const handleMapClick = (e: L.LeafletMouseEvent) => {
      if (!dropMode) return;
      setWalkIn((prev) => ({ ...prev, lat: e.latlng.lat, lng: e.latlng.lng }));
      setDropMode(false);
    };

    if (dropMode) {
      map.getContainer().style.cursor = "crosshair";
      map.on("click", handleMapClick);
      return () => {
        map.getContainer().style.cursor = "";
        map.off("click", handleMapClick);
      };
    }
  }, [dropMode]);

  if (loading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-gray-100">
        <div className="text-gray-500 text-lg">Loading manifest...</div>
      </div>
    );
  }

  if (!manifest) {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center bg-gray-100 gap-4">
        <p className="text-gray-500">Manifest not found</p>
        <button onClick={onBack} className="text-blue-600 text-sm font-medium">
          Go back
        </button>
      </div>
    );
  }

  const sections = [...(manifest.sections ?? [])].sort((a, b) => a.position - b.position);
  const hasSections = sections.length > 0;

  // Compute per-section stats
  const sectionStats = sections.map((sec) => {
    const secStops = manifest.stops.filter((s) => s.sectionId === sec.id);
    const delivered = secStops.filter((s) => s.status === "delivered").length;
    const skipped = secStops.filter((s) => s.status === "skipped").length;
    return { ...sec, total: secStops.length, delivered, skipped };
  });

  const delivered = manifest.stops.filter((s) => s.status === "delivered").length;
  const skipped = manifest.stops.filter((s) => s.status === "skipped").length;
  const total = manifest.stops.length;
  const done = delivered + skipped;
  const progress = total > 0 ? Math.round((done / total) * 100) : 0;

  const selectedClient = selectedStop?.isWalkIn
    ? null
    : selectedStop
    ? getClient(selectedStop.clientId)
    : null;

  const selectedSectionName = activeSectionId
    ? sections.find((s) => s.id === activeSectionId)?.name
    : null;

  return (
    <main className="relative h-full flex flex-col">
      {/* Header with progress */}
      <div className="relative z-10 bg-white border-b border-gray-200 px-4 py-2">
        <div className="flex items-center justify-between">
          <button
            onClick={onBack}
            className="text-gray-500 hover:text-gray-700 p-1"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="text-center">
            <p className="text-sm font-medium text-gray-900">
              {done}/{total} stops
            </p>
            <p className="text-xs text-gray-500">{manifest.date}</p>
          </div>
          <button
            onClick={() => {
              setShowWalkIn(true);
              setWalkIn(emptyWalkIn);
              setDropMode(false);
            }}
            className="w-8 h-8 flex items-center justify-center bg-blue-600 text-white rounded-full hover:bg-blue-700"
            aria-label="Add walk-in"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </button>
        </div>

        {/* Section tabs */}
        {hasSections && (
          <div className="mt-2 flex gap-1 overflow-x-auto no-scrollbar">
            <button
              onClick={() => setActiveSectionId(null)}
              className={`shrink-0 px-2.5 py-1 text-xs font-medium rounded-full transition-colors ${
                activeSectionId === null
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              All
            </button>
            {sectionStats.map((sec) => (
              <button
                key={sec.id}
                onClick={() => setActiveSectionId(sec.id)}
                className={`shrink-0 px-2.5 py-1 text-xs font-medium rounded-full transition-colors ${
                  activeSectionId === sec.id
                    ? "bg-blue-600 text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {sec.name || `Section ${sec.position + 1}`}
                {sec.timeFrom && ` ${sec.timeFrom}`}
                {" "}({sec.delivered + sec.skipped}/{sec.total})
              </button>
            ))}
          </div>
        )}

        {/* Progress bar */}
        <div className="mt-2 h-1.5 bg-gray-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-green-500 rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="flex justify-between mt-1 text-xs text-gray-400">
          <span>{delivered} delivered</span>
          <span>{skipped} skipped</span>
          <span>{total - done} remaining</span>
          {selectedSectionName && (
            <span className="text-blue-500 font-medium">· {selectedSectionName}</span>
          )}
        </div>
      </div>

      {/* Map */}
      <div className="flex-1 relative">
        <div ref={mapRef} className="absolute inset-0" />
      </div>

      {/* Walk-in form modal */}
      {showWalkIn && (
        <div className="fixed inset-0 z-30 flex items-end sm:items-center justify-center bg-black/40">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full max-w-md max-h-[85vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between rounded-t-2xl">
              <h3 className="font-semibold text-gray-900">Add Walk-in</h3>
              <button
                onClick={() => {
                  setShowWalkIn(false);
                  setDropMode(false);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-4 space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name (optional)</label>
                <input
                  type="text"
                  value={walkIn.name}
                  onChange={(e) => setWalkIn((p) => ({ ...p, name: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  placeholder="Customer name"
                />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Street *</label>
                  <input
                    type="text"
                    value={walkIn.street}
                    onChange={(e) => setWalkIn((p) => ({ ...p, street: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    placeholder="Strada..."
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nr. *</label>
                  <input
                    type="text"
                    value={walkIn.number}
                    onChange={(e) => setWalkIn((p) => ({ ...p, number: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Block</label>
                  <input
                    type="text"
                    value={walkIn.bloc}
                    onChange={(e) => setWalkIn((p) => ({ ...p, bloc: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Apartment</label>
                  <input
                    type="text"
                    value={walkIn.apartment}
                    onChange={(e) => setWalkIn((p) => ({ ...p, apartment: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                <input
                  type="tel"
                  value={walkIn.phone}
                  onChange={(e) => setWalkIn((p) => ({ ...p, phone: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Coordinates</label>
                {walkIn.lat != null && walkIn.lng != null ? (
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <span>{walkIn.lat.toFixed(5)}, {walkIn.lng.toFixed(5)}</span>
                    <button
                      onClick={() => setWalkIn((p) => ({ ...p, lat: null, lng: null }))}
                      className="text-red-500 text-xs hover:underline"
                    >
                      Clear
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setDropMode(true)}
                    className="w-full border border-dashed border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-500 hover:border-blue-400 hover:text-blue-600"
                  >
                    Tap map to drop pin
                  </button>
                )}
              </div>
              <button
                onClick={handleAddWalkIn}
                disabled={!walkIn.street || !walkIn.number}
                className="w-full py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Add Walk-in Stop
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Stop card */}
      {selectedStop && (
        <div className="fixed bottom-0 left-0 right-0 z-20">
          <div className="bg-white rounded-t-2xl shadow-2xl border border-gray-200 overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
              <div className="min-w-0 flex-1">
                <h3 className="font-semibold text-gray-900 text-base truncate">
                  {selectedStop.isWalkIn
                    ? selectedStop.walkInName || `Walk-in nr. ${selectedStop.walkInNumber}`
                    : selectedClient?.name ||
                      `Str. ${selectedClient?.street} nr. ${selectedClient?.number}`}
                </h3>
                {selectedStop.sectionId && (
                  <p className="text-xs text-blue-500">
                    {getSectionName(selectedStop.sectionId)}
                  </p>
                )}
              </div>
              <button
                onClick={() => setSelectedStop(null)}
                className="shrink-0 w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100"
                aria-label="Close"
              >
                <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Body */}
            <div className="px-4 py-3 space-y-2">
              <div className="flex items-start gap-2">
                <svg className="w-4 h-4 mt-0.5 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <p className="text-sm text-gray-600">
                  {selectedStop.isWalkIn ? (
                    <>
                      Strada {selectedStop.walkInStreet} nr. {selectedStop.walkInNumber}
                      {selectedStop.walkInBloc ? ` bl. ${selectedStop.walkInBloc}` : ""}
                      {selectedStop.walkInApartment ? ` ap. ${selectedStop.walkInApartment}` : ""}
                    </>
                  ) : (
                    <>
                      Strada {selectedClient?.street} nr. {selectedClient?.number}
                      {selectedClient?.bloc ? ` bl. ${selectedClient.bloc}` : ""}
                      {selectedClient?.apartment ? ` ap. ${selectedClient.apartment}` : ""}
                    </>
                  )}
                </p>
              </div>

              {!selectedStop.isWalkIn && selectedClient?.phone && (
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                  <a href={`tel:${selectedClient.phone}`} className="text-sm text-blue-600 hover:underline">
                    {selectedClient.phone}
                  </a>
                </div>
              )}

              {selectedStop.isWalkIn && selectedStop.walkInPhone && (
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                  <a href={`tel:${selectedStop.walkInPhone}`} className="text-sm text-blue-600 hover:underline">
                    {selectedStop.walkInPhone}
                  </a>
                </div>
              )}

              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                <p className="text-sm text-gray-600">
                  {getMenuName(selectedStop.menuItemId)}
                </p>
              </div>

              {selectedStop.isWalkIn && (
                <span className="inline-block bg-yellow-100 text-yellow-800 text-xs px-2 py-0.5 rounded-full">
                  Walk-in
                </span>
              )}

              {!selectedStop.isWalkIn && selectedClient?.notes && (
                <div className="flex items-start gap-2">
                  <svg className="w-4 h-4 mt-0.5 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                  </svg>
                  <p className="text-sm text-gray-600">{selectedClient.notes}</p>
                </div>
              )}
            </div>

            {/* Action buttons */}
            <div className="px-4 py-3 border-t border-gray-100 flex gap-2">
              {selectedStop.status === "pending" ? (
                <>
                  <button
                    onClick={() => handleStatusChange(selectedStop.id, "delivered")}
                    className="flex-1 py-2.5 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors"
                  >
                    Delivered
                  </button>
                  <button
                    onClick={() => handleStatusChange(selectedStop.id, "skipped")}
                    className="flex-1 py-2.5 bg-red-500 text-white text-sm font-medium rounded-lg hover:bg-red-600 transition-colors"
                  >
                    Skipped
                  </button>
                </>
              ) : (
                <button
                  onClick={() => handleStatusChange(selectedStop.id, "pending")}
                  className="flex-1 py-2.5 bg-gray-200 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-300 transition-colors"
                >
                  Reset to Pending
                </button>
              )}
              {((selectedStop.isWalkIn && selectedStop.walkInLat != null && selectedStop.walkInLng != null) ||
                (!selectedStop.isWalkIn && selectedClient)) && (
                <a
                  href={`https://www.google.com/maps/dir/?api=1&destination=${
                    selectedStop.isWalkIn
                      ? `${selectedStop.walkInLat},${selectedStop.walkInLng}`
                      : `${selectedClient?.lat},${selectedClient?.lng}`
                  }`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="py-2.5 px-4 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors text-center"
                >
                  Navigate
                </a>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Drop mode indicator */}
      {dropMode && (
        <div className="fixed top-14 left-1/2 -translate-x-1/2 z-20 bg-blue-600 text-white text-sm font-medium px-4 py-2 rounded-full shadow-lg">
          Tap map to place pin
        </div>
      )}
    </main>
  );
}
