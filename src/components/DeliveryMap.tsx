"use client";

import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";
import "leaflet.markercluster";
import { Client } from "@/types";
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
}

export default function DeliveryMap({ clients, onClientSelect }: DeliveryMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const [filterTag, setFilterTag] = useState<string>("");
  const [allTags, setAllTags] = useState<string[]>([]);

  useEffect(() => {
    getAllTags().then(setAllTags);
  }, []);

  const filteredClients = filterTag
    ? clients.filter((c) => c.tags?.includes(filterTag))
    : clients;

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

    // Fit bounds to show all markers
    if (filteredClients.length > 0) {
      const bounds = L.latLngBounds(
        filteredClients.map((c) => [c.lat, c.lng] as [number, number])
      );
      map.fitBounds(bounds, { padding: [40, 40] });
    }

    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, [filteredClients, onClientSelect]);

  return (
    <div className="fixed inset-0 w-full h-full" style={{ zIndex: 0 }}>
      {/* Tag filter bar */}
      {allTags.length > 0 && (
        <div className="absolute top-2 left-2 right-2 z-[1000] flex flex-wrap gap-1.5 bg-white/95 backdrop-blur-sm rounded-lg p-2 shadow-md">
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
      <div
        ref={mapRef}
        className="w-full h-full"
      />
    </div>
  );
}
