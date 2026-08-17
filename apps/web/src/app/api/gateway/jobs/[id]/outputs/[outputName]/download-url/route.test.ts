import { describe, expect, it, vi } from "vitest";

const getJobOutputDownloadUrl = vi.fn();

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
  getJobOutputDownloadUrl,
}));

const { GET } = await import("./route");

describe("GET /api/gateway/jobs/[id]/outputs/[outputName]/download-url", () => {
  it("returns a short-lived Job Output URL from Gateway", async () => {
    const download = {
      download_url: "http://seaweedfs/download",
      expires_at: "2026-08-17T00:15:00Z",
    };
    getJobOutputDownloadUrl.mockResolvedValueOnce(download);

    const response = await GET(
      new Request(
        "http://localhost/api/gateway/jobs/job-1/outputs/annotated_structure/download-url",
      ),
      { params: Promise.resolve({ id: "job-1", outputName: "annotated_structure" }) },
    );

    expect(getJobOutputDownloadUrl).toHaveBeenCalledWith({
      jobId: "job-1",
      outputName: "annotated_structure",
    });
    expect(await response.json()).toEqual(download);
  });

  it("passes through Gateway's opaque missing-output response", async () => {
    const { GatewayHttpError } = await import("@taskome/api-client");
    const problem = {
      detail: "The requested Job Output is not available.",
      instance: "/v1/jobs/job-1/outputs/annotated_structure/download-url",
      request_id: "request-1",
      status: 404,
      title: "Job Output Not Found",
      type: "urn:taskome:error:job-output-not-found",
    };
    getJobOutputDownloadUrl.mockRejectedValueOnce(
      new GatewayHttpError(new Response(null, { status: 404 }), problem),
    );

    const response = await GET(new Request("http://localhost"), {
      params: Promise.resolve({ id: "job-1", outputName: "annotated_structure" }),
    });

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual(problem);
  });
});
