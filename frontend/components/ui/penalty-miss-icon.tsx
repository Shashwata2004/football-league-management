export function PenaltyMissIcon({
  className = "h-5 w-5",
}: {
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 64 64"
      className={className}
      aria-hidden="true"
      fill="none"
    >
      <circle cx="32" cy="32" r="30" fill="#fff" stroke="#d1d5db" strokeWidth="2" />
      <path
        d="M13 45V27h29v18M13 27l6-7h29v18h-6M19 20v7M27 20v7M35 20v7M42 27l6-7"
        stroke="#111827"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M13 36h29M22 27v18M32 27v18"
        stroke="#9ca3af"
        strokeWidth="1.5"
      />
      <circle cx="49" cy="46" r="9" fill="#ef4444" stroke="#fff" strokeWidth="2" />
      <path
        d="m45.5 42.5 7 7m0-7-7 7"
        stroke="#fff"
        strokeWidth="2.8"
        strokeLinecap="round"
      />
    </svg>
  );
}
