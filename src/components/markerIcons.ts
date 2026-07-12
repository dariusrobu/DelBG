import type L from "leaflet";

let icons: { pending: L.DivIcon; delivered: L.DivIcon; skipped: L.DivIcon } | null = null;

export function getMarkerIcons() {
  if (icons) return icons;

  // Dynamic import of leaflet only on client
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const L = require("leaflet") as typeof import("leaflet");

  function createIcon(color: string): L.DivIcon {
    return L.divIcon({
      className: "custom-marker",
      html: `<div style="
        width: 24px;
        height: 24px;
        border-radius: 50% 50% 50% 0;
        background: ${color};
        transform: rotate(-45deg);
        border: 2px solid white;
        box-shadow: 0 1px 4px rgba(0,0,0,0.3);
      "><div style="
        width: 10px;
        height: 10px;
        background: white;
        border-radius: 50%;
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
      "></div></div>`,
      iconSize: [24, 24],
      iconAnchor: [12, 24],
      popupAnchor: [0, -24],
    });
  }

  icons = {
    pending: createIcon("#9ca3af"),
    delivered: createIcon("#22c55e"),
    skipped: createIcon("#ef4444"),
  };

  return icons;
}
