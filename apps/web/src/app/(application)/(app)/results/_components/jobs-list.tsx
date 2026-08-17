"use client";

import { RefreshCwIcon } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { Button } from "@taskome/ui/components/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@taskome/ui/components/empty";
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
  status: string;
  task_name: string;
  created_at: string;
  updated_at: string;
};
type JobListResponse = { jobs: Job[] };

const pageSize = 20;

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(
    new Date(value),
  );
}

export function JobsList() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);

  const load = useCallback(async (offset: number, append: boolean) => {
    setError(null);
    if (append) setLoadingMore(true);
    else setLoading(true);
    try {
      const response = await fetch(`/api/gateway/jobs?limit=${pageSize}&offset=${offset}`);
      if (!response.ok) throw new Error("Job list could not be loaded.");
      const data = (await response.json()) as JobListResponse;
      setJobs((current) => (append ? [...current, ...data.jobs] : data.jobs));
      setHasMore(data.jobs.length === pageSize);
    } catch {
      setError("We couldn't load your Jobs. Try again.");
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    void load(0, false);
  }, [load]);

  // TODO: Replace manual refresh with SSE/WebSocket Job lifecycle updates when real-time status is needed.
  if (loading)
    return (
      <div aria-label="Loading Jobs" className="space-y-3">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    );
  if (error)
    return (
      <Empty>
        <EmptyHeader>
          <EmptyTitle>Jobs unavailable</EmptyTitle>
          <EmptyDescription>{error}</EmptyDescription>
          <Button onClick={() => void load(0, false)}>Try again</Button>
        </EmptyHeader>
      </Empty>
    );
  if (jobs.length === 0)
    return (
      <Empty>
        <EmptyHeader>
          <EmptyTitle>No Jobs yet</EmptyTitle>
          <EmptyDescription>Run a Task to see its status and results here.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  return (
    <div className="space-y-4">
      <div className="flex justify-end gap-2">
        <Button size="sm" render={<Link href="/results/new" />}>
          New Job
        </Button>
        <Button variant="outline" size="sm" onClick={() => void load(0, false)}>
          <RefreshCwIcon data-icon="inline-start" />
          Refresh
        </Button>
      </div>
      <div className="overflow-hidden rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Task</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Created</TableHead>
              <TableHead>Updated</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {jobs.map((job) => (
              <TableRow key={job.id}>
                <TableCell className="font-medium">{job.task_name}</TableCell>
                <TableCell className="capitalize">{job.status}</TableCell>
                <TableCell>{formatDate(job.created_at)}</TableCell>
                <TableCell>{formatDate(job.updated_at)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {hasMore && (
        <Button
          variant="outline"
          disabled={loadingMore}
          onClick={() => void load(jobs.length, true)}
        >
          {loadingMore ? "Loading…" : "Load more"}
        </Button>
      )}
    </div>
  );
}
