export { crossWord } from './crossWord';
export { confidentialRedact } from './confidentialRedact';
export { qualityLossImage, getPixelDegradeSvgFilters } from './qualityLossImage';
export {
  raysImage,
  getImageOrbitRayCoordinates,
  createImageOrbitRaySvgGroup,
  type ImageOrbitRayLine
} from './raysImage';
export {
  raysText,
  getOrbitRayCoordinates,
  createOrbitZeroCharHtml,
  type OrbitRayLine
} from './raysText';
export { fallingLetters } from './fallingLetters';

export type AttackType =
  | 'qualityLossImage'
  | 'raysImage'
  | 'raysText'
  | 'fallingLetters'
  | 'crossWord'
  | 'confidentialRedact';

export interface AttackEvent {
  satelliteName: string;
  attackType: AttackType;
  force?: number;
  timestamp: Date;
}

export interface CommercialSatelliteDwell {
  name: string;
  attackType: AttackType;
  dwellSeconds: number;
  force: number;
  inZone: boolean;
  distanceKm: number;
  firstSeenAt: Date;
}
