"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { LeagueDto, SeasonDto } from "@flms/shared";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { publicApi } from "@/lib/api";

export default function PublicPage() {
  const [leagues, setLeagues] = useState<LeagueDto[]>([]);
  const [seasonsByLeague, setSeasonsByLeague] = useState<Record<string, SeasonDto[]>>({});

  useEffect(() => {
    publicApi<{ leagues: LeagueDto[] }>("/public/leagues").then(async ({ leagues }) => {
      setLeagues(leagues);
      const entries = await Promise.all(
        leagues.map(async (league) => {
          const data = await publicApi<{ seasons: SeasonDto[] }>(`/public/leagues/${league.id}/seasons`);
          return [league.id, data.seasons] as const;
        })
      );
      setSeasonsByLeague(Object.fromEntries(entries));
    });
  }, []);

  return (
    <div className="space-y-6">
      <section className="rounded-2xl bg-slate-950 p-8 text-white">
        <p className="text-sm uppercase tracking-wide text-green-300">DBMS Course Project</p>
        <h1 className="mt-2 text-4xl font-bold">Custom Football League Management System</h1>
        <p className="mt-3 max-w-2xl text-slate-300">
          Public fixtures, final results, standings, and player season statistics. Admin-only attributes, formulas, identity data, and
          unconfirmed simulations are not exposed.
        </p>
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        {leagues.map((league) => (
          <Card key={league.id}>
            <CardTitle>{league.name}</CardTitle>
            <CardDescription>{league.description ?? league.country ?? "No description"}</CardDescription>
            <div className="mt-4 space-y-2">
              {(seasonsByLeague[league.id] ?? []).map((season) => (
                <Link key={season.id} href={`/public/seasons/${season.id}`} className="block rounded-md border p-3 hover:bg-muted">
                  {season.name} · {season.format.replaceAll("_", " ")}
                </Link>
              ))}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
