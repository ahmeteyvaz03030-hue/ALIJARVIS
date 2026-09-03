/**
 * Mission parameters. Everything travel-related in the UI reads from here, so
 * a new trip is a single edit.
 */

export interface Waypoint {
  code: string
  city: string
  country: string
  lat: number
  lon: number
}

export const ORIGIN: Waypoint = {
  code: 'FRA',
  city: 'FRANKFURT',
  country: 'GERMANY',
  lat: 50.0379,
  lon: 8.5622,
}

export const DESTINATION: Waypoint = {
  code: 'DLM',
  city: 'MARMARIS',
  country: 'TÜRKİYE',
  lat: 36.8552, // Marmaris itself; DLM airport is ~90 km north
  lon: 28.2743,
}

/** Airport the flight actually lands at, shown on the route readout. */
export const ARRIVAL_AIRPORT = {
  code: 'DLM',
  name: 'DALAMAN',
  lat: 36.7131,
  lon: 28.7925,
}

export const TRIP = {
  flightNumber: 'RJ-2317',
  carrier: 'RONALJARVIS AIR OPS',
  /** Local wheels-up in Frankfurt. */
  departure: new Date('2026-09-05T06:35:00+02:00'),
  /** Local touchdown at Dalaman. */
  arrival: new Date('2026-09-05T11:05:00+03:00'),
  /** Return leg — ends holiday mode. */
  returnFlight: new Date('2026-09-12T12:20:00+03:00'),
  distanceKm: 2374,
  cruiseAltitudeFt: 38_000,
  cruiseSpeedKmh: 875,
  seat: '14A',
  gate: 'B42',
  terminal: '2',
}

export type FlightPhase =
  | 'countdown'
  | 'flight_day'
  | 'in_flight'
  | 'arrived'
  | 'returned'

export const FLIGHT_PHASES: FlightPhase[] = [
  'countdown',
  'flight_day',
  'in_flight',
  'arrived',
  'returned',
]

const DAY_MS = 24 * 60 * 60 * 1000

/** Derive the mission phase from a timestamp. */
export function resolvePhase(now: number): FlightPhase {
  const dep = TRIP.departure.getTime()
  const arr = TRIP.arrival.getTime()
  const ret = TRIP.returnFlight.getTime()
  if (now >= ret) return 'returned'
  if (now >= arr) return 'arrived'
  if (now >= dep) return 'in_flight'
  if (now >= dep - DAY_MS) return 'flight_day'
  return 'countdown'
}

export const PHASE_LABEL: Record<FlightPhase, string> = {
  countdown: 'PRE-FLIGHT',
  flight_day: 'FLIGHT DAY',
  in_flight: 'IN FLIGHT',
  arrived: 'HOLIDAY MODE',
  returned: 'MISSION ARCHIVED',
}

/** Great-circle distance in km. */
export function haversineKm(
  a: { lat: number; lon: number },
  b: { lat: number; lon: number },
): number {
  const R = 6371
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLon = toRad(b.lon - a.lon)
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)))
}
