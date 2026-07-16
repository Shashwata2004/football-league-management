# Functional Dependencies and Normalization Analysis

## 1. Purpose and scope

This document provides the formal functional-dependency and normalization
analysis for the Football League Management System database.

The analysis is based on:

- the relations declared in `supabase/schema.sql`;
- primary-key, unique-key, foreign-key, check, and trigger constraints;
- business rules enforced by the backend and database triggers; and
- the current live PostgreSQL/Supabase schema.

Views are excluded from normalization because they do not store independent
tuples. The three reporting views are derived from the base relations.

## 2. Notation

- `X -> Y` means that attribute set `X` functionally determines attribute set
  `Y`.
- `K -> non-key attributes` is compact notation. In a strict canonical cover,
  it is decomposed into one FD for each right-hand-side attribute.
- `all` means all remaining attributes of the relation.
- `PK` means primary key.
- `AK` means alternate candidate key.
- A conditional FD applies only when its stated predicate is true, such as a
  partial unique index or a particular competition format.

The analysis does not treat coincidences in the current sample data as FDs. An
FD is included only when it follows from a declared key, constraint, trigger,
or stable business rule.

## 3. Design assumptions

1. A team has one current manager, represented by `teams.manager_id`.
2. A team can register only once in a season.
3. A player can register only once in a season.
4. A team registration belongs to exactly one season and one team.
5. A player registration belongs to exactly one season and one team
   registration.
6. A fixture belongs to one season. Its optional league and group labels are
   copied scope information.
7. A lineup belongs to one fixture participant and therefore inherits its
   season and manager scope.
8. A player can have at most one statistics row per fixture.
9. A team can have at most one statistics row per fixture.
10. Standings values obey standard football arithmetic:
    `played = won + drawn + lost`,
    `goal_difference = goals_for - goals_against`, and
    `points = 3 * won + drawn`.
11. Copied scope and snapshot attributes are intentional operational
    denormalizations unless stated otherwise.

## 4. Candidate keys

The following table lists the important minimal keys. Every base relation also
has the surrogate key `id`, unless noted otherwise.

| Relation | Additional candidate or conditional keys |
| --- | --- |
| `profiles` | None declared |
| `app_users` | `email` |
| `app_managers` | `email` |
| `app_admins` | `email` |
| `role_requests` | `(user_id, requested_role)` while `status = 'PENDING'` |
| `leagues` | None declared |
| `seasons` | None declared |
| `teams` | None; `(id, manager_id)` is a referenced superkey, not a minimal candidate key |
| `team_registrations` | `(season_id, team_id)` |
| `players` | `id_number_hash` when non-null; `generated_identity_number` when non-null |
| `identity_proofs` | None declared |
| `player_season_registrations` | `(season_id, player_id)`; `player_code` when non-null; `(team_registration_id, shirt_number)` for an active squad member |
| `player_hidden_attributes` | `player_registration_id` |
| `player_abilities` | `player_registration_id` |
| `season_groups` | `(season_id, name)` |
| `fixtures` | None beyond `id`; `(id, season_id)` is a referenced superkey |
| `lineups` | `(fixture_id, team_registration_id)` and `(fixture_id, side)` |
| `lineup_players` | `(lineup_id, player_registration_id)`; `(lineup_id, slot_key)` for a starter with a slot |
| `lineup_set_piece_takers` | `(lineup_id, set_piece_type, priority)` and `(lineup_id, set_piece_type, player_registration_id)` |
| `manager_team_preferences` | `team_registration_id` under the enforced manager/season scope rule |
| `team_match_stats` | `(fixture_id, team_registration_id)` |
| `player_match_stats` | `(fixture_id, player_registration_id)` |
| `match_events` | None declared |
| `match_substitutions` | `(fixture_id, player_out_registration_id)` and `(fixture_id, player_in_registration_id)` |
| `match_injuries` | `(fixture_id, player_registration_id)` |
| `player_suspensions` | `player_registration_id` only for an active suspension |
| `standings` | `team_registration_id` under the registration-season FD; physically declared as `(season_id, team_registration_id)` |
| `player_season_stats` | `player_registration_id` under the registration-season FD; physically declared as `(season_id, player_registration_id)` |
| `manager_messages` | `notification_key` when non-null |
| `season_group_teams` | `team_registration_id`; also `(group_id, team_registration_id)` |

## 5. Non-trivial functional dependencies

### 5.1 Identity and authorization relations

Compact canonical covers:

