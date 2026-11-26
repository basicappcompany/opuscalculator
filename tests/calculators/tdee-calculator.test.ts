import { describe, expect, it } from 'vitest';
import config from '../../src/calculators/tdee-calculator';
import { runner } from '../helpers';

const run = runner(config);

describe('tdee-calculator', () => {
  it('computes the default case and its intro quotes it', () => {
    expect(run()).toEqual({
      bmr: '1,780',
      tdee: '2,759',
      tdeeSedentary: '2,136',
      tdeeLight: '2,448',
      tdeeModerate: '2,759',
      tdeeActive: '3,071',
      tdeeExtra: '3,382',
    });
    for (const quoted of ['180 cm', '80 kg', '1,780', '2,759']) expect(config.intro).toContain(quoted);
  });

  it('chooses the TDEE for the selected activity level', () => {
    expect(run({ activity: 'sedentary' }).tdee).toBe('2,136');
    expect(run({ activity: 'extra' }).tdee).toBe('3,382');
  });

  it('revised Harris-Benedict for a man: 1,853.632 BMR and 2,873 TDEE', () => {
    expect(run({ formula: 'harris' })).toMatchObject({ bmr: '1,854', tdee: '2,873' });
  });

  it('women: Mifflin-St Jeor and Harris-Benedict', () => {
    const woman = { sex: 'female', age: 30, weight: 65, height: 165, activity: 'sedentary' };
    expect(run({ ...woman, formula: 'mifflin' })).toMatchObject({ bmr: '1,370', tdee: '1,644' });
    expect(run({ ...woman, formula: 'harris' })).toMatchObject({ bmr: '1,430', tdee: '1,716' });
  });

  it('is exact in decimals: 3,070.5 rounds half up to 3,071', () => {
    expect(run().tdeeActive).toBe('3,071');
  });
});
