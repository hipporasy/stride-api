export interface StravaAthlete {
  id: number;
}

export interface StravaActivity {
  id: number;
  athlete: StravaAthlete;
  name: string;
  type: string;
  sport_type: string;
  distance: number;             // metres (float)
  moving_time: number;          // seconds of actual movement
  total_elevation_gain: number; // metres (float)
  start_date: string;           // ISO 8601
}

export interface StravaTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  expires_in: number;
  token_type: string;
}
