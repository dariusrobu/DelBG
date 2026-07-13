"use client";

import { useState, useEffect, useCallback } from "react";
import dynamic from "next/dynamic";
import { Client, MenuItem, DailyManifest, ManifestSection } from "@/types";
import { getAllClients, createClient, updateClient } from "@/lib/clients";
import { createMenuItem, updateMenuItem } from "@/lib/menus";
import { createManifest, getAllManifests } from "@/lib/manifests";
import { startAutoSync, pushSync } from "@/lib/sync";
import PinCard from "@/components/PinCard";
import ClientList from "@/components/ClientList";
import MenuList from "@/components/MenuList";
import MenuForm from "@/components/MenuForm";
import ManifestList from "@/components/ManifestList";
import ManifestForm from "@/components/ManifestForm";

const ClientForm = dynamic(() => import("@/components/ClientForm"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[400px] bg-gray-100 rounded-lg flex items-center justify-center">
      <span className="text-gray-400">Loading form...</span>
    </div>
  ),
});

const DriverView = dynamic(() => import("@/components/DriverView"), {
  ssr: false,
  loading: () => (
    <div className="fixed inset-0 flex items-center justify-center bg-gray-100">
      <div className="text-gray-500 text-lg">Loading driver view...</div>
    </div>
  ),
});

const DeliveryMap = dynamic(() => import("@/components/DeliveryMap"), {
  ssr: false,
  loading: () => (
    <div className="fixed inset-0 flex items-center justify-center bg-gray-100">
      <div className="text-gray-500 text-lg">Loading map...</div>
    </div>
  ),
});

type Screen = "map" | "clients" | "menus" | "manifests";

