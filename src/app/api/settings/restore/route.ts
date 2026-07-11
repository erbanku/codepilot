import { NextRequest } from "next/server";
import { restoreBackup, type BackupData } from "@/lib/backup/service";
import { serverErrorResponse } from "@/lib/api-error";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const data = body as BackupData;

    if (!data || typeof data !== "object" || !data.settings) {
      return Response.json({ error: "Invalid backup data: missing settings" }, { status: 400 });
    }

    const result = restoreBackup(data);
    if (result.restored) {
      return Response.json({ success: true });
    }
    return Response.json({ success: false, errors: result.errors }, { status: 207 });
  } catch (error) {
    return serverErrorResponse("POST /api/settings/restore", error);
  }
}
