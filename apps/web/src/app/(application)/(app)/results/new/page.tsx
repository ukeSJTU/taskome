import { FpocketJobForm } from "./_components/fpocket-job-form";

export default function NewJobPage() {
  return (
    <section className="mx-auto max-w-2xl px-4 py-6 lg:px-6">
      <h1 className="text-2xl font-semibold tracking-tight">New fpocket Job</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Upload a PDB structure to detect binding pockets.
      </p>
      <div className="mt-6">
        <FpocketJobForm />
      </div>
    </section>
  );
}
