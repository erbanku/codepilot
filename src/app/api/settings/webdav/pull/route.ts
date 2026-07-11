import { NextRequest } from "next/server";
import { pullBackupFromWebDAV, deleteWebDAVBackup } from "@/lib/backup/webdav";
import { serverErrorResponse } from "@/lib/api-error";

export async function GET(request: NextRequest) {
  try {
    const filename = request.nextUrl.searchParams.get("filename");
    if (!filename) {
      return Response.json({ error: "filename is required" }, { status: 400 });
    }

    const result = await pullBackupFromWebDAV(filename);
    if (result.ok && result.data) {
      return Response.json({ success: true, data: JSON.parse(result.data), filename });
    }
    return Response.json({ success: false, message: result.message }, { status: 400 });
  } catch (error) {
    return serverErrorResponse("GET /api/settings/webdav/pull", error);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const filename = request.nextUrl.searchParams.get("filename");
    if (!filename) {
      return Response.json({ error: "filename is required" }, { status: 400 });
    }

    const result = await deleteWebDAVBackup(filename);
    if (result.ok) {
      return Response.json({ success: true });
    }
    return Response.json({ success: false, message: result.message }, { status: 400 });
  } catch (error) {
    return serverErrorResponse("DELETE /api/settings/webdav/pull", error);
  }
}
