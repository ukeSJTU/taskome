import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test, vi } from "vitest";

vi.mock("./structure-viewer", () => ({
  StructureViewer: ({ source }: { source: { name: string } }) => <p>Viewing {source.name}</p>,
}));

import { StructureViewerPage } from "./structure-viewer-page";

test("reads supported local files in the browser and explains their privacy boundary", async () => {
  const user = userEvent.setup({ applyAccept: false });
  render(<StructureViewerPage />);

  expect(screen.getByText(/not uploaded, saved, or turned into a Job/i)).toBeDefined();
  const input = screen.getByLabelText("Choose structure file");
  const file = new File(["ATOM"], "protein.ent", { type: "chemical/x-pdb" });
  await user.upload(input, file);

  expect(await screen.findByText("Viewing protein.ent")).toBeDefined();
  expect(screen.getByText(/4 B · This file stays in your browser/i)).toBeDefined();
});

test("rejects an unsupported local file before it reaches the viewer", async () => {
  const user = userEvent.setup({ applyAccept: false });
  render(<StructureViewerPage />);

  await user.upload(
    screen.getByLabelText("Choose structure file"),
    new File(["data"], "notes.txt"),
  );

  expect(await screen.findByText("Unsupported local file")).toBeDefined();
  expect(screen.getByText(/Choose a PDB/)).toBeDefined();
});
