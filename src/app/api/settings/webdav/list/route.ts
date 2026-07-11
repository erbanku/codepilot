import { NextRequest } from "next/server";
import { listWebDAVBackups, getCachedWebDAVFiles } from "@/lib/backup/webdav";
import { serverErrorResponse } from "@/lib/api-error";

export async function GET(request: NextRequest) {
  try {
    const cached = request.nextUrl.searchParams.get("cached");
    if (cached === "1") {
      const files = getCachedWebDAVFiles();
      return Response.json({ files, message: `Cached: ${files.length} backups` });
    }

    const result = await listWebDAVBackups();
    if (result.ok) {
      return Response.json({ files: result.files, message: result.message });
    }
    return Response.json({ files: [], message: result.message }, { status: 400 });
  } catch (error) {
    return serverErrorResponse("GET /api/settings/webdav/list", error);
  }
}
