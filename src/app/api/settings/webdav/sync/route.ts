import { createBackup, createBackupFilename } from "@/lib/backup/service";
import { pushBackupToWebDAV } from "@/lib/backup/webdav";
import { serverErrorResponse } from "@/lib/api-error";

export async function POST() {
  try {
    const backup = createBackup();
    const json = JSON.stringify(backup);
    const filename = createBackupFilename();

    const result = await pushBackupToWebDAV(json, filename);
    if (result.ok) {
      return Response.json({ success: true, filename, message: result.message });
    }
    return Response.json({ success: false, message: result.message }, { status: 400 });
  } catch (error) {
    return serverErrorResponse("POST /api/settings/webdav/sync", error);
  }
}
