import { getAllSettings, getAllProviders, getModelsForProvider } from "@/lib/db";
import { getDb } from "@/lib/db";
import type { ApiProvider, ProviderModel } from "@/types";
import fs from "fs";
import path from "path";
import os from "os";

export interface BackupData {
  version: number;
  exportedAt: string;
  appVersion: string;
  hostname: string;
  settings: Record<string, string>;
  providers: ApiProvider[];
  providerModels: Record<string, ProviderModel[]>;
}

const BACKUP_VERSION = 1;

function getBackupsDir(): string {
  const dir = path.join(os.homedir(), ".codepilot", "backups");
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

function getHostname(): string {
  try {
    return os.hostname() || "unknown";
  } catch {
    return "unknown";
  }
}

function getAppVersion(): string {
  try {
    return process.env.NEXT_PUBLIC_APP_VERSION || "unknown";
  } catch {
    return "unknown";
  }
}

export function createBackup(): BackupData {
  const settings = getAllSettings();
  const providers = getAllProviders();
  const providerModels: Record<string, ProviderModel[]> = {};

  for (const provider of providers) {
    providerModels[provider.id] = getModelsForProvider(provider.id);
  }

  return {
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    appVersion: getAppVersion(),
    hostname: getHostname(),
    settings: settings as Record<string, string>,
    providers,
    providerModels,
  };
}

export function createBackupFilename(): string {
  const hostname = getHostname().replace(/[^a-zA-Z0-9_-]/g, "-");
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  return `codepilot-backup-${hostname}-${timestamp}.json`;
}

export function saveBackupToLocal(data: BackupData): string {
  const dir = getBackupsDir();
  const filename = createBackupFilename();
  const filePath = path.join(dir, filename);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
  return filename;
}

export function listLocalBackups(): Array<{ name: string; size: number; lastModified: string; path: string }> {
  const dir = getBackupsDir();
  try {
    const files = fs.readdirSync(dir)
      .filter((f) => f.endsWith(".json"))
      .map((f) => {
        const fullPath = path.join(dir, f);
        const stat = fs.statSync(fullPath);
        return {
          name: f,
          size: stat.size,
          lastModified: stat.mtime.toISOString(),
          path: fullPath,
        };
      })
      .sort((a, b) => b.lastModified.localeCompare(a.lastModified));
    return files;
  } catch {
    return [];
  }
}

export function readLocalBackup(filename: string): BackupData | null {
  const dir = getBackupsDir();
  const filePath = path.join(dir, filename);
  try {
    if (!fs.existsSync(filePath)) return null;
    const raw = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(raw) as BackupData;
  } catch {
    return null;
  }
}

export function deleteLocalBackup(filename: string): boolean {
  const dir = getBackupsDir();
  const filePath = path.join(dir, filename);
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

export function restoreBackup(data: BackupData): { restored: boolean; errors: string[] } {
  const errors: string[] = [];
  const db = getDb();

  const txn = db.transaction(() => {
    // Restore settings
    if (data.settings) {
      for (const [key, value] of Object.entries(data.settings)) {
        try {
          const existing = db.prepare("SELECT id FROM settings WHERE key = ?").get(key) as { id: number } | undefined;
          if (existing) {
            db.prepare("UPDATE settings SET value = ? WHERE key = ?").run(value, key);
          } else {
            db.prepare("INSERT INTO settings (key, value) VALUES (?, ?)").run(key, value);
          }
        } catch {
          errors.push(`Failed to restore setting: ${key}`);
        }
      }
    }

    // Restore providers
    if (data.providers) {
      for (const provider of data.providers) {
        try {
          const existing = db.prepare("SELECT id FROM api_providers WHERE id = ?").get(provider.id) as { id: string } | undefined;
          if (existing) {
            db.prepare(
              `UPDATE api_providers SET name=?, provider_type=?, protocol=?, base_url=?, api_key=?, is_active=?, sort_order=?, extra_env=?, headers_json=?, env_overrides_json=?, role_models_json=?, options_json=?, notes=?, updated_at=datetime('now') WHERE id=?`
            ).run(
              provider.name, provider.provider_type, provider.protocol || "",
              provider.base_url, provider.api_key, provider.is_active,
              provider.sort_order, provider.extra_env || "{}",
              provider.headers_json || "{}", provider.env_overrides_json || "{}",
              provider.role_models_json || "{}", provider.options_json || "{}",
              provider.notes || "", provider.id
            );
          } else {
            db.prepare(
              `INSERT INTO api_providers (id, name, provider_type, protocol, base_url, api_key, is_active, sort_order, extra_env, headers_json, env_overrides_json, role_models_json, options_json, notes, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,datetime('now'),datetime('now'))`
            ).run(
              provider.id, provider.name, provider.provider_type,
              provider.protocol || "", provider.base_url, provider.api_key,
              provider.is_active, provider.sort_order,
              provider.extra_env || "{}", provider.headers_json || "{}",
              provider.env_overrides_json || "{}", provider.role_models_json || "{}",
              provider.options_json || "{}", provider.notes || ""
            );
          }
        } catch {
          errors.push(`Failed to restore provider: ${provider.name}`);
        }
      }
    }

    // Restore provider models
    if (data.providerModels) {
      for (const [providerId, models] of Object.entries(data.providerModels)) {
        for (const model of models) {
          try {
            const existing = db.prepare(
              "SELECT id FROM provider_models WHERE provider_id = ? AND model_id = ?"
            ).get(providerId, model.model_id) as { id: string } | undefined;

            if (existing) {
              db.prepare(
                `UPDATE provider_models SET display_name=?, upstream_model_id=?, capabilities_json=?, variants_json=?, sort_order=?, enabled=?, source=?, user_edited=?, enable_source=? WHERE provider_id=? AND model_id=?`
              ).run(
                model.display_name, model.upstream_model_id,
                model.capabilities_json || "{}", model.variants_json || "{}",
                model.sort_order, model.enabled, model.source || "manual",
                model.user_edited, model.enable_source || "recommended",
                providerId, model.model_id
              );
            } else {
              db.prepare(
                `INSERT INTO provider_models (id, provider_id, model_id, upstream_model_id, display_name, capabilities_json, variants_json, sort_order, enabled, source, user_edited, enable_source, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,datetime('now'))`
              ).run(
                model.id, providerId, model.model_id,
                model.upstream_model_id, model.display_name,
                model.capabilities_json || "{}", model.variants_json || "{}",
                model.sort_order, model.enabled, model.source || "manual",
                model.user_edited, model.enable_source || "recommended"
              );
            }
          } catch {
            errors.push(`Failed to restore model: ${model.model_id}`);
          }
        }
      }
    }
  });

  try {
    txn();
    return { restored: errors.length === 0, errors };
  } catch (e) {
    return { restored: false, errors: [...errors, String(e)] };
  }
}
