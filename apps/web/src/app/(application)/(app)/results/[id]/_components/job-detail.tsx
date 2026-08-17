"use client";

import { DownloadIcon, RefreshCwIcon } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { Badge } from "@taskome/ui/components/badge";
import { Button } from "@taskome/ui/components/button";
import { Skeleton } from "@taskome/ui/components/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@taskome/ui/components/table";

type Job = {
  id: string;
  status: "queued" | "running" | "completed" | "failed";
  task_name: string;
  task_server_name: string;
  params: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  error_detail: { detail?: string; title?: string } | null;
  result: {
    value?: {
      pocket_count?: number;
      pockets?: Array<{
        rank: number;
        score: number;
        druggability_score: number;
        volume: number;
        num_alpha_spheres: number;
      }>;
    };
    outputs?: Array<{ name: string; download_name?: string | null }>;
  } | null;
};

export function JobDetail({ jobId }: { jobId: string }) {
  const [job, setJob] = useState<Job | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const load = useCallback(async () => {
    setError(null);
    try {
      const response = await fetch(`/api/gateway/jobs/${jobId}`);
      if (!response.ok) throw new Error();
      setJob(await response.json());
    } catch {
      setError("We couldn't load this Job. Try again.");
    }
  }, [jobId]);
  useEffect(() => {
    void load();
  }, [load]);
  const download = async () => {
    setDownloading(true);
    try {
      const response = await fetch(
        `/api/gateway/jobs/${jobId}/outputs/annotated_structure/download-url`,
      );
      if (!response.ok) throw new Error();
      const { download_url } = (await response.json()) as { download_url: string };
      window.location.assign(download_url);
    } catch {
      setError("The annotated structure could not be downloaded. Try again.");
    } finally {
      setDownloading(false);
    }
  };
  if (!job && !error)
    return (
      <section className="px-4 py-6 lg:px-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="mt-6 h-72 w-full" />
      </section>
    );
  if (!job)
    return (
      <section className="px-4 py-6 lg:px-6">
        <p className="text-sm text-destructive">{error}</p>
        <Button className="mt-4" onClick={() => void load()}>
          Try again
        </Button>
      </section>
    );
  const pockets = job.result?.value?.pockets ?? [];
  const output = job.result?.outputs?.find((item) => item.name === "annotated_structure");
  return (
    <section className="mx-auto max-w-6xl px-4 py-6 lg:px-6">
      <div className="flex flex-wrap justify-between gap-4">
        <div>
          <Link href="/results" className="text-sm text-muted-foreground">
            ← My Results
          </Link>
          <div className="mt-3 flex items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">
              {job.task_server_name} · {job.task_name}
            </h1>
            <Badge
              variant={
                job.status === "failed"
                  ? "destructive"
                  : job.status === "completed"
                    ? "default"
                    : "secondary"
              }
            >
              {job.status}
            </Badge>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => void load()}>
          <RefreshCwIcon data-icon="inline-start" />
          Refresh
        </Button>
      </div>
      {/* TODO: Replace manual refresh with SSE/WebSocket Job lifecycle updates when real-time status is needed. */}
      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <main>
          <h2 className="font-semibold">Pocket analysis</h2>
          {job.status === "failed" ? (
            <div className="mt-4 border border-destructive/30 bg-destructive/5 p-4 text-sm">
              <p className="font-medium text-destructive">
                {job.error_detail?.title ?? "Job failed"}
              </p>
              <p className="mt-1">{job.error_detail?.detail}</p>
            </div>
          ) : job.status !== "completed" ? (
            <p className="mt-4 border p-4 text-sm">
              {job.status === "queued" ? "Waiting for a worker." : "Detecting pockets."}
            </p>
          ) : (
            <>
              <div className="mt-4 flex justify-between gap-3">
                <p className="text-sm text-muted-foreground">
                  {pockets.length ? `${pockets.length} pockets detected.` : "No pockets detected."}
                </p>
                {output && (
                  <Button size="sm" disabled={downloading} onClick={() => void download()}>
                    <DownloadIcon data-icon="inline-start" />
                    {downloading
                      ? "Preparing…"
                      : `Download ${output.download_name ?? "annotated structure"}`}
                  </Button>
                )}
              </div>
              {pockets.length > 0 && (
                <div className="mt-4 overflow-x-auto border-y">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Rank</TableHead>
                        <TableHead>Score</TableHead>
                        <TableHead>Druggability</TableHead>
                        <TableHead>Volume</TableHead>
                        <TableHead>α-spheres</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pockets.map((pocket) => (
                        <TableRow key={pocket.rank}>
                          <TableCell>{pocket.rank}</TableCell>
                          <TableCell>{pocket.score}</TableCell>
                          <TableCell>{pocket.druggability_score}</TableCell>
                          <TableCell>{pocket.volume} Å³</TableCell>
                          <TableCell>{pocket.num_alpha_spheres}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </>
          )}
        </main>
        <aside className="border-l pl-6 text-sm">
          <h2 className="font-semibold">Input</h2>
          <pre className="mt-3 overflow-auto whitespace-pre-wrap text-xs text-muted-foreground">
            {JSON.stringify(job.params, null, 2)}
          </pre>
          <h2 className="mt-8 font-semibold">Job timeline</h2>
          <ol className="mt-3 space-y-3 border-l pl-4">
            <li>
              Submitted
              <br />
              <span className="text-muted-foreground">
                {new Date(job.created_at).toLocaleString()}
              </span>
            </li>
            <li>
              Last updated
              <br />
              <span className="text-muted-foreground">
                {new Date(job.updated_at).toLocaleString()}
              </span>
            </li>
          </ol>
        </aside>
      </div>
      {error && <p className="mt-4 text-sm text-destructive">{error}</p>}
    </section>
  );
}