```text
profiles:
  id -> email, full_name, role, created_at, updated_at

app_users:
  id -> email, full_name, password_hash, created_at, updated_at
  email -> id

app_managers:
  id -> email, full_name, password_hash, created_at, updated_at
  email -> id

app_admins:
  id -> email, full_name, password_hash, created_at, updated_at
  email -> id

role_requests:
  id -> user_id, requested_role, status, reason, decision_reason,
        decided_by, decided_at, created_at
```

The pending-role partial unique index introduces the conditional FD:

```text
(user_id, requested_role) -> id, reason, created_at
when status = 'PENDING'
```

### 5.2 Competition and team relations

```text
leagues:
  id -> name, short_name, logo_url, organizer_name, country,
        description, created_at, updated_at

seasons:
  id -> league_id, name, season_year, registration dates, phase,
        format, limits, group configuration, active matchday state,
        champion_team_registration_id, timestamps

teams:
  id -> manager_id, name, short_name, colors, logo and jersey URLs,
        created_at, updated_at

team_registrations:
  id -> season_id, team_id, status, review/removal state, timestamps
  (season_id, team_id) -> id
  team_id -> manager_id

season_groups:
  id -> season_id, name, locked, created_at, updated_at
  (season_id, name) -> id

season_group_teams:
  id -> group_id, team_registration_id, seed_no, status, created_at
  team_registration_id -> id
```

For a group-stage/knockout season, the check constraint introduces this
conditional derived FD:

```text
(format, group_count, qualifiers_per_group, best_third_place_teams)
  -> total_knockout_teams
when format = 'GROUP_STAGE_KNOCKOUT'
```

### 5.3 Player and registration relations

```text
players:
  id -> full_name, date_of_birth, nationality, identity attributes,
        avatar_url, timestamps
  id_number_hash -> id                     when id_number_hash is non-null
  generated_identity_number -> id          when generated_identity_number is non-null

identity_proofs:
  id -> player_id, submitted_by, id_type, identity hash/last4,
        storage_path, created_at

player_season_registrations:
  id -> player_id, season_id, team_registration_id, player state,
        position, shirt number, approval/removal/suspension state,
        identity mode, timestamps
  (season_id, player_id) -> id
  team_registration_id -> season_id
  player_code -> id                         when player_code is non-null

player_hidden_attributes:
  id -> player_registration_id, submitted_by, hidden ratings, timestamps
  player_registration_id -> id

player_abilities:
  id -> player_registration_id, player_id, season_id,
        team_registration_id, position, ratings, visibility, timestamps
  player_registration_id -> id
```

The copied `player_id`, `season_id`, and `team_registration_id` values in
`player_abilities` do not create a BCNF violation because
`player_registration_id` is itself a candidate key of that relation.

### 5.4 Fixture and lineup relations

```text
fixtures:
  id -> league_id, season_id, round/stage/group data, participants,
        schedule, result, winner, penalty result, simulation state,
        finalization state, timestamps
  season_id -> league_id
  group_id -> season_id, group_name         when group_id is non-null

lineups:
  id -> fixture_id, team_registration_id, season_id, manager_id, side,
        formation, style, captain, workflow state, timestamps
  (fixture_id, team_registration_id) -> id
  (fixture_id, side) -> id
  fixture_id -> season_id
  team_registration_id -> season_id, manager_id
  (fixture_id, side) -> team_registration_id

lineup_players:
  id -> lineup_id, player_registration_id, starter/substitute state,
        lineup position, snapshot/display attributes, timestamps
  (lineup_id, player_registration_id) -> id
  (lineup_id, slot_key) -> id               for a starter with a slot
  is_starter -> is_substitute
  player_registration_id -> shirt_number, player_natural_position
                                                if these are treated as copied values

lineup_set_piece_takers:
  id -> lineup_id, player_registration_id, set_piece_type,
        priority, created_at
  (lineup_id, set_piece_type, priority) -> id
  (lineup_id, set_piece_type, player_registration_id) -> id

manager_team_preferences:
  id -> manager_id, team_registration_id, season_id,
        preferred_formation, preferred_playing_style, timestamps
  team_registration_id -> manager_id, season_id
  team_registration_id -> id
```

The copied player fields do not create a dependency on the current
registration when they are defined as historical lineup snapshots. However,
`is_substitute = NOT is_starter` is always enforced, so the relation still
contains one exact non-key derived dependency.

### 5.5 Match and statistics relations

