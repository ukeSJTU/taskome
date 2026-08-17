import { describe, expect, it, vi } from "vitest";

const createInputFile = vi.fn();

vi.mock("@taskome/api-client", () => ({
  GatewayAuthenticationError: class GatewayAuthenticationError extends Error {},
  GatewayHttpError: class GatewayHttpError extends Error {
    problem: unknown;
    status: number;

    constructor(response: Response, problem: unknown) {
      super();
      this.problem = problem;
      this.status = response.status;
    }
  },
  createInputFile,
}));

const { POST } = await import("./route");

describe("POST /api/gateway/input-files", () => {
  it("allocates an Input File and returns its signed upload URL", async () => {
    const upload = {
      expires_at: "2026-08-17T00:15:00Z",
      id: "input-file-1",
      upload_url: "https://storage.example.test/upload/input-file-1",
    };
    createInputFile.mockResolvedValueOnce(upload);
    const request = new Request("http://localhost/api/gateway/input-files", {
      body: JSON.stringify({ original_filename: "structure.pdb", size_bytes: 42 }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });

    const response = await POST(request);

    expect(createInputFile).toHaveBeenCalledWith({
      original_filename: "structure.pdb",
      size_bytes: 42,
    });
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual(upload);
  });

  it("returns the BFF authentication contract without exposing Gateway details", async () => {
    const { GatewayAuthenticationError } = await import("@taskome/api-client");
    createInputFile.mockRejectedValueOnce(new GatewayAuthenticationError());

    const response = await POST(
      new Request("http://localhost/api/gateway/input-files", {
        body: JSON.stringify({ original_filename: "structure.pdb", size_bytes: 42 }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      }),
    );

    expect(response.status).toBe(401);
    expect(response.headers.get("WWW-Authenticate")).toBe("Bearer");
    expect(await response.json()).toEqual({ error: "authentication_required" });
  });
});
