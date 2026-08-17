import { createInputFile } from "@taskome/api-client";

import { gatewayErrorResponse } from "../error-response";

export async function POST(request: Request) {
  try {
    return Response.json(await createInputFile(await request.json()), { status: 201 });
  } catch (error) {
    return gatewayErrorResponse(error);
  }
}
