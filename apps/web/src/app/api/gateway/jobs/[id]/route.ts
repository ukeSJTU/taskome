import { getJob } from "@taskome/api-client";

import { gatewayErrorResponse } from "../../error-response";

export async function GET(_request: Request, context: RouteContext<"/api/gateway/jobs/[id]">) {
  try {
    const { id } = await context.params;
    return Response.json(await getJob({ jobId: id }));
  } catch (error) {
    return gatewayErrorResponse(error);
  }
}
