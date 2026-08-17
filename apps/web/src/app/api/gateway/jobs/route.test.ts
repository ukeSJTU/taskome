import { describe, expect, it, vi } from "vitest";

const createJob = vi.fn();
const listJobs = vi.fn();

vi.mock("@taskome/api-client", () => ({
  GatewayAuthenticationError: class GatewayAuthenticationError extends Error {},
  GatewayHttpError: class GatewayHttpError extends Error {
    status: number;
    problem: unknown;

    constructor(response: Response, problem: unknown) {
      super();
      this.status = response.status;
      this.problem = problem;
    }
  },
  createJob,
  listJobs,
}));

const { GET, POST } = await import("./route");

const job = {
  created_at: "2026-08-17T00:00:00Z",
  error_detail: null,
  id: "job-1",
  params: { structure: "input-file-1" },
  params_schema_version: 1,
  result: null,
  status: "queued",
  task_name: "fpocket_detect",
  task_server_name: "fpocket",
  updated_at: "2026-08-17T00:00:00Z",
};

describe("/api/gateway/jobs", () => {
  it("submits the request body and returns the queued Job", async () => {
    createJob.mockResolvedValueOnce(job);
    const request = new Request("http://localhost/api/gateway/jobs", {
      body: JSON.stringify({
        params: { structure: "input-file-1" },
        task_name: "fpocket_detect",
        task_server_name: "fpocket",
      }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });

    const response = await POST(request);

    expect(createJob).toHaveBeenCalledWith({
      params: { structure: "input-file-1" },
      task_name: "fpocket_detect",
      task_server_name: "fpocket",
    });
    expect(response.status).toBe(202);
    expect(await response.json()).toEqual(job);
  });

  it("forwards supported list filters to Gateway", async () => {
    listJobs.mockResolvedValueOnce({ jobs: [job] });
    const request = new Request(
      "http://localhost/api/gateway/jobs?status=running&task_name=fpocket_detect&limit=20&offset=40",
    );

    const response = await GET(request);

    expect(listJobs).toHaveBeenCalledWith({
      limit: 20,
      offset: 40,
      status: "running",
      task_name: "fpocket_detect",
    });
    expect(await response.json()).toEqual({ jobs: [job] });
  });

  it("returns the authentication contract when the gateway client has no session", async () => {
    const { GatewayAuthenticationError } = await import("@taskome/api-client");
    listJobs.mockRejectedValueOnce(new GatewayAuthenticationError());

    const response = await GET(new Request("http://localhost/api/gateway/jobs"));

    expect(response.status).toBe(401);
    expect(response.headers.get("WWW-Authenticate")).toBe("Bearer");
    expect(await response.json()).toEqual({ error: "authentication_required" });
  });

  it("passes through Gateway Problem Details responses", async () => {
    const { GatewayHttpError } = await import("@taskome/api-client");
    const problem = {
      detail: "Job was not found.",
      instance: "/v1/jobs/job-1",
      request_id: "request-1",
      status: 404,
      title: "Not Found",
      type: "about:blank",
    };
    listJobs.mockRejectedValueOnce(
      new GatewayHttpError(new Response(null, { status: 404 }), problem),
    );

    const response = await GET(new Request("http://localhost/api/gateway/jobs"));

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual(problem);
  });
});
