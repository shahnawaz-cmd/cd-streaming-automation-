import { EmailGenerator } from './EmailGenerator';
import { Logger } from '../utils/Logger';

const logger = new Logger('GarageCredentialsGenerator');

export interface GarageUserCredentials {
  email: string;
  password: string;
  phone: string;
}

/**
 * Layer 4: GarageCredentialsGenerator
 * Generates unique disposable user credentials for CDMA Garage Signup & Login flows.
 */
export class GarageCredentialsGenerator {
  static generate(): GarageUserCredentials {
    const email = EmailGenerator.generateWithTimestamp();
    const suffix = Math.floor(1000 + Math.random() * 9000);
    const phoneDigits = String(Math.floor(1000000 + Math.random() * 9000000));
    const creds: GarageUserCredentials = {
      email,
      password: `TestPass@${suffix}`,
      phone: `555${phoneDigits}`,
    };
    logger.info(`Generated synthetic CDMA user credentials for: ${creds.email}`);
    return creds;
  }
}