```text
team_match_stats:
  id -> fixture_id, team_registration_id, all measured team statistics
  (fixture_id, team_registration_id) -> id
  (shots, shots_on_target) -> shots_off_target

player_match_stats:
  id -> fixture_id, player_registration_id, all measured player statistics
  (fixture_id, player_registration_id) -> id

match_events:
  id -> fixture_id, minute, side, type, player_registration_id,
        related_player_registration_id, created_at

match_substitutions:
  id -> fixture_id, team_registration_id, minute,
        player_out_registration_id, player_in_registration_id,
        reason, created_at
  (fixture_id, player_out_registration_id) -> id
  (fixture_id, player_in_registration_id) -> id
  player_out_registration_id -> team_registration_id
  player_in_registration_id -> team_registration_id

match_injuries:
  id -> fixture_id, player_registration_id, team_registration_id,
        injury details, minute, expected absence, created_at
  (fixture_id, player_registration_id) -> id
  player_registration_id -> team_registration_id

player_suspensions:
  id -> player_registration_id, team_registration_id, season_id,
        reason, source_fixture_id, remaining matches, status, timestamps
  player_registration_id -> team_registration_id, season_id

standings:
  id -> season_id, team_registration_id, result totals,
        fair-play state, rank, updated_at
  team_registration_id -> season_id
  team_registration_id -> id
  (won, drawn, lost) -> played
  (goals_for, goals_against) -> goal_difference
  (won, drawn) -> points

player_season_stats:
  id -> season_id, player_registration_id, all season aggregates, updated_at
  player_registration_id -> season_id
  player_registration_id -> id
```

`team_match_stats.shots_off_target` and the three calculated standings fields
are exact derived values because database check constraints enforce the
equations.

### 5.6 Notification relation

```text
manager_messages:
  id -> season_id, manager_id, optional team/player/fixture scope,
        notification_key, related_type, message, read state, timestamps
  notification_key -> id                    when notification_key is non-null
  team_registration_id -> manager_id, season_id
  player_registration_id -> team_registration_id, manager_id, season_id
  fixture_id -> season_id
```

The scope FDs are enforced by database triggers. They intentionally duplicate
scope information so messages remain easy to authorize and query.

## 6. Canonical-cover derivation examples

### 6.1 `season_groups`

Initial FDs:

```text
id -> season_id, name, locked, created_at, updated_at
(season_id, name) -> id, locked, created_at, updated_at
```

After decomposing right-hand sides, the dependencies from
`(season_id, name)` to the non-key fields are redundant because
`(season_id, name) -> id` and `id -> all`. The minimal compact cover is:

```text
id -> season_id, name, locked, created_at, updated_at
(season_id, name) -> id
```

Neither determinant contains an extraneous attribute, and neither FD can be
removed.

### 6.2 `team_registrations`

Initial business FDs:

```text
id -> all
(season_id, team_id) -> all
team_id -> manager_id
```

Remove the redundant right-hand-side dependencies reachable through `id`.
Also remove `manager_id` from the direct `id` determinant because
`id -> team_id` and `team_id -> manager_id`.

Minimal compact cover:

```text
id -> season_id, team_id, status, review/removal state, timestamps
(season_id, team_id) -> id
team_id -> manager_id
```

This cover exposes the partial dependency that prevents strict 2NF.

### 6.3 `standings`

Minimal compact cover:

```text
team_registration_id -> id
id -> won, drawn, lost, goals_for, goals_against,
      fair_play_score, admin_draw_rank, updated_at
team_registration_id -> season_id
(won, drawn, lost) -> played
(goals_for, goals_against) -> goal_difference
(won, drawn) -> points
```

The calculated-value dependencies cannot be derived from the key dependencies,
so they remain in the canonical cover.

### 6.4 `team_match_stats`

Minimal compact cover:

```text
(fixture_id, team_registration_id) -> id
id -> possession, expected_goals, shots, shots_on_target,
      hit_woodwork, big_chances, passes, cards, defensive metrics,
      rating, created_at
(shots, shots_on_target) -> shots_off_target
```

The final FD is non-key to non-key and therefore demonstrates the strict 3NF
exception.

## 7. Normal-form definitions used

### First Normal Form (1NF)

A relation is in 1NF when every attribute contains one atomic value and there
are no repeating groups.

### Second Normal Form (2NF)

A 1NF relation is in 2NF when no non-prime attribute depends on a proper subset
of any composite candidate key.

### Third Normal Form (3NF)

For every non-trivial FD `X -> A`, at least one of the following must hold:

1. `X` is a superkey; or
2. `A` is a prime attribute.

### Boyce-Codd Normal Form (BCNF)

For every non-trivial FD `X -> A`, `X` must be a superkey.

## 8. Formal normalization proof

### 8.1 Proof of 1NF

All 30 base relations are in 1NF:

