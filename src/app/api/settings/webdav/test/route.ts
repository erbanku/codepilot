import { NextRequest } from "next/server";
import { testWebDAVConnection, saveWebDAVConfig, type WebDAVConfig } from "@/lib/backup/webdav";
import { serverErrorResponse } from "@/lib/api-error";

export async function POST(request: NextRequest) {
  try {
    const config = await request.json() as WebDAVConfig;
    const result = await testWebDAVConnection(config);

    if (result.ok && config) {
      saveWebDAVConfig(config);
    }

    return Response.json(result);
  } catch (error) {
    return serverErrorResponse("POST /api/settings/webdav/test", error);
  }
}