export default function Home() {
  const [screen, setScreen] = useState<Screen>("map");
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);

  // Client form state
  const [showClientForm, setShowClientForm] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);

  // Menu form state
  const [showMenuForm, setShowMenuForm] = useState(false);
  const [editingMenu, setEditingMenu] = useState<MenuItem | null>(null);

  // Manifest form state
  const [editingManifest, setEditingManifest] = useState<DailyManifest | null>(null);

  // Driver view state
  const [drivingManifestId, setDrivingManifestId] = useState<string | null>(null);

  // Manifests for map filtering
  const [allManifests, setAllManifests] = useState<DailyManifest[]>([]);
  const [selectedManifestId, setSelectedManifestId] = useState<string | null>(null);

  // Sync state
  const loadClients = useCallback(async () => {
    const data = await getAllClients();
    setClients(data);
  }, []);

  const loadManifests = useCallback(async () => {
    const data = await getAllManifests();
    setAllManifests(data);
    setSelectedManifestId((prev) => prev ?? (data.length > 0 ? data[0].id : null));
  }, []);

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    loadClients();
    loadManifests();
    startAutoSync();
    // Initial sync: pull all data from server, then reload local state
    pushSync().then(() => {
      loadClients();
      loadManifests();
    });
  }, [loadClients, loadManifests]);

  const handleClientSelect = useCallback((client: Client) => {
    setSelectedClient(client);
  }, []);

  // Build client → section map from selected manifest
  const selectedManifest = allManifests.find((m) => m.id === selectedManifestId) ?? null;
  const clientSectionMap = new Map<string, string>();
  const manifestSections: ManifestSection[] = selectedManifest?.sections ?? [];
  if (selectedManifest) {
    for (const stop of selectedManifest.stops) {
      if (!stop.isWalkIn && stop.clientId && stop.sectionId) {
        clientSectionMap.set(stop.clientId, stop.sectionId);
      }
    }
  }

  const handleClientSave = async (data: Omit<Client, "id">) => {
    if (editingClient) {
      await updateClient(editingClient.id, data);
    } else {
      await createClient(data);
    }
    setEditingClient(null);
    setShowClientForm(false);
    loadClients();
    if (screen === "map") setScreen("clients");
  };

  const handleMenuSave = async (data: Omit<MenuItem, "id">) => {
    if (editingMenu) {
      await updateMenuItem(editingMenu.id, data);
    } else {
      await createMenuItem(data);
    }
    setEditingMenu(null);
    setShowMenuForm(false);
  };

  const handleEditClient = (client: Client) => {
    setEditingClient(client);
    setShowClientForm(true);
  };

  const handleEditMenu = (item: MenuItem) => {
    setEditingMenu(item);
    setShowMenuForm(true);
  };

  const handleEditManifest = (manifest: DailyManifest) => {
    setEditingManifest(manifest);
  };

  const handleCreateBlankManifest = async () => {
    const today = new Date().toISOString().split("T")[0];
    const manifest = await createManifest({ date: today, stops: [] });
    await loadManifests();
    setSelectedManifestId(manifest.id);
    setEditingManifest(manifest);
  };

  const handleManifestSave = () => {
    setEditingManifest(null);
    loadManifests();
  };

  // --- Full-screen form views ---

  if (drivingManifestId) {
    return (
      <DriverView
        manifestId={drivingManifestId}
        onBack={() => setDrivingManifestId(null)}
      />
    );
  }

  if (editingManifest) {
    return (
      <main className="h-full overflow-y-auto bg-gray-50">
        <div className="sticky top-0 z-10 bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => setEditingManifest(null)}
            className="text-gray-500 hover:text-gray-700"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div>
            <h1 className="text-lg font-semibold">Edit Manifest</h1>
            <p className="text-xs text-gray-500">{editingManifest.date}</p>
          </div>
        </div>
        <div className="p-4 max-w-lg mx-auto">
          <ManifestForm
            manifest={editingManifest}
            onSave={handleManifestSave}
            onCancel={() => setEditingManifest(null)}
          />
        </div>
      </main>
    );
  }

  if (showClientForm) {
    return (
      <main className="h-full overflow-y-auto bg-gray-50">
        <div className="sticky top-0 z-10 bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => {
              setShowClientForm(false);
              setEditingClient(null);
            }}
            className="text-gray-500 hover:text-gray-700"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-lg font-semibold">
            {editingClient ? "Edit Client" : "Add Client"}
          </h1>
        </div>
        <div className="p-4 max-w-lg mx-auto">
          <ClientForm
            initial={editingClient ?? undefined}
            onSave={handleClientSave}
            onCancel={() => {
              setShowClientForm(false);
              setEditingClient(null);
            }}
          />
        </div>
      </main>
    );
  }

  if (showMenuForm) {
    return (
      <main className="h-full overflow-y-auto bg-gray-50">
        <div className="sticky top-0 z-10 bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => {
              setShowMenuForm(false);
              setEditingMenu(null);
            }}
            className="text-gray-500 hover:text-gray-700"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-lg font-semibold">
            {editingMenu ? "Edit Menu" : "Add Menu"}
          </h1>
        </div>
        <div className="p-4 max-w-lg mx-auto">
          <MenuForm
            initial={editingMenu ?? undefined}
            onSave={handleMenuSave}
            onCancel={() => {
              setShowMenuForm(false);
              setEditingMenu(null);
            }}
          />
        </div>
      </main>
    );
  }

  // --- Main tabbed views ---

  return (
    <main className="relative h-full flex flex-col">
      <div className="flex-1 relative min-h-0">
        {screen === "map" && (
          <>
            <DeliveryMap
              clients={clients}
              onClientSelect={handleClientSelect}
              sections={manifestSections}
              clientSectionMap={clientSectionMap}
              manifests={allManifests}
              selectedManifestId={selectedManifestId}
              onManifestSelect={setSelectedManifestId}
            />
            {selectedClient && (
              <PinCard
                client={selectedClient}
                onClose={() => setSelectedClient(null)}
              />
            )}
          </>
        )}

        {screen === "clients" && (
          <div className="h-full overflow-y-auto bg-gray-50">
            <div className="sticky top-0 z-10 bg-white border-b border-gray-200 px-4 py-3">
              <h1 className="text-lg font-semibold">Clients</h1>
              <p className="text-xs text-gray-500">{clients.length} total</p>
            </div>
            <div className="p-4">
              <ClientList
                onEdit={handleEditClient}
                onAddNew={() => {
                  setEditingClient(null);
                  setShowClientForm(true);
                }}
              />
            </div>
          </div>
        )}

        {screen === "menus" && (
          <div className="h-full overflow-y-auto bg-gray-50">
            <div className="sticky top-0 z-10 bg-white border-b border-gray-200 px-4 py-3">
              <h1 className="text-lg font-semibold">Menus</h1>
            </div>
            <div className="p-4">
              <MenuList
                onEdit={handleEditMenu}
                onAddNew={() => {
                  setEditingMenu(null);
                  setShowMenuForm(true);
                }}
              />
            </div>
          </div>
        )}

        {screen === "manifests" && (
          <div className="h-full overflow-y-auto bg-gray-50">
            <div className="sticky top-0 z-10 bg-white border-b border-gray-200 px-4 py-3">
              <h1 className="text-lg font-semibold">Manifests</h1>
            </div>
            <div className="p-4">
              <ManifestList
                onEdit={handleEditManifest}
                onDrive={(id) => setDrivingManifestId(id)}
                onAddNew={handleCreateBlankManifest}
              />
            </div>
          </div>
        )}
      </div>

      {/* Bottom navigation */}
      <nav className="sticky bottom-0 z-20 bg-white border-t border-gray-200 flex">
        <button
          onClick={() => setScreen("map")}
          className={`flex-1 flex flex-col items-center py-2 text-xs font-medium transition-colors ${
            screen === "map"
              ? "text-blue-600"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          <svg className="w-5 h-5 mb-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
          </svg>
          Map
        </button>
        <button
          onClick={() => setScreen("clients")}
          className={`flex-1 flex flex-col items-center py-2 text-xs font-medium transition-colors ${
            screen === "clients"
              ? "text-blue-600"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          <svg className="w-5 h-5 mb-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
          Clients
        </button>
        <button
          onClick={() => setScreen("manifests")}
          className={`flex-1 flex flex-col items-center py-2 text-xs font-medium transition-colors ${
            screen === "manifests"
              ? "text-blue-600"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          <svg className="w-5 h-5 mb-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
          </svg>
          Routes
        </button>
        <button
          onClick={() => setScreen("menus")}
          className={`flex-1 flex flex-col items-center py-2 text-xs font-medium transition-colors ${
            screen === "menus"
              ? "text-blue-600"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          <svg className="w-5 h-5 mb-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
          </svg>
          Menu
        </button>
      </nav>
    </main>
  );
}
