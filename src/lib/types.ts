export interface Team {
  id: string;
  name: string;
  season: string;
  created_at: string;
}

export interface Player {
  id: string;
  team_id: string;
  name: string;
  jersey_number: number | null;
  created_at: string;
}

export interface Game {
  id: string;
  team_id: string;
  opponent: string;
  game_date: string;
  home_score: number;
  away_score: number;
  innings: number;
  created_at: string;
}

export interface AtBat {
  id: string;
  game_id: string;
  player_id: string;
  inning: number;
  result: 'single' | 'double' | 'triple' | 'hr' | 'walk' | 'strikeout' | 'out';
  rbi: number;
  run_scored: boolean;
  stolen_base: boolean;
  created_at: string;
}

export interface PitchCount {
  id: string;
  game_id: string;
  player_id: string;
  count: number;
  updated_at: string;
}
