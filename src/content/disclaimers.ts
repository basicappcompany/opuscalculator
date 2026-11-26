import type { Category } from '../lib/types';

/**
 * Category disclaimers (Prompt 12, step 1). The texts are the plan's exact wording. A category that is not a key here
 * needs no disclaimer: math, physics, conversion, everyday-life, statistics, sports, ecology.
 * `tax` has text but no category yet: a calculator that computes tax uses it when a `tax` category is added.
 */
export const DISCLAIMERS: Partial<Record<Category | 'tax', string>> = {
  health:
    'This calculator is for informational and educational purposes only. It is not a substitute for professional medical advice, diagnosis, or treatment. Always consult a qualified healthcare provider before making decisions about your health.',
  finance:
    'This calculator is for educational and informational purposes only and does not constitute financial, investment, or tax advice. Consult a licensed financial professional before making decisions.',
  tax: 'This calculator provides estimates only. Tax law varies by jurisdiction and changes frequently. Consult a qualified tax professional before filing or making decisions.',
  construction: 'Estimates only. Verify all quantities and materials with a licensed contractor and local building codes before purchase or construction.',
  chemistry: "For educational use. Follow your institution's lab safety protocols and consult a qualified chemist before any experimental use.",
  food: 'Estimates only. Check all ingredients against known allergies. Consult a dietitian for medical or therapeutic dietary needs.',
  biology: 'For educational and informational purposes only. Not a substitute for professional scientific or medical advice.',
  other: 'This calculator is provided for informational purposes. Verify results independently before relying on them.',
};

export const disclaimerFor = (category: Category): string | undefined => DISCLAIMERS[category];

/** Categories the plan calls YMYL ("your money or your life"): they also show a review line and review markup. */
export const YMYL_CATEGORIES: readonly Category[] = ['health', 'finance', 'construction', 'chemistry', 'food', 'biology'];

export const isYmyl = (category: Category): boolean => YMYL_CATEGORIES.includes(category);
