"use client";

import { useState } from "react";

import { Button } from "@taskome/ui/components/button";

const maxFileBytes = 50 * 1024 * 1024;

export function FpocketJobForm() {
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // TODO: Replace this fpocket-specific form with a schema-driven Task form when another Task Server is added.
  async function submit(formData: FormData) {
    const file = formData.get("structure");
    const min = Number(formData.get("min_alpha_size"));
    const max = Number(formData.get("max_alpha_size"));
    const spheres = Number(formData.get("min_spheres_per_pocket"));
    if (
      !(file instanceof File) ||
      !file.name.endsWith(".pdb") ||
      file.size === 0 ||
      file.size > maxFileBytes
    )
      return setError("Choose a non-empty PDB file no larger than 50 MiB.");
    if (!(min > 0 && max > min && spheres > 0))
      return setError("Use positive values and make the minimum α size smaller than the maximum.");
    setSubmitting(true);
    setError(null);
    try {
      const upload = await fetch("/api/gateway/input-files", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ original_filename: file.name, size_bytes: file.size }),
      });
      if (!upload.ok) throw new Error();
      const input = (await upload.json()) as { id: string; upload_url: string };
      const put = await fetch(input.upload_url, {
        method: "PUT",
        headers: { "Content-Length": String(file.size), "If-None-Match": "*" },
        body: file,
      });
      if (!put.ok) throw new Error();
      const jobResponse = await fetch("/api/gateway/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          task_server_name: "fpocket",
          task_name: "detect_pockets",
          params: {
            structure: input.id,
            min_alpha_size: min,
            max_alpha_size: max,
            min_spheres_per_pocket: spheres,
          },
        }),
      });
      if (!jobResponse.ok) throw new Error();
      const job = (await jobResponse.json()) as { id: string };
      window.location.assign(`/results/${job.id}`);
    } catch {
      setError("We couldn't queue this Job. Try again.");
      setSubmitting(false);
    }
  }

  return (
    <form action={submit} className="space-y-6">
      <label className="block text-sm font-medium">
        Structure (.pdb, max 50 MiB)
        <input className="mt-2 block" name="structure" type="file" accept=".pdb" required />
      </label>
      <div className="grid gap-4 sm:grid-cols-3">
        <label className="text-sm font-medium">
          Min α size
          <input
            className="mt-2 w-full rounded-md border p-2"
            name="min_alpha_size"
            type="number"
            defaultValue="3.4"
            min="0.1"
            step="0.1"
            required
          />
        </label>
        <label className="text-sm font-medium">
          Max α size
          <input
            className="mt-2 w-full rounded-md border p-2"
            name="max_alpha_size"
            type="number"
            defaultValue="6.2"
            min="0.1"
            step="0.1"
            required
          />
        </label>
        <label className="text-sm font-medium">
          Min spheres
          <input
            className="mt-2 w-full rounded-md border p-2"
            name="min_spheres_per_pocket"
            type="number"
            defaultValue="15"
            min="1"
            required
          />
        </label>
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <Button disabled={submitting} type="submit">
        {submitting ? "Queuing Job…" : "Run fpocket"}
      </Button>
    </form>
  );
}
