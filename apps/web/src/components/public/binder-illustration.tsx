export function BinderIllustration() {
  return (
    <svg
      viewBox="0 0 560 560"
      role="img"
      aria-label="Schematic diagram of an AI-designed binder ribbon locking onto a target protein's binding interface"
      className="h-full w-full"
    >
      <title>Designed binder engaging a target interface</title>

      {/* Target protein: large looping ribbon, pale bio tone */}
      <path
        d="M 90 320 C 90 180, 210 90, 330 100 C 450 110, 500 220, 460 300 C 425 370, 320 380, 250 350 C 190 325, 150 380, 170 440 C 185 485, 250 500, 300 470"
        fill="none"
        stroke="var(--color-bio-200)"
        strokeWidth="34"
        strokeLinecap="round"
      />
      <path
        d="M 90 320 C 90 180, 210 90, 330 100 C 450 110, 500 220, 460 300 C 425 370, 320 380, 250 350 C 190 325, 150 380, 170 440 C 185 485, 250 500, 300 470"
        fill="none"
        stroke="var(--color-bio-300)"
        strokeWidth="6"
        strokeLinecap="round"
      />

      {/* Designed binder: tighter ribbon, deeper bio tone, approaching from lower right */}
      <path
        d="M 500 480 C 460 440, 430 400, 400 360 C 380 335, 360 320, 335 315"
        fill="none"
        stroke="var(--color-bio-700)"
        strokeWidth="26"
        strokeLinecap="round"
      />
      <path
        d="M 500 480 C 460 440, 430 400, 400 360 C 380 335, 360 320, 335 315"
        fill="none"
        stroke="var(--color-bio-500)"
        strokeWidth="4"
        strokeLinecap="round"
      />

      {/* Binder's final contact stretch, recolored into the binding interface itself */}
      <path
        d="M 360 322 C 348 320, 338 317, 335 315"
        fill="none"
        stroke="var(--color-signal)"
        strokeWidth="6"
        strokeLinecap="round"
      />

      {/* beta-strand arrowhead marking the binder's terminal contact residue */}
      <path d="M 335 315 L 300 300 L 320 285 Z" fill="var(--color-signal)" />

      {/* Binding interface marker */}
      <g>
        <circle
          cx="308"
          cy="298"
          r="16"
          fill="none"
          stroke="var(--color-signal)"
          strokeWidth="2"
          className="motion-safe:animate-[interface-pulse_2.6s_ease-out_infinite]"
        />
        <circle cx="308" cy="298" r="9" fill="var(--color-signal)" />
      </g>

      <style>{`
        @keyframes interface-pulse {
          0% { r: 16; opacity: 0.9; }
          70% { r: 40; opacity: 0; }
          100% { r: 40; opacity: 0; }
        }
      `}</style>
    </svg>
  );
}
