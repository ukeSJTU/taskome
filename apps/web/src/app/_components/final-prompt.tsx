type FinalPromptProps = {
  signInHref: string;
};

export function FinalPrompt({ signInHref }: FinalPromptProps) {
  return (
    <section id="sign-in" className="final-prompt" aria-labelledby="final-prompt-title">
      <div className="section-shell final-prompt__inner">
        <p className="editorial-label">Taskome / Ready when you are</p>
        <h2 id="final-prompt-title">Return to the work with the record intact.</h2>
        <a className="signal-action signal-action--final" href={signInHref}>
          Sign in
        </a>
      </div>
    </section>
  );
}
