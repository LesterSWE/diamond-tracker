# Diamond Tracker

A mobile-first little league stats tracker built for coaches. Track rosters, log at-bats, monitor pitch counts, and enforce youth baseball rest day rules — all from your phone during the game.

Built for the Royals, Rookies Division (Ages 7–8).

## Features

- **Teams & Roster** — Create teams, add/edit/remove players with jersey numbers
- **Game Logging** — Log at-bats per inning (1B, 2B, 3B, HR, BB, K, OUT) with RBI, runs scored, and stolen bases
- **Edit At-Bats** — Correct any at-bat after submitting
- **Pitch Count Tracker** — Track pitches per pitcher with a live progress bar and limit warnings
- **Rest Day Eligibility** — Automatically checks previous games and flags whether a pitcher has had enough rest based on Little League rules
- **Per-Game Stats** — AB, H, R, RBI, BB, K, SB, AVG per player

## Pitch Rules (Ages 7–8)

| Pitches | Rest Required |
|---------|--------------|
| 1–20    | 0 days       |
| 21–35   | 1 day        |
| 36–50   | 2 days       |
| 51–65   | 3 days       |
| 66+     | 4 days       |

- Max **50 pitches** per game
- Max **1 inning** per game (2 in playoffs)
- No pitching in back-to-back games

## Tech Stack

- **Frontend** — React + TypeScript + Vite
- **Styling** — Tailwind CSS v4
- **Database** — Supabase (PostgreSQL)
- **Routing** — React Router v6
- **Deployment** — Vercel

## Getting Started

### Prerequisites

- Node.js 18+
- A [Supabase](https://supabase.com) project with the following tables: `teams`, `players`, `games`, `at_bats`, `pitch_counts`

### Local Setup

```bash
# Install dependencies
npm install

# Create environment file
cp .env.example .env
# Add your Supabase URL and anon key

# Start dev server
npm run dev
```

### Environment Variables

```
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### Deploy

```bash
vercel --prod
```

Set the environment variables in your Vercel project settings.

## Database Schema

```sql
create table teams (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  season text,
  created_at timestamptz default now()
);

create table players (
  id uuid primary key default gen_random_uuid(),
  team_id uuid references teams(id) on delete cascade,
  name text not null,
  jersey_number int,
  created_at timestamptz default now()
);

create table games (
  id uuid primary key default gen_random_uuid(),
  team_id uuid references teams(id) on delete cascade,
  opponent text not null,
  game_date date not null,
  home_score int default 0,
  away_score int default 0,
  created_at timestamptz default now()
);

create table at_bats (
  id uuid primary key default gen_random_uuid(),
  game_id uuid references games(id) on delete cascade,
  player_id uuid references players(id) on delete cascade,
  inning int not null,
  result text not null,
  rbi int default 0,
  run_scored boolean default false,
  stolen_base boolean default false,
  created_at timestamptz default now()
);

create table pitch_counts (
  id uuid primary key default gen_random_uuid(),
  game_id uuid references games(id) on delete cascade,
  player_id uuid references players(id) on delete cascade,
  count int default 0,
  updated_at timestamptz default now()
);
```
