import { numberField, selectField } from '../lib/calc-utils';
import { D, ONE, ZERO, toD, type Dec } from '../lib/decimal';
import { fmtCurrency, fmtPercent, plural } from '../lib/format';
import { defineCalculator, type Spec } from '../lib/spec';
import { varied } from '../lib/spec-helpers';
import type { CalculatorConfig } from '../lib/types';

/**
 * Catalog batch 19 (finance): retirement and housing money questions from the competitor consensus gaps: 401(k),
 * Roth versus traditional, retirement income, refinancing, rental property returns, sales commission, real-estate
 * commission, rent affordability and salary conversion. Money is shown with fmtCurrency and labelled `($)`. Every
 * figure is an illustration at fixed rates and does not include tax law, contribution limits or fees unless an input
 * says so; the finance disclaimer renders on every page. Tier 2 or 3, so none is live until the cohort gate opens.
 */

const num = (name: string, label: string, def: number, min: number, max: number) => ({
  name,
  label,
  type: 'number' as const,
  default: def,
  min,
  max,
  validator: numberField({ min, max }),
});
const dollars = (name: string, label: string, def: number, max = 1e12) => num(name, `${label} ($)`, def, 0, max);
const percent = (name: string, label: string, def: number, max = 100) => num(name, `${label} (%)`, def, 0, max);
const whole = (name: string, label: string, def: number, min: number, max: number) => ({
  name,
  label,
  type: 'number' as const,
  default: def,
  min,
  max,
  validator: numberField({ min, max, integer: true }),
});
const sel = (name: string, label: string, def: string, options: [string, string][]) => ({
  name,
  label,
  type: 'select' as const,
  default: def,
  unitOptions: options.map(([value, text]) => ({ value, label: text })),
  validator: selectField(options.map(([value]) => value) as [string, ...string[]]),
});
const out = (name: string, label: string, highlight = false) => ({ name, label, format: 'text' as const, ...(highlight ? { highlight: true } : {}) });

/** Level payment on an amortizing loan with periodic rate r over n periods (a 0% loan is P / n). */
const level = (P: Dec, r: Dec, n: number): Dec => (r.isZero() ? P.div(n) : P.mul(r).div(ONE.minus(ONE.plus(r).pow(-n))));
const yrsMo = (months: number): string => `${plural(Math.floor(months / 12), 'year')} ${plural(months % 12, 'month')}`;
/** Future value factor of level end-of-period payments: ((1 + r)^n − 1) ÷ r, or n at a 0% rate. */
const fvFactor = (r: Dec, n: number): Dec => (r.isZero() ? new D(n) : ONE.plus(r).pow(n).minus(1).div(r));

