import { createJob, listJobs } from "@taskome/api-client";

import { gatewayErrorResponse } from "../error-response";

type ListJobsParams = NonNullable<Parameters<typeof listJobs>[0]>;

function listJobsParams(searchParams: URLSearchParams): ListJobsParams {
  const limit = searchParams.get("limit");
  const offset = searchParams.get("offset");
  const status = searchParams.get("status");
  const taskName = searchParams.get("task_name");

  return {
    ...(limit === null ? {} : { limit: Number(limit) }),
    ...(offset === null ? {} : { offset: Number(offset) }),
    ...(status === null ? {} : { status: status as ListJobsParams["status"] }),
    ...(taskName === null ? {} : { task_name: taskName }),
  };
}

export async function GET(request: Request) {
  try {
    return Response.json(await listJobs(listJobsParams(new URL(request.url).searchParams)));
  } catch (error) {
    return gatewayErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    return Response.json(await createJob(await request.json()), { status: 202 });
  } catch (error) {
    return gatewayErrorResponse(error);
  }
}
