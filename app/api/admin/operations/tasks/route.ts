import { NextRequest } from "next/server";
import { requireAdminApi } from "@/src/lib/requireAdminApi";
import {
  createOperationalTask,
  mutateOperationalTask,
} from "@/src/server/operations/OperationalTaskServer";
import { getOperationalOverview } from "@/src/server/operations/OperationalOverviewServer";
import {
  operationsError,
  privateHeaders,
  readOperationsBody,
} from "@/src/server/operations/OperationsHttp";
export const runtime = "nodejs";
export async function GET(request: NextRequest) {
  try {
    const { uid } = await requireAdminApi(request);
    const season = request.nextUrl.searchParams.get("season") ?? undefined;
    if (season && !/^[\w-]{1,128}$/.test(season))
      throw new Error("INVALID_INPUT");
    return Response.json(await getOperationalOverview(uid, season), {
      headers: privateHeaders,
    });
  } catch (e) {
    return operationsError(e);
  }
}
export async function POST(request: NextRequest) {
  try {
    const { uid } = await requireAdminApi(request);
    if (Number(request.headers.get("content-length") ?? 0) > 12000)
      throw new Error("INVALID_INPUT");
    const body = await readOperationsBody(request);
    return Response.json(await createOperationalTask(uid, body), {
      status: 201,
      headers: privateHeaders,
    });
  } catch (e) {
    return operationsError(e);
  }
}
export async function PATCH(request: NextRequest) {
  try {
    const { uid } = await requireAdminApi(request);
    if (Number(request.headers.get("content-length") ?? 0) > 12000)
      throw new Error("INVALID_INPUT");
    const body = await readOperationsBody(request);
    if (!body || typeof body !== "object" || Array.isArray(body))
      throw new Error("INVALID_INPUT");
    return Response.json(
      await mutateOperationalTask(uid, body as Record<string, unknown>),
      { headers: privateHeaders },
    );
  } catch (e) {
    return operationsError(e);
  }
}
