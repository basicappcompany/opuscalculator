import type { HubContent } from './types';

const hub: HubContent = {
  category: 'construction',
  title: 'Construction Calculators: Concrete, Paint and Materials',
  metaDescription:
    'Free construction calculators for concrete, paint and building materials, with allowances for waste explained, so you buy the right amount the first time.',
  h1: 'Construction Calculators',
  lede: 'Buying too little material stops a job and buying too much wastes money, so most construction calculations are really about getting a quantity right before you order. The mathematics is geometry, areas and volumes, with an allowance for waste. These calculators handle the arithmetic and explain the assumptions behind it, so you can adjust them to your site.',
  sections: [
    {
      heading: 'What construction calculations are used for',
      paragraphs: [
        'The core task is estimating quantities. How much concrete fills a slab, how much paint covers a room, how many boards, tiles or bricks a wall needs. Each of these starts with a measurement of length, area or volume and ends with a number of units to buy: bags, litres, sheets or pallets.',
        'Homeowners use these estimates to price a project and to avoid repeated trips to a supplier. Contractors use them to quote work and to order materials with a sensible margin. Students in construction and design courses use them to practise the translation between a drawing and a purchase.',
        'A quantity estimate is also the first step in a cost estimate. Once you know how much material you need, you can multiply by prices, add labour and see whether a project fits the budget, which is why an error at the quantity stage carries through to every later number.',
      ],
    },
    {
      heading: 'How the formulas relate to each other',
      paragraphs: [
        'Most of these calculators use the same few geometric ideas. Volume is length times width times depth, used for slabs, footings and fill. Area is length times width, used for painting, flooring and wall coverings, with openings subtracted. Perimeter is used for edging, skirting and fencing. Everything else is a conversion from those geometric quantities into the units that suppliers sell.',
        'The conversion step is where the tools differ. Concrete is sold by the cubic metre or yard in bulk, and in bags of a known yield for small jobs, so the calculator divides the volume by the yield of one bag. Paint is sold by the litre or gallon, with a stated coverage per unit, so the calculator divides the paintable area by that coverage and multiplies by the number of coats.',
        'Allowances connect them all. Real jobs lose material to cutting, spillage, uneven surfaces and mistakes, so a sensible estimate adds a percentage for waste. The amount varies by material and by how complex the job is, but the principle is the same: calculate the exact need, then add a margin.',
        "This means a good estimate has three layers: the geometry, the supplier's conversion factor and the waste allowance. If you understand each layer, you can adjust any of them for your own project.",
      ],
    },
    {
      heading: 'Common mistakes people make',
      paragraphs: [
        'The first mistake is mixing units. Dimensions measured in feet and inches, and a depth given in inches, must be converted to a consistent unit before multiplying. A slab four inches deep is a third of a foot, and forgetting that conversion changes the volume by a large factor.',
        'A second mistake is ignoring openings and obstructions, or the reverse. For painting, subtracting every window and door makes the estimate too tight if you also need a second coat and some spare for touch-ups. A common practice is to subtract large openings, keep the rest as part of the margin, and round up.',
        'Third, forgetting that quoted coverage is an ideal. A coverage rate on a paint tin assumes a smooth, previously painted surface. Rough, porous or very dark surfaces absorb more. Concrete bag yields are likewise approximate, and depth is rarely perfectly uniform, so ground that is uneven needs extra.',
        'Fourth, not rounding up. You cannot buy a fraction of a bag, and a shortfall often means mixing a new batch that will not match, or an extra delivery fee. Round up to the next whole unit, and consider buying one more if you cannot easily return surplus.',
        'Finally, treating an estimate as a specification. These calculators give typical quantities. They do not account for structural requirements, reinforcement, drainage, ground conditions or local building codes, so a structural element needs proper design by a qualified person.',
      ],
    },
    {
      heading: 'Who benefits from these calculators',
      paragraphs: [
        'Homeowners and renters tackling a project themselves benefit the most. Anyone comparing the cost of doing a job themselves against hiring it out also gains, because an accurate bill of materials is the starting point for that comparison. A clear quantity before shopping prevents the two most irritating outcomes of a weekend project: running out halfway through, and a garage full of leftover material.',
        'Small contractors and tradespeople benefit from a fast cross-check on a quote. Even experienced professionals use calculators to verify a figure, particularly for unfamiliar shapes or materials.',
        "Students and apprentices benefit from the transparency: each calculator shows how the volume or area is found and how the supplier's unit is applied, so the logic can be reproduced by hand.",
        'These tools provide estimates only. Verify quantities and materials with a licensed contractor and your local building codes before you buy or build, particularly for anything structural, anything involving load or safety, and any work that needs a permit.',
      ],
    },
  ],
  subclusters: [
    {
      label: 'Concrete and masonry',
      blurb: 'Volumes and bag counts.',
      slugs: ['concrete-calculator'],
    },
    {
      label: 'Finishing',
      blurb: 'Surface coverage for paints and coatings.',
      slugs: ['paint-calculator'],
    },
  ],
  featured: [
    {
      slug: 'concrete-calculator',
      blurb:
        'Turns the length, width and thickness of a slab, path or footing into cubic yards, cubic feet and cubic metres, with a waste allowance, plus a count of 60 lb and 80 lb bags. It is the right tool when you need to know how much to order for a pour.',
    },
    {
      slug: 'paint-calculator',
      blurb:
        'Estimates the paint needed for a room from its length, width and ceiling height, the doors and windows to leave out, the number of coats and the coverage of your paint. It reports litres and gallons, and the whole gallons to buy.',
    },
  ],
  guide: [
    {
      situation: 'You are pouring a slab, path or footing',
      slug: 'concrete-calculator',
      advice: 'Measure the depth in the same unit as the length and width, and add a margin for uneven ground.',
    },
    {
      situation: 'You are painting a room',
      slug: 'paint-calculator',
      advice: 'Count the coats you really need, since two coats on a dark wall doubles the paint.',
    },
  ],
};

export default hub;
