import { expect, test, vi } from "vitest";

const molstar = vi.hoisted(() => {
  const resetCamera = vi.fn();

  class PluginContext {
    builders: {
      data: { rawData: (value: unknown) => Promise<unknown> };
      structure?: {
        hierarchy: { applyPreset: () => Promise<void> };
        parseTrajectory: () => Promise<unknown>;
        representation: { resolveProvider: () => unknown };
      };
    } = {
      data: { rawData: async (value) => value },
    };

    helpers = {
      viewportScreenshot: undefined,
    };

    managers = {
      structure: {
        component: {
          applyPreset: async () => undefined,
          updateRepresentationsTheme: async () => undefined,
        },
        hierarchy: {
          current: {
            models: [] as {
              cell: {
                obj: {
                  data: {
                    atomicHierarchy: {
                      atoms: { _rowCount: number };
                      chains: { _rowCount: number };
                      residues: { _rowCount: number };
                    };
                  };
                };
              };
            }[],
            structures: [],
          },
        },
      },
    };

    async init() {
      this.builders.structure = {
        hierarchy: {
          applyPreset: async () => {
            this.managers.structure.hierarchy.current.models = [
              {
                cell: {
                  obj: {
                    data: {
                      atomicHierarchy: {
                        atoms: { _rowCount: 42 },
                        chains: { _rowCount: 2 },
                        residues: { _rowCount: 7 },
                      },
                    },
                  },
                },
              },
            ];
          },
        },
        parseTrajectory: async () => ({}),
        representation: { resolveProvider: () => ({}) },
      };
    }

    async mountAsync() {
      return true;
    }

    async clear() {}
    dispose() {}

    async dataTransaction(operation: () => Promise<void>) {
      await operation();
    }
  }

  return { PluginContext, resetCamera };
});

vi.mock("molstar/lib/mol-plugin/spec", () => ({ DefaultPluginSpec: () => ({}) }));
vi.mock("molstar/lib/mol-plugin/context", () => ({ PluginContext: molstar.PluginContext }));
vi.mock("molstar/lib/mol-plugin/commands", () => ({
  PluginCommands: { Camera: { Reset: molstar.resetCamera } },
}));

import { molstarAdapter } from "./molstar-adapter";

test("loads a supported PDB after creating a viewer session", async () => {
  const session = await molstarAdapter.create(document.createElement("div"));

  const statistics = await session.load({
    content: "ATOM",
    format: "pdb",
    id: "source-1",
    name: "example.pdb",
  });

  expect(statistics).toEqual({ atoms: 42, chains: 2, models: 1, residues: 7 });
});
