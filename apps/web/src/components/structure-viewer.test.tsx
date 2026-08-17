import { screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { render } from "@/test/render";

import { StructureViewer } from "./structure-viewer";

const load = vi.fn();
const dispose = vi.fn();

vi.mock("./structure-viewer-molstar-adapter", () => ({
  createMolstarAdapter: vi.fn(async () => ({
    load,
    dispose,
    resize: vi.fn(),
    resetCamera: vi.fn(),
    setAppearance: vi.fn(),
    screenshot: vi.fn(),
  })),
}));

afterEach(() => {
  load.mockReset();
  dispose.mockReset();
});

describe("StructureViewer", () => {
  it("explains that a structure source is needed before it can render", () => {
    render(<StructureViewer />);

    expect(screen.getByRole("status")).toHaveTextContent("Choose a structure file to begin");
    expect(screen.getByText("Protein structure viewer")).toBeInTheDocument();
  });

  it("loads inferred PDB data and announces when the viewer is ready", async () => {
    load.mockResolvedValueOnce({ models: 1, chains: 1, residues: 1, atoms: 1 });

    render(
      <StructureViewer
        source={{ key: "example", name: "example.pdb", data: "HEADER    EXAMPLE" }}
      />,
    );

    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Structure ready"));
    expect(load).toHaveBeenCalledWith(
      expect.objectContaining({ format: "pdb", data: "HEADER    EXAMPLE" }),
    );
  });

  it("reports a missing format without reading the source", async () => {
    render(<StructureViewer source={{ key: "unknown", data: "structure" }} />);

    expect(await screen.findByRole("alert")).toHaveTextContent("Structure format is required");
    expect(load).not.toHaveBeenCalled();
  });
});
