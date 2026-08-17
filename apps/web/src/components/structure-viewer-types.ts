export type StructureFormat = "pdb" | "mmcif";

export type StructureSource =
  | { key: string; url: string; name?: string; format?: StructureFormat }
  | { key: string; data: string | Uint8Array; name?: string; format?: StructureFormat }
  | { key: string; file: File; name?: string; format?: StructureFormat };

export type StructureReady = { models: number; chains: number; residues: number; atoms: number };

export type StructureViewerErrorCode =
  | "format-required"
  | "unsupported-format"
  | "download-failed"
  | "file-read-failed"
  | "parse-failed"
  | "webgl-unavailable"
  | "initialization-failed"
  | "render-failed";

export type StructureViewerError = {
  code: StructureViewerErrorCode;
  message: string;
  retryable: boolean;
  status?: number;
};

export type StructureAppearance = {
  representation: "automatic" | "cartoon" | "ball-and-stick" | "surface";
  coloring: "chain" | "element" | "secondary-structure";
};
