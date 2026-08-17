import { JobsList } from "./_components/jobs-list";

export default function ResultsPage() {
  return (
    <section className="px-4 py-6 lg:px-6">
      <h1 className="text-2xl font-semibold tracking-tight">My Results</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Review the status and outputs of your Jobs.
      </p>
      <div className="mt-6">
        <JobsList />
      </div>
    </section>
  );
}
