# Accessibility audit, 23 November 2026

Target: WCAG 2.2 AA. This records what `npm run a11y` and the related checks found on the local build on 23 Nov 2026, what was fixed, and what has **not** been tested. Re-run `npm run build && npm run a11y` after any change to layouts, the widget, colours or the header.

## Result

| Check                                               | Result                 | How                                                                                                                                                                  |
| --------------------------------------------------- | ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| axe-core, every rule, any impact                    | **PASS: 0 violations** | 8 pages (the 5 Tier 1 calculators, the home page, the finance hub, the privacy page), each in light and dark, plus the BMI and mortgage widgets in their error state |
| No horizontal scroll at 320 px                      | PASS                   | all 8 pages, viewport 320 x 800                                                                                                                                      |
| No horizontal scroll at 200% zoom                   | PASS                   | all 8 pages at 640 px wide, which is a 1280 px window at 200%                                                                                                        |
| Skip link is the first tab stop                     | PASS                   | all 5 calculator pages                                                                                                                                               |
| Every control in the calculator is reachable by Tab | PASS                   | all 5 calculator pages                                                                                                                                               |
| No keyboard trap                                    | PASS                   | focus wraps to the first stop after 33 to 40 stops                                                                                                                   |
| The ad slot never takes focus                       | PASS                   | and holds nothing focusable before an ad loads                                                                                                                       |
| Enter, Space and Escape on a focused button         | PASS                   | Escape does not move focus off a button                                                                                                                              |
| A select can be driven with the arrow keys          | PASS                   | unit select on the BMI page (native control)                                                                                                                         |
| Theme toggle is a button with `aria-pressed`        | PASS                   | `false` becomes `true` on Enter                                                                                                                                      |
| Visible focus ring on buttons                       | PASS                   | 3 px outline                                                                                                                                                         |
| Live region quiet while typing, speaks once settled | PASS                   | typing two digits 120 ms apart leaves the region unchanged; after 1 second it announces the new BMI                                                                  |
| Colour contrast, both themes                        | PASS                   | `tests/design-tokens.test.ts` computes WCAG ratios for every text pair (4.5:1) and control outline and focus ring (3:1)                                              |

## Found by the audit and fixed

1. **Scrollable regions not keyboard reachable** (axe `scrollable-region-focusable`, serious): the scenario table and the formula box scroll sideways on narrow screens but could not be reached by keyboard. They are now `role="region" tabindex="0"` with a label.
2. **Header overflowed at 320 px** (the page was 484 px wide): the wordmark is now text-hidden on phones (its accessible name is kept) and the currency selector has a fixed width.
3. **A decorative border colour was about 1.4:1 against white** where 3:1 is required for the outline of an input: form controls now use a stronger border token.

## Keyboard tab order

Stop 1 is always the skip link; the advertisement is never a stop. Two pages are shown in full. The tables for the percentage, age and compound-interest pages are written by `npm run a11y` to `reports/a11y/tab-order.md`.

### BMI calculator (layout A)

| #   | Element                                                    | In calculator |
| --- | ---------------------------------------------------------- | ------------- |
| 1   | a "Skip to calculator"                                     | no            |
| 2   | a "Opus Calculator"                                        | no            |
| 3   | select#currency-select "Currency"                          | no            |
| 4   | button#theme-toggle "Dark mode"                            | no            |
| 5   | a "Home"                                                   | no            |
| 6   | a "Health"                                                 | no            |
| 7   | button "kg · cm"                                           | yes           |
| 8   | button "lb · in"                                           | yes           |
| 9   | input#_r1R_0_-weight "Weight"                              | yes           |
| 10  | select "Weight unit"                                       | yes           |
| 11  | input#_r1R_0_-height "Height"                              | yes           |
| 12  | select "Height unit"                                       | yes           |
| 13  | button "Reset to defaults"                                 | yes           |
| 14  | button "Copy results"                                      | yes           |
| 15  | a "How we review"                                          | no            |
| 16  | summary "The formula"                                      | no            |
| 17  | summary "A worked example"                                 | no            |
| 18  | div "Compare scenarios, scrollable table"                  | no            |
| 19  | summary "What is a healthy BMI for an adult?"              | no            |
| 20  | summary "Is BMI accurate for athletes and muscular people" | no            |
| 21  | summary "Does BMI work for children and teenagers?"        | no            |
| 22  | summary "How do I calculate BMI in pounds and inches?"     | no            |
| 23  | a "All health calculators"                                 | no            |
| 24  | a "Mortgage Calculator"                                    | no            |
| 25  | a "Percentage Calculator"                                  | no            |
| 26  | a "Compound Interest Calculator"                           | no            |
| 27  | a "Age Calculator"                                         | no            |
| 28  | a "Everyday life"                                          | no            |
| 29  | a "Finance"                                                | no            |
| 30  | a "Health"                                                 | no            |
| 31  | a "Math"                                                   | no            |
| 32  | a "About"                                                  | no            |
| 33  | a "Contact"                                                | no            |
| 34  | a "Editorial policy"                                       | no            |
| 35  | a "How we make money"                                      | no            |
| 36  | a "Privacy"                                                | no            |
| 37  | a "Terms"                                                  | no            |
| 38  | a "Ad disclosure"                                          | no            |
| 39  | a "Accessibility"                                          | no            |
| 40  | a "DMCA"                                                   | no            |

