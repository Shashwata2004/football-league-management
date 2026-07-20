"use client";

import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Trophy } from "lucide-react";

const stageOrder = [
  "ROUND_OF_64",
  "ROUND_OF_32",
  "ROUND_OF_16",
  "QUARTER_FINAL",
  "SEMI_FINAL",
  "FINAL",
] as const;

const stageLabels: Record<(typeof stageOrder)[number], string> = {
  ROUND_OF_64: "R64",
  ROUND_OF_32: "R32",
  ROUND_OF_16: "R16",
  QUARTER_FINAL: "QF",
  SEMI_FINAL: "SF",
  FINAL: "FINAL",
};

const stageRank = new Map<string, number>(
  stageOrder.map((stage, index) => [stage, index]),
);

export interface KnockoutBracketTeam {
  id?: string | null;
  teams?: {
    name?: string | null;
    short_name?: string | null;
    logo_url?: string | null;
  } | null;
}

export interface KnockoutBracketFixture {
  id: string;
  round_no?: number | null;
  stage?: string | null;
  kickoff_at?: string | null;
  status: string;
  result_confirmed?: boolean | null;
  home_team_registration_id?: string | null;
  away_team_registration_id?: string | null;
  home_source?: string | null;
  away_source?: string | null;
  home_score?: number | null;
  away_score?: number | null;
  penalties_home?: number | null;
  penalties_away?: number | null;
  winner_team_registration_id?: string | null;
  penalty_winner_team_registration_id?: string | null;
  home_team?: KnockoutBracketTeam | null;
  away_team?: KnockoutBracketTeam | null;
}

interface BracketPath {
  id: string;
  d: string;
}

interface BracketSide {
  stage: string;
  fixtures: KnockoutBracketFixture[];
  column: number;
}

