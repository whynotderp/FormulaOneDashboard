import axios from 'axios';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export const api = axios.create({
  baseURL: BASE_URL,
  timeout: 15000,
});

export interface Session {
  session_key: number;
  session_name: string;
  date_start: string;
  circuit_short_name: string;
  country_name: string;
  year: number;
  session_type: string;
  meeting_key?: number;
}

export interface Driver {
  code: string;
  name: string;
  team: string;
  price: number;
  number: number;
}

export interface Lap {
  lap_number: number;
  driver_number: number;
  lap_duration: number;
  duration_sector_1: number;
  duration_sector_2: number;
  duration_sector_3: number;
  is_pit_out_lap: boolean;
}

export interface CarData {
  date: string;
  speed: number;
  throttle: number;
  brake: number;
  drs: number;
  n_gear: number;
  rpm: number;
}

export interface Stint {
  driver_number: number;
  stint_number: number;
  lap_start: number;
  lap_end: number;
  compound: 'SOFT' | 'MEDIUM' | 'HARD' | 'INTER' | 'WET';
  tyre_age_at_start: number;
}

export interface Weather {
  air_temperature: number;
  track_temperature: number;
  humidity: number;
  pressure: number;
  wind_speed: number;
  wind_direction: number;
  rainfall: boolean;
}

export interface RaceControl {
  date: string;
  message: string;
  category: string;
  flag: string;
  lap_number: number;
}

export interface Position {
  driver_number: number;
  position: number;
  gap_to_leader: number;
  interval: number;
}

export interface PredictionResult {
  predicted_position: number;
  driver_code: string;
  driver_name: string;
  team: string;
  quali_position: number;
  confidence_pct: number;
  crash_probability_pct: number;
  score: number;
}

export interface RacePrediction {
  circuit: string;
  weather: string;
  grid_source?: 'qualifying' | 'model';
  predictions: PredictionResult[];
  incident_probabilities: {
    safety_car: number;
    virtual_sc: number;
    red_flag: number;
  };
  podium: string[];
}

export interface FantasyDriver extends Driver {
  predicted_points: number;
  avg_points: number;
  pts_per_million: number;
}

export interface FantasyConstructor {
  name: string;
  price: number;
  predicted_points: number;
  avg_points: number;
  pts_per_million: number;
}

export interface FantasyTeam {
  circuit: string;
  budget: number;
  total_cost: number;
  budget_remaining: number;
  drivers: FantasyDriver[];
  constructor: FantasyConstructor;
  captain: FantasyDriver;
  total_predicted_points: number;
  reasoning: string;
}

export interface Track {
  id: string;
  name: string;
  path: string;
  viewBox: string;
  turns: number;
  length_km: number;
}

export interface TrackOutline {
  source: 'telemetry' | 'circuit' | 'generated';
  viewBox: string;
  points: { x: number; y: number; t?: string }[];
  session_key?: number;
  circuit_id?: string;
}

// No hardcoded year: backend defaults to the current season (and falls back
// to the previous one early in the year).
export const getSessions = (year?: number) =>
  api.get<Session[]>('/api/sessions', { params: year ? { year } : {} });
export const getTrackOutline = (sessionKey?: number, circuitId = 'bahrain', driverNumber?: number) =>
  api.get<TrackOutline>('/api/track_outline', {
    params: { session_key: sessionKey, circuit_id: circuitId, driver_number: driverNumber },
  });

export interface ReplayCar {
  driver_number: number;
  code: string;
  team: string;
  samples: { x: number; y: number; t: number }[];
}
export interface PitStop {
  driver_number: number;
  code: string;
  team: string;
  t: number;
  duration?: number | null;
}
export interface Replay {
  source: 'telemetry' | 'none';
  lap: number;
  total_laps: number;
  viewBox: string;
  outline: { x: number; y: number }[];
  cars: ReplayCar[];
  pits: PitStop[];
}
export const getReplayMeta = (sessionKey: number) =>
  api.get<{ session_key: number; total_laps: number; has_replay: boolean }>(
    '/api/replay_meta', { params: { session_key: sessionKey } });
export const getReplay = (sessionKey: number, lap: number) =>
  api.get<Replay>('/api/replay', { params: { session_key: sessionKey, lap } });
export const getDrivers = (sessionKey?: number) => api.get<Driver[]>('/api/drivers', { params: { session_key: sessionKey } });
export const getLaps = (sessionKey: number, driverNumber?: number) =>
  api.get<Lap[]>('/api/laps', { params: { session_key: sessionKey, driver_number: driverNumber } });
export const getCarData = (sessionKey: number, driverNumber: number) =>
  api.get<CarData[]>('/api/car_data', { params: { session_key: sessionKey, driver_number: driverNumber } });
export const getStints = (sessionKey: number, driverNumber?: number) =>
  api.get<Stint[]>('/api/stints', { params: { session_key: sessionKey, driver_number: driverNumber } });
export const getWeather = (sessionKey: number) =>
  api.get<Weather>('/api/weather', { params: { session_key: sessionKey } });
export const getRaceControl = (sessionKey: number) =>
  api.get<RaceControl[]>('/api/race_control', { params: { session_key: sessionKey } });
export const getPositions = (sessionKey: number) =>
  api.get<Position[]>('/api/positions', { params: { session_key: sessionKey } });
export const getTrack = (trackId: string) => api.get<Track>(`/api/tracks/${trackId}`);
export const predictRace = (circuitId: string, weather = 'dry', sessionKey?: number) =>
  api.get<RacePrediction>('/api/predictor/race', {
    params: { circuit_id: circuitId, weather, session_key: sessionKey },
  });
export const getFantasyTeam = (circuitId: string, budget = 100, sessionKey?: number) =>
  api.get<FantasyTeam>('/api/fantasy/team', { params: { circuit_id: circuitId, budget, session_key: sessionKey } });
export const getFantasyDrivers = (circuitId: string, sessionKey?: number) =>
  api.get<FantasyDriver[]>('/api/fantasy/drivers', { params: { circuit_id: circuitId, session_key: sessionKey } });
export const getFantasyConstructors = (circuitId: string, sessionKey?: number) =>
  api.get<FantasyConstructor[]>('/api/fantasy/constructors', { params: { circuit_id: circuitId, session_key: sessionKey } });
