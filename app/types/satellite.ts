export type SatelliteType = 'scientific' | 'commercial';

export interface RawSatelliteData {
  id: string;
  name: string;
  altName?: string;
  type: SatelliteType;
  purpose: string;
  country?: string;
  launchDate?: string;
  tle1: string;
  tle2: string;
}

export interface SatellitePosition {
  name: string;
  altName?: string;
  type: SatelliteType;
  purpose: string;
  country?: string;
  distance: number; // in kilometers
  azimuth: number; // 0 - 360 degrees
  elevation: number; // 0 - 90 degrees above horizon
}

export interface NearestSatellite extends SatellitePosition {
  rawId?: string;
}