export const SPECS: Spec[] = [
  {
    slug: '401k-calculator',
    category: 'finance',
    tier: 2,
    subCluster: 'Retirement',
    title: '401(k) Calculator: Balance at Retirement With Employer Match',
    h1: '401(k) Calculator',
    metaDescription:
      'Project a 401(k) balance at retirement from your salary, contribution rate, employer match, salary growth and investment return, with what you and your employer each put in.',
    about:
      "A 401(k) grows from three sources: what you contribute from each paycheck, what your employer adds as a match and what the investments earn. Enter your current balance and salary, the share of pay you contribute and the employer's match, which is usually a percentage of your contributions up to a ceiling expressed as a share of salary. Add an expected salary increase, a return and the years until retirement. The page adds the contributions each year and returns the projected balance with a breakdown.",
    inputs: [
      dollars('bal', 'Current balance', 25000),
      dollars('sal', 'Current annual salary', 75000),
      percent('pct', 'Your contribution (% of salary)', 6, 100),
      percent('match', 'Employer matches this % of your contribution', 50, 100),
      percent('cap', 'Match applies up to this % of salary', 6, 100),
      percent('grow', 'Salary growth per year', 3, 30),
      percent('ret', 'Average yearly investment return', 7, 30),
      whole('yrs', 'Years until retirement', 30, 1, 60),
    ],
    outputs: [
      out('bal', 'Projected balance at retirement', true),
      out('mine', 'Your contributions'),
      out('theirs', 'Employer match'),
      out('growth', 'Growth from investment returns'),
    ],
    calculate: (i) => {
      let b = toD(i.bal);
      const start = b;
      let sal = toD(i.sal);
      let mine = ZERO;
      let theirs = ZERO;
      const pc = toD(i.pct);
      for (let y = 0; y < Number(i.yrs); y++) {
        const emp = sal.mul(pc).div(100);
        const er = sal
          .mul(D.min(pc, toD(i.cap)))
          .div(100)
          .mul(toD(i.match))
          .div(100);
        b = b
          .mul(ONE.plus(toD(i.ret).div(100)))
          .plus(emp)
          .plus(er);
        mine = mine.plus(emp);
        theirs = theirs.plus(er);
        sal = sal.mul(ONE.plus(toD(i.grow).div(100)));
      }
      return { bal: fmtCurrency(b), mine: fmtCurrency(mine), theirs: fmtCurrency(theirs), growth: fmtCurrency(b.minus(start).minus(mine).minus(theirs)) };
    },
    formulaDescription:
      'Each year: your contribution = salary × your %; the match = salary × min(your %, cap %) × match %; balance = balance × (1 + return) + both; then salary grows. Contributions are added at the end of each year. Contribution limits, vesting and tax are not modelled.',
    formulaLatex: 'B_{t+1} = B_{t}(1 + r) + s_{t}\\,(c + m)',
    workedExample:
      '$25,000 now, $75,000 salary growing 3%, contributing 6% with a 50% match up to 6%, at a 7% return for 30 years: you put in $214,089.37, your employer $107,044.69, and the balance reaches $1,065,273.87.',
    faq: [
      {
        question: 'How does an employer match work?',
        answer: 'Typically the employer adds a percentage of what you contribute, up to a cap, such as 50 cents per dollar on the first 6% of pay.',
      },
      {
        question: 'Why does a small increase in contributions matter so much?',
        answer: 'Contributions made early have decades to compound, so each extra percent adds a lot by retirement.',
      },
      {
        question: 'Are there contribution limits?',
        answer: 'Yes, set by law and changing over time. The page does not apply them, so check the current limit.',
      },
    ],
    scenarios: varied(
      '401k-calculator',
      12,
      [
        { name: 'bal', lo: 0, hi: 190000, step: 500 },
        { name: 'sal', lo: 28000, hi: 240000, step: 500 },
        { name: 'pct', lo: 2, hi: 18, step: 1 },
        { name: 'match', lo: 0, hi: 100, step: 5 },
        { name: 'cap', lo: 3, hi: 8, step: 1 },
        { name: 'grow', lo: 0, hi: 5, step: 0.5 },
        { name: 'ret', lo: 3, hi: 10, step: 0.5 },
        { name: 'yrs', lo: 8, hi: 42, step: 1 },
      ],
      [],
      (v) => `${v.bal} start, ${v.sal} salary, ${v.pct}% in, ${v.ret}% for ${v.yrs} years`,
    ),
    introOutputs: ['bal'],
    relatedSlugs: ['roth-ira-calculator', 'retirement-calculator', 'compound-interest-calculator'],
    checks: [
      { inputs: {}, expect: { bal: '$1,065,273.87', mine: '$214,089.37', theirs: '$107,044.69', growth: '$719,139.82' } },
      {
        inputs: { bal: 0, sal: 50000, pct: 3, match: 100, cap: 3, grow: 0, ret: 0, yrs: 10 },
        expect: { bal: '$30,000.00', mine: '$15,000.00', theirs: '$15,000.00', growth: '$0.00' },
      },
      {
        inputs: { bal: 120000, sal: 95000, pct: 15, match: 50, cap: 6, grow: 2.5, ret: 6, yrs: 20 },
        expect: { bal: '$1,151,189.84', mine: '$364,011.37', theirs: '$72,802.27', growth: '$594,376.20' },
      },
    ],
  },
  {
    slug: 'roth-ira-calculator',
    category: 'finance',
    tier: 2,
    subCluster: 'Retirement',
    title: 'Roth IRA Calculator: Roth vs Traditional After Tax',
    h1: 'Roth IRA Calculator',
    metaDescription:
      'Compare a Roth and a traditional retirement account for the same yearly sacrifice, using your tax rate now and in retirement, and see which ends ahead after tax.',
    about:
      "The choice between a Roth and a traditional account comes down to when you pay the tax. A Roth takes after-tax money now and is tax-free when you withdraw it; a traditional account takes pre-tax money, which lowers your tax bill today, but the withdrawals are taxed. To compare them fairly this page starts from the same yearly pre-tax amount you can set aside, puts the Roth contribution net of today's tax, and taxes the traditional balance at your expected retirement rate.",
    inputs: [
      dollars('a', 'Yearly amount set aside, before tax', 6000),
      percent('ret', 'Average yearly return', 7, 30),
      whole('yrs', 'Years of contributions', 30, 1, 60),
      percent('tn', 'Your tax rate now', 22, 60),
      percent('tr', 'Your tax rate in retirement', 22, 60),
    ],
    outputs: [
      out('win', 'Result', true),
      out('roth', 'Roth balance (tax-free)'),
      out('trad', 'Traditional balance before tax'),
      out('after', 'Traditional balance after tax'),
    ],
    calculate: (i) => {
      const f = fvFactor(toD(i.ret).div(100), Number(i.yrs));
      const a = toD(i.a);
      const roth = a.mul(ONE.minus(toD(i.tn).div(100))).mul(f);
      const trad = a.mul(f);
      const after = trad.mul(ONE.minus(toD(i.tr).div(100)));
      const diff = roth.minus(after);
      const win = diff.abs().lt('0.005')
        ? 'About equal'
        : diff.gt(0)
          ? `Roth ahead by ${fmtCurrency(diff)}`
          : `Traditional ahead by ${fmtCurrency(diff.neg())}`;
      return { win, roth: fmtCurrency(roth), trad: fmtCurrency(trad), after: fmtCurrency(after) };
    },
    formulaDescription:
      'Roth = A (1 − t_now) × F; traditional = A × F, taxed at t_retirement on withdrawal, with F = ((1 + r)ⁿ − 1) ÷ r, contributions at year end. With equal tax rates the two tie exactly; the Roth wins if the rate will be higher later and the traditional if it will be lower. Limits and tax rules are not modelled.',
    formulaLatex: 'A(1-t_{0})F \\;\\text{vs}\\; AF(1-t_{1})',
    workedExample:
      'Setting aside $6,000 a year at 7% for 30 years with a 22% rate now and later: the Roth holds $442,076.48 tax-free, the traditional $566,764.72 before tax and $442,076.48 after, so they tie. If the rate falls to 12% in retirement (24% now) the traditional is ahead by $68,011.77.',
    faq: [
      {
        question: 'Which is better?',
        answer: 'Neither always: Roth tends to win if your tax rate will be higher in retirement, traditional if lower; the page shows both for your numbers.',
      },
      { question: 'Why do equal tax rates tie?', answer: 'Both pay tax exactly once at the same rate, just at a different time, so multiplication commutes.' },
      { question: 'Are there income and contribution limits?', answer: 'Yes, and they change; check the current rules, as none is applied here.' },
    ],
    scenarios: varied(
      'roth-ira-calculator',
      12,
      [
        { name: 'a', lo: 1500, hi: 9500, step: 50 },
        { name: 'ret', lo: 3, hi: 10, step: 0.5 },
        { name: 'yrs', lo: 8, hi: 42, step: 1 },
        { name: 'tn', lo: 10, hi: 37, step: 1 },
        { name: 'tr', lo: 10, hi: 37, step: 1 },
      ],
      [],
      (v) => `${v.a} a year, ${v.ret}% for ${v.yrs} years, tax ${v.tn}% then ${v.tr}%`,
    ),
    introOutputs: ['win'],
    relatedSlugs: ['401k-calculator', 'retirement-calculator', 'compound-interest-calculator'],
    checks: [
      { inputs: {}, expect: { roth: '$442,076.48', trad: '$566,764.72', after: '$442,076.48', win: 'About equal' } },
      { inputs: { tn: 24, tr: 12 }, expect: { roth: '$430,741.19', trad: '$566,764.72', after: '$498,752.95', win: 'Traditional ahead by $68,011.77' } },
      { inputs: { tn: 12, tr: 32 }, expect: { roth: '$498,752.95', trad: '$566,764.72', after: '$385,400.01', win: 'Roth ahead by $113,352.94' } },
      { inputs: { ret: 0, yrs: 10 }, expect: { roth: '$46,800.00', trad: '$60,000.00', after: '$46,800.00', win: 'About equal' } },
    ],
  },
  {
    slug: 'retirement-calculator',
    category: 'finance',
    tier: 2,
    subCluster: 'Retirement',
    title: 'Retirement Calculator: Savings at Retirement and Monthly Income',
    h1: 'Retirement Calculator',
    metaDescription:
      "Project retirement savings from your age, savings and monthly contributions, then the level monthly income they could pay until a chosen age, also in today's money.",
    about:
      "Retirement planning has two stages: saving up, and drawing down. Enter your age, the age you plan to retire, what you have saved and what you add each month, with a return for the years of saving and a typically lower one for retirement. The calculator projects the pot at retirement and the level monthly income it can pay until the age you choose, and it also states that income in today's money, because inflation will have eroded what a future dollar buys.",
    inputs: [
      whole('age', 'Your age now', 35, 16, 90),
      whole('ra', 'Retirement age', 65, 17, 95),
      dollars('bal', 'Savings now', 50000),
      dollars('mo', 'Monthly contribution', 800),
      percent('pre', 'Yearly return until retirement', 6.5, 30),
      percent('post', 'Yearly return in retirement', 4.5, 30),
      whole('end', 'Plan income until age', 90, 18, 120),
      percent('inf', 'Inflation per year', 2.5, 30),
    ],
    outputs: [
      out('fv', 'Savings at retirement', true),
      out('w', 'Level monthly income in retirement'),
      out('today', "That income in today's money"),
      out('put', 'Total you will have put in'),
    ],
    calculate: (i) => {
      const age = Number(i.age);
      const ra = Number(i.ra);
      const end = Number(i.end);
      if (ra <= age) return { fv: 'Retirement age must be above your age', w: '', today: '', put: '' };
      if (end <= ra) return { fv: 'The income end age must be above the retirement age', w: '', today: '', put: '' };
      const n1 = (ra - age) * 12;
      const i1 = toD(i.pre).div(1200);
      const fv = toD(i.bal)
        .mul(ONE.plus(i1).pow(n1))
        .plus(toD(i.mo).mul(fvFactor(i1, n1)));
      const w = level(fv, toD(i.post).div(1200), (end - ra) * 12);
      return {
        fv: fmtCurrency(fv),
        w: fmtCurrency(w),
        today: fmtCurrency(w.div(ONE.plus(toD(i.inf).div(100)).pow(ra - age))),
        put: fmtCurrency(toD(i.bal).plus(toD(i.mo).mul(n1))),
      };
    },
    formulaDescription:
      "Savings = S (1 + i)ⁿ + C ((1 + i)ⁿ − 1) ÷ i, with i the monthly return and n the months to retirement. Income = savings × j ÷ (1 − (1 + j)⁻ᵐ) with j the monthly retirement return and m the months of income. Today's money divides by (1 + inflation)^(years to retirement). Before tax and fees; returns are assumed constant.",
    formulaLatex: 'S_{R} = S(1+i)^{n} + C\\dfrac{(1+i)^{n} - 1}{i}',
    workedExample:
      "At 35 with $50,000 saved and $800 a month at 6.5% to age 65: $1,234,532.37 at retirement. Paid out to age 90 at 4.5% that is $6,861.93 a month, worth $3,271.38 in today's money at 2.5% inflation, after $338,000 of your own money went in.",
    faq: [
      {
        question: "Why show today's money?",
        answer: 'Because a fixed number of dollars buys less every year; the inflation-adjusted figure shows the buying power you will actually have.',
      },
      {
        question: 'Is the return guaranteed?',
        answer: 'No. Markets vary, so test several returns, and consider that a bad run just before retirement matters most.',
      },
      { question: 'Does it include pensions or social benefits?', answer: 'No, only your savings. Add any other income yourself.' },
    ],
    scenarios: varied(
      'retirement-calculator',
      12,
      [
        { name: 'age', lo: 22, hi: 58, step: 1 },
        { name: 'bal', lo: 0, hi: 480000, step: 500 },
        { name: 'mo', lo: 100, hi: 3800, step: 25 },
        { name: 'pre', lo: 3, hi: 9, step: 0.5 },
        { name: 'post', lo: 2, hi: 6, step: 0.5 },
        { name: 'inf', lo: 1, hi: 5, step: 0.5 },
      ],
      [],
      (v) => `age ${v.age}, ${v.bal} saved, ${v.mo} a month at ${v.pre}%`,
    ),
    introOutputs: ['fv', 'w'],
    relatedSlugs: ['401k-calculator', 'annuity-payout-calculator', 'savings-goal-calculator'],
    checks: [
      { inputs: {}, expect: { fv: '$1,234,532.37', w: '$6,861.93', today: '$3,271.38', put: '$338,000.00' } },
      {
        inputs: { age: 50, ra: 67, bal: 300000, mo: 1500, pre: 5, post: 4, end: 95, inf: 3 },
        expect: { fv: '$1,181,442.44', w: '$5,850.65', today: '$3,539.74', put: '$606,000.00' },
      },
      {
        inputs: { age: 25, ra: 60, bal: 0, mo: 400, pre: 0, post: 0, end: 85, inf: 0 },
        expect: { fv: '$168,000.00', w: '$560.00', today: '$560.00', put: '$168,000.00' },
      },
    ],
  },
  {
    slug: 'refinance-calculator',
    category: 'finance',
    tier: 2,
    subCluster: 'Loans',
    title: 'Refinance Calculator: Monthly Savings and Break-Even',
    h1: 'Refinance Calculator',
    metaDescription:
      'Compare your current mortgage with a refinance: the new payment, the monthly saving, the months to break even on closing costs and the change in lifetime cost.',
    about:
      'Refinancing swaps your current mortgage for a new one, usually to get a lower rate or a different term, but it costs money to arrange. The key question is how long the monthly saving takes to repay those closing costs: the break-even point. Enter your balance, your current rate and the years left, then the new rate, the new term and the closing costs. You see the new payment, the monthly saving, the break-even time and how the total cost across both loans compares.',
    inputs: [
      dollars('bal', 'Current loan balance', 250000),
      percent('rate', 'Current interest rate', 6.8, 100),
      whole('left', 'Years left on the current loan', 27, 1, 50),
      percent('nr', 'New interest rate', 5.9, 100),
      whole('ny', 'New loan term (years)', 30, 1, 50),
      dollars('cost', 'Closing costs paid upfront', 4500),
    ],
    outputs: [
      out('new', 'New monthly payment', true),
      out('save', 'Monthly saving'),
      out('be', 'Months to break even'),
      out('life', 'Change in lifetime cost (negative saves money)'),
    ],
    calculate: (i) => {
      const bal = toD(i.bal);
      const left = Number(i.left);
      const ny = Number(i.ny);
      const cur = level(bal, toD(i.rate).div(1200), left * 12);
      const neu = level(bal, toD(i.nr).div(1200), ny * 12);
      const save = cur.minus(neu);
      let be: string;
      if (save.lte(0)) be = 'Never (the new payment is not lower)';
      else {
        const m = Number(toD(i.cost).div(save).toFixed(0, D.ROUND_CEIL));
        be = `${m} months (${yrsMo(m)})`;
      }
      const life = neu
        .mul(ny * 12)
        .minus(bal)
        .plus(toD(i.cost))
        .minus(cur.mul(left * 12).minus(bal));
      return { new: fmtCurrency(neu), save: fmtCurrency(save), be, life: fmtCurrency(life) };
    },
    formulaDescription:
      'Each payment is the standard amortizing payment on the same balance. Break-even = closing costs ÷ monthly saving, rounded up. Lifetime change = (new total interest + closing costs) − current total interest. Closing costs are paid in cash, not added to the loan; taxes and insurance are excluded.',
    formulaLatex: 'n_{be} = \\dfrac{\\text{closing costs}}{M_{old} - M_{new}}',
    workedExample:
      '$250,000 at 6.8% with 27 years left, refinanced at 5.9% over 30 years with $4,500 of costs: the new payment is $1,482.84, $204.23 less, you break even in 23 months, and the lifetime cost is $8,289.53 lower.',
    faq: [
      {
        question: 'When is refinancing worthwhile?',
        answer:
          'When you will stay in the home beyond the break-even point and the saving is real after costs; a lower rate over a longer term can still cost more in total.',
      },
      {
        question: 'Why can a longer term cost more?',
        answer: 'It lowers the payment but spreads interest over more years; the lifetime-cost line shows that effect.',
      },
      { question: 'Are closing costs rolled in?', answer: 'Here they are paid upfront; rolling them into the loan raises the balance and the interest.' },
    ],
    scenarios: varied(
      'refinance-calculator',
      12,
      [
        { name: 'bal', lo: 60000, hi: 780000, step: 1000 },
        { name: 'rate', lo: 4.5, hi: 9, step: 0.1 },
        { name: 'left', lo: 8, hi: 29, step: 1 },
        { name: 'nr', lo: 3, hi: 7.5, step: 0.1 },
        { name: 'ny', lo: 10, hi: 30, step: 5 },
        { name: 'cost', lo: 1500, hi: 14000, step: 100 },
      ],
      [],
      (v) => `${v.bal} at ${v.rate}% to ${v.nr}% over ${v.ny} years, ${v.cost} costs`,
    ),
    introOutputs: ['new', 'be'],
    relatedSlugs: ['mortgage-calculator', 'amortization-calculator', 'loan-calculator'],
    checks: [
      { inputs: {}, expect: { new: '$1,482.84', save: '$204.23', be: '23 months (1 year 11 months)', life: '-$8,289.53' } },
      {
        inputs: { bal: 400000, rate: 7.5, left: 25, nr: 6.0, ny: 25, cost: 8000 },
        expect: { new: '$2,577.21', save: '$378.76', be: '22 months (1 year 10 months)', life: '-$105,627.73' },
      },
      {
        inputs: { bal: 300000, rate: 5.0, left: 20, nr: 5.5, ny: 30, cost: 3000 },
        expect: { new: '$1,703.37', save: '$276.50', be: '11 months (0 years 11 months)', life: '$141,043.99' },
      },
    ],
  },
  {
    slug: 'rental-property-calculator',
    category: 'finance',
    tier: 3,
    subCluster: 'Real estate',
    title: 'Rental Property Calculator: Cash Flow, Cap Rate and Cash-on-Cash Return',
    h1: 'Rental Property Calculator',
    metaDescription:
      'Analyse a rental property: net operating income, yearly and monthly cash flow after the mortgage, cap rate and cash-on-cash return from price, rent, loan and costs.',
    about:
      'A rental property is worth buying only if the rent covers the costs and leaves a return on the money you put in. Enter the price and down payment, the loan terms, the monthly rent, how much of the year you expect it to be empty and the running costs: property tax, insurance and maintenance and management as shares of the rent. The page works out the net operating income, the cash flow after the mortgage, the cap rate on the whole price and the cash-on-cash return on your down payment.',
    inputs: [
      dollars('price', 'Purchase price', 300000),
      percent('down', 'Down payment', 20, 100),
      percent('rate', 'Mortgage rate', 6.5, 100),
      whole('yrs', 'Mortgage term (years)', 30, 1, 50),
      dollars('rent', 'Monthly rent', 2400),
      percent('vac', 'Vacancy', 5, 100),
      dollars('tax', 'Property tax per year', 3600),
      dollars('ins', 'Insurance per year', 1200),
      percent('maint', 'Maintenance (% of rent)', 8, 100),
      percent('mgmt', 'Management (% of rent)', 8, 100),
    ],
    outputs: [
      out('cf', 'Cash flow per year after the mortgage', true),
      out('mcf', 'Cash flow per month'),
      out('noi', 'Net operating income per year'),
      out('cap', 'Cap rate'),
      out('coc', 'Cash-on-cash return'),
    ],
    calculate: (i) => {
      const price = toD(i.price);
      const eff = toD(i.rent)
        .mul(12)
        .mul(ONE.minus(toD(i.vac).div(100)));
      const noi = eff
        .minus(toD(i.tax))
        .minus(toD(i.ins))
        .minus(toD(i.maint).plus(toD(i.mgmt)).div(100).mul(eff));
      const down = price.mul(toD(i.down)).div(100);
      const cf = noi.minus(level(price.minus(down), toD(i.rate).div(1200), Number(i.yrs) * 12).mul(12));
      return {
        cf: fmtCurrency(cf),
        mcf: fmtCurrency(cf.div(12)),
        noi: fmtCurrency(noi),
        cap: fmtPercent(noi.div(price).mul(100), 2),
        coc: down.isZero() ? 'Not defined with no down payment' : fmtPercent(cf.div(down).mul(100), 2),
      };
    },
    formulaDescription:
      'Effective rent = rent × 12 × (1 − vacancy). NOI = effective rent − tax − insurance − (maintenance % + management %) × effective rent. Cash flow = NOI − yearly mortgage payments. Cap rate = NOI ÷ price. Cash-on-cash = cash flow ÷ down payment. Closing costs, repairs beyond the percentage and appreciation are not included.',
    formulaLatex: '\\text{cap rate} = \\dfrac{\\text{NOI}}{\\text{price}}',
    workedExample:
      'A $300,000 property with 20% down at 6.5% over 30 years, renting for $2,400 a month with 5% vacancy, $3,600 tax, $1,200 insurance and 16% for upkeep and management: NOI $18,182.40, a cap rate of 6.06%, and cash flow of −$21.16 a year after the mortgage, so a cash-on-cash return of −0.04%.',
    faq: [
      {
        question: 'What is a good cap rate?',
        answer: 'It depends on the market and risk; higher usually means more income per dollar of price but often a riskier or weaker location.',
      },
      {
        question: 'Why can cash flow be negative while NOI is positive?',
        answer: 'NOI ignores the mortgage; if the loan payments exceed NOI, the property loses money in cash terms.',
      },
      { question: 'What does cash-on-cash mean?', answer: 'The yearly cash flow divided by the cash you invested as a down payment.' },
    ],
    scenarios: varied(
      'rental-property-calculator',
      12,
      [
        { name: 'price', lo: 90000, hi: 880000, step: 1000 },
        { name: 'down', lo: 5, hi: 40, step: 1 },
        { name: 'rate', lo: 4.5, hi: 9, step: 0.1 },
        { name: 'rent', lo: 800, hi: 6400, step: 25 },
        { name: 'vac', lo: 2, hi: 12, step: 1 },
        { name: 'tax', lo: 900, hi: 11000, step: 100 },
        { name: 'ins', lo: 500, hi: 3800, step: 50 },
      ],
      [],
      (v) => `${v.price} at ${v.down}% down earning ${v.rent} a month`,
    ),
    introOutputs: ['cf', 'cap'],
    relatedSlugs: ['cap-rate-calculator', 'rental-yield-calculator', 'mortgage-calculator'],
    checks: [
      { inputs: {}, expect: { noi: '$18,182.40', cf: '-$21.16', mcf: '-$1.76', cap: '6.06%', coc: '-0.04%' } },
      {
        inputs: { price: 450000, down: 25, rate: 7, yrs: 30, rent: 3100, vac: 8, tax: 5400, ins: 1800, maint: 10, mgmt: 0 },
        expect: { noi: '$23,601.60', cf: '-$3,343.15', mcf: '-$278.60', cap: '5.24%', coc: '-2.97%' },
      },
      {
        inputs: { price: 200000, down: 20, rate: 6, rent: 1100, vac: 5, tax: 2800, ins: 900, maint: 10, mgmt: 10 },
        expect: { noi: '$6,332.00', cf: '-$5,179.37', mcf: '-$431.61', cap: '3.17%', coc: '-12.95%' },
      },
    ],
  },
  {
    slug: 'commission-calculator',
    category: 'finance',
    tier: 3,
    subCluster: 'Business',
    title: 'Commission Calculator: Earnings Above a Sales Quota',
    h1: 'Commission Calculator',
    metaDescription:
      'Calculate sales commission from your sales, the commission rate, an optional quota and your base pay, with total earnings and the effective rate on sales.',
    about:
      'Many sales jobs pay a base amount plus a commission on what you sell, and some only pay commission on sales above a quota. Enter your sales for the period, the commission rate, your base pay and the quota; set the quota to zero if commission applies from the first dollar. The page returns the commission earned, your total pay for the period and the effective commission rate as a share of your sales, which is lower than the headline rate whenever a quota applies.',
    inputs: [
      dollars('sales', 'Sales for the period', 60000),
      percent('rate', 'Commission rate', 8, 100),
      dollars('base', 'Base pay for the period', 3000),
      dollars('quota', 'Quota (commission only above this)', 20000),
    ],
    outputs: [out('comm', 'Commission earned', true), out('total', 'Total pay (base + commission)'), out('eff', 'Commission as a share of sales')],
    calculate: (i) => {
      const sales = toD(i.sales);
      const comm = D.max(ZERO, sales.minus(toD(i.quota)))
        .mul(toD(i.rate))
        .div(100);
      return { comm: fmtCurrency(comm), total: fmtCurrency(toD(i.base).plus(comm)), eff: sales.isZero() ? '0.00%' : fmtPercent(comm.div(sales).mul(100), 2) };
    },
    formulaDescription:
      'Commission = max(0, sales − quota) × rate. Total pay = base + commission. The effective rate is commission ÷ sales. Flat rate above the quota; tiered or accelerating schemes are not modelled.',
    formulaLatex: '\\text{commission} = \\max(0,\\ \\text{sales} - \\text{quota}) \\times r',
    workedExample:
      '$60,000 of sales, 8% above a $20,000 quota, $3,000 base: commission = $40,000 × 8% = $3,200, so total pay is $6,200 and the effective rate on all sales is 5.33%.',
    faq: [
      { question: 'What is a quota?', answer: 'A sales target; here commission is paid only on sales above it.' },
      { question: 'What if my scheme has tiers?', answer: 'Calculate each tier separately with its own quota and rate, and add the results.' },
      { question: 'Is commission taxed?', answer: 'Usually as ordinary income; this page shows gross amounts before tax.' },
    ],
    scenarios: varied(
      'commission-calculator',
      12,
      [
        { name: 'sales', lo: 5000, hi: 480000, step: 500 },
        { name: 'rate', lo: 1, hi: 20, step: 0.5 },
        { name: 'base', lo: 0, hi: 7500, step: 100 },
        { name: 'quota', lo: 0, hi: 60000, step: 500 },
      ],
      [],
      (v) => `sales ${v.sales} at ${v.rate}% over a ${v.quota} quota with ${v.base} base`,
    ),
    introOutputs: ['comm', 'total'],
    relatedSlugs: ['markup-calculator', 'profit-margin-calculator', 'salary-calculator'],
    checks: [
      { inputs: {}, expect: { comm: '$3,200.00', total: '$6,200.00', eff: '5.33%' } },
      { inputs: { sales: 15000, rate: 10, base: 2500, quota: 20000 }, expect: { comm: '$0.00', total: '$2,500.00', eff: '0.00%' } },
      { inputs: { sales: 250000, rate: 3, base: 0, quota: 0 }, expect: { comm: '$7,500.00', total: '$7,500.00', eff: '3.00%' } },
    ],
  },
  {
    slug: 'real-estate-commission-calculator',
    category: 'finance',
    tier: 3,
    subCluster: 'Real estate',
    title: 'Real Estate Commission Calculator: Seller Cost and Agent Take-Home',
    h1: 'Real Estate Commission Calculator',
    metaDescription:
      "Calculate the commission on a home sale from the price and rate, how it splits between the listing and buyer sides and the brokerage, and the seller's net before any mortgage payoff.",
    about:
      "When a home sells, the seller usually pays a commission as a percentage of the price, which is then shared between the two sides of the deal and again between each agent and their brokerage. Enter the sale price, the total commission rate, the share that goes to the listing side, the share of that which the agent keeps and the seller's other closing costs as a percentage. The page shows the total commission, the listing side, the agent's take-home and what the seller keeps before paying off any mortgage.",
    inputs: [
      dollars('price', 'Sale price', 400000),
      percent('rate', 'Total commission rate', 5.5, 20),
      percent('share', 'Share going to the listing side', 50, 100),
      percent('split', "Agent's share after brokerage split", 70, 100),
      percent('closing', 'Other seller closing costs', 2, 20),
    ],
    outputs: [
      out('total', 'Total commission', true),
      out('side', "Listing side's commission"),
      out('agent', "Listing agent's take-home"),
      out('net', "Seller's proceeds before mortgage payoff"),
    ],
    calculate: (i) => {
      const price = toD(i.price);
      const total = price.mul(toD(i.rate)).div(100);
      const side = total.mul(toD(i.share)).div(100);
      return {
        total: fmtCurrency(total),
        side: fmtCurrency(side),
        agent: fmtCurrency(side.mul(toD(i.split)).div(100)),
        net: fmtCurrency(price.minus(total).minus(price.mul(toD(i.closing)).div(100))),
      };
    },
    formulaDescription:
      "Total commission = price × rate. Listing side = total × its share. Agent take-home = listing side × agent's split. Seller's proceeds = price − commission − price × closing-cost %. Rates are negotiable, vary by market and rules change; this is an illustration.",
    formulaLatex: '\\text{commission} = \\text{price}\\times r',
    workedExample:
      'A $400,000 sale at a 5.5% total commission is $22,000. Half, $11,000, goes to the listing side and the agent keeps 70% of that, $7,700. With 2% closing costs the seller receives $370,000 before paying off the mortgage.',
    faq: [
      {
        question: 'Who pays the commission?',
        answer: 'Practices differ by country and have changed in places; traditionally the seller paid it, but check the agreement.',
      },
      { question: 'Is the rate fixed?', answer: 'No, it is negotiable and varies by market, price and service.' },
      { question: 'Does it include taxes?', answer: 'No. Capital gains tax and mortgage payoff are not included.' },
    ],
    scenarios: varied(
      'real-estate-commission-calculator',
      12,
      [
        { name: 'price', lo: 120000, hi: 1900000, step: 1000 },
        { name: 'rate', lo: 2.5, hi: 7, step: 0.25 },
        { name: 'share', lo: 40, hi: 100, step: 5 },
        { name: 'split', lo: 50, hi: 95, step: 5 },
        { name: 'closing', lo: 0.5, hi: 4, step: 0.25 },
      ],
      [],
      (v) => `sale at ${v.price}, ${v.rate}% commission, ${v.share}% listing side, ${v.split}% to the agent`,
    ),
    introOutputs: ['total', 'net'],
    relatedSlugs: ['commission-calculator', 'mortgage-calculator', 'rental-yield-calculator'],
    checks: [
      { inputs: {}, expect: { total: '$22,000.00', side: '$11,000.00', agent: '$7,700.00', net: '$370,000.00' } },
      {
        inputs: { price: 725000, rate: 6, share: 100, split: 60, closing: 1.5 },
        expect: { total: '$43,500.00', side: '$43,500.00', agent: '$26,100.00', net: '$670,625.00' },
      },
      {
        inputs: { price: 180000, rate: 4.5, share: 50, split: 80, closing: 3 },
        expect: { total: '$8,100.00', side: '$4,050.00', agent: '$3,240.00', net: '$166,500.00' },
      },
    ],
  },
  {
    slug: 'rent-affordability-calculator',
    category: 'finance',
    tier: 2,
    subCluster: 'Housing',
    title: 'Rent Affordability Calculator: How Much Rent Can You Afford?',
    h1: 'Rent Affordability Calculator',
    metaDescription:
      'Work out the most rent you can afford from your monthly income and a rent-to-income target, and the income you need for a given rent, including the 40x rule landlords use.',
    about:
      'A common rule of thumb says rent should not take more than about 30 percent of your gross monthly income, and landlords often ask for an annual income of 40 times the monthly rent. Enter your gross monthly income, the share of it you are willing to spend on rent and a rent you are considering. The calculator returns the highest rent that fits your target, the monthly income that rent would need at your target share, your actual rent-to-income ratio and the income a landlord using the 40x rule would require.',
    inputs: [
      dollars('inc', 'Gross monthly income', 5200),
      percent('pct', 'Share of income for rent', 30, 100),
      dollars('rent', 'Rent you are considering', 1800),
    ],
    outputs: [
      out('max', 'Highest rent at your target share', true),
      out('need', 'Monthly income needed for that rent'),
      out('ratio', 'Rent as a share of your income'),
      out('x40', 'Yearly income under the 40x rule'),
    ],
    calculate: (i) => {
      const inc = toD(i.inc);
      const pc = toD(i.pct);
      const rent = toD(i.rent);
      return {
        max: fmtCurrency(inc.mul(pc).div(100)),
        need: pc.isZero() ? 'Set a target share above zero' : fmtCurrency(rent.div(pc.div(100))),
        ratio: inc.isZero() ? 'Enter an income' : fmtPercent(rent.div(inc).mul(100), 1),
        x40: fmtCurrency(rent.mul(40)),
      };
    },
    formulaDescription:
      'Highest rent = income × target share. Income needed = rent ÷ target share. Ratio = rent ÷ income. The 40x rule asks for yearly income of at least 40 × monthly rent. These are rules of thumb, not lending or leasing requirements.',
    formulaLatex: '\\text{rent}_{max} = \\text{income}\\times s',
    workedExample:
      'On $5,200 a month with a 30% target the most you should spend is $1,560. A $1,800 rent needs $6,000 of monthly income at that share, takes 34.6% of your income, and under the 40x rule needs $72,000 a year.',
    faq: [
      {
        question: 'Where does the 30% rule come from?',
        answer: 'It is a long-standing rule of thumb for housing cost; in expensive cities many people spend more.',
      },
      { question: 'Should I use gross or net income?', answer: 'The rule is usually stated on gross (before-tax) income, which is what landlords check.' },
      { question: 'What else should I budget for?', answer: 'Utilities, insurance, deposits and moving costs on top of rent.' },
    ],
    scenarios: varied(
      'rent-affordability-calculator',
      12,
      [
        { name: 'inc', lo: 1800, hi: 14500, step: 50 },
        { name: 'pct', lo: 20, hi: 45, step: 1 },
        { name: 'rent', lo: 600, hi: 5200, step: 25 },
      ],
      [],
      (v) => `income ${v.inc}, target ${v.pct}%, rent ${v.rent}`,
    ),
    introOutputs: ['max', 'ratio'],
    relatedSlugs: ['rental-yield-calculator', 'salary-calculator', 'split-bill-calculator'],
    checks: [
      { inputs: {}, expect: { max: '$1,560.00', need: '$6,000.00', x40: '$72,000.00', ratio: '34.6%' } },
      { inputs: { inc: 3800, pct: 35, rent: 1500 }, expect: { max: '$1,330.00', need: '$4,285.71', x40: '$60,000.00', ratio: '39.5%' } },
      { inputs: { inc: 9000, pct: 25, rent: 2200 }, expect: { max: '$2,250.00', need: '$8,800.00', x40: '$88,000.00', ratio: '24.4%' } },
    ],
  },
  {
    slug: 'salary-calculator',
    category: 'finance',
    tier: 2,
    subCluster: 'Income',
    title: 'Salary Calculator: Hourly, Weekly, Monthly and Yearly Pay',
    h1: 'Salary Calculator',
    metaDescription: 'Convert pay between hourly, daily, weekly, biweekly, monthly and yearly amounts, using your hours per week and weeks per year.',
    about:
      'Pay is quoted in different periods, so comparing a job that pays by the hour with one that pays a yearly salary needs a common basis. Enter an amount and say whether it is hourly, weekly, biweekly, monthly or yearly, then set your hours per week and the weeks you are paid in a year. The calculator converts it into every other period, all before tax. Unpaid time off is handled by lowering the weeks per year, and part-time work by lowering the hours.',
    inputs: [
      dollars('amt', 'Pay amount', 65000),
      sel('per', 'This amount is', 'annual', [
        ['hourly', 'Per hour'],
        ['weekly', 'Per week'],
        ['biweekly', 'Every two weeks'],
        ['monthly', 'Per month'],
        ['annual', 'Per year'],
      ]),
      num('hrs', 'Hours worked per week', 40, 1, 100),
      num('wks', 'Weeks paid per year', 52, 1, 52),
    ],
    outputs: [
      out('year', 'Yearly pay', true),
      out('month', 'Monthly pay'),
      out('bi', 'Biweekly pay'),
      out('week', 'Weekly pay'),
      out('day', 'Daily pay (5-day week)'),
      out('hour', 'Hourly pay'),
    ],
    calculate: (i) => {
      const amt = toD(i.amt);
      const hrs = toD(i.hrs);
      const wks = toD(i.wks);
      const per = String(i.per);
      const annual =
        per === 'hourly'
          ? amt.mul(hrs).mul(wks)
          : per === 'weekly'
            ? amt.mul(wks)
            : per === 'biweekly'
              ? amt.mul(wks).div(2)
              : per === 'monthly'
                ? amt.mul(12)
                : amt;
      const wk = annual.div(wks);
      return {
        year: fmtCurrency(annual),
        month: fmtCurrency(annual.div(12)),
        bi: fmtCurrency(wk.mul(2)),
        week: fmtCurrency(wk),
        day: fmtCurrency(wk.div(5)),
        hour: fmtCurrency(wk.div(hrs)),
      };
    },
    formulaDescription:
      'Yearly = hourly × hours × weeks, or weekly × weeks, or biweekly × weeks ÷ 2, or monthly × 12. Weekly = yearly ÷ weeks; hourly = weekly ÷ hours; monthly = yearly ÷ 12; daily = weekly ÷ 5. Gross pay, before tax and deductions.',
    formulaLatex: '\\text{hourly} = \\dfrac{\\text{annual}}{\\text{hours/week}\\times\\text{weeks/year}}',
    workedExample:
      'A $65,000 salary on a 40-hour week paid for 52 weeks is $31.25 an hour, $250 a day, $1,250 a week, $2,500 every two weeks and $5,416.67 a month.',
    faq: [
      { question: 'Is this before or after tax?', answer: 'Before tax. Taxes and deductions vary and are not applied.' },
      { question: 'How do I allow for unpaid holidays?', answer: 'Lower the weeks paid per year; the hourly equivalent then rises for the same salary.' },
      {
        question: 'Why is monthly not four weeks of pay?',
        answer: 'A year has about 4.33 weeks per month, so monthly pay is yearly ÷ 12, not four weekly cheques.',
      },
    ],
    scenarios: [
      [18.5, 'hourly', 40, 52],
      [32, 'hourly', 37.5, 50],
      [780, 'weekly', 40, 52],
      [1450, 'biweekly', 40, 52],
      [3850, 'monthly', 40, 52],
      [52000, 'annual', 40, 52],
      [88500, 'annual', 37.5, 52],
      [26.75, 'hourly', 32, 48],
      [2200, 'weekly', 40, 52],
      [61250, 'annual', 40, 50],
      [4720, 'monthly', 35, 52],
      [41, 'hourly', 45, 52],
    ].map(([amt, per, hrs, wks]) => ({ label: `${amt} ${per}, ${hrs} hours, ${wks} weeks`, inputs: { amt, per, hrs, wks } })),
    introOutputs: ['year', 'hour'],
    relatedSlugs: ['hourly-to-salary-calculator', 'commission-calculator', 'rent-affordability-calculator'],
    checks: [
      { inputs: {}, expect: { hour: '$31.25', day: '$250.00', week: '$1,250.00', bi: '$2,500.00', month: '$5,416.67', year: '$65,000.00' } },
      {
        inputs: { amt: 32, per: 'hourly', hrs: 37.5, wks: 50 },
        expect: { hour: '$32.00', day: '$240.00', week: '$1,200.00', bi: '$2,400.00', month: '$5,000.00', year: '$60,000.00' },
      },
      {
        inputs: { amt: 4200, per: 'monthly' },
        expect: { hour: '$24.23', day: '$193.85', week: '$969.23', bi: '$1,938.46', month: '$4,200.00', year: '$50,400.00' },
      },
      {
        inputs: { amt: 1800, per: 'biweekly', hrs: 35 },
        expect: { hour: '$25.71', day: '$180.00', week: '$900.00', bi: '$1,800.00', month: '$3,900.00', year: '$46,800.00' },
      },
      {
        inputs: { amt: 950, per: 'weekly', hrs: 30, wks: 48 },
        expect: { hour: '$31.67', day: '$190.00', week: '$950.00', bi: '$1,900.00', month: '$3,800.00', year: '$45,600.00' },
      },
    ],
  },
];

export default function generate(): CalculatorConfig[] {
  return SPECS.map(defineCalculator);
}
