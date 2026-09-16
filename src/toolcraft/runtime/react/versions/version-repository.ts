import type { ToolcraftWorkspaceDefaults } from "../../schema/workspace-defaults-types";
import type { ToolcraftDefaultResourceUpload } from "../../source-assets/default-resource-capture";

export type SavedVersion = {
  id: string;
  appId: string;
  createdAt: number;
  name: string;
  parentId: string | null;
  snapshot: ToolcraftWorkspaceDefaults;
};

async function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("toolcraft-saved-versions", 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      db.createObjectStore("versions", { keyPath: "id" }).createIndex("appId", "appId");
      db.createObjectStore("resources", { keyPath: "resource.ref" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error("Close other editor tabs and retry saving."));
  });
}

function result<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function listVersions(appId: string): Promise<SavedVersion[]> {
  const db = await openDatabase();
  try {
    const rows = await result<SavedVersion[]>(db.transaction("versions").objectStore("versions").index("appId").getAll(appId));
    return rows.sort((a, b) => b.createdAt - a.createdAt || b.id.localeCompare(a.id));
  } finally { db.close(); }
}

/** Publish metadata and its independent binary copies in one durable transaction. */
export async function saveVersion(version: SavedVersion, uploads: readonly ToolcraftDefaultResourceUpload[]): Promise<void> {
  const db = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(["versions", "resources"], "readwrite");
      tx.oncomplete = () => resolve();
      tx.onabort = () => reject(tx.error ?? new Error("Could not save this version. Storage may be full."));
      tx.onerror = () => {};
      for (const upload of uploads) tx.objectStore("resources").put(upload);
      tx.objectStore("versions").add(version);
    });
  } finally { db.close(); }
}

export async function readVersionResources(version: SavedVersion): Promise<ToolcraftDefaultResourceUpload[]> {
  const db = await openDatabase();
  try {
    const store = db.transaction("resources").objectStore("resources");
    const uploads = await Promise.all(version.snapshot.resources.map((resource) =>
      result<ToolcraftDefaultResourceUpload | undefined>(store.get(resource.ref)),
    ));
    if (uploads.some((upload) => !upload)) throw new Error("This version has missing artwork. Your current design has not been changed.");
    return uploads as ToolcraftDefaultResourceUpload[];
  } finally { db.close(); }
}

/** Delete a snapshot and only binaries no remaining snapshot references. */
export async function deleteVersion(appId: string, id: string): Promise<void> {
  const db = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(["versions", "resources"], "readwrite");
      tx.oncomplete = () => resolve();
      tx.onabort = () => reject(tx.error ?? new Error("Could not delete this version."));
      const versions = tx.objectStore("versions");
      const request = versions.getAll();
      request.onsuccess = () => {
        const rows = request.result as SavedVersion[];
        const removed = rows.find(row => row.id === id && row.appId === appId);
        if (!removed) return;
        versions.delete(id);
        const retained = new Set(rows.filter(row => row.id !== id).flatMap(row => row.snapshot.resources.map(resource => resource.ref)));
        for (const resource of removed.snapshot.resources) {
          if (!retained.has(resource.ref)) tx.objectStore("resources").delete(resource.ref);
        }
      };
    });
  } finally { db.close(); }
}
