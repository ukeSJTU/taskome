import { SectionHeading } from "@/app/_components/section-heading";

const channels = [
  {
    index: "A",
    name: "Web App",
    notation: "browse · submit · inspect",
    description:
      "Discover curated Tools, submit Jobs, inspect Attempts and Job Outputs, and organize Projects and scientific files in the browser.",
  },
  {
    index: "B",
    name: "MCP Agent",
    notation: "discover · authorize · execute",
    description:
      "Let a compatible agent discover and use Taskome through explicit, revocable authorization while preserving the same durable records.",
  },
  {
    index: "C",
    name: "Direct API Client",
    notation: "typed resources · explicit grants",
    description:
      "Build a user-controlled integration around the same Tools, Jobs, Attempts, Projects, and files exposed by the product model.",
  },
  {
    index: "D",
    name: "CLI",
    notation: "shell · scripts · file transfer",
    description:
      "Work from a terminal or automation environment without creating a second vocabulary for compute or provenance.",
  },
] as const;

export function AccessSection() {
  return (
    <section id="access" className="access-section" aria-labelledby="access-title">
      <div className="section-shell">
        <SectionHeading
          index="04"
          label="Access"
          summary="Choose the surface that fits the work. Every journey reaches the same Taskome concepts, permissions, and execution history."
          title="Four ways in. One scientific record."
          titleId="access-title"
        />

        <div className="access-model" aria-hidden="true">
          <span>Tool</span>
          <span>Job</span>
          <span>Attempt</span>
          <span>Job Output</span>
        </div>

        <ol className="access-list">
          {channels.map((channel) => (
            <li key={channel.name}>
              <div className="access-list__index">{channel.index}</div>
              <div className="access-list__body">
                <h3>{channel.name}</h3>
                <p className="access-list__notation">{channel.notation}</p>
                <p className="access-list__description">{channel.description}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
