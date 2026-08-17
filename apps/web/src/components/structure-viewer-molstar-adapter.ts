import type {
  StructureAppearance,
  StructureFormat,
  StructureReady,
} from "./structure-viewer-types";

export type StructurePayload = {
  data: string | Uint8Array;
  format: StructureFormat;
  name?: string;
};

export type MolstarAdapter = {
  clear(): Promise<void>;
  load(payload: StructurePayload): Promise<StructureReady>;
  setAppearance(appearance: StructureAppearance): Promise<void>;
  resetCamera(): void;
  resize(): void;
  screenshot(name: string): Promise<void>;
  dispose(): void;
};

export async function createMolstarAdapter(container: HTMLElement): Promise<MolstarAdapter> {
  const [{ PluginContext }, { DefaultPluginSpec }, { PdbProvider, MmcifProvider }] =
    await Promise.all([
      import("molstar/lib/mol-plugin/context.js"),
      import("molstar/lib/mol-plugin/spec.js"),
      import("molstar/lib/mol-plugin-state/formats/trajectory.js"),
    ]);
  const plugin = new PluginContext(DefaultPluginSpec());
  await plugin.init();
  const mounted = await plugin.mountAsync(container);
  if (!mounted) {
    plugin.dispose();
    throw new Error("WebGL is unavailable");
  }

  let structure: Awaited<ReturnType<typeof plugin.builders.structure.createStructure>> | undefined;
  let appearance: StructureAppearance = { representation: "automatic", coloring: "chain" };
  const applyAppearance = async () => {
    if (!structure) return;
    const representation = {
      automatic: "auto",
      cartoon: "polymer-cartoon",
      "ball-and-stick": "illustrative",
      surface: "molecular-surface",
    }[appearance.representation];
    await plugin.builders.structure.representation.applyPreset(structure, representation, {
      theme: {
        globalName:
          appearance.coloring === "secondary-structure"
            ? "secondary-structure"
            : appearance.coloring,
      },
    });
  };

  return {
    clear: () => plugin.clear(),
    async load(payload) {
      await plugin.clear();
      const data = typeof payload.data === "string" ? payload.data : new Uint8Array(payload.data);
      const raw = await plugin.builders.data.rawData({ data, label: payload.name });
      const parsed = await plugin.builders.structure.parseTrajectory(
        raw,
        payload.format === "pdb" ? PdbProvider : MmcifProvider,
      );
      const model = await plugin.builders.structure.createModel(parsed);
      structure = await plugin.builders.structure.createStructure(model);
      await applyAppearance();
      plugin.managers.camera.reset();
      if (!model.data) throw new Error("Structure model is unavailable");
      const atomicHierarchy = model.data.atomicHierarchy;
      return {
        models: 1,
        chains: atomicHierarchy.chains._rowCount,
        residues: atomicHierarchy.residues._rowCount,
        atoms: atomicHierarchy.atoms._rowCount,
      };
    },
    async setAppearance(nextAppearance) {
      appearance = nextAppearance;
      await applyAppearance();
    },
    resetCamera: () => plugin.managers.camera.reset(),
    resize: () => plugin.handleResize(),
    async screenshot(name) {
      const image = await plugin.helpers.viewportScreenshot?.getImageDataUri();
      if (!image) return;
      const anchor = document.createElement("a");
      anchor.href = image;
      anchor.download = name;
      anchor.click();
    },
    dispose: () => plugin.dispose(),
  };
}
