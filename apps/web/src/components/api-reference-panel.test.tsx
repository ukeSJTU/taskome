import { fireEvent, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { render } from "@/test/render";

const scalarProps = vi.fn();

vi.mock("@scalar/api-reference-react", () => ({
  ApiReferenceReact: (props: unknown) => {
    scalarProps(props);
    return <div data-testid="scalar-reference" />;
  },
}));

const { ApiReferencePanel } = await import("./api-reference-panel");

const projection = {
  openapi: "3.1.0",
  info: { title: "Taskome Gateway", version: "0.1.0" },
  paths: { "/me": { get: { operationId: "getCurrentIdentity" } } },
};

describe("ApiReferencePanel", () => {
  it("renders the live projection with browser execution disabled", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(Response.json(projection)));

    render(<ApiReferencePanel />);

    expect(screen.getByRole("heading", { name: "API reference" })).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Loading API reference");
    expect(await screen.findByTestId("scalar-reference")).toBeInTheDocument();
    expect(scalarProps).toHaveBeenCalledWith(
      expect.objectContaining({
        configuration: expect.objectContaining({
          content: projection,
          hideClientButton: true,
          hideTestRequestButton: true,
          showDeveloperTools: "never",
        }),
      }),
    );
  });

  it("explains an unavailable reference and retries", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 502 }))
      .mockResolvedValueOnce(Response.json(projection));
    vi.stubGlobal("fetch", fetchMock);

    render(<ApiReferencePanel />);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "The API reference is temporarily unavailable",
    );
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(await screen.findByTestId("scalar-reference")).toBeInTheDocument();
  });
});
