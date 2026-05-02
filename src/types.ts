/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface PollutionSession {
  id: string;
  pollutionDiff: number;
  ballsUsed: number;
  timestamp: number;
}

export interface HuntRecord {
  id: string;
  petName: string;
  totalBalls: number;
  remainingBalls: number;
  pollutionCount: number;
  isShiny: boolean;
  history: PollutionSession[];
  createdAt: number;
  updatedAt: number;
}

export type NewHuntRecord = Omit<HuntRecord, 'id' | 'createdAt' | 'updatedAt'>;

export const POLLUTION_LIMIT = 80;
