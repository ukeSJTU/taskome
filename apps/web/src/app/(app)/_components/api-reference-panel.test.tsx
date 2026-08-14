import { fireEvent, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { render } from "@/test/render";

const scalarProps = vi.fn();
const { useTheme } = vi.hoisted(() => ({
  useTheme: vi.fn(() => ({ resolvedTheme: "light" })),
}));

vi.mock("@scalar/api-reference-react", () => ({
  ApiReferenceReact: (props: unknown) => {
    scalarProps(props);
    return <div data-testid="scalar-reference" />;
  },
}));

vi.mock("next-themes", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next-themes")>()),
  useTheme,
}));

const { ApiReferencePanel } = await import("./api-reference-panel");

const projection = {
  openapi: "3.1.0",
  info: { title: "Taskome Gateway", version: "0.1.0" },
  paths: { "/me": { get: { operationId: "getCurrentIdentity" } } },
};

describe("ApiReferencePanel", () => {
  it("renders API Docs with the live projection and its read-only Scalar configuration", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(Response.json(projection)));

    render(<ApiReferencePanel />);

    expect(screen.getByRole("heading", { name: "API Docs" })).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Loading API Docs");
    expect(await screen.findByTestId("scalar-reference")).toBeInTheDocument();
    expect(scalarProps).toHaveBeenCalledWith(
      expect.objectContaining({
        configuration: expect.objectContaining({
          agent: { disabled: true },
          content: projection,
          customCss: expect.stringContaining("--scalar-font: var(--font-sans)"),
          forceDarkModeState: "light",
          hideDarkModeToggle: true,
          hideClientButton: true,
          hideTestRequestButton: true,
          layout: "modern",
          modelsSectionLabel: "Schemas",
          showDeveloperTools: "never",
          telemetry: false,
          theme: "kepler",
          withDefaultFonts: false,
        }),
      }),
    );
  });

  it("uses Scalar dark mode when the app resolves dark", async () => {
    useTheme.mockReturnValue({ resolvedTheme: "dark" });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(Response.json(projection)));

    render(<ApiReferencePanel />);

    expect(await screen.findByTestId("scalar-reference")).toBeInTheDocument();
    expect(scalarProps).toHaveBeenCalledWith(
      expect.objectContaining({
        configuration: expect.objectContaining({ forceDarkModeState: "dark" }),
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
      "API Docs are temporarily unavailable",
    );
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(await screen.findByTestId("scalar-reference")).toBeInTheDocument();
  });
});
