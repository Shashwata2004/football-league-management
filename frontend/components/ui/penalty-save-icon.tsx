export function PenaltySaveIcon({
  className = "h-4 w-4",
}: {
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 32 32"
      className={className}
      aria-hidden="true"
      fill="none"
    >
      <circle
        cx="16"
        cy="16"
        r="15"
        fill="#fff"
        stroke="#d1d5db"
        strokeWidth="1.5"
      />
      <circle cx="21.5" cy="10.5" r="5" fill="#fff" stroke="#111827" />
      <path
        d="m21.5 7.7 1.65 1.2-.63 1.94h-2.04l-.63-1.94 1.65-1.2Zm-2.95 4.05-1.4 1.55m7.3-1.55 1.4 1.55m-4.35-2.46v2.1"
        stroke="#111827"
        strokeWidth="1"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M8.25 17.1c-.7-.95-.55-1.9.05-2.25.5-.3 1.05-.05 1.55.55l1.05 1.25-.65-5.7c-.08-.75.35-1.3.95-1.35.6-.05 1.05.4 1.15 1.05l.55 4.2-.05-5.35c0-.75.45-1.25 1.05-1.25s1.05.5 1.05 1.2l.08 5.15.45-4.65c.08-.7.5-1.1 1.1-1.05.55.05.9.5.85 1.2l-.3 4.85.75-3.1c.18-.7.68-1.05 1.25-.9.55.15.8.7.63 1.35l-1.35 5.5c-.45 1.85-1.4 3.2-2.95 3.85l.45 2.1-5.85 1.25-.55-2.45c-.2-.9-.55-1.75-1.2-2.6l-2.05-2.9Z"
        fill="#111827"
        stroke="#fff"
        strokeWidth=".7"
        strokeLinejoin="round"
      />
      <path
        d="m10.05 22.6 5.85-1.25.65 3.05-5.85 1.25-.65-3.05Z"
        fill="#22c55e"
        stroke="#111827"
        strokeWidth=".7"
      />
    </svg>
  );
}
