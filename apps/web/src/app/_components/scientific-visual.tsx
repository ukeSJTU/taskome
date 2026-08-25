const sequence = ["M", "K", "T", "L", "A", "E", "Q", "L", "G", "V", "S", "D"];

export function ScientificVisual() {
  return (
    <figure className="scientific-visual" aria-labelledby="scientific-visual-caption">
      <div className="scientific-visual__index" aria-hidden="true">
        <span>01</span>
        <span>12</span>
      </div>

      <svg
        className="scientific-visual__drawing"
        viewBox="0 0 620 720"
        role="img"
        aria-label="A protein trace moving through a reproducible compute record"
      >
        <g className="scientific-visual__grid" aria-hidden="true">
          <path d="M42 72H578M42 184H578M42 296H578M42 408H578M42 520H578M42 632H578" />
          <path d="M86 38V682M198 38V682M310 38V682M422 38V682M534 38V682" />
        </g>
        <path
          className="scientific-visual__protein-shadow"
          d="M78 554C132 472 137 380 221 358C302 337 313 435 386 406C458 377 420 270 504 220C535 201 557 180 570 142"
        />
        <path
          className="scientific-visual__protein"
          d="M64 548C127 483 127 383 217 354C306 325 318 428 386 399C454 370 416 267 499 216C532 196 552 174 566 136"
        />
        <path
          className="scientific-visual__trace"
          d="M67 600H194L244 546L308 576L378 502L429 524L484 452H566"
        />
        <g className="scientific-visual__nodes">
          <circle cx="64" cy="548" r="10" />
          <circle cx="217" cy="354" r="10" />
          <circle cx="386" cy="399" r="10" />
          <circle cx="499" cy="216" r="10" />
          <circle cx="566" cy="136" r="10" />
        </g>
        <g className="scientific-visual__annotations">
          <path d="M217 340V286H302" />
          <path d="M386 415V465H468" />
          <text x="222" y="272">
            CURATED INPUT
          </text>
          <text x="391" y="489">
            JOB / 01A7
          </text>
        </g>
      </svg>

      <div className="scientific-visual__sequence" aria-hidden="true">
        {sequence.map((residue, index) => (
          <span key={`${residue}-${index}`}>{residue}</span>
        ))}
      </div>

      <figcaption id="scientific-visual-caption">
        <span>One scientific record</span>
        A curated Tool receives an input, runs a traceable Job, and publishes reproducible outputs.
      </figcaption>
    </figure>
  );
}
