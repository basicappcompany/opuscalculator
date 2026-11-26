import type { HubContent } from './types';

const hub: HubContent = {
  category: 'finance',
  title: 'Finance Calculators: Loans, Mortgages and Investing',
  metaDescription:
    'Free finance calculators for mortgages, loans, compound interest and growth rates, with a plain explanation of how each result is worked out and what people get wrong.',
  h1: 'Finance Calculators',
  lede: 'Money decisions are mostly arithmetic done over a long time. A mortgage payment, the growth of a savings balance and the real cost of a discount all come from a handful of formulas that compound, amortize or take a percentage. These calculators run those formulas for you, show the inputs that matter, and explain what the result means.',
  sections: [
    {
      heading: 'What finance calculations are used for',
      paragraphs: [
        'Almost every personal finance question falls into one of three shapes. The first is borrowing: how much will I pay each month, and how much will I pay in total, for a loan or a mortgage. The second is saving and investing: what will a balance grow to if I leave it alone. The third is comparison: which of two offers, prices or returns is actually better once the time and the fees are counted.',
        'The reason a calculator helps is that the human intuition for these problems is poor. People tend to think in straight lines, but interest works on a curve. A loan that costs a few hundred dollars a month feels manageable until the same figure is multiplied by 360 payments. A savings plan that looks modest in year five looks very different in year thirty. Putting the numbers on the screen makes the long-run shape visible before you commit to it.',
        'Finance calculators are also useful for checking a figure someone else gave you. A lender quotes a payment, a salesperson quotes a saving, an advert quotes a return. Running the same inputs yourself tells you whether the quote is consistent with the stated rate and term, and it shows you which inputs were left out of the pitch.',
      ],
    },
    {
      heading: 'How the formulas relate to each other',
      paragraphs: [
        'Most of the formulas on this site are variations of one idea: money has a time value. A sum received later is worth less than the same sum received now, because the earlier sum can earn interest in the meantime. Compound interest runs that idea forward: it asks what a sum today becomes in the future. Loan amortization runs it backward: it asks what level payment, made every period, exactly repays a sum borrowed today with interest.',
        'The compound interest formula multiplies the balance by one plus the periodic rate for every period. The loan payment formula divides the amount borrowed by the sum of those same growth factors, discounted back to the present. They look different on the page, but they are the same machinery used in opposite directions. That is why a mortgage and a savings account respond to the same inputs in the same way: a higher rate, a longer term, or more frequent compounding all push the numbers apart.',
        'The compound annual growth rate, usually shortened to CAGR, is the compound interest formula solved for the rate. If you know where an investment started and where it ended, CAGR gives the single steady yearly rate that would produce the same end result. It is a way of describing a bumpy path with one number, and it should be read that way: it says nothing about the ups and downs along the route.',
        'Percentages sit underneath all of it. A discount, a tax rate, a fee and an interest rate are all percentages applied to a base amount. Most errors in everyday finance come from applying a percentage to the wrong base, which is why the comparison tools matter as much as the headline ones.',
      ],
    },
    {
      heading: 'Common mistakes people make',
      paragraphs: [
        'The most frequent mistake is comparing loans by their monthly payment alone. A longer term lowers the payment and raises the total interest, sometimes by a very large amount. A lower payment is not a cheaper loan. Always compare the total interest paid and the total repaid alongside the payment, and compare loans at the same term or be explicit about the difference.',
        'The second mistake is mixing up the nominal rate and the effective rate. A stated yearly rate that compounds monthly produces a slightly higher effective yearly rate than the same figure compounded once a year. When two products quote rates on different compounding schedules, they are not directly comparable until you convert them to the same basis.',
        'Third, people forget what a payment does not include. A mortgage payment from a loan formula covers principal and interest only. Property tax, insurance, mortgage insurance and association fees usually come on top, and they can add a meaningful amount to the monthly cost. Use the calculator for the loan itself and add the other costs separately so you know the full figure.',
        'Fourth, returns are often quoted without inflation. A balance that grows at five percent a year while prices rise at three percent a year grows in purchasing power by roughly two percent, not five. Where a long horizon matters, think in real terms as well as nominal ones.',
        'Finally, treat any projected return as an illustration rather than a promise. A compound interest calculator assumes the rate stays fixed for the whole period. Real investments move around, and real loans may have variable rates. Use a range of rates, not one, when you plan.',
      ],
    },
    {
      heading: 'Who benefits from these calculators',
      paragraphs: [
        'First-time home buyers get the most obvious value. Before talking to a lender, you can test how the price, down payment, rate and term combine into a monthly payment, and decide what range is realistic. That turns a vague budget into a specific one and lets you ask better questions when you do speak to a professional.',
        'People who are already saving benefit from seeing how balance, time and rate interact. Often the most useful lesson is that time matters more than the exact rate. Starting earlier usually moves the end result further than chasing a slightly higher return.',
        'Students of finance, small business owners and anyone checking a quote benefit from being able to reproduce a number. When a result is shown alongside the formula and a worked example, you can verify it by hand, and you can see which assumption drives it. That transparency is the point of every calculator here.',
        'None of this replaces advice from a licensed professional who knows your whole situation. These tools give estimates from the inputs you provide. They do not know your tax position, your other debts or the fine print of a particular product, so treat the output as a well-informed starting point for a decision, not the decision itself.',
      ],
    },
  ],
  subclusters: [
    {
      label: 'Loans and mortgages',
      blurb: 'Work out payments and total interest before you borrow.',
      slugs: ['mortgage-calculator', 'loan-calculator'],
    },
    {
      label: 'Saving and investing',
      blurb: 'See how a balance grows over time, and measure growth you have already had.',
      slugs: ['compound-interest-calculator', 'cagr-calculator'],
    },
    {
      label: 'Everyday money',
      blurb: 'Quick percentage-based sums for shopping and dining.',
      slugs: ['discount-calculator', 'tip-calculator'],
    },
  ],
  featured: [
    {
      slug: 'mortgage-calculator',
      blurb:
        'Turns a home price, down payment, interest rate and term into a monthly principal-and-interest payment, with the loan amount, loan-to-value and total interest over the life of the loan. It is the right first stop when you are sizing a purchase, because the total interest line shows what the term really costs.',
    },
    {
      slug: 'compound-interest-calculator',
      blurb:
        'Shows what a starting amount grows to at a fixed annual rate over a chosen number of years, compounded annually, monthly or daily. It reports the total interest earned and the effective annual rate, which is usually the number that changes how people think about saving.',
    },
    {
      slug: 'loan-calculator',
      blurb:
        'Handles any fixed-rate loan, such as a car loan or personal loan, and returns the payment and the total cost of borrowing. It suits comparing two offers with different rates and terms side by side.',
    },
    {
      slug: 'cagr-calculator',
      blurb:
        'Takes a starting value, an ending value and a number of years and returns the steady annual growth rate that connects them. It is the clean way to compare investments or business figures that were measured over different periods.',
    },
  ],
  guide: [
    {
      situation: 'You are sizing a home purchase',
      slug: 'mortgage-calculator',
      advice: 'Adjust the down payment and the term and watch both the payment and the total interest, then add tax and insurance yourself.',
    },
    {
      situation: 'You are comparing a car or personal loan offer',
      slug: 'loan-calculator',
      advice: "Enter each offer's rate and term and compare the total repaid, not just the monthly figure.",
    },
    {
      situation: 'You want to know what your savings could become',
      slug: 'compound-interest-calculator',
      advice: 'Try two or three different rates rather than one, since a fixed rate is only an assumption.',
    },
    {
      situation: 'You want to compare how two investments performed',
      slug: 'cagr-calculator',
      advice: 'Use the same time span for both, or the annual rates will not be comparable.',
    },
  ],
};

export default hub;