- columns use atomic PostgreSQL types such as UUID, text, integer, numeric,
  boolean, date, timestamp, and enum;
- no base-table column stores a repeating group or list;
- many-to-many and repeating concepts are represented by separate relations,
  such as `season_group_teams`, `lineup_players`, and
  `lineup_set_piece_takers`; and
- every base relation has a primary key.

### 8.2 Relation-by-relation result

| Relation | Highest strict normal form | Reason |
| --- | --- | --- |
| `profiles` | BCNF | Only the primary key is an unconditional determinant |
| `app_users` | BCNF | Both `id` and `email` are candidate keys |
| `app_managers` | BCNF | Both `id` and `email` are candidate keys |
| `app_admins` | BCNF | Both `id` and `email` are candidate keys |
| `role_requests` | BCNF | The unconditional relation is key-determined; pending uniqueness is conditional |
| `leagues` | BCNF | All non-trivial FDs have `id` as determinant |
| `seasons` | 2NF | Conditional knockout arithmetic determines `total_knockout_teams` from non-key configuration fields |
| `teams` | BCNF | `id` is the only minimal unconditional determinant |
| `team_registrations` | 1NF | `team_id -> manager_id` is a partial dependency of candidate key `(season_id, team_id)` |
| `players` | BCNF | `id` and each non-null unique identity are candidate keys |
| `identity_proofs` | BCNF | All stored facts describe one proof identified by `id` |
| `player_season_registrations` | 3NF, not BCNF | `team_registration_id -> season_id`; the dependent `season_id` is prime |
| `player_hidden_attributes` | BCNF | `id` and `player_registration_id` are candidate keys |
| `player_abilities` | BCNF | `id` and `player_registration_id` are candidate keys |
| `season_groups` | BCNF | `id` and `(season_id, name)` are candidate keys |
| `fixtures` | 2NF | `season_id -> league_id` and `group_id -> season_id, group_name` are non-key dependencies |
| `lineups` | 1NF | Fixture and team-registration subsets determine copied season/manager scope |
| `lineup_players` | 2NF as historical snapshot; otherwise 1NF | `is_starter -> is_substitute`; copied registration fields add partial dependencies unless defined as lineup-time snapshots |
| `lineup_set_piece_takers` | BCNF | Every declared determinant is a candidate key |
| `manager_team_preferences` | BCNF | The enforced scope makes `team_registration_id` a candidate key |
| `team_match_stats` | 2NF | `(shots, shots_on_target) -> shots_off_target` is non-key to non-key |
| `player_match_stats` | BCNF | `id` and `(fixture_id, player_registration_id)` are candidate keys |
| `match_events` | BCNF | No stable non-key determinant is stored |
| `match_substitutions` | 1NF | An individual player registration determines copied team scope within composite event keys |
| `match_injuries` | 1NF | `player_registration_id -> team_registration_id` is partial to `(fixture_id, player_registration_id)` |
| `player_suspensions` | 2NF | `player_registration_id -> team_registration_id, season_id` is transitive copied scope |
| `standings` | 2NF | Non-key match totals determine `played`, `goal_difference`, and `points` |
| `player_season_stats` | BCNF | Registration identifies its season and its one aggregate row |
| `manager_messages` | 2NF | Optional subject identifiers determine copied manager/season/team scope |
| `season_group_teams` | BCNF | `team_registration_id` and `id` are candidate keys |

### 8.3 BCNF proof example

For:

```text
season_groups(id, season_id, name, locked, created_at, updated_at)
```

the canonical cover is:

```text
id -> season_id, name, locked, created_at, updated_at
(season_id, name) -> id
```

Both determinants are candidate keys. Therefore every determinant is a
superkey, and `season_groups` is in BCNF.

### 8.4 3NF but not BCNF proof example

For the relevant part of `player_season_registrations`:

```text
R(id, player_id, season_id, team_registration_id, ...)
```

candidate keys include:

```text
id
(season_id, player_id)
```

and the scope rule gives:

```text
team_registration_id -> season_id
```

`team_registration_id` is not a superkey, so BCNF is violated. However,
`season_id` is a prime attribute because it belongs to candidate key
`(season_id, player_id)`. The FD therefore satisfies the 3NF condition.

### 8.5 3NF violation example

For:

```text
standings(..., won, drawn, lost, played,
          goals_for, goals_against, goal_difference, points, ...)
```

the database enforces:

```text
(won, drawn, lost) -> played
(goals_for, goals_against) -> goal_difference
(won, drawn) -> points
```

None of these determinants is a superkey, and the dependent attributes are not
prime. Therefore `standings` is not in 3NF or BCNF. It remains in 2NF because
the violation is not a partial dependency on a composite candidate key.

