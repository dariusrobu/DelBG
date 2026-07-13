"use client";

import { useState, useEffect, useRef } from "react";
import { Client } from "@/types";
import { getAllTags } from "@/lib/clients";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const SEBES_CENTER: [number, number] = [45.95, 23.57];

interface ClientFormProps {
  initial?: Client;
  allClients?: Client[];
  onSave: (data: Omit<Client, "id">) => void;
  onCancel: () => void;
}

function parseCoords(input: string): { lat: number; lng: number } | null {
  const parts = input.split(",").map((s) => s.trim());
  if (parts.length !== 2) return null;
  const lat = parseFloat(parts[0]);
  const lng = parseFloat(parts[1]);
  if (isNaN(lat) || isNaN(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { lat, lng };
}

export default function ClientForm({ initial, allClients = [], onSave, onCancel }: ClientFormProps) {
  const [street, setStreet] = useState(initial?.street ?? "");
  const [number, setNumber] = useState(initial?.number ?? "");
  const [bloc, setBloc] = useState(initial?.bloc ?? "");
  const [apartment, setApartment] = useState(initial?.apartment ?? "");
  const [name, setName] = useState(initial?.name ?? "");
  const [phone, setPhone] = useState(initial?.phone ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [coordsInput, setCoordsInput] = useState(
    initial ? `${initial.lat}, ${initial.lng}` : ""
  );
  const [tags, setTags] = useState<string[]>(initial?.tags ?? []);
  const [tagInput, setTagInput] = useState("");
  const [allTags, setAllTags] = useState<string[]>([]);
  const [showTagSuggestions, setShowTagSuggestions] = useState(false);
  const [copyQuery, setCopyQuery] = useState("");
  const [showCopyDropdown, setShowCopyDropdown] = useState(false);

  const isCreateMode = !initial;
  const filteredCopyClients = isCreateMode && copyQuery
    ? allClients.filter((c) => {
        const q = copyQuery.toLowerCase();
        const addr = `str ${c.street} nr ${c.number} ${c.bloc ?? ""}`.toLowerCase();
        const cname = (c.name ?? "").toLowerCase();
        return addr.includes(q) || cname.includes(q);
      })
    : [];

  const handleCopyFrom = (client: Client) => {
    setStreet(client.street);
    setNumber(client.number);
    setBloc(client.bloc ?? "");
    setApartment(client.apartment ?? "");
    setPhone(client.phone ?? "");
    setNotes(client.notes ?? "");
    setCoordsInput(`${client.lat}, ${client.lng}`);
    setTags(client.tags ?? []);
    setCopyQuery("");
    setShowCopyDropdown(false);
  };

  // Load existing tags for autocomplete
  useEffect(() => {
    getAllTags().then(setAllTags);
  }, []);

  const parsedCoords = coordsInput.trim() ? parseCoords(coordsInput) : null;
  const coordsError = coordsInput.trim() !== "" && !parsedCoords;
  const lat = parsedCoords?.lat ?? initial?.lat ?? SEBES_CENTER[0];
  const lng = parsedCoords?.lng ?? initial?.lng ?? SEBES_CENTER[1];

  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);

  // Initialize map
  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    const center: [number, number] = [lat, lng];
    const map = L.map(mapRef.current, {
      center,
      zoom: initial ? 15 : 12,
      zoomControl: false,
      dragging: true,
      scrollWheelZoom: true,
    });

    L.control.zoom({ position: "topright" }).addTo(map);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>',
      maxZoom: 19,
    }).addTo(map);

    // Place marker if we have valid coordinates
    const parsed = coordsInput ? parseCoords(coordsInput) : null;
    if (parsed) {
      const marker = L.marker([parsed.lat, parsed.lng], { draggable: false }).addTo(map);
      markerRef.current = marker;
    }

    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
      markerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update marker when coords input changes
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const map = mapInstanceRef.current;

    if (parsedCoords) {
      if (markerRef.current) {
        markerRef.current.setLatLng([parsedCoords.lat, parsedCoords.lng]);
      } else {
        const marker = L.marker([parsedCoords.lat, parsedCoords.lng], { draggable: false }).addTo(map);
        markerRef.current = marker;
      }

      map.setView([parsedCoords.lat, parsedCoords.lng], Math.max(map.getZoom(), 15));
    } else {
      if (markerRef.current) {
        markerRef.current.remove();
        markerRef.current = null;
      }
    }
  }, [coordsInput, parsedCoords]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!street.trim() || !number.trim()) return;
    onSave({
      street: street.trim(),
      number: number.trim(),
      bloc: bloc.trim() || undefined,
      apartment: apartment.trim() || undefined,
      name: name.trim() || undefined,
      phone: phone.trim() || undefined,
      notes: notes.trim() || undefined,
      lat,
      lng,
      tags,
    });
  };

  const addressPreview =
    street && number
      ? `Strada ${street} nr. ${number}${bloc ? ` bl. ${bloc}` : ""}${apartment ? ` ap. ${apartment}` : ""}`
      : "";

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Copy from existing */}
      {isCreateMode && allClients.length > 0 && (
        <div className="space-y-1">
          <label className="text-sm font-medium text-gray-700">
            Copy address from existing client?
          </label>
          <div className="relative">
            <input
              type="text"
              placeholder="Search clients..."
              value={copyQuery}
              onChange={(e) => {
                setCopyQuery(e.target.value);
                setShowCopyDropdown(e.target.value.length > 0);
              }}
              onFocus={() => setShowCopyDropdown(copyQuery.length > 0)}
              onBlur={() => setTimeout(() => setShowCopyDropdown(false), 200)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
            {showCopyDropdown && filteredCopyClients.length > 0 && (
              <div className="absolute z-10 w-full bg-white border border-gray-300 rounded-lg mt-1 shadow-lg max-h-48 overflow-y-auto">
                {filteredCopyClients.slice(0, 8).map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      handleCopyFrom(c);
                    }}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100"
                  >
                    <span className="font-medium text-gray-900">
                      {c.name || `Str. ${c.street} nr. ${c.number}`}
                    </span>
                    <span className="text-gray-500 ml-2">
                      Str. {c.street} nr. {c.number}
                      {c.bloc ? ` bl. ${c.bloc}` : ""}
                      {c.apartment ? ` ap. ${c.apartment}` : ""}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Address */}
      <fieldset className="space-y-3">
        <legend className="text-sm font-medium text-gray-700">Address *</legend>
        <div className="grid grid-cols-2 gap-3">
          <input
            type="text"
            placeholder="Strada"
            value={street}
            onChange={(e) => setStreet(e.target.value)}
            required
            className="col-span-2 sm:col-span-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
          />
          <input
            type="text"
            placeholder="Număr"
            value={number}
            onChange={(e) => setNumber(e.target.value)}
            required
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
          />
          <input
            type="text"
            placeholder="Bloc (optional)"
            value={bloc}
            onChange={(e) => setBloc(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
          />
          <input
            type="text"
            placeholder="Apartment (optional)"
            value={apartment}
            onChange={(e) => setApartment(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
          />
        </div>
      </fieldset>

      {/* Coordinates */}
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-gray-700">
          Coordinates *
        </legend>
        <input
          type="text"
          placeholder="45.9573016175575, 23.574910197338266"
          value={coordsInput}
          onChange={(e) => setCoordsInput(e.target.value)}
          className={`w-full rounded-lg border px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none ${
            coordsError ? "border-red-400 bg-red-50" : "border-gray-300"
          }`}
        />
        {coordsError && (
          <p className="text-xs text-red-500">Invalid format. Use: lat, lng (e.g. 45.957, 23.574)</p>
        )}
        <div
          ref={mapRef}
          className="w-full rounded-lg border border-gray-300"
          style={{ height: "200px" }}
        />
        <p className="text-xs text-gray-500">
          Paste coordinates from Google Maps or another source.
        </p>
      </fieldset>

      {/* Details */}
      <fieldset className="space-y-3">
        <legend className="text-sm font-medium text-gray-700">Details</legend>
        <input
          type="text"
          placeholder="Name (optional)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
        />
        <input
          type="tel"
          placeholder="Phone (optional)"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
        />
        <textarea
          placeholder="Notes (optional) — e.g. gate code, leave with neighbor"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none"
        />
      </fieldset>

      {/* Tags */}
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-gray-700">Tags</legend>
        <div className="relative">
          <input
            type="text"
            placeholder="Add tag (e.g. regular, apartment, leave-at-door)"
            value={tagInput}
            onChange={(e) => {
              setTagInput(e.target.value);
              setShowTagSuggestions(e.target.value.length > 0);
            }}
            onFocus={() => setShowTagSuggestions(tagInput.length > 0)}
            onBlur={() => {
              setTimeout(() => setShowTagSuggestions(false), 200);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                const newTag = tagInput.trim();
                if (newTag && !tags.includes(newTag)) {
                  setTags([...tags, newTag]);
                  setTagInput("");
                  setShowTagSuggestions(false);
                }
              }
            }}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
          />
          {showTagSuggestions && (
            <div className="absolute z-10 w-full bg-white border border-gray-300 rounded-lg mt-1 shadow-lg max-h-40 overflow-y-auto">
              {allTags
                .filter(
                  (t) =>
                    t.toLowerCase().includes(tagInput.toLowerCase()) &&
                    !tags.includes(t)
                )
                .slice(0, 5)
                .map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      setTags([...tags, suggestion]);
                      setTagInput("");
                      setShowTagSuggestions(false);
                    }}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100"
                  >
                    {suggestion}
                  </button>
                ))}
            </div>
          )}
        </div>
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {tags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center gap-1 px-2.5 py-1 bg-gray-100 text-gray-700 text-xs font-medium rounded-full"
              >
                {tag}
                <button
                  type="button"
                  onClick={() => setTags(tags.filter((t) => t !== tag))}
                  className="hover:text-red-500"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}
      </fieldset>

      {/* Preview */}
      {addressPreview && (
        <div className="bg-gray-50 rounded-lg px-3 py-2 text-sm text-gray-600">
          Preview: <span className="font-medium">{addressPreview}</span>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2 pt-2">
        <button
          type="submit"
          disabled={!street.trim() || !number.trim()}
          className="flex-1 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {initial ? "Update Client" : "Add Client"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="py-2.5 px-6 bg-gray-200 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-300 transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
