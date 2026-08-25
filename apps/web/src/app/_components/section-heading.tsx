type SectionHeadingProps = {
  index: string;
  label: string;
  summary: string;
  title: string;
  titleId: string;
};

export function SectionHeading({ index, label, summary, title, titleId }: SectionHeadingProps) {
  return (
    <header className="section-heading">
      <p className="section-heading__label">
        <span>{index}</span>
        {label}
      </p>
      <h2 id={titleId}>{title}</h2>
      <p className="section-heading__summary">{summary}</p>
    </header>
  );
}
