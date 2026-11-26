import { describe, expect, it } from 'vitest';
import config from '../../src/calculators/concrete-calculator';
import { runner } from '../helpers';

const run = runner(config);

describe('concrete-calculator', () => {
  it('computes the default case and its intro quotes it', () => {
    expect(run()).toEqual({ cubicYards: '1.36', cubicFeet: '36.67', cubicMeters: '1.04', bags80: '62', bags60: '82' });
    for (const quoted of ['10 ft by 10 ft', '4 inches', '1.36 cubic yards', '62 bags']) expect(config.intro).toContain(quoted);
  });

  it('a 10 x 10 x 4 in slab with no waste is 1.23 cubic yards', () => {
    expect(run({ waste: 0 })).toEqual({ cubicYards: '1.23', cubicFeet: '33.33', cubicMeters: '0.94', bags80: '56', bags60: '75' });
  });

  it('works in meters and centimeters: 3 m x 3 m x 10 cm is exactly 0.9 cubic meters', () => {
    const r = run({ length: 3, lengthUnit: 'm', width: 3, widthUnit: 'm', thickness: 10, thicknessUnit: 'cm', waste: 0 });
    expect(r.cubicMeters).toBe('0.9');
    expect(r.cubicYards).toBe('1.18');
  });

  it('rounds bags up to a whole bag', () => {
    // 0.6 cubic feet exactly fills one 80 lb bag; a hair more needs two.
    expect(run({ length: 1, width: 1, thickness: 7.2, waste: 0 }).bags80).toBe('1');
    expect(run({ length: 1, width: 1, thickness: 7.3, waste: 0 }).bags80).toBe('2');
  });

  it('is exact in decimals: 10 ft x 10 ft x 4 in is 33.33 cubic feet and thirds do not drift', () => {
    expect(run({ waste: 0 }).cubicFeet).toBe('33.33');
    expect(run({ length: 3, width: 3, thickness: 4, waste: 0 }).cubicFeet).toBe('3');
  });
});
