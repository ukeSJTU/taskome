import { waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { render, screen } from "@/test/render";

import { JobsList } from "./jobs-list";

describe("JobsList", () => {
  it("shows Jobs returned by the BFF and offers a manual refresh", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          jobs: [
            {
              created_at: "2026-08-17T00:00:00Z",
              id: "job-1",
              status: "running",
              task_name: "fpocket_detect",
              updated_at: "2026-08-17T00:01:00Z",
            },
          ],
        }),
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    render(<JobsList />);

    expect(await screen.findByText("fpocket_detect")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Refresh" })).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith("/api/gateway/jobs?limit=20&offset=0");
  });

  it("teaches the user what to do when no Jobs exist", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ jobs: [] }))));

    render(<JobsList />);

    expect(await screen.findByText("No Jobs yet")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "New Job" })).toHaveAttribute("href", "/results/new");
    await waitFor(() => expect(screen.queryByLabelText("Loading Jobs")).not.toBeInTheDocument());
  });
});
