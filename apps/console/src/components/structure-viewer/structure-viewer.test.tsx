import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test, vi } from "vitest";

import { StructureViewerError, type StructureViewerAdapter } from "./structure-viewer-adapter";
import { StructureViewer } from "./structure-viewer";

const source = {
  content: "ATOM",
  format: "pdb" as const,
  id: "source-1",
  name: "example.pdb",
};

function createAdapter(): StructureViewerAdapter {
  return {
    async create() {
      return {
        cancel() {},
        async clear() {},
        async load() {
          return { atoms: 42, chains: 2, models: 1, residues: 7 };
        },
        async setAppearance() {},
        resetCamera() {},
        screenshot() {},
        async toggleFullscreen() {},
        dispose() {},
      };
    },
  };
}

test("loads a source, presents its metadata and exposes accessible viewer controls", async () => {
  render(<StructureViewer adapter={createAdapter()} source={source} />);

  expect(await screen.findByText("Ready")).toBeDefined();
  expect(screen.getByText(/example\.pdb · PDB/)).toBeDefined();
  expect(screen.getByText("1 model · 2 chains · 7 residues · 42 atoms")).toBeDefined();
  expect(screen.getByRole("button", { name: "Reset camera" })).toBeDefined();
  expect(screen.getByRole("button", { name: "Download PNG" })).toBeDefined();
  expect(screen.getByRole("button", { name: "Toggle fullscreen" })).toBeDefined();
  expect(screen.getByLabelText("Representation")).toBeDefined();
  expect(screen.getByLabelText("Coloring")).toBeDefined();
});

test("supersedes a stale source load and preserves appearance preferences", async () => {
  let resolveFirstLoad:
    | ((value: { atoms: number; chains: number; models: number; residues: number }) => void)
    | undefined;
  const setAppearance = vi.fn();
  const adapter: StructureViewerAdapter = {
    async create() {
      return {
        cancel() {},
        async clear() {},
        load(nextSource) {
          if (nextSource.id === "source-1") {
            return new Promise((resolve) => {
              resolveFirstLoad = resolve;
            });
          }
          return Promise.resolve({ atoms: 9, chains: 1, models: 1, residues: 2 });
        },
        setAppearance,
        resetCamera() {},
        screenshot() {},
        async toggleFullscreen() {},
        dispose() {},
      };
    },
  };
  const { rerender } = render(<StructureViewer adapter={adapter} source={source} />);
  const user = userEvent.setup();

  await user.selectOptions(screen.getByLabelText("Representation"), "cartoon");
  rerender(
    <StructureViewer
      adapter={adapter}
      source={{ ...source, id: "source-2", name: "new.cif", format: "mmcif" }}
    />,
  );

  expect(await screen.findByText(/new\.cif · MMCIF/)).toBeDefined();
  expect(await screen.findByText("1 model · 1 chain · 2 residues · 9 atoms")).toBeDefined();
  resolveFirstLoad?.({ atoms: 99, chains: 9, models: 9, residues: 9 });
  await waitFor(() =>
    expect(screen.queryByText("9 models · 9 chains · 9 residues · 99 atoms")).toBeNull(),
  );
  expect(setAppearance).toHaveBeenCalledWith({ coloring: "chain", representation: "cartoon" });
});

test("retries initialization failures but gives WebGL guidance without a retry loop", async () => {
  let attempts = 0;
  const adapter: StructureViewerAdapter = {
    async create() {
      attempts += 1;
      if (attempts === 1) throw new Error("temporary initialization failure");
      return (await createAdapter().create(document.createElement("div")))!;
    },
  };
  const user = userEvent.setup();
  const { rerender } = render(<StructureViewer adapter={adapter} source={source} />);

  expect(await screen.findByRole("button", { name: "Retry" })).toBeDefined();
  await user.click(screen.getByRole("button", { name: "Retry" }));
  expect(await screen.findByText("Ready")).toBeDefined();

  rerender(
    <StructureViewer
      adapter={{
        create: async () => {
          throw new StructureViewerError("webgl-unavailable");
        },
      }}
      source={source}
    />,
  );
  expect(await screen.findByText(/WebGL is unavailable/)).toBeDefined();
  expect(screen.queryByRole("button", { name: "Retry" })).toBeNull();
});
