import { StructureViewerError } from "./structure-viewer-adapter";
import type {
  StructureAppearance,
  StructureStatistics,
  StructureViewerAdapter,
  StructureViewerSession,
} from "./structure-viewer-adapter";

const presetByRepresentation = {
  automatic: "auto",
  "ball-and-stick": "atomic-detail",
  cartoon: "polymer-cartoon",
  surface: "molecular-surface",
} as const;

const themeByColoring = {
  chain: "chain-id",
  element: "element-symbol",
  "secondary-structure": "secondary-structure",
} as const;

function sourceText(content: string | Uint8Array) {
  return typeof content === "string" ? content : new TextDecoder().decode(content);
}

function statisticsFromPlugin(plugin: any): StructureStatistics {
  const models = plugin.managers.structure.hierarchy.current.models;
  const model = models[0]?.cell.obj?.data;
  if (!model) throw new Error("No parsed molecular model is available.");

  return {
    atoms: model.atomicHierarchy.atoms._rowCount,
    chains: model.atomicHierarchy.chains._rowCount,
    models: models.length,
    residues: model.atomicHierarchy.residues._rowCount,
  };
}

async function downloadDataUri(dataUri: string, filename: string) {
  const link = document.createElement("a");
  link.href = dataUri;
  link.download = filename;
  link.click();
}

export const molstarAdapter: StructureViewerAdapter = {
  async create(container) {
    const [{ DefaultPluginSpec }, { PluginContext }, { PluginCommands }] = await Promise.all([
      import("molstar/lib/mol-plugin/spec"),
      import("molstar/lib/mol-plugin/context"),
      import("molstar/lib/mol-plugin/commands"),
    ]);
    const plugin = new PluginContext(DefaultPluginSpec());
    const initialized = await plugin.mountAsync(container);
    if (!initialized) {
      plugin.dispose();
      throw new StructureViewerError("webgl-unavailable");
    }

    let currentAppearance: StructureAppearance = { coloring: "chain", representation: "automatic" };
    let activeLoad = 0;

    const applyAppearance = async (appearance: StructureAppearance) => {
      currentAppearance = appearance;
      const structures = plugin.managers.structure.hierarchy.current.structures;
      if (structures.length === 0) return;
      await plugin.managers.structure.component.applyPreset(
        structures,
        plugin.builders.structure.representation.resolveProvider(
          presetByRepresentation[appearance.representation],
        ),
      );
      await plugin.dataTransaction(async () => {
        for (const structure of structures) {
          await plugin.managers.structure.component.updateRepresentationsTheme(
            structure.components,
            {
              color: themeByColoring[appearance.coloring],
            },
          );
        }
      });
    };

    const session: StructureViewerSession = {
      cancel() {
        activeLoad += 1;
      },
      async clear() {
        await plugin.clear();
      },
      dispose() {
        plugin.dispose();
      },
      async load(source) {
        const load = ++activeLoad;
        const assertCurrent = () => {
          if (load !== activeLoad) throw new Error("Structure load was superseded.");
        };
        let trajectory;
        try {
          const data = await plugin.builders.data.rawData({
            data: sourceText(source.content),
            label: source.name,
          });
          assertCurrent();
          trajectory = await plugin.builders.structure.parseTrajectory(data, source.format);
          assertCurrent();
        } catch (error) {
          if (error instanceof StructureViewerError) throw error;
          throw new StructureViewerError("parse");
        }
        try {
          await plugin.builders.structure.hierarchy.applyPreset(trajectory, "default", {
            representationPreset: presetByRepresentation[currentAppearance.representation],
          });
          assertCurrent();
          await applyAppearance(currentAppearance);
          assertCurrent();
        } catch (error) {
          if (error instanceof StructureViewerError) throw error;
          throw new StructureViewerError("render");
        }
        PluginCommands.Camera.Reset(plugin, {});
        return statisticsFromPlugin(plugin);
      },
      resetCamera() {
        PluginCommands.Camera.Reset(plugin, {});
      },
      screenshot(sourceName) {
        const basename = sourceName.replace(/\.[^.]+$/, "");
        void plugin.helpers.viewportScreenshot
          ?.getImageDataUri()
          .then((uri) => downloadDataUri(uri, `${basename}.png`));
      },
      async setAppearance(appearance) {
        try {
          await applyAppearance(appearance);
        } catch (error) {
          if (error instanceof StructureViewerError) throw error;
          throw new StructureViewerError("render");
        }
      },
      async toggleFullscreen() {
        if (document.fullscreenElement === container) {
          await document.exitFullscreen();
        } else {
          await container.requestFullscreen();
        }
      },
    };

    return session;
  },
};
