type PlayerSeasonContributionBadgesProps = {
  goals?: number | null;
  assists?: number | null;
  variant?: "inline" | "overlay";
};

function AssistIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-3 w-3" aria-hidden="true">
      <path
        d="M4 12.8c2.8-.5 5.3-2.4 7.4-5.6l1.2-1.8 2.6 1.7-1.7 2.5 3.5 2.2c.8.5 1.1 1.4.8 2.2-.2.7-.8 1.1-1.6 1.1H4.7c-1.2 0-1.8-1.5-.7-2.3Z"
        fill="currentColor"
      />
      <path
        d="M6.5 11.7 8 14m1-4 2.1 3.2m1.7-5.8 1.5 2"
        stroke="#fff"
        strokeWidth="1.1"
        strokeLinecap="round"
      />
    </svg>
  );
}

function contributionTitle(value: number, singular: string) {
  return `${value} confirmed season ${singular}${value === 1 ? "" : "s"}`;
}

export function PlayerSeasonContributionBadges({
  goals,
  assists,
  variant = "inline",
}: PlayerSeasonContributionBadgesProps) {
  const goalTotal = Math.max(0, Number(goals ?? 0));
  const assistTotal = Math.max(0, Number(assists ?? 0));

  if (goalTotal === 0 && assistTotal === 0) return null;

  const goalBadge = goalTotal ? (
    <span
      className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-white px-1 text-[10px] font-black text-slate-950 shadow ring-1 ring-slate-200"
      title={contributionTitle(goalTotal, "goal")}
      aria-label={contributionTitle(goalTotal, "goal")}
    >
      ⚽{goalTotal > 1 ? goalTotal : ""}
    </span>
  ) : null;

  const assistBadge = assistTotal ? (
    <span
      className="inline-flex h-5 min-w-5 items-center justify-center gap-0.5 rounded-full bg-white px-1 text-[10px] font-black text-slate-800 shadow ring-1 ring-slate-200"
      title={contributionTitle(assistTotal, "assist")}
      aria-label={contributionTitle(assistTotal, "assist")}
    >
      <AssistIcon />
      {assistTotal > 1 ? assistTotal : ""}
    </span>
  ) : null;

  if (variant === "overlay") {
    return (
      <span className="pointer-events-none absolute inset-0 z-20">
        {goalBadge ? (
          <span className="absolute -bottom-1 -right-2">{goalBadge}</span>
        ) : null}
        {assistBadge ? (
          <span className="absolute -bottom-1 -left-2">{assistBadge}</span>
        ) : null}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1">
      {goalBadge}
      {assistBadge}
    </span>
  );
}
