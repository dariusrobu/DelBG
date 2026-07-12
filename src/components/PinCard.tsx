"use client";

import { Client } from "@/types";

interface PinCardProps {
  client: Client;
  onClose: () => void;
}

export default function PinCard({ client, onClose }: PinCardProps) {
  const addressParts = [
    `Strada ${client.street}`,
    `nr. ${client.number}`,
    client.bloc ? `bl. ${client.bloc}` : null,
    client.apartment ? `ap. ${client.apartment}` : null,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 sm:bottom-4 sm:left-4 sm:right-auto sm:w-96">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl border border-gray-200 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900 text-base truncate pr-2">
            {client.name || addressParts}
          </h3>
          <button
            onClick={onClose}
            className="shrink-0 w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors"
            aria-label="Close"
          >
            <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="px-4 py-3 space-y-2">
          {/* Address */}
          <div className="flex items-start gap-2">
            <svg className="w-4 h-4 mt-0.5 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <p className="text-sm text-gray-600">{addressParts}</p>
          </div>

          {/* Phone */}
          {client.phone && (
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
              <a href={`tel:${client.phone}`} className="text-sm text-blue-600 hover:underline">
                {client.phone}
              </a>
            </div>
          )}

          {/* Notes */}
          {client.notes && (
            <div className="flex items-start gap-2">
              <svg className="w-4 h-4 mt-0.5 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
              </svg>
              <p className="text-sm text-gray-600">{client.notes}</p>
            </div>
          )}

          {/* Coordinates */}
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
            </svg>
            <p className="text-xs text-gray-400 font-mono">
              {client.lat.toFixed(6)}, {client.lng.toFixed(6)}
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="px-4 py-3 border-t border-gray-100 flex gap-2">
          <button className="flex-1 py-2.5 px-4 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors">
            Delivered
          </button>
          <button className="flex-1 py-2.5 px-4 bg-red-500 text-white text-sm font-medium rounded-lg hover:bg-red-600 transition-colors">
            Skipped
          </button>
          <a
            href={`https://www.google.com/maps/dir/?api=1&destination=${client.lat},${client.lng}`}
            target="_blank"
            rel="noopener noreferrer"
            className="py-2.5 px-4 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors text-center"
          >
            Navigate
          </a>
        </div>
      </div>
    </div>
  );
}
