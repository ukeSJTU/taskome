import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, test, vi } from "vitest";

import { FilesPage } from "./files-page";

const projectId = "00000000-0000-4000-8000-000000000001";
const fileId = "00000000-0000-4000-8000-000000000002";
const timestamp = "2026-08-24T00:00:00.000Z";
function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

afterEach(() => vi.unstubAllGlobals());

test("confirms an existing conditional upload after a lost object-store response", async () => {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(input instanceof Request ? input.url : String(input), "http://localhost");
    if (url.pathname === "/api/v1/projects")
      return response({ items: [{ id: projectId, name: "Default Project" }], nextCursor: null });
    if (url.pathname === "/api/v1/saved-files" && (init?.method ?? "GET") === "GET")
      return response({ items: [], nextCursor: null });
    if (url.pathname === "/api/v1/saved-files/uploads")
      return response({ id: fileId, uploadUrl: "https://objects.example/upload" }, 201);
    if (url.hostname === "objects.example") return response({}, 412);
    if (url.pathname.endsWith("/confirm"))
      return response({
        id: fileId,
        projectId,
        filename: "protein.pdb",
        contentType: null,
        sizeBytes: 5,
        status: "uploaded",
        createdAt: timestamp,
      });
    throw new Error(`Unexpected request: ${init?.method ?? "GET"} ${url}`);
  });
  vi.stubGlobal("fetch", fetchMock);
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const user = userEvent.setup();
  const { container } = render(
    <QueryClientProvider client={client}>
      <FilesPage />
    </QueryClientProvider>,
  );
  await user.click(await screen.findByRole("combobox"));
  await user.click(await screen.findByRole("option", { name: "Default Project" }));
  const input = container.querySelector("input[type=file]");
  if (!input) throw new Error("Missing file input");
  fireEvent.change(input, {
    target: { files: [new File(["ATOM\n"], "protein.pdb", { type: "chemical/x-pdb" })] },
  });
  await waitFor(() =>
    expect(fetchMock).toHaveBeenCalledWith(
      "https://objects.example/upload",
      expect.objectContaining({ method: "PUT" }),
    ),
  );
  await waitFor(() =>
    expect(
      fetchMock.mock.calls.some(([url]) => String(url).includes(`/saved-files/${fileId}/confirm`)),
    ).toBe(true),
  );
});
