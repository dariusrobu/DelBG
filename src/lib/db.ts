import { openDB, DBSchema, IDBPDatabase } from "idb";
import { Client, MenuItem, DailyManifest, Stop } from "@/types";

interface DelBGDB extends DBSchema {
  clients: {
    key: string;
    value: Client;
    indexes: { "by-name": string };
  };
  menuItems: {
    key: string;
    value: MenuItem;
    indexes: { "by-date": string };
  };
  manifests: {
    key: string;
    value: DailyManifest;
    indexes: { "by-date": string };
  };
  stops: {
    key: string;
    value: Stop;
    indexes: {
      "by-manifest": string;
      "by-client": string;
    };
  };
}

let dbPromise: Promise<IDBPDatabase<DelBGDB>> | null = null;

export function getDB(): Promise<IDBPDatabase<DelBGDB>> {
  if (!dbPromise) {
    dbPromise = openDB<DelBGDB>("delbg", 1, {
      upgrade(db) {
        const clientStore = db.createObjectStore("clients", { keyPath: "id" });
        clientStore.createIndex("by-name", "name");

        const menuItemStore = db.createObjectStore("menuItems", { keyPath: "id" });
        menuItemStore.createIndex("by-date", "date");

        const manifestStore = db.createObjectStore("manifests", { keyPath: "id" });
        manifestStore.createIndex("by-date", "date");

        const stopStore = db.createObjectStore("stops", { keyPath: "id" });
        stopStore.createIndex("by-manifest", "manifestId");
        stopStore.createIndex("by-client", "clientId");
      },
    });
  }
  return dbPromise;
}
