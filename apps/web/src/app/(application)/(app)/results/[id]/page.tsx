import { JobDetail } from "./_components/job-detail";

export default async function JobDetailPage({ params }: PageProps<"/results/[id]">) {
  const { id } = await params;
  return <JobDetail jobId={id} />;
}
