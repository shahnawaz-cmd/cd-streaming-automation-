import * as dotenv from 'dotenv';
dotenv.config();

export const ENV = {
  baseURL: process.env.BASE_URL || 'https://dev.pintonaturals.com',
};

export interface ClarityTarget {
  name: 'PROD' | 'DEV';
  baseURL: string;
  /** Microsoft Clarity project id loaded by the site's tag (differs per environment). */
  projectId: string;
}

export const CLARITY_TARGETS: ClarityTarget[] = [
  {
    name: 'PROD',
    baseURL: process.env.PROD_BASE_URL || 'https://classicdecoder.com',
    projectId: process.env.PROD_CLARITY_ID || 'ikaw63rxww',
  },
  {
    name: 'DEV',
    baseURL: ENV.baseURL,
    projectId: process.env.DEV_CLARITY_ID || 's7m7s4qxs7',
  },
];
