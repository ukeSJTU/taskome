export type StructureFormat = "pdb" | "mmcif";

export type StructureSource = {
  content: string | Uint8Array;
  format: StructureFormat;
  id: string;
  name: string;
};

export type StructureStatistics = {
  atoms: number;
  chains: number;
  models: number;
  residues: number;
};

export type StructureAppearance = {
  coloring: "chain" | "element" | "secondary-structure";
  representation: "automatic" | "cartoon" | "ball-and-stick" | "surface";
};

export type StructureViewerErrorKind = "initialization" | "parse" | "render" | "webgl-unavailable";

export class StructureViewerError extends Error {
  constructor(public readonly kind: StructureViewerErrorKind) {
    super(kind);
  }
}

export type StructureViewerSession = {
  cancel(): void;
  clear(): Promise<void>;
  dispose(): void;
  load(source: StructureSource): Promise<StructureStatistics>;
  resetCamera(): void;
  screenshot(sourceName: string): void;
  setAppearance(appearance: StructureAppearance): Promise<void>;
  toggleFullscreen(): Promise<void>;
};

export type StructureViewerAdapter = {
  create(container: HTMLElement): Promise<StructureViewerSession>;
};
