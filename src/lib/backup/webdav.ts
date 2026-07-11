import { createClient, type WebDAVClient } from "webdav";
import { getSetting, setSetting } from "@/lib/db";

const WEBDAV_CONFIG_KEY = "backup_webdav_config";
const WEBDAV_FILES_CACHE_KEY = "backup_webdav_files_cache";

export interface WebDAVConfig {
  url: string;
  username: string;
  password: string;
  path: string; // e.g. "/codepilot/backups"
}

export interface RemoteBackupFile {
  name: string;
  size: number;
  lastModified: string;
}

function getWebDAVConfig(): WebDAVConfig | null {
  try {
    const raw = getSetting(WEBDAV_CONFIG_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as WebDAVConfig;
  } catch {
    return null;
  }
}

function getCachedFiles(): RemoteBackupFile[] {
  try {
    const raw = getSetting(WEBDAV_FILES_CACHE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as RemoteBackupFile[];
  } catch {
    return [];
  }
}

function setCachedFiles(files: RemoteBackupFile[]): void {
  setSetting(WEBDAV_FILES_CACHE_KEY, JSON.stringify(files));
}

export function saveWebDAVConfig(config: WebDAVConfig): void {
  setSetting(WEBDAV_CONFIG_KEY, JSON.stringify(config));
}

export function getWebDAVConfigPublic(): WebDAVConfig | null {
  return getWebDAVConfig();
}

function createWebDAVClient(override?: WebDAVConfig): WebDAVClient | null {
  const config = override ?? getWebDAVConfig();
  if (!config?.url) return null;

  // Remove trailing slashes from URL
  const cleanUrl = config.url.replace(/\/+$/, "");

  return createClient(cleanUrl, {
    username: config.username || undefined,
    password: config.password || undefined,
  });
}

export async function testWebDAVConnection(override?: WebDAVConfig): Promise<{ ok: boolean; message: string }> {
  const client = createWebDAVClient(override);
  if (!client) {
    return { ok: false, message: "WebDAV not configured" };
  }
  try {
    const items = await client.getDirectoryContents("/");
    return { ok: true, message: `Connected (${items.length} items at root)` };
  } catch (e) {
    return { ok: false, message: `Connection failed: ${e instanceof Error ? e.message : String(e)}` };
  }
}

export async function pushBackupToWebDAV(data: string, filename: string): Promise<{ ok: boolean; message: string }> {
  const client = createWebDAVClient();
  if (!client) {
    return { ok: false, message: "WebDAV not configured" };
  }

  const config = getWebDAVConfig();
  const basePath = config?.path?.replace(/\/+$/, "") || "/codepilot-backups";
  const filePath = `${basePath}/${filename}`;

  try {
    // Ensure directory exists
    const dirs = basePath.split("/").filter(Boolean);
    let currentPath = "";
    for (const dir of dirs) {
      currentPath += "/" + dir;
      try {
        await client.createDirectory(currentPath);
      } catch {
        // Directory may already exist
      }
    }

    await client.putFileContents(filePath, data, { overwrite: true });
    // Update cache with the new file
    try {
      const cached = getCachedFiles();
      cached.unshift({ name: filename, size: data.length, lastModified: new Date().toISOString() });
      setCachedFiles(cached);
    } catch { /* cache is best-effort */ }
    return { ok: true, message: `Uploaded to ${filePath}` };
  } catch (e) {
    return { ok: false, message: `Upload failed: ${e instanceof Error ? e.message : String(e)}` };
  }
}

export function getCachedWebDAVFiles(): RemoteBackupFile[] {
  return getCachedFiles();
}

export async function listWebDAVBackups(): Promise<{ ok: boolean; files: RemoteBackupFile[]; message: string }> {
  const client = createWebDAVClient();
  if (!client) {
    return { ok: false, files: [], message: "WebDAV not configured" };
  }

  const config = getWebDAVConfig();
  const basePath = config?.path?.replace(/\/+$/, "") || "/codepilot-backups";

  try {
    const items = await client.getDirectoryContents(basePath);
    const files = items
      .filter((item: any) => item.type === "file")
      .map((item: any) => ({
        name: item.basename,
        size: item.size || 0,
        lastModified: item.lastmod || "",
      }))
      .sort((a, b) => b.lastModified.localeCompare(a.lastModified));
    // Cache for instant display next time
    setCachedFiles(files);
    return { ok: true, files, message: `Found ${files.length} backups` };
  } catch (e) {
    // Fall back to cached files if live fetch fails
    const cached = getCachedFiles();
    if (cached.length > 0) {
      return { ok: true, files: cached, message: "Showing cached list (server unreachable)" };
    }
    return { ok: false, files: [], message: `List failed: ${e instanceof Error ? e.message : String(e)}` };
  }
}

export async function pullBackupFromWebDAV(filename: string): Promise<{ ok: boolean; data?: string; message: string }> {
  const client = createWebDAVClient();
  if (!client) {
    return { ok: false, message: "WebDAV not configured" };
  }

  const config = getWebDAVConfig();
  const basePath = config?.path?.replace(/\/+$/, "") || "/codepilot-backups";
  const filePath = `${basePath}/${filename}`;

  try {
    const content = await client.getFileContents(filePath, { format: "text" });
    return { ok: true, data: content as string, message: `Downloaded ${filename}` };
  } catch (e) {
    return { ok: false, message: `Download failed: ${e instanceof Error ? e.message : String(e)}` };
  }
}

export async function deleteWebDAVBackup(filename: string): Promise<{ ok: boolean; message: string }> {
  const client = createWebDAVClient();
  if (!client) {
    return { ok: false, message: "WebDAV not configured" };
  }

  const config = getWebDAVConfig();
  const basePath = config?.path?.replace(/\/+$/, "") || "/codepilot-backups";
  const filePath = `${basePath}/${filename}`;

  try {
    await client.deleteFile(filePath);
    return { ok: true, message: `Deleted ${filename}` };
  } catch (e) {
    return { ok: false, message: `Delete failed: ${e instanceof Error ? e.message : String(e)}` };
  }
}
