"use client";

import { FormEvent, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Input, Textarea } from "@/components/ui/input";
import { api } from "@/lib/api";

interface TeamRegistration {
  id: string;
  season_id: string;
  status: string;
  teams?: { name: string; short_name: string };
}

export default function ManagerDashboard() {
  const [seasonId, setSeasonId] = useState("");
  const [teamName, setTeamName] = useState("");
  const [shortName, setShortName] = useState("");
  const [roleReason, setRoleReason] = useState("");
  const [teams, setTeams] = useState<TeamRegistration[]>([]);
  const [message, setMessage] = useState("");

  async function load() {
    const data = await api<{ team_registrations: TeamRegistration[] }>("/manager/team-registrations");
    setTeams(data.team_registrations);
  }

  useEffect(() => {
    void load().catch(() => undefined);
  }, []);

  async function requestManager() {
    await api("/role-requests/manager", { method: "POST", body: JSON.stringify({ reason: roleReason }) });
    setMessage("Manager role request submitted.");
  }

  async function submitTeam(event: FormEvent) {
    event.preventDefault();
    await api("/manager/team-registrations", {
      method: "POST",
      body: JSON.stringify({ season_id: seasonId, name: teamName, short_name: shortName })
    });
    setMessage("Team registration submitted for admin review.");
    await load();
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardTitle>Request manager role</CardTitle>
        <CardDescription>Admins approve manager access. Admin users are seeded manually.</CardDescription>
        <Textarea className="mt-4" placeholder="Reason" value={roleReason} onChange={(event) => setRoleReason(event.target.value)} />
        <Button className="mt-3" onClick={requestManager}>
          Submit request
        </Button>
      </Card>

      <Card>
        <CardTitle>Register team for season</CardTitle>
        <form className="mt-4 space-y-3" onSubmit={submitTeam}>
          <Input placeholder="Season UUID" value={seasonId} onChange={(event) => setSeasonId(event.target.value)} />
          <Input placeholder="Team name" value={teamName} onChange={(event) => setTeamName(event.target.value)} />
          <Input placeholder="Short name" value={shortName} onChange={(event) => setShortName(event.target.value)} />
          <Button>Submit team</Button>
        </form>
      </Card>

      <Card className="lg:col-span-2">
        <CardTitle>My team registrations</CardTitle>
        <div className="mt-4 grid gap-3">
          {teams.map((team) => (
            <div key={team.id} className="rounded-md border p-3 text-sm">
              <p className="font-medium">{team.teams?.name ?? team.id}</p>
              <p className="text-muted-foreground">Season {team.season_id} · {team.status}</p>
            </div>
          ))}
        </div>
        {message ? <p className="mt-4 text-sm text-muted-foreground">{message}</p> : null}
      </Card>
    </div>
  );
}
