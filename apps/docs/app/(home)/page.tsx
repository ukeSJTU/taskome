import Link from "next/link";

export default function HomePage() {
  return (
    <div className="flex flex-col justify-center text-center flex-1">
      <h1 className="text-2xl font-bold mb-4">Taskome documentation</h1>
      <p>
        Browse the{" "}
        <Link href="/docs" className="font-medium underline">
          Developer Docs
        </Link>{" "}
        for the public REST API reference and onboarding guidance.
      </p>
    </div>
  );
}