## 9. Controlled denormalization and justification

The schema is not honestly describable as “every table is in BCNF.” Several
relations intentionally store derived or copied values:

| Relation | Stored redundancy | Operational reason |
| --- | --- | --- |
| `team_registrations` | `manager_id` copied from the team | Ownership enforcement and direct manager filtering |
| `seasons` | calculated knockout-team total | Configuration validation and administration UI |
| `fixtures` | `league_id` and `group_name` copied from parents | Fast fixture filtering and stable display labels |
| `lineups` | season, manager, side, and participant scope | Safe authorization and immutable submitted-lineup scope |
| `lineup_players` | shirt/position display snapshots | Preserve the submitted lineup presentation |
| `team_match_stats` | `shots_off_target` | Direct dashboard reporting with an enforced equation |
| `match_substitutions` and `match_injuries` | copied team scope | Participant validation and efficient team match queries |
| `player_suspensions` | copied team and season scope | Fast eligibility checks |
| `standings` | played, goal difference, and points | Fast ordering and public table display |
| `manager_messages` | copied subject scope | Secure, efficient manager inbox filtering |

These are controlled because foreign keys, check constraints, and scope
triggers prevent inconsistent values. Live-data validation found zero
violations for the tested copied and derived FDs.

## 10. Strict 3NF decomposition options

These decompositions are academically cleaner, but applying them would require
coordinated backend and frontend changes.

### 10.1 Team registration

Strict design:

```text
team_registrations(id, season_id, team_id, status, review/removal state, ...)
teams(id, manager_id, ...)
```

Remove `team_registrations.manager_id` and obtain it through `teams`.

### 10.2 Fixture scope

Strict design:

```text
fixtures(id, season_id, group_id, ...)
seasons(id, league_id, ...)
season_groups(id, season_id, name, ...)
```

Remove `fixtures.league_id` and `fixtures.group_name`; expose them through a
join or security-invoker view.

### 10.3 Lineup scope

Keep the lineup’s fixture and participant reference, but derive season and
manager from the fixture/team-registration relations. Preserve a separate
snapshot relation only if historical scope must never change.

### 10.4 Team match statistics

Remove `shots_off_target` and compute:

```text
shots - shots_on_target AS shots_off_target
```

in a reporting view.

### 10.5 Lineup-player role state

Store `is_starter` as the authoritative value and derive:

```text
NOT is_starter AS is_substitute
```

Keep shirt number and natural-position columns only when they are explicitly
defined as historical snapshots.

### 10.6 Standings

Store only base totals:

```text
won, drawn, lost, goals_for, goals_against, fair_play_score
```

Compute:

```text
won + drawn + lost AS played
goals_for - goals_against AS goal_difference
won * 3 + drawn AS points
```

in a view.

### 10.7 Match absence records

Remove copied `team_registration_id` and `season_id` values where they can be
derived from `player_registration_id`. Use joins and indexes for eligibility
queries.

### 10.8 Manager messages

For a fully normalized notification model, separate message content from
subject links:

```text
manager_messages(id, manager_id, related_type, message, read_at, ...)
manager_message_teams(message_id, team_registration_id)
manager_message_players(message_id, player_registration_id)
manager_message_fixtures(message_id, fixture_id)
```

## 11. Recommended claim for the report

Use the following accurate conclusion:

> The database uses normalized entity and association relations, primarily in
> 3NF or BCNF. A limited set of operational, aggregate, snapshot, and
> authorization-scope relations uses controlled denormalization. Foreign keys,
> unique constraints, check constraints, and validation triggers preserve the
> relevant functional dependencies and prevent update anomalies. Strict 3NF
> decompositions were identified, but the controlled form was retained where
> it materially improves safe authorization, historical snapshots, and
> high-frequency reporting.

Do not claim that all 30 relations are in BCNF. The derived standings and team
statistics attributes alone make that statement formally incorrect.

## 12. Validation evidence

The following live-data dependency checks returned zero violations:

- team registration manager matches the owning team;
- fixture league matches its season;
- fixture group season/name matches its group;
- lineup season matches its fixture;
- lineup season and manager match its team registration;
- team-stat shots-off-target equation;
- all three standings arithmetic equations;
- substitution players match the stored team;
- injury player matches the stored team; and
- suspension player matches the stored team and season.

The live schema also contains:

- 30 public base relations;
- 30 primary keys;
- 78 foreign keys;
- 28 declared unique constraints, plus conditional unique indexes;
- 102 check constraints; and
- zero invalid constraints or indexes.
