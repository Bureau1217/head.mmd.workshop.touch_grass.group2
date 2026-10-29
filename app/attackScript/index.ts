export { crossWord } from './crossWord';
export { confidentialRedact } from './confidentialRedact';
export { qualityLossImage } from './qualityLossImage';

export type AttackType = 'crossWord' | 'confidentialRedact' | 'qualityLossImage';

export interface AttackEvent {
  satelliteName: string;
  attackType: AttackType;
  timestamp: Date;
}