export function KnockoutBracket({
  fixtures,
  accentColor = "#4F46E5",
  emptyMessage = "Knockout fixtures have not been saved yet.",
}: {
  fixtures: KnockoutBracketFixture[];
  accentColor?: string;
  emptyMessage?: string;
}) {
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const matchRefs = useRef(new Map<string, HTMLDivElement>());
  const [paths, setPaths] = useState<BracketPath[]>([]);

  const sortedFixtures = useMemo(
    () =>
      fixtures
        .filter((fixture) => stageRank.has(String(fixture.stage ?? "")))
        .sort(compareKnockoutFixtures),
    [fixtures],
  );

  const rounds = useMemo(
    () =>
      stageOrder
        .map((stage) => ({
          stage,
          fixtures: sortedFixtures.filter((fixture) => fixture.stage === stage),
        }))
        .filter((round) => round.fixtures.length > 0),
    [sortedFixtures],
  );

  const finalRound = rounds.find((round) => round.stage === "FINAL") ?? null;
  const finalFixture = finalRound?.fixtures[0] ?? null;
  const sideRounds = rounds.filter((round) => round.stage !== "FINAL");
  const columnCount = Math.max(sideRounds.length * 2 + 1, 1);
  const centreColumn = Math.floor(columnCount / 2) + 1;
  const firstRoundMatchCount = sideRounds[0]?.fixtures.length ?? 2;
  const canvasHeight = Math.max(590, Math.ceil(firstRoundMatchCount / 2) * 158);
  const canvasWidth = Math.max(420, columnCount * 184 + (columnCount - 1) * 46);

  const sides = useMemo<BracketSide[]>(() => {
    return sideRounds.flatMap((round, roundIndex) => {
      const midpoint = Math.ceil(round.fixtures.length / 2);
      return [
        {
          stage: round.stage,
          fixtures: round.fixtures.slice(0, midpoint),
          column: roundIndex + 1,
        },
        {
          stage: round.stage,
          fixtures: round.fixtures.slice(midpoint),
          column: columnCount - roundIndex,
        },
      ];
    });
  }, [columnCount, sideRounds]);

  const connections = useMemo(() => {
    const result: Array<{
      fromId: string;
      toId: string;
      id: string;
    }> = [];
    for (let roundIndex = 0; roundIndex < rounds.length - 1; roundIndex += 1) {
      const currentRound = rounds[roundIndex]?.fixtures ?? [];
      const nextRound = rounds[roundIndex + 1]?.fixtures ?? [];
      for (let nextIndex = 0; nextIndex < nextRound.length; nextIndex += 1) {
        const target = nextRound[nextIndex];
        const firstSource = currentRound[nextIndex * 2];
        const secondSource = currentRound[nextIndex * 2 + 1];
        if (!target) continue;
        for (const source of [firstSource, secondSource]) {
          if (!source) continue;
          result.push({
            fromId: source.id,
            toId: target.id,
            id: `${source.id}-${target.id}`,
          });
        }
      }
    }
    return result;
  }, [rounds]);

  const updatePaths = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const canvasRect = canvas.getBoundingClientRect();
    const nextPaths: BracketPath[] = [];
    for (const connection of connections) {
      const source = matchRefs.current.get(connection.fromId);
      const target = matchRefs.current.get(connection.toId);
      if (!source || !target) continue;
      const sourceRect = source.getBoundingClientRect();
      const targetRect = target.getBoundingClientRect();
      const sourceCentreX = sourceRect.left + sourceRect.width / 2;
      const targetCentreX = targetRect.left + targetRect.width / 2;
      const travelsRight = sourceCentreX < targetCentreX;
      const startX =
        (travelsRight ? sourceRect.right : sourceRect.left) - canvasRect.left;
      const endX =
        (travelsRight ? targetRect.left : targetRect.right) - canvasRect.left;
      const startY = sourceRect.top + sourceRect.height / 2 - canvasRect.top;
      const endY = targetRect.top + targetRect.height / 2 - canvasRect.top;
      const bendX = startX + (endX - startX) / 2;
      nextPaths.push({
        id: connection.id,
        d: `M ${startX} ${startY} H ${bendX} V ${endY} H ${endX}`,
      });
    }
    setPaths(nextPaths);
  }, [connections]);

  useLayoutEffect(() => {
    const frame = window.requestAnimationFrame(updatePaths);
    const observer = new ResizeObserver(updatePaths);
    if (canvasRef.current) observer.observe(canvasRef.current);
    window.addEventListener("resize", updatePaths);
    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("resize", updatePaths);
    };
  }, [updatePaths]);

  if (sortedFixtures.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center text-sm font-bold text-slate-500 shadow-sm">
        {emptyMessage}
      </div>
    );
  }

  const champion = finalFixture ? winnerForFixture(finalFixture) : null;

  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-5 py-3 text-xs font-bold text-slate-500 sm:hidden">
        Scroll horizontally to view the complete bracket.
      </div>
      <div className="min-w-max p-5 sm:p-8">
        <div
          ref={canvasRef}
          className="relative grid"
          style={{
            width: canvasWidth,
            height: canvasHeight,
            gridTemplateColumns: `repeat(${columnCount}, 184px)`,
            columnGap: "46px",
          }}
        >
          <svg
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 z-0 h-full w-full overflow-visible"
          >
            {paths.map((path) => (
              <path
                key={path.id}
                d={path.d}
                fill="none"
                stroke="#D7DCE3"
                strokeWidth="2"
                vectorEffect="non-scaling-stroke"
              />
            ))}
          </svg>

          {sides.map((side) => (
            <div
              key={`${side.stage}-${side.column}`}
              className="relative z-10 flex h-full flex-col justify-around"
              style={{ gridColumn: side.column, gridRow: 1 }}
            >
              {side.fixtures.map((fixture) => (
                <BracketMatch
                  key={fixture.id}
                  fixture={fixture}
                  accentColor={accentColor}
                  register={(node) => {
                    if (node) matchRefs.current.set(fixture.id, node);
                    else matchRefs.current.delete(fixture.id);
                  }}
                />
              ))}
            </div>
          ))}

          <div
            className="relative z-10 h-full"
            style={{ gridColumn: centreColumn, gridRow: 1 }}
          >
            <Champion team={champion} />
            {finalFixture ? (
              <div className="absolute left-1/2 top-[58%] -translate-x-1/2 -translate-y-1/2">
                <BracketMatch
                  fixture={finalFixture}
                  accentColor={accentColor}
                  register={(node) => {
                    if (node) matchRefs.current.set(finalFixture.id, node);
                    else matchRefs.current.delete(finalFixture.id);
                  }}
                />
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function BracketMatch({
  fixture,
  accentColor,
  register,
}: {
  fixture: KnockoutBracketFixture;
  accentColor: string;
  register: (node: HTMLDivElement | null) => void;
}) {
  const first = fixtureTeam(fixture, "first");
  const second = fixtureTeam(fixture, "second");
  const winner = winnerForFixture(fixture);
  const hasScore =
    fixture.home_score !== null &&
    fixture.home_score !== undefined &&
    fixture.away_score !== null &&
    fixture.away_score !== undefined;
  const hasPenalties =
    fixture.penalties_home !== null &&
    fixture.penalties_home !== undefined &&
    fixture.penalties_away !== null &&
    fixture.penalties_away !== undefined;
  const stage = String(fixture.stage ?? "");
  const stageLabel = stageLabels[stage as keyof typeof stageLabels] ?? stage;

  return (
    <div className="flex w-[184px] flex-col items-center">
      <div
        ref={register}
        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 shadow-sm"
        title={`${first.fullName} versus ${second.fullName}`}
      >
        <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-2">
          <BracketTeam
            team={first}
            eliminated={Boolean(
              winner?.id && first.id && winner.id !== first.id,
            )}
          />
          <div className="pb-0.5 text-center font-mono text-sm font-black text-slate-900">
            {hasScore ? (
              <>
                <div>
                  {fixture.home_score} <span className="text-slate-400">–</span>{" "}
                  {fixture.away_score}
                </div>
                {hasPenalties ? (
                  <div className="mt-1 text-[9px] font-bold uppercase tracking-wide text-slate-500">
                    Pens {fixture.penalties_home}–{fixture.penalties_away}
                  </div>
                ) : null}
              </>
            ) : (
              <span className="text-slate-400">–</span>
            )}
          </div>
          <BracketTeam
            team={second}
            eliminated={Boolean(
              winner?.id && second.id && winner.id !== second.id,
            )}
          />
        </div>
      </div>
      <span
        className="-mt-1 rounded-md px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.12em] text-white shadow-sm"
        style={{ backgroundColor: accentColor }}
      >
        {stageLabel}
      </span>
    </div>
  );
}

function BracketTeam({
  team,
  eliminated,
}: {
  team: ReturnType<typeof fixtureTeam>;
  eliminated: boolean;
}) {
  return (
    <div
      className={`min-w-0 text-center ${eliminated ? "opacity-45 grayscale" : ""}`}
    >
      <TeamMark team={team} />
      <p
        className={`mt-1 truncate text-[11px] font-black text-slate-800 ${eliminated ? "line-through" : ""}`}
      >
        {team.label}
      </p>
    </div>
  );
}

function TeamMark({ team }: { team: ReturnType<typeof fixtureTeam> }) {
  if (team.logoUrl) {
    return (
      <img
        src={team.logoUrl}
        alt={team.fullName}
        className="mx-auto h-8 w-8 rounded-full border border-slate-200 bg-white object-cover"
      />
    );
  }
  return (
    <div className="mx-auto grid h-8 w-8 place-items-center rounded-full border border-slate-200 bg-slate-100 text-[9px] font-black text-slate-500">
      {team.initials}
    </div>
  );
}

function Champion({
  team,
}: {
  team: ReturnType<typeof winnerForFixture> | null;
}) {
  return (
    <div className="absolute left-1/2 top-[19%] flex w-44 -translate-x-1/2 -translate-y-1/2 flex-col items-center text-center">
      {team?.logoUrl ? (
        <div className="relative">
          <Trophy className="h-20 w-20 text-amber-400" strokeWidth={1.4} />
          <img
            src={team.logoUrl}
            alt={team.fullName}
            className="absolute left-1/2 top-[42%] h-10 w-10 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-white object-cover shadow"
          />
        </div>
      ) : (
        <Trophy className="h-20 w-20 text-slate-300" strokeWidth={1.4} />
      )}
      <p className="mt-1 max-w-44 truncate text-base font-black text-slate-800">
        {team?.fullName ?? "Champion TBD"}
      </p>
      <p className="mt-1 text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">
        Champion
      </p>
    </div>
  );
}

function fixtureTeam(
  fixture: KnockoutBracketFixture,
  side: "first" | "second",
) {
  const registration = side === "first" ? fixture.home_team : fixture.away_team;
  const registrationId =
    side === "first"
      ? fixture.home_team_registration_id
      : fixture.away_team_registration_id;
  const source = side === "first" ? fixture.home_source : fixture.away_source;
  const fullName = registration?.teams?.name ?? source ?? "TBD";
  const shortName = registration?.teams?.short_name?.trim();
  return {
    id: registrationId ?? registration?.id ?? null,
    fullName,
    label: shortName || compactSourceLabel(source) || initials(fullName),
    initials: initials(fullName),
    logoUrl: registration?.teams?.logo_url ?? null,
  };
}

function winnerForFixture(fixture: KnockoutBracketFixture) {
  const winnerId =
    fixture.penalty_winner_team_registration_id ??
    fixture.winner_team_registration_id ??
    inferredWinnerId(fixture);
  if (!winnerId) return null;
  const side =
    winnerId === fixture.home_team_registration_id ? "first" : "second";
  return fixtureTeam(fixture, side);
}

function inferredWinnerId(fixture: KnockoutBracketFixture) {
  if (!fixture.result_confirmed) return null;
  if (
    fixture.home_score === null ||
    fixture.home_score === undefined ||
    fixture.away_score === null ||
    fixture.away_score === undefined
  )
    return null;
  if (fixture.home_score > fixture.away_score)
    return fixture.home_team_registration_id ?? null;
  if (fixture.away_score > fixture.home_score)
    return fixture.away_team_registration_id ?? null;
  return null;
}

function compactSourceLabel(source?: string | null) {
  if (!source) return null;
  const knockoutMatch = source.match(/KO\d+/i)?.[0];
  return knockoutMatch ? `${knockoutMatch.toUpperCase()} W` : "TBD";
}

function initials(value: string) {
  const result = value
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .toUpperCase()
    .slice(0, 3);
  return result || "TBD";
}

function compareKnockoutFixtures(
  left: KnockoutBracketFixture,
  right: KnockoutBracketFixture,
) {
  const roundDifference =
    Number(left.round_no ?? 0) - Number(right.round_no ?? 0);
  if (roundDifference) return roundDifference;
  const kickoffDifference = String(left.kickoff_at ?? "").localeCompare(
    String(right.kickoff_at ?? ""),
  );
  if (kickoffDifference) return kickoffDifference;
  return left.id.localeCompare(right.id);
}
