import { describe, expect, it } from 'vitest';
import config from '../../src/calculators/calorie-calculator';
import { runner } from '../helpers';

const run = runner(config);

describe('calorie-calculator', () => {
  it('computes the default case and its intro quotes it', () => {
    expect(run()).toEqual({ bmr: '1,780', maintenance: '2,759', goalCalories: '2,209', note: '' });
    for (const quoted of ['180 cm', '80 kg', '2,209', '2,759', '550']) expect(config.intro).toContain(quoted);
  });

  it('maintain and gain goals', () => {
    expect(run({ goal: 'maintain' }).goalCalories).toBe('2,759');
    expect(run({ goal: 'gain-0.5' }).goalCalories).toBe('3,309');
  });

  it("uses the women's Mifflin-St Jeor constant", () => {
    expect(run({ sex: 'female', age: 30, weight: 65, height: 165, activity: 'sedentary', goal: 'maintain' })).toMatchObject({
      bmr: '1,370',
      maintenance: '1,644',
      goalCalories: '1,644',
    });
  });

  it('converts pounds and inches exactly', () => {
    expect(run({ age: 40, weight: 100, weightUnit: 'lb', height: 60, heightUnit: 'in', activity: 'sedentary', goal: 'maintain' })).toMatchObject({
      bmr: '1,211',
      maintenance: '1,453',
    });
  });

  it('warns when the goal falls below the usual minimum', () => {
    const woman = run({ sex: 'female', age: 30, weight: 65, height: 165, activity: 'sedentary', goal: 'lose-1' });
    expect(woman.goalCalories).toBe('544');
    expect(woman.note).toContain('below the 1,200');
    expect(woman.note).toContain('women');
    const man = run({ activity: 'light', goal: 'lose-1' });
    expect(man.note).toContain('below the 1,500');
  });

  it('is exact in decimals: 1,347.5 calories rounds half up to 1,348 (and 2,447.5 to 2,448)', () => {
    const r = run({ activity: 'light', goal: 'lose-1' });
    expect(r.maintenance).toBe('2,448');
    expect(r.goalCalories).toBe('1,348');
  });
});
