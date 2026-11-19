import { Logger } from '../utils/Logger';

const logger = new Logger('SpecsGenerator');

export interface DynamicVehicleSpecs {
  bodyMaker: string;
  engineType: string;
  displacement: string;
  cylinders: string;
  torque: string;
  noOfGears: string;
  fuelCapacity: string;
  weight: string;
}

const BODY_MAKERS = ['Fisher Body', 'Ghia', 'Custom Coachwork', 'Pininfarina', 'Bertone'];
const ENGINE_TYPES = [
  'V8 OHV Dual Downdraft',
  'Inline-6 Turbocharged DOHC',
  'V8 Supercharged 4-Barrel',
  'V12 Quad-Cam High Output',
  'V8 Turbo Hydra-Matic 4-Barrel',
];
const DISPLACEMENTS = ['350 cu. in.', '383 cu. in.', '400 cu. in.', '427 cu. in.', '454 cu. in.'];
const CYLINDERS = ['6', '8', '12'];
const TORQUES = [
  '310 lb-ft @ 2600 rpm',
  '350 lb-ft @ 3000 rpm',
  '390 lb-ft @ 3400 rpm',
  '420 lb-ft @ 3800 rpm',
];
const GEARS = ['3', '4', '5', '6'];
const FUEL_CAPACITIES = ['19 Gallons', '21.5 Gallons', '23 Gallons', '25 Gallons'];
const WEIGHTS = ['3,450 lbs', '3,720 lbs', '3,980 lbs', '4,150 lbs'];

function randomPick<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

/**
 * Layer 4: SpecsGenerator
 * Dynamically generates fresh, randomized vehicle specifications on every test run.
 */
export class SpecsGenerator {
  static generate(): DynamicVehicleSpecs {
    const specs: DynamicVehicleSpecs = {
      bodyMaker: randomPick(BODY_MAKERS),
      engineType: randomPick(ENGINE_TYPES),
      displacement: randomPick(DISPLACEMENTS),
      cylinders: randomPick(CYLINDERS),
      torque: randomPick(TORQUES),
      noOfGears: randomPick(GEARS),
      fuelCapacity: randomPick(FUEL_CAPACITIES),
      weight: randomPick(WEIGHTS),
    };
    logger.info(`Generated dynamic specs: Engine=${specs.engineType}, Disp=${specs.displacement}, Cyl=${specs.cylinders}`);
    return specs;
  }
}
