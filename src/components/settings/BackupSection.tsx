"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useTranslation } from "@/hooks/useTranslation";
import type { TranslationKey } from "@/i18n";
import { SettingsCard } from "@/components/patterns/SettingsCard";
import { FieldRow } from "@/components/patterns/FieldRow";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CodePilotIcon } from "@/components/ui/semantic-icon";
import { showToast } from "@/hooks/useToast";
import { cn } from "@/lib/utils";

interface BackupFile {
  name: string;
  size: number;
  lastModified: string;
}

export function BackupSection() {
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Export
  const [exporting, setExporting] = useState(false);
  const [saving, setSaving] = useState(false);

  // Import
  const [importing, setImporting] = useState(false);

  // Local backups
  const [localFiles, setLocalFiles] = useState<BackupFile[]>([]);
  const [loadingLocal, setLoadingLocal] = useState(false);
  const [restoringLocal, setRestoringLocal] = useState<string | null>(null);

  // WebDAV
  const [webdavUrl, setWebdavUrl] = useState("");
  const [webdavUsername, setWebdavUsername] = useState("");
  const [webdavPassword, setWebdavPassword] = useState("");
  const [webdavPath, setWebdavPath] = useState("/codepilot-backups");
  const [webdavConfigured, setWebdavConfigured] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [remoteFiles, setRemoteFiles] = useState<BackupFile[]>([]);
  const [loadingRemote, setLoadingRemote] = useState(false);
  const [restoringRemote, setRestoringRemote] = useState<string | null>(null);

  const loadLocalBackups = useCallback(async () => {
    setLoadingLocal(true);
    try {
      const res = await fetch("/api/settings/backup?action=list");
      const data = await res.json();
      setLocalFiles(data.files || []);
    } catch {
      // ignore
    } finally {
      setLoadingLocal(false);
    }
  }, []);

  // Load local backups + WebDAV config on mount
  useEffect(() => {
    loadLocalBackups();
    fetch("/api/settings/webdav/config")
      .then((r) => r.json())
      .then((data) => {
        if (data.config?.url) {
          setWebdavUrl(data.config.url);
          setWebdavUsername(data.config.username || "");
          setWebdavPassword(data.config.password || "");
          setWebdavPath(data.config.path || "/codepilot-backups");
          setWebdavConfigured(true);
          // Load cached remote files on mount
          fetch("/api/settings/webdav/list?cached=1")
            .then((r) => r.json())
            .then((d) => setRemoteFiles(d.files || []))
            .catch(() => {});
        }
      })
      .catch(() => {});
  }, [loadLocalBackups]);

  const handleExportDownload = useCallback(async () => {
    setExporting(true);
    try {
      const res = await fetch("/api/settings/backup");
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `codepilot-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      showToast({ type: "success", message: "Export complete" });
      loadLocalBackups();
    } catch {
      showToast({ type: "error", message: "Export failed" });
    } finally {
      setExporting(false);
    }
  }, [loadLocalBackups]);

  const handleSaveLocal = useCallback(async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/settings/backup", { method: "POST" });
      const result = await res.json();
      if (result.success) {
        showToast({ type: "success", message: `Saved: ${result.filename}` });
        loadLocalBackups();
      }
    } catch {
      showToast({ type: "error", message: "Save failed" });
    } finally {
      setSaving(false);
    }
  }, [loadLocalBackups]);

  const handleImport = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      const res = await fetch("/api/settings/restore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const result = await res.json();
      if (res.ok && result.success) {
        showToast({ type: "success", message: t("settings.backup.importSuccess") });
        loadLocalBackups();
      } else {
        showToast({ type: "error", message: result.errors?.join(", ") || t("settings.backup.importFailed") });
      }
    } catch {
      showToast({ type: "error", message: t("settings.backup.importFailed") });
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }, [t, loadLocalBackups]);

  const handleRestoreLocal = useCallback(async (filename: string) => {
    if (!confirm(t("settings.backup.webdav.pullConfirm"))) return;
    setRestoringLocal(filename);
    try {
      const res = await fetch(`/api/settings/backup?action=restore&filename=${encodeURIComponent(filename)}`);
      const result = await res.json();
      if (result.success) {
        showToast({ type: "success", message: t("settings.backup.importSuccess") });
      } else {
        showToast({ type: "error", message: result.errors?.join(", ") || t("settings.backup.importFailed") });
      }
    } catch {
      showToast({ type: "error", message: "Restore failed" });
    } finally {
      setRestoringLocal(null);
    }
  }, [t]);

  const handleDeleteLocal = useCallback(async (filename: string) => {
    if (!confirm(`Delete ${filename}?`)) return;
    try {
      const res = await fetch(`/api/settings/backup?action=delete&filename=${encodeURIComponent(filename)}`);
      if (res.ok) {
        setLocalFiles((prev) => prev.filter((f) => f.name !== filename));
        showToast({ type: "success", message: "Deleted" });
      }
    } catch {
      showToast({ type: "error", message: "Delete failed" });
    }
  }, []);

  // WebDAV handlers
  const handleTestConnection = useCallback(async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/settings/webdav/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: webdavUrl, username: webdavUsername, password: webdavPassword, path: webdavPath }),
      });
      const result = await res.json();
      setTestResult(result);
      if (result.ok) setWebdavConfigured(true);
    } catch {
      setTestResult({ ok: false, message: "Request failed" });
    } finally {
      setTesting(false);
    }
  }, [webdavUrl, webdavUsername, webdavPassword, webdavPath]);

  const handleDisconnect = useCallback(async () => {
    await fetch("/api/settings/webdav/config", { method: "DELETE" });
    setWebdavConfigured(false);
    setWebdavUrl("");
    setWebdavUsername("");
    setWebdavPassword("");
    setTestResult(null);
    setRemoteFiles([]);
  }, []);

  const handlePushSync = useCallback(async () => {
    setSyncing(true);
    try {
      const res = await fetch("/api/settings/webdav/sync", { method: "POST" });
      const result = await res.json();
      showToast({ type: result.success ? "success" : "error", message: result.message });
      if (result.success) {
        // Refresh cached list after push
        const listRes = await fetch("/api/settings/webdav/list?cached=1");
        const listData = await listRes.json();
        setRemoteFiles(listData.files || []);
      }
    } catch {
      showToast({ type: "error", message: "Sync failed" });
    } finally {
      setSyncing(false);
    }
  }, []);

  const handleLoadRemote = useCallback(async () => {
    setLoadingRemote(true);
    try {
      const res = await fetch("/api/settings/webdav/list");
      const data = await res.json();
      setRemoteFiles(data.files || []);
      if (data.files?.length === 0) {
        showToast({ type: "info", message: t("settings.backup.webdav.noBackups") });
      }
    } catch {
      showToast({ type: "error", message: "Failed to list backups" });
    } finally {
      setLoadingRemote(false);
    }
  }, [t]);

  const handlePullRestore = useCallback(async (filename: string) => {
    if (!confirm(t("settings.backup.webdav.pullConfirm"))) return;
    setRestoringRemote(filename);
    try {
      const res = await fetch(`/api/settings/webdav/pull?filename=${encodeURIComponent(filename)}`);
      const result = await res.json();
      if (result.success && result.data) {
        const restoreRes = await fetch("/api/settings/restore", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(result.data),
        });
        const restoreResult = await restoreRes.json();
        showToast({
          type: restoreResult.success ? "success" : "error",
          message: restoreResult.success
            ? t("settings.backup.importSuccess")
            : (restoreResult.errors?.join(", ") || t("settings.backup.importFailed")),
        });
      } else {
        showToast({ type: "error", message: result.message });
      }
    } catch {
      showToast({ type: "error", message: "Restore failed" });
    } finally {
      setRestoringRemote(null);
    }
  }, [t]);

  const handleDeleteRemote = useCallback(async (filename: string) => {
    if (!confirm(`Delete ${filename} from server?`)) return;
    try {
      const res = await fetch(`/api/settings/webdav/pull?filename=${encodeURIComponent(filename)}`, { method: "DELETE" });
      if (res.ok) {
        setRemoteFiles((prev) => prev.filter((f) => f.name !== filename));
        showToast({ type: "success", message: "Deleted" });
      }
    } catch {
      showToast({ type: "error", message: "Delete failed" });
    }
  }, []);

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDate = (iso: string) => {
    try { return new Date(iso).toLocaleString(); } catch { return "-"; }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">{t("settings.backup" as TranslationKey)}</h2>
        <p className="text-xs text-muted-foreground">{t("settings.backupDesc" as TranslationKey)}</p>
      </div>

      {/* Export / Save */}
      <SettingsCard>
        <FieldRow
          label={t("settings.backup.export" as TranslationKey)}
          description={t("settings.backup.exportDesc" as TranslationKey)}
        >
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleSaveLocal} disabled={saving}>
              <CodePilotIcon name="disk" size="sm" className="mr-1" aria-hidden />
              {saving ? "..." : "Save Backup"}
            </Button>
            <Button variant="outline" size="sm" onClick={handleExportDownload} disabled={exporting}>
              <CodePilotIcon name="download" size="sm" className="mr-1" aria-hidden />
              {exporting ? "..." : t("settings.backup.exportButton" as TranslationKey)}
            </Button>
          </div>
        </FieldRow>

        <FieldRow
          label={t("settings.backup.import" as TranslationKey)}
          description={t("settings.backup.importDesc" as TranslationKey)}
          separator
        >
          <input ref={fileInputRef} type="file" accept=".json" onChange={handleImport} className="hidden" />
          <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={importing}>
            <CodePilotIcon name="upload" size="sm" className="mr-1" aria-hidden />
            {importing ? "..." : t("settings.backup.importButton" as TranslationKey)}
          </Button>
        </FieldRow>
      </SettingsCard>

      {/* Local Backups */}
      <SettingsCard>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-sm font-semibold">Local Backups</h3>
            <p className="text-xs text-muted-foreground">Backups stored in ~/.codepilot/backups/</p>
          </div>
          <Button variant="ghost" size="sm" onClick={loadLocalBackups} disabled={loadingLocal}>
            <CodePilotIcon name="refresh" size="sm" className="mr-1" aria-hidden />
            {loadingLocal ? "..." : "Refresh"}
          </Button>
        </div>

        {localFiles.length > 0 ? (
          <div className="rounded-lg border border-border/50 divide-y divide-border/30">
            {localFiles.map((f) => (
              <div key={f.name} className="flex items-center gap-2 px-3 py-2">
                <CodePilotIcon name="file" size="sm" className="text-muted-foreground shrink-0" aria-hidden />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">{f.name}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {formatSize(f.size)} &middot; {formatDate(f.lastModified)}
                  </p>
                </div>
                <Button
                  variant="ghost" size="sm" className="h-7 px-2 text-[11px]"
                  disabled={restoringLocal === f.name}
                  onClick={() => handleRestoreLocal(f.name)}
                >
                  {restoringLocal === f.name ? "..." : "Restore"}
                </Button>
                <Button
                  variant="ghost" size="icon-xs" className="h-6 w-6 text-muted-foreground hover:text-destructive"
                  onClick={() => handleDeleteLocal(f.name)}
                >
                  <CodePilotIcon name="delete" size="sm" aria-hidden />
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground py-4 text-center">
            No local backups yet. Click "Save Backup" to create one.
          </p>
        )}
      </SettingsCard>

      {/* WebDAV Sync */}
      <SettingsCard>
        <div className="mb-4">
          <h3 className="text-sm font-semibold">{t("settings.backup.webdav" as TranslationKey)}</h3>
          <p className="text-xs text-muted-foreground">{t("settings.backup.webdavDesc" as TranslationKey)}</p>
          {webdavConfigured && (
            <span className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full bg-status-success-muted text-[10px] font-medium text-status-success-foreground">
              <span className="h-1.5 w-1.5 rounded-full bg-status-success" />
              {t("settings.backup.webdav.configured" as TranslationKey)}
            </span>
          )}
        </div>

        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">{t("settings.backup.webdav.url" as TranslationKey)}</label>
              <Input value={webdavUrl} onChange={(e) => setWebdavUrl(e.target.value)} placeholder="https://your-server.com/remote.php/dav/files/user" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">{t("settings.backup.webdav.path" as TranslationKey)}</label>
              <Input value={webdavPath} onChange={(e) => setWebdavPath(e.target.value)} placeholder="/codepilot-backups" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">{t("settings.backup.webdav.username" as TranslationKey)}</label>
              <Input value={webdavUsername} onChange={(e) => setWebdavUsername(e.target.value)} placeholder="username" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">{t("settings.backup.webdav.password" as TranslationKey)}</label>
              <Input type="password" value={webdavPassword} onChange={(e) => setWebdavPassword(e.target.value)} placeholder="••••••••" />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleTestConnection} disabled={testing || !webdavUrl}>
              {testing ? t("settings.backup.webdav.testing" as TranslationKey) : t("settings.backup.webdav.test" as TranslationKey)}
            </Button>
            {webdavConfigured && (
              <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={handleDisconnect}>
                {t("settings.backup.webdav.disconnect" as TranslationKey)}
              </Button>
            )}
          </div>

          {testResult && (
            <p className={cn("text-xs", testResult.ok ? "text-status-success-foreground" : "text-destructive")}>
              {testResult.message}
            </p>
          )}
        </div>

        {webdavConfigured && (
          <div className="mt-6 pt-4 border-t border-border/50 space-y-4">
            <div className="flex items-center gap-2">
              <Button variant="default" size="sm" onClick={handlePushSync} disabled={syncing}>
                <CodePilotIcon name="upload_cloud" size="sm" className="mr-1" aria-hidden />
                {syncing ? t("settings.backup.webdav.pushing" as TranslationKey) : t("settings.backup.webdav.pushNow" as TranslationKey)}
              </Button>
              <Button variant="outline" size="sm" onClick={handleLoadRemote} disabled={loadingRemote}>
                <CodePilotIcon name="refresh" size="sm" className="mr-1" aria-hidden />
                {loadingRemote ? "..." : t("settings.backup.webdav.remoteBackups" as TranslationKey)}
              </Button>
            </div>

            {remoteFiles.length > 0 && (
              <div className="space-y-1">
                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
                  {t("settings.backup.webdav.remoteBackups" as TranslationKey)} ({remoteFiles.length})
                </p>
                <div className="rounded-lg border border-border/50 divide-y divide-border/30">
                  {remoteFiles.map((f) => (
                    <div key={f.name} className="flex items-center gap-2 px-3 py-2">
                      <CodePilotIcon name="file" size="sm" className="text-muted-foreground shrink-0" aria-hidden />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate">{f.name}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {formatSize(f.size)} &middot; {f.lastModified ? new Date(f.lastModified).toLocaleDateString() : "-"}
                        </p>
                      </div>
                      <Button variant="ghost" size="sm" className="h-7 px-2 text-[11px]" disabled={restoringRemote === f.name} onClick={() => handlePullRestore(f.name)}>
                        {restoringRemote === f.name ? "..." : "Restore"}
                      </Button>
                      <Button variant="ghost" size="icon-xs" className="h-6 w-6 text-muted-foreground hover:text-destructive" onClick={() => handleDeleteRemote(f.name)}>
                        <CodePilotIcon name="delete" size="sm" aria-hidden />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {remoteFiles.length === 0 && !loadingRemote && (
              <p className="text-xs text-muted-foreground">{t("settings.backup.webdav.noBackups" as TranslationKey)}</p>
            )}
          </div>
        )}
      </SettingsCard>
    </div>
  );
}