### Mortgage calculator (layout A)

| #   | Element                                                    | In calculator |
| --- | ---------------------------------------------------------- | ------------- |
| 1   | a "Skip to calculator"                                     | no            |
| 2   | a "Opus Calculator"                                        | no            |
| 3   | select#currency-select "Currency"                          | no            |
| 4   | button#theme-toggle "Dark mode"                            | no            |
| 5   | a "Home"                                                   | no            |
| 6   | a "Finance"                                                | no            |
| 7   | button "Change"                                            | yes           |
| 8   | input#_r1R_0_-homePrice "Home price ($)"                   | yes           |
| 9   | input#_r1R_0_-downPayment "Down payment ($)"               | yes           |
| 10  | input#_r1R_0_-interestRate "Interest rate (% per year)"    | yes           |
| 11  | input#_r1R_0_-termYears "Loan term (years)"                | yes           |
| 12  | button "Reset to defaults"                                 | yes           |
| 13  | button "Copy results"                                      | yes           |
| 14  | a "How we review"                                          | no            |
| 15  | summary "The formula"                                      | no            |
| 16  | summary "A worked example"                                 | no            |
| 17  | div "Compare scenarios, scrollable table"                  | no            |
| 18  | summary "How is a monthly mortgage payment calculated?"    | no            |
| 19  | summary "Does this payment include property tax and homeo" | no            |
| 20  | summary "How much interest will I pay over a 30-year mort" | no            |
| 21  | summary "Is a 15-year or a 30-year mortgage better?"       | no            |
| 22  | a "All finance calculators"                                | no            |
| 23  | a "Compound Interest Calculator"                           | no            |
| 24  | a "BMI Calculator"                                         | no            |
| 25  | a "Age Calculator"                                         | no            |
| 26  | a "Percentage Calculator"                                  | no            |
| 27  | a "Everyday life"                                          | no            |
| 28  | a "Finance"                                                | no            |
| 29  | a "Health"                                                 | no            |
| 30  | a "Math"                                                   | no            |
| 31  | a "About"                                                  | no            |
| 32  | a "Contact"                                                | no            |
| 33  | a "Editorial policy"                                       | no            |
| 34  | a "How we make money"                                      | no            |
| 35  | a "Privacy"                                                | no            |
| 36  | a "Terms"                                                  | no            |
| 37  | a "Ad disclosure"                                          | no            |
| 38  | a "Accessibility"                                          | no            |
| 39  | a "DMCA"                                                   | no            |

## Not tested

- **No screen reader was used.** NVDA, JAWS, VoiceOver and TalkBack have not been run against the site. The live-region behaviour is tested by reading the region's text in a browser, not by listening. (Tracker item 15.7.)
- **No person with a disability has tried the site**, and there has been no audit by an accessibility specialist.
- **Only Chrome** was used. Safari and Firefox behaviour of the native date input and select controls has not been checked.
- **200% zoom was approximated** by a 640 px viewport, not by browser zoom, and text-only enlargement (WCAG 1.4.4) was not tried separately.
- **Windows High Contrast / forced colours** was not checked.
- **Formulas** are typeset with KaTeX and are also written out in words, but how a screen reader reads the math markup is untested.
- **The advertisement** is a third party's content; its accessibility cannot be tested until an ad network is chosen.
- **Not in CI yet:** `npm run a11y` runs in the held pull request #19, not on main.
