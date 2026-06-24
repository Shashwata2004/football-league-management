"use client";

import { FormEvent, useEffect, useState } from "react";
import { SeasonFormat } from "@flms/shared";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Input, Textarea } from "@/components/ui/input";
import { api } from "@/lib/api";

interface RoleRequest {
  id: string;
  user_id: string;
  requested_role: string;
  status: string;
  profiles?: { email: string };
}

interface Registration {
  id: string;
  status: string;
  teams?: { name: string };
}

export default function AdminDashboard() {
  const [leagueName, setLeagueName] = useState("");
  const [description, setDescription] = useState("");
  const [leagueId, setLeagueId] = useState("");
  const [seasonName, setSeasonName] = useState("");
  const [seasonId, setSeasonId] = useState("");
  const [roleRequests, setRoleRequests] = useState<RoleRequest[]>([]);
  const [teamRegistrations, setTeamRegistrations] = useState<Registration[]>([]);
  const [message, setMessage] = useState("");

  async function loadReviews() {
    const [roles, teams] = await Promise.all([
      api<{ role_requests: RoleRequest[] }>("/admin/role-requests"),
      api<{ team_registrations: Registration[] }>("/admin/team-registrations")
    ]);
    setRoleRequests(roles.role_requests);
    setTeamRegistrations(teams.team_registrations);
  }

  useEffect(() => {
    void loadReviews().catch(() => undefined);
  }, []);

  async function createLeague(event: FormEvent) {
    event.preventDefault();
    const data = await api<{ league: { id: string } }>("/admin/leagues", {
      method: "POST",
      body: JSON.stringify({ name: leagueName, description })
    });
    setLeagueId(data.league.id);
    setMessage(`League created: ${data.league.id}`);
  }

  async function createSeason(event: FormEvent) {
    event.preventDefault();
    const data = await api<{ season: { id: string } }>("/admin/seasons", {
      method: "POST",
      body: JSON.stringify({ league_id: leagueId, name: seasonName, format: SeasonFormat.SINGLE_ROUND_ROBIN })
    });
    setSeasonId(data.season.id);
    setMessage(`Season created: ${data.season.id}`);
  }

  async function decideRole(id: string, status: "APPROVED" | "REJECTED") {
    await api(`/admin/role-requests/${id}`, { method: "PATCH", body: JSON.stringify({ status }) });
    await loadReviews();
  }

  async function decideTeam(id: string, status: "APPROVED" | "REJECTED") {
    await api(`/admin/team-registrations/${id}/decision`, { method: "PATCH", body: JSON.stringify({ status }) });
    await loadReviews();
  }

  async function generateFixtures() {
    const data = await api<{ fixtures: unknown[] }>("/admin/fixtures/generate", {
      method: "POST",
      body: JSON.stringify({ season_id: seasonId })
    });
    setMessage(`Generated ${data.fixtures.length} fixtures.`);
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardTitle>Create league</CardTitle>
          <form className="mt-4 space-y-3" onSubmit={createLeague}>
            <Input placeholder="League name" value={leagueName} onChange={(event) => setLeagueName(event.target.value)} />
            <Textarea placeholder="Description" value={description} onChange={(event) => setDescription(event.target.value)} />
            <Button>Create league</Button>
          </form>
        </Card>

        <Card>
          <CardTitle>Create season</CardTitle>
          <CardDescription>Default form creates single round-robin; API also supports double round-robin and group + knockout.</CardDescription>
          <form className="mt-4 space-y-3" onSubmit={createSeason}>
            <Input placeholder="League UUID" value={leagueId} onChange={(event) => setLeagueId(event.target.value)} />
            <Input placeholder="Season name" value={seasonName} onChange={(event) => setSeasonName(event.target.value)} />
            <Button>Create season</Button>
          </form>
        </Card>
      </div>

      <Card>
        <CardTitle>Generate fixtures</CardTitle>
        <div className="mt-4 flex gap-3">
          <Input placeholder="Season UUID" value={seasonId} onChange={(event) => setSeasonId(event.target.value)} />
          <Button onClick={generateFixtures}>Generate</Button>
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardTitle>Manager role requests</CardTitle>
          <div className="mt-4 space-y-3">
            {roleRequests.map((request) => (
              <div key={request.id} className="rounded-md border p-3 text-sm">
                <p className="font-medium">{request.profiles?.email ?? request.user_id}</p>
                <p className="text-muted-foreground">{request.status}</p>
                {request.status === "PENDING" ? (
                  <div className="mt-2 flex gap-2">
                    <Button onClick={() => decideRole(request.id, "APPROVED")}>Approve</Button>
                    <Button className="bg-slate-900" onClick={() => decideRole(request.id, "REJECTED")}>
                      Reject
                    </Button>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <CardTitle>Team approvals</CardTitle>
          <div className="mt-4 space-y-3">
            {teamRegistrations.map((registration) => (
              <div key={registration.id} className="rounded-md border p-3 text-sm">
                <p className="font-medium">{registration.teams?.name ?? registration.id}</p>
                <p className="text-muted-foreground">{registration.status}</p>
                {registration.status === "PENDING" ? (
                  <div className="mt-2 flex gap-2">
                    <Button onClick={() => decideTeam(registration.id, "APPROVED")}>Approve</Button>
                    <Button className="bg-slate-900" onClick={() => decideTeam(registration.id, "REJECTED")}>
                      Reject
                    </Button>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </Card>
      </div>

      {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
    </div>
  );
}
