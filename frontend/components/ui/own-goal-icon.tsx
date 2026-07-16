export function OwnGoalIcon({ className = "h-3 w-3" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 20 20"
      className={className}
      aria-hidden="true"
      fill="none"
    >
      <circle cx="10" cy="10" r="8" fill="white" stroke="currentColor" />
      <path d="m10 5 2.5 1.8-1 3H8.5l-1-3L10 5Z" fill="currentColor" />
      <path
        d="m7.5 6.8-3 .7m8-0.7 3 .7M8.5 9.8l-2 2.7m5-2.7 2 2.7m-7 0 1 3m6-3-1 3"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinecap="round"
      />
    </svg>
  );
}
