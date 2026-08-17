import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { JobDetail } from "./job-detail";

const job = {
  created_at: "2026-08-17T00:00:00Z",
  error_detail: null,
  id: "job-1",
  params: { structure: "file-1" },
  result: {
    outputs: [{ name: "annotated_structure", download_name: "pockets.pdb" }],
    value: { pocket_count: 0, pockets: [] },
  },
  status: "completed",
  task_name: "detect_pockets",
  task_server_name: "fpocket",
  updated_at: "2026-08-17T00:01:00Z",
};

describe("JobDetail", () => {
  beforeEach(() => vi.stubGlobal("fetch", vi.fn()));
  it("shows a completed zero-pocket Job and its declared output", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify(job), { status: 200 }));
    render(<JobDetail jobId="job-1" />);
    expect(await screen.findByText("No pockets detected.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /download pockets.pdb/i })).toBeInTheDocument();
  });
  it("shows a Job failure detail", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          ...job,
          status: "failed",
          error_detail: { title: "Job failed", detail: "Invalid PDB" },
        }),
        { status: 200 },
      ),
    );
    render(<JobDetail jobId="job-1" />);
    expect(await screen.findByText("Invalid PDB")).toBeInTheDocument();
  });
  it("requests a download URL when its output is downloaded", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(new Response(JSON.stringify(job), { status: 200 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ download_url: "https://storage.test/file" }), {
          status: 200,
        }),
      );
    const assign = vi.fn();
    Object.defineProperty(window, "location", { configurable: true, value: { assign } });
    render(<JobDetail jobId="job-1" />);
    fireEvent.click(await screen.findByRole("button", { name: /download pockets.pdb/i }));
    expect(fetch).toHaveBeenLastCalledWith(
      "/api/gateway/jobs/job-1/outputs/annotated_structure/download-url",
    );
    await vi.waitFor(() => expect(assign).toHaveBeenCalledWith("https://storage.test/file"));
  });
});
