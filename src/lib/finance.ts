import { D, ONE, ZERO, type Dec } from './decimal';

/**
 * Level monthly payment on an amortizing loan: P*r / (1 - (1+r)^-n), with r the monthly rate.
 * A 0% loan is just P / n. Returned unrounded; callers format.
 */
export function monthlyPayment(principal: Dec, annualRatePercent: Dec, months: number): Dec {
  if (principal.lte(0) || months <= 0) return ZERO;
  const r = annualRatePercent.div(100).div(12);
  if (r.isZero()) return principal.div(months);
  return principal.mul(r).div(ONE.minus(ONE.plus(r).pow(-months)));
}

export interface Amortized {
  /** The level payment, rounded to the cent as a lender bills it. */
  payment: Dec;
  totalPaid: Dec;
  totalInterest: Dec;
}

/**
 * Totals from a real month-by-month schedule, the way a lender bills: the payment is rounded to the cent,
 * each month's interest is rounded to the cent, and the last payment is adjusted to clear the balance.
 * `exactPayment` is the unrounded level payment and `monthlyRate` the rate charged each month (a decimal).
 * Multiplying the unrounded payment by n instead drifts from a real schedule by up to a couple of dollars
 * over a 30-year mortgage, so totals must come from here.
 */
export function amortize(principal: Dec, monthlyRate: Dec, months: number, exactPayment: Dec): Amortized {
  if (principal.lte(0) || months <= 0) return { payment: ZERO, totalPaid: ZERO, totalInterest: ZERO };
  const payment = exactPayment.toDecimalPlaces(2, D.ROUND_HALF_UP);
  let balance = principal;
  let paid = ZERO;
  for (let m = 1; m <= months && balance.gt(0); m++) {
    const interest = balance.mul(monthlyRate).toDecimalPlaces(2, D.ROUND_HALF_UP);
    const owed = balance.plus(interest);
    const pay = m === months || payment.gt(owed) ? owed : payment;
    balance = owed.minus(pay);
    paid = paid.plus(pay);
  }
  return { payment, totalPaid: paid, totalInterest: paid.minus(principal) };
}

/** Amortization at a plain monthly rate of annual% ÷ 12 (the common case). */
export function amortizeAnnual(principal: Dec, annualRatePercent: Dec, months: number): Amortized {
  return amortize(principal, annualRatePercent.div(1200), months, monthlyPayment(principal, annualRatePercent, months));
}
