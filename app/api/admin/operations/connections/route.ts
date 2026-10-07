import { NextRequest } from "next/server";
import { requireAdminApi } from "@/src/lib/requireAdminApi";
import { getOperationsConnections } from "@/src/server/operations/OperationsConnections";
import {
  operationsError,
  privateHeaders,
} from "@/src/server/operations/OperationsHttp";
export async function GET(request: NextRequest) {
  try {
    await requireAdminApi(request);
    return Response.json(getOperationsConnections(), {
      headers: privateHeaders,
    });
  } catch (e) {
    return operationsError(e);
  }
}
