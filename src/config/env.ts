import * as dotenv from 'dotenv';
dotenv.config();

export const ENV = {
  baseURL: process.env.BASE_URL || 'https://dev.pintonaturals.com',
};

export interface ClarityTarget {
  name: 'DEV';
  baseURL: string;
  /** Microsoft Clarity project id loaded by the site's tag. */
  projectId: string;
}

export const CLARITY_TARGET: ClarityTarget = {
  name: 'DEV',
  baseURL: ENV.baseURL,
  projectId: process.env.CLARITY_PROJECT_ID || 's7m7s4qxs7',
};
