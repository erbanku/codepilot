import { NextRequest } from "next/server";
import { createBackup, listLocalBackups, readLocalBackup, deleteLocalBackup, saveBackupToLocal, restoreBackup, type BackupData } from "@/lib/backup/service";
import { serverErrorResponse } from "@/lib/api-error";

export async function GET(request: NextRequest) {
  try {
    const action = request.nextUrl.searchParams.get("action");

    // List local backups
    if (action === "list") {
      const files = listLocalBackups();
      return Response.json({ files });
    }

    // Restore from local backup
    if (action === "restore") {
      const filename = request.nextUrl.searchParams.get("filename");
      if (!filename) {
        return Response.json({ error: "filename is required" }, { status: 400 });
      }
      const data = readLocalBackup(filename);
      if (!data) {
        return Response.json({ error: "Backup file not found" }, { status: 404 });
      }
      const result = restoreBackup(data);
      return Response.json({ success: result.restored, errors: result.errors });
    }

    // Delete local backup
    if (action === "delete") {
      const filename = request.nextUrl.searchParams.get("filename");
      if (!filename) {
        return Response.json({ error: "filename is required" }, { status: 400 });
      }
      const ok = deleteLocalBackup(filename);
      return Response.json({ success: ok });
    }

    // Default: download backup (also saves locally)
    const backup = createBackup();
    saveBackupToLocal(backup);
    const json = JSON.stringify(backup, null, 2);

    return new Response(json, {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="codepilot-backup-${new Date().toISOString().slice(0, 10)}.json"`,
      },
    });
  } catch (error) {
    return serverErrorResponse("GET /api/settings/backup", error);
  }
}

export async function POST(request: NextRequest) {
  // Save backup locally without downloading
  try {
    const backup = createBackup();
    const filename = saveBackupToLocal(backup);
    return Response.json({ success: true, filename });
  } catch (error) {
    return serverErrorResponse("POST /api/settings/backup", error);
  }
}
