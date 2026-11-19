import * as dotenv from 'dotenv';
dotenv.config();

export const ENV = {
  baseURL: process.env.BASE_URL || 'https://dev.pintonaturals.com',
};
