"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import type { FixtureDto, StandingDto } from "@flms/shared";
import { Badge } from "@/components/ui/badge";
import { Card, CardTitle } from "@/components/ui/card";
import { publicApi } from "@/lib/api";

export default function PublicSeasonPage() {
  const params = useParams<{ seasonId: string }>();
  const [fixtures, setFixtures] = useState<FixtureDto[]>([]);
  const [standings, setStandings] = useState<StandingDto[]>([]);

  useEffect(() => {
    void publicApi<{ fixtures: FixtureDto[] }>(`/public/seasons/${params.seasonId}/fixtures`).then((data) => setFixtures(data.fixtures));
    void publicApi<{ standings: StandingDto[] }>(`/public/seasons/${params.seasonId}/standings`).then((data) => setStandings(data.standings));
  }, [params.seasonId]);

  return (
    <div className="space-y-6">
      <Card>
        <CardTitle>Standings</CardTitle>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-muted-foreground">
              <tr>
                <th>Team registration</th>
                <th>P</th>
                <th>W</th>
                <th>D</th>
                <th>L</th>
                <th>GF</th>
                <th>GA</th>
                <th>GD</th>
                <th>Pts</th>
              </tr>
            </thead>
            <tbody>
              {standings.map((row) => (
                <tr key={row.team_registration_id} className="border-t">
                  <td className="py-2">{row.team_registration_id}</td>
                  <td>{row.played}</td>
                  <td>{row.won}</td>
                  <td>{row.drawn}</td>
                  <td>{row.lost}</td>
                  <td>{row.goals_for}</td>
                  <td>{row.goals_against}</td>
                  <td>{row.goal_difference}</td>
                  <td className="font-semibold">{row.points}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card>
        <CardTitle>Fixtures and final results</CardTitle>
        <div className="mt-4 grid gap-3">
          {fixtures.map((fixture) => (
            <div key={fixture.id} className="rounded-lg border p-4">
              <div className="flex items-center justify-between">
                <span>Round {fixture.round_no}</span>
                <Badge>{fixture.status}</Badge>
              </div>
              <p className="mt-2 text-sm">
                {fixture.home_team_registration_id} vs {fixture.away_team_registration_id}
              </p>
              <p className="mt-1 font-semibold">
                {fixture.home_score ?? "-"} : {fixture.away_score ?? "-"}
              </p>
              <p className="text-xs text-muted-foreground">{fixture.venue ?? "Venue TBA"}</p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
