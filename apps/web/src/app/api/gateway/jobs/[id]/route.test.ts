import { describe, expect, it, vi } from "vitest";

const getJob = vi.fn();

vi.mock("@taskome/api-client", () => ({ getJob }));

const { GET } = await import("./route");

describe("GET /api/gateway/jobs/[id]", () => {
  it("returns the requested Job", async () => {
    const job = { id: "job-1", status: "running" };
    getJob.mockResolvedValueOnce(job);

    const response = await GET(new Request("http://localhost/api/gateway/jobs/job-1"), {
      params: Promise.resolve({ id: "job-1" }),
    });

    expect(getJob).toHaveBeenCalledWith({ jobId: "job-1" });
    expect(await response.json()).toEqual(job);
  });
});
