import { fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { render, screen } from "@/test/render";

vi.mock("next/dynamic", () => ({ default: () => () => <div data-testid="viewer" /> }));

import { StructureViewerPanel } from "./structure-viewer-panel";

describe("StructureViewerPanel", () => {
  it("keeps unsupported files out of the viewer", async () => {
    render(<StructureViewerPanel />);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;

    fireEvent.change(input, { target: { files: [new File(["text"], "notes.txt")] } });

    expect(screen.getByRole("alert")).toHaveTextContent("Choose a PDB");
  });

  it("shows metadata for a chosen local PDB", async () => {
    const user = userEvent.setup();
    render(<StructureViewerPanel />);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;

    await user.upload(input, new File(["HEADER"], "example.pdb", { type: "chemical/x-pdb" }));

    expect(screen.getByText("example.pdb")).toBeInTheDocument();
    expect(screen.getByText("PDB")).toBeInTheDocument();
  });
});
