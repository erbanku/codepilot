import { getWebDAVConfigPublic, saveWebDAVConfig, type WebDAVConfig } from "@/lib/backup/webdav";
import { serverErrorResponse } from "@/lib/api-error";

export async function GET() {
  try {
    const config = getWebDAVConfigPublic();
    return Response.json({ config: config || null });
  } catch (error) {
    return serverErrorResponse("GET /api/settings/webdav/config", error);
  }
}

export async function PUT(request: Request) {
  try {
    const config = await request.json() as WebDAVConfig;
    saveWebDAVConfig(config);
    return Response.json({ success: true });
  } catch (error) {
    return serverErrorResponse("PUT /api/settings/webdav/config", error);
  }
}

export async function DELETE() {
  try {
    saveWebDAVConfig({ url: "", username: "", password: "", path: "" });
    return Response.json({ success: true });
  } catch (error) {
    return serverErrorResponse("DELETE /api/settings/webdav/config", error);
  }
}
