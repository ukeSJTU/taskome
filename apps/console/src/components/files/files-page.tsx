import { useQuery, useQueryClient } from "@tanstack/react-query";
import Uppy from "@uppy/core";
import { Button } from "@taskome/ui/components/button";
import { Input } from "@taskome/ui/components/input";
import { Label } from "@taskome/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@taskome/ui/components/select";
import { Trash2Icon, UploadIcon, DownloadIcon } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";

import { listProjects } from "@/api/generated/projects/projects";
import {
  confirmSavedFileUpload,
  createSavedFileUpload,
  deleteSavedFile,
  getSavedFileDownload,
  getListSavedFilesQueryKey,
  listSavedFiles,
} from "@/api/generated/saved-files/saved-files";

const allProjects = "all";
const maximumSavedFileSize = 2 * 1024 * 1024 * 1024;

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function FilesPage() {
  const queryClient = useQueryClient();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [projectId, setProjectId] = React.useState(allProjects);
  const [uploading, setUploading] = React.useState(false);
  const [uploadProgress, setUploadProgress] = React.useState<number>();
  const [failedFile, setFailedFile] = React.useState<File>();
  const projects = useQuery({
    queryKey: ["projects", "all"],
    queryFn: () => listProjects({ status: "all" }),
  });
  const files = useQuery({
    queryKey: getListSavedFilesQueryKey(projectId === allProjects ? undefined : { projectId }),
    queryFn: () => listSavedFiles(projectId === allProjects ? undefined : { projectId }),
  });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["/api/v1/saved-files"] });

  const upload = async (file: File) => {
    if (projectId === allProjects) {
      toast.error("Choose a Project before uploading.");
      return;
    }
    if (file.size > maximumSavedFileSize) {
      toast.error("Saved Files must be 2 GiB or smaller.");
      return;
    }
    setUploading(true);
    setUploadProgress(0);
    setFailedFile(undefined);
    const uppy = new Uppy({ autoProceed: false });
    try {
      uppy.addUploader(async (fileIds) => {
        await Promise.all(
          fileIds.map(async (fileId) => {
            const queued = uppy.getFile(fileId);
            const data = queued.data;
            if (!(data instanceof File)) throw new Error("Selected upload is no longer available.");
            const created = await createSavedFileUpload({
              filename: data.name,
              projectId,
              sizeBytes: data.size,
              ...(data.type ? { contentType: data.type } : {}),
            });
            const response = await fetch(created.uploadUrl, {
              body: data,
              headers: {
                ...(data.type ? { "content-type": data.type } : {}),
                "if-none-match": "*",
              },
              method: "PUT",
            });
            if (!response.ok) throw new Error("The object store rejected the upload.");
            setUploadProgress(100);
            await confirmSavedFileUpload({ savedFileId: created.id });
          }),
        );
      });
      uppy.addFile({ data: file, name: file.name, type: file.type });
      const result = await uppy.upload();
      if (!result || (result.failed?.length ?? 0) > 0)
        throw new Error("The object store rejected the upload.");
      await refresh();
      toast.success(`${file.name} uploaded.`);
    } catch (error) {
      setFailedFile(file);
      toast.error(error instanceof Error ? error.message : "Upload failed.");
    } finally {
      uppy.destroy();
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const download = async (id: string) => {
    try {
      window.location.assign((await getSavedFileDownload({ savedFileId: id })).downloadUrl);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Download failed.");
    }
  };
  const remove = async (id: string) => {
    try {
      await deleteSavedFile({ savedFileId: id });
      await refresh();
      toast.success("Saved File deleted.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Deletion failed.");
    }
  };

  return (
    <main className="mx-auto w-full max-w-5xl space-y-6 p-6">
      <header>
        <h1 className="text-2xl font-semibold">Files</h1>
        <p className="text-muted-foreground">
          Upload, find, and download Saved Files across your Projects.
        </p>
      </header>
      <div className="flex flex-wrap items-end gap-3 rounded-lg border p-4">
        <div className="grid gap-2">
          <Label htmlFor="saved-file-project">Project</Label>
          <Select value={projectId} onValueChange={(value) => setProjectId(value ?? allProjects)}>
            <SelectTrigger id="saved-file-project" className="w-64">
              <SelectValue placeholder="All Projects" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={allProjects}>All Projects</SelectItem>
              {projects.data?.items.map((project) => (
                <SelectItem key={project.id} value={project.id}>
                  {project.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Input
          ref={inputRef}
          className="hidden"
          type="file"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void upload(file);
          }}
        />
        <Button
          disabled={uploading || projectId === allProjects}
          onClick={() => inputRef.current?.click()}
        >
          <UploadIcon />
          {uploading
            ? `Uploading${uploadProgress === undefined ? "" : ` ${uploadProgress}%`}…`
            : "Upload file"}
        </Button>
        {failedFile ? (
          <Button variant="outline" onClick={() => void upload(failedFile)}>
            Retry {failedFile.name}
          </Button>
        ) : null}
      </div>
      <div className="rounded-lg border">
        <div className="grid grid-cols-[1fr_auto_auto] gap-4 border-b px-4 py-3 text-sm font-medium">
          <span>Name</span>
          <span>Size</span>
          <span>Status</span>
        </div>
        {files.isLoading ? (
          <p className="p-4 text-muted-foreground">Loading Saved Files…</p>
        ) : files.data?.items.length ? (
          files.data.items.map((file) => (
            <div
              key={file.id}
              className="grid grid-cols-[1fr_auto_auto] items-center gap-4 border-b px-4 py-3 last:border-0"
            >
              <div>
                <p className="font-medium">{file.filename}</p>
                <p className="text-sm text-muted-foreground">
                  {file.status === "uploaded" ? "Available" : "Uploading"}
                </p>
              </div>
              <span className="text-sm text-muted-foreground">{formatBytes(file.sizeBytes)}</span>
              <span className="flex gap-2">
                <Button
                  size="icon"
                  variant="ghost"
                  disabled={file.status !== "uploaded"}
                  onClick={() => void download(file.id)}
                  aria-label={`Download ${file.filename}`}
                >
                  <DownloadIcon />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => void remove(file.id)}
                  aria-label={`Delete ${file.filename}`}
                >
                  <Trash2Icon />
                </Button>
              </span>
            </div>
          ))
        ) : (
          <p className="p-8 text-center text-muted-foreground">No Saved Files found.</p>
        )}
      </div>
    </main>
  );
}
