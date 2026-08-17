import { getJobOutputDownloadUrl } from "@taskome/api-client";

import { gatewayErrorResponse } from "../../../../../error-response";

export async function GET(
  _request: Request,
  context: RouteContext<"/api/gateway/jobs/[id]/outputs/[outputName]/download-url">,
) {
  try {
    const { id, outputName } = await context.params;
    return Response.json(await getJobOutputDownloadUrl({ jobId: id, outputName }));
  } catch (error) {
    return gatewayErrorResponse(error);
  }
}
