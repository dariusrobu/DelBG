"use client";

import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const SEBES_CENTER: [number, number] = [45.95, 23.57];
const DEFAULT_ZOOM = 14;

interface PinDropMapProps {
  initialLat?: number;
  initialLng?: number;
  onPinDrop: (lat: number, lng: number) => void;
}

export default function PinDropMap({
  initialLat,
  initialLng,
  onPinDrop,
}: PinDropMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const [coords, setCoords] = useState<{
    lat: number;
    lng: number;
  } | null>(initialLat && initialLng ? { lat: initialLat, lng: initialLng } : null);

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    const center: [number, number] =
      initialLat && initialLng ? [initialLat, initialLng] : SEBES_CENTER;

    const map = L.map(mapRef.current, {
      center,
      zoom: initialLat && initialLng ? DEFAULT_ZOOM : 12,
      zoomControl: false,
    });

    L.control.zoom({ position: "topright" }).addTo(map);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map);

    // Place initial marker if coordinates provided
    if (initialLat && initialLng) {
      const marker = L.marker([initialLat, initialLng], {
        draggable: true,
      }).addTo(map);
      markerRef.current = marker;

      marker.on("dragend", () => {
        const pos = marker.getLatLng();
        setCoords({ lat: pos.lat, lng: pos.lng });
        onPinDrop(pos.lat, pos.lng);
      });
    }

    // Click to place/move marker
    map.on("click", (e: L.LeafletMouseEvent) => {
      const { lat, lng } = e.latlng;

      if (markerRef.current) {
        markerRef.current.setLatLng([lat, lng]);
      } else {
        const marker = L.marker([lat, lng], {
          draggable: true,
        }).addTo(map);
        markerRef.current = marker;

        marker.on("dragend", () => {
          const pos = marker.getLatLng();
          setCoords({ lat: pos.lat, lng: pos.lng });
          onPinDrop(pos.lat, pos.lng);
        });
      }

      setCoords({ lat, lng });
      onPinDrop(lat, lng);
    });

    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
      markerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="relative w-full">
      <div
        ref={mapRef}
        className="w-full rounded-lg border border-gray-300"
        style={{ height: "300px" }}
      />
      {coords && (
        <div className="absolute bottom-2 left-2 bg-white/90 backdrop-blur-sm rounded px-2 py-1 text-xs font-mono text-gray-600 shadow">
          {coords.lat.toFixed(6)}, {coords.lng.toFixed(6)}
        </div>
      )}
      <p className="mt-1 text-xs text-gray-500">
        Tap the map to drop a pin. Drag to adjust.
      </p>
    </div>
  );
}
