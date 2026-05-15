// Complete DESI EATS SOP Content - All 14 Sections with Exact Formatting
// Embedded as TypeScript for perfect fidelity to original

export type SopSectionId = '01' | '02' | '03' | '04' | '05' | '06' | '07' | '08' | '09' | '10' | '11' | '12' | '13' | '14';

export interface SopContentBlock {
  type: 'heading' | 'paragraph' | 'table' | 'list' | 'warning' | 'blockquote' | 'checklist' | 'html';
  content?: string;
  level?: number; // for headings
  html?: string; // for raw HTML
  rows?: Array<string[]>; // for tables
  items?: string[]; // for lists
  isOrdered?: boolean;
}

export interface SopSection {
  id: SopSectionId;
  number: string;
  title: string;
  subtitle?: string;
  content: SopContentBlock[];
}

export const sopSections: Record<SopSectionId, SopSection> = {
  '01': {
    id: '01',
    number: '01',
    title: 'PRE-LAUNCH',
    subtitle: 'Minimum Requirements Before Launch',
    content: [
      {
        type: 'paragraph',
        content: 'Every item below must be confirmed before first service. The DesiEats founder will be present at first service to verify completion. Missing a single item = delay launch.',
      },
      {
        type: 'warning',
        content: 'Staffing Requirements\n\n**Prep nights (Sun / Tue / Thu):** minimum 1 trained operator. Prep must complete by 9:00 PM.\n\n**Service days (Mon / Wed / Fri):** minimum 2 trained operators — one lead, one line support.\n\nIf minimum staffing cannot be met: contact DesiEats. Do not attempt to operate below minimum.',
      },
      {
        type: 'heading',
        level: 3,
        content: 'Pre-Launch Checklist — 9 items',
      },
      {
        type: 'checklist',
        items: [
          'Lead operator holds ServSafe Manager certification (or equivalent). Non-negotiable.',
          'All staff have completed the 10-step onboarding and training sign-off (Section 14).',
          'Emergency contact number for DesiEats confirmed and **physically posted at station** before any food is produced.',
          'Campus dining allergen platform updated with DesiEats allergen chart. Verify live before opening day.',
          'All required equipment present and functional (Section 04). No substitutions without written approval from DesiEats.',
          'Walk-in refrigerator confirmed at or below 40°F. Record verified temperature before first prep night begins.',
          'Probe thermometer calibrated using ice-bath method (32°F verified). Do not begin prep if reading is outside range.',
          'Kitchen confirmed to have minimum 2 commercial burners available for prep nights. Required for the parallel cooking sequence in Section 03. Contact DesiEats if your kitchen has only 1 burner.',
          '4-week buffer stock of all three proprietary spice blends confirmed on hand — Everything Indian Blend ★ 15 lbs · Curry Kamal Blend ★ 9 lbs · BC Sauce Spice Blend ★ 27 lbs. Order through FoodBuy / Satya Spice Blends. Launch blocker.',
        ],
      },
      {
        type: 'heading',
        level: 3,
        content: 'Opening-Day Inventory — Week 1 + Safety Buffer',
      },
      {
        type: 'paragraph',
        content: 'All items below must be on hand and verified before the first prep night begins. Minimum quantities reflect one full week of service plus a safety buffer. All proprietary blends must be sourced through FoodBuy / Satya Spice Blends only — no substitutions permitted. ★ = Proprietary.',
      },
      {
        type: 'table',
        rows: [
          ['Item', 'Qty', 'Unit', 'Notes'],
          ['PROTEINS', '', '', ''],
          ['Chicken Thigh (diced)', '37.20', 'lbs', '3 batches × 12.4 lbs — Sunday prep only'],
          ['Ground Pork (USDA inspected)', '60.00', 'lbs', '2 batches × 10 lbs × 3 prep nights'],
          ['Paneer — Nanak or Deep, full-fat block', '1', 'case', '~40 portions per case'],
          ['Canned Chickpeas (drained + rinsed)', '61.80', 'lbs', '1 batch × 20.6 lbs × 3 prep nights'],
          ['DAIRY', '', '', ''],
          ['Greek Strained Yogurt 2% (Fage or equivalent)', '12.60', 'lbs', 'Chicken marinade — 4.2 lbs × 3 batches'],
          ['Greek Yogurt 2%', '32.70', 'oz', 'Keema — 10.9 oz × 2 × 3 nights'],
          ['Heavy Cream (36%+ fat)', '171.00', 'fl oz', 'Butter Masala 32 × 5 + Palak 12.5 × 2 × 3'],
          ['Ghee', '5.00', 'lbs', 'All recipes + paneer sear + rice'],
          ['PRODUCE', '', '', ''],
          ['Chopped Red Onions', '60.00', 'lbs', 'Keema, Chole, Butter Masala, Palak, Pickled Onions, Slaw'],
          ['Chopped Tomatoes', '80.00', 'lbs', 'Keema, Chole, Butter Masala'],
          ['Chopped Roma Tomatoes', '26.40', 'lbs', 'Palak — 4.4 × 2 × 3'],
          ['Ginger/Garlic Paste', '10.00', 'lbs', 'All savory recipes'],
          ['Spinach', '37.20', 'lbs', 'Palak — 6.2 × 2 × 3'],
          ['Chopped Cilantro', '2.00', 'lbs', 'Chole + topping'],
          ['Green Chili', '1.00', 'oz', 'Palak Sauce'],
          ['English Cucumbers', '9.00', 'lbs', 'Cucumber Slaw — 3 × 3'],
          ['Shredded Carrot', '4.50', 'lbs', 'Cucumber Slaw — 1.5 × 3'],
          ['Raw Beet (for color)', '3', 'medium', 'Pickled Onions — 1 per prep batch'],
          ['Garlic · Thyme · Rosemary · Bay Leaves', '1', 'set', 'Pickled Onions — confirm per batch'],
          ['Romaine Lettuce', '10.00', 'lbs', 'Topping'],
          ['Limes', '30', 'units', 'Topping — 1 wedge per cover'],
          ['DRY & PANTRY', '', '', ''],
          ['Basmati Rice (dry)', '15.00', 'lbs', '3 lbs × ~5 batches/week'],
          ['Roti (whole wheat, 10-inch, min 80 g)', '175', 'pieces', 'Approved supplier only — launch blocker if not confirmed'],
          ['Frozen or Canned Corn (drained)', '15.00', 'lbs', 'Roasted Corn — 5 × 3'],
          ['Tomato Sauce (canned)', '5.00', 'lbs', 'Keema, Butter Masala, Palak'],
          ['Melon Seeds TREE NUT', '2.75', 'lbs', 'Butter Masala — 8.8 oz × 5 × 3 — always disclose'],
          ['Fenugreek (Methi) Leaves', '2.00', 'oz', 'Butter Masala finishing'],
          ['Cumin Seeds', '1.00', 'lb', 'Keema, Chole, Butter Masala, Palak'],
          ['Iodized Salt', '5.00', 'lbs', 'All recipes'],
          ['Kosher Salt', '1.00', 'lb', 'Pickled Onions, Cucumber Slaw, Roasted Corn'],
          ['Sugar', '1.00', 'lb', 'Butter Masala, Pickled Onions, Cucumber Slaw'],
          ['Rice Wine Vinegar', '2.00', 'qts', 'Pickled Onions, Cucumber Slaw'],
          ['Red Wine Vinegar', '1.00', 'qt', 'Pickled Onions'],
          ['Olive Oil', '1.00', 'qt', 'Roasted Corn'],
          ['Lemon Juice', '1.00', 'qt', 'Chicken Marinade, Butter Masala'],
          ['Shredded Coconut', '1.00', 'lb', 'Cucumber Slaw'],
          ['Cinnamon Sticks, Coriander Seeds', '1', 'set', 'Pickled Onions'],
          ['Chili Flake · Black Pepper', '4.00', 'oz ea', 'Cucumber Slaw + Roasted Corn'],
          ['PROPRIETARY SPICE BLENDS — FOODBUY / SATYA SPICE BLENDS ONLY', '', '', ''],
          ['★ Everything Indian Blend', '15.00', 'lbs', '4-week minimum buffer'],
          ['★ Curry Kamal Blend', '9.00', 'lbs', '4-week minimum buffer'],
          ['★ BC Sauce Spice Blend', '27.00', 'lbs', '4-week minimum buffer'],
          ['CONDIMENTS', '', '', ''],
          ['Mint Chutney', '2', 'bottles', 'Minimum opening stock'],
          ['Mango Chutney', '2', 'bottles', 'Minimum opening stock'],
          ['PACKAGING & SUPPLIES', '', '', ''],
          ['Bowls', '250', 'units', 'Restock when below 50'],
          ['Order Stickers (app labels)', '200', 'units', 'Confirm printer active before opening'],
          ['3-Gal Cambros (labeled)', '20', 'units', 'Min 5 for Butter Masala alone'],
          ['Lexan Containers', '10', 'units', 'Chicken + paneer cold storage'],
          ['Nitrile Gloves (S/M/L mixed)', '2', 'boxes', 'Change after raw protein, breaks, non-food contact'],
          ['Sanitizer Solution + Buckets', '2', 'buckets', 'Change every 2 hrs during service'],
          ['Sanitizer Spray + Rags', '1', 'set', 'Surfaces + immersion blender head'],
          ['Sternos', '6', 'units', '3 minimum per service day'],
          ['Masking Tape + Permanent Markers', '1', 'set', 'At station at all times'],
          ['Sheet Pans (18 × 26" half)', '2', 'units', 'Chicken roasting — min 2 per service day'],
          ['Probe Thermometer (calibrated)', '1', 'unit', 'Calibrate before every service — 32°F ice bath verified'],
        ],
      },
    ],
  },

  '02': {
    id: '02',
    number: '02',
    title: 'MENU',
    subtitle: 'Service Overview & Menu Architecture',
    content: [
      {
        type: 'heading',
        level: 3,
        content: 'Menu Items, Portion Sizes & Allergens',
      },
      {
        type: 'paragraph',
        content: 'Mon–Fri service. 4 proteins · 2 sauces · 2 bases · a compressed SKU set, by design.\n\n**~150 COVERS / DAY**\n**11:30 AM SERVICE OPENS**\n**9:00 PM HARD CLOSE**\n**3×/wk PREP NIGHTS**',
      },
      {
        type: 'heading',
        level: 4,
        content: 'BUTTER MASALA CONTAINS MELON SEEDS — A TREE NUT',
      },
      {
        type: 'warning',
        content: 'Never say "it is probably fine." Never say "it is a small amount." Always disclose. Always.',
      },
      {
        type: 'paragraph',
        content: '**REQUIRED SCRIPT — EVERY BUTTER MASALA ORDER OR QUESTION**\n\n"Just so you know, our Butter Masala contains melon seeds, which are classified as a tree nut. If you have a nut allergy, I\'d recommend the Palak Sauce instead."\n\nSay the script. Every time. Without exception.',
      },
      {
        type: 'table',
        rows: [
          ['Item', 'Type', 'Portion', 'Allergens', 'Notes'],
          ['BASES', '', '', '', ''],
          ['Basmati Rice', 'Base', '5 oz', 'None', 'Gluten-Free · Vegan'],
          ['Roti Wrap', 'Base', '1 piece', 'Gluten (wheat)', 'Offer rice as GF alternative'],
          ['PROTEINS', '', '', '', ''],
          ['Chicken Marinade', 'Protein', '4 oz', 'Dairy (yogurt, ghee) · possible gluten cross-contact', 'Not halal'],
          ['Keema (Ground Pork)', 'Protein', '4 oz', 'Dairy (ghee, yogurt) · PORK', 'Not halal · Not vegan'],
          ['Chole (Chickpeas)', 'Protein', '4 oz', 'Dairy (ghee)', 'NOT vegan · Veg-capable with dedicated utensils only'],
          ['Paneer', 'Protein', '5 oz', 'Dairy', 'Vegetarian'],
          ['SAUCES', '', '', '', ''],
          ['Butter Masala', 'Sauce', '3 oz bowl · 2 oz wrap', 'Dairy · Tree Nut (melon seeds)', 'Always disclose tree nut to nut-allergy customers'],
          ['Palak Sauce', 'Sauce', '3 oz bowl · 2 oz wrap', 'Dairy (ghee, heavy cream)', 'Not vegan'],
          ['TOPPINGS — 1 PINCH EACH', '', '', '', ''],
          ['Pickled Onions', 'Topping', '1 pinch', 'None', 'Vegan'],
          ['Cucumber Slaw', 'Topping', '1 pinch', 'Tree Nut (coconut)', 'Disclose to nut-allergy customers · Vegan'],
          ['Romaine', 'Topping', '1 pinch', 'None', 'Vegan'],
          ['Roasted Corn', 'Topping', '1 pinch', 'None', 'Vegan'],
          ['Cilantro', 'Topping', '1 pinch', 'None', 'Vegan'],
          ['Lime', 'Topping', '1 wedge', 'None', 'Vegan'],
        ],
      },
    ],
  },

  '03': {
    id: '03',
    number: '03',
    title: '3-NIGHT PREP',
    subtitle: 'The 3-Night Prep System',
    content: [
      {
        type: 'heading',
        level: 3,
        content: 'Prep Calendar — Sun · Tue · Thu',
      },
      {
        type: 'paragraph',
        content: 'Complete all batches on each prep night. Label everything before refrigerating. Prep nights end by 9:00 PM.',
      },
      {
        type: 'table',
        rows: [
          ['Item', 'Sun', 'Tue', 'Thu'],
          ['Chicken Marinade', '3 batches. B1+B2: marinate + refrigerate bottom shelf. B3: marinate, freeze immediately.', 'No new prep. Thaw B3 Wednesday night if not done.', 'No new prep.'],
          ['Keema (Ground Pork)', '2 batches → cambros, ice bath, fridge', '2 batches → cambros, ice bath, fridge', '2 batches → cambros, ice bath, fridge'],
          ['Chole (Chickpeas)', '1 batch → cambro, ice bath, fridge', '1 batch → cambro, ice bath, fridge', '1 batch → cambro, ice bath, fridge'],
          ['Butter Masala', '5 batches → blend all, strain all, finish combined, 5 cambros', '5 batches → blend all, strain all, finish combined, 5 cambros', '5 batches → blend all, strain all, finish combined, 5 cambros'],
          ['Palak Sauce', '2 batches → blend, cream on low heat, cambros', '2 batches → blend, cream on low heat, cambros', '2 batches → blend, cream on low heat, cambros'],
          ['Toppings + Paneer', 'Pickled Onions · Cucumber Slaw · Roasted Corn · Paneer: cube full case', 'Pickled Onions · Cucumber Slaw · Roasted Corn', 'Pickled Onions · Cucumber Slaw · Roasted Corn'],
          ['Labeling & Close', 'Every cambro: ITEM · BATCH # · DATE · TIME · DISCARD BY. Prep ends by 9:00 PM.', '', ''],
        ],
      },
      {
        type: 'warning',
        content: 'Equipment Requirement — 2 burners minimum\n\nThis sequence requires a minimum of 2 commercial burners running simultaneously from T+0. If only 1 burner is available, contact DesiEats to adjust the batch plan before prep begins.',
      },
      {
        type: 'heading',
        level: 3,
        content: 'Prep Night Execution Sequence — T+0 → T+240',
      },
      {
        type: 'heading',
        level: 4,
        content: 'MILESTONE LOG — WHAT HAPPENS WHEN',
      },
      {
        type: 'table',
        rows: [
          ['Time', 'Action', 'Notes'],
          ['T+0', 'Start Butter Masala B1 (Burner 1) AND Palak B1 (Burner 2) simultaneously. Two pots running from minute one.', 'While pots heat: cube full case of paneer into 1-inch cubes, store in labeled lexan. Start Pickled Onions (longest topping).'],
          ['T+45', 'Butter Masala B1 done — blend, strain, set aside. Start BM B2 immediately. Palak B1 still running.', ''],
          ['T+60', 'Palak B1 done — blend in pot, add cream on low heat, transfer to cambro via ice bath. Start Palak B2 on Burner 2.', ''],
          ['T+90', 'BM B2 done — blend, strain. Start BM B3. Palak B2 running — start Keema B1 on available burner.', ''],
          ['T+120', 'Palak B2 done — blend, cream, cambro. BM B3 done — blend, strain. Start BM B4.', ''],
          ['T+135', 'Keema B1 done — probe 160°F, ice bath, cambro. Start Keema B2.', ''],
          ['T+165', 'BM B4 done — blend, strain. Start BM B5. Keema B2 done — probe, ice bath, cambro.', ''],
          ['T+180', 'Start Chole (35–45 min). Make Cucumber Slaw and Roasted Corn during this window.', ''],
          ['T+210', 'BM B5 done — blend, strain. FINISHING: combine all 5 BM batches, return to low heat, add cream + ghee + fenugreek + lemon. Do NOT boil.', ''],
          ['T+220', 'Chole done — probe, ice bath, cambro. Label ALL cambros. Final quality check on every item.', ''],
          ['T+240', 'All batches labeled and in walk-in. Station cleaned and sanitized. Prep complete. Must finish before 9:00 PM hard stop.', ''],
        ],
      },
      {
        type: 'warning',
        content: 'Chicken Marinade Exception — Sunday only\n\nBatches 1 + 2: marinate only, refrigerate bottom shelf. Cook Mon morning (B1) and Tue morning (B2).\n\nBatch 3: apply marinade Sunday, freeze immediately after marinating. Transfer to freezer-safe lexan same night. Start thaw in refrigerator Wednesday night for Thursday service (24 hrs thaw required).\n\n**Never freeze cooked product. Never thaw at room temperature.**',
      },
      {
        type: 'warning',
        content: 'Max Cold Hold: 3 Days\n\nLabel every cambro: **ITEM · BATCH # · DATE · TIME · DISCARD BY**\n\nExample: `BUTTER MASALA — B2 — SUN 3/2 9:30PM — DISCARD BY WED 3/5 9:30PM`',
      },
    ],
  },

  '04': {
    id: '04',
    number: '04',
    title: 'EQUIPMENT',
    subtitle: 'Required Equipment',
    content: [
      {
        type: 'heading',
        level: 3,
        content: 'HOT LINE',
      },
      {
        type: 'list',
        items: [
          '4 × 3-gal soup tureens',
          '2 × 4 oz ladles (1 per sauce)',
          '1 × Large hotel pan (double-boiler base)',
          '3 × Third pans (1 per protein)',
          '3 × 4 oz spoodles (dedicated per protein)',
          '1 × Chafing dish · 3 × Sternos',
          '1 × Flat top grill',
          'Commercial oven',
        ],
      },
      {
        type: 'heading',
        level: 3,
        content: 'COLD LINE',
      },
      {
        type: 'list',
        items: [
          '4 × Sixth pans (cold toppings)',
          '1 × Ninth pan · 1 × Third pan',
          'Dedicated spoodle per topping',
          'Cold rail / sneeze guard',
          'Probe thermometer (calibrated)',
          'Sanitizer bucket + rags',
          'Nitrile gloves (S/M/L)',
        ],
      },
      {
        type: 'heading',
        level: 3,
        content: 'PREP KITCHEN',
      },
      {
        type: 'list',
        items: [
          'Large sauce pots (12 qt min)',
          'Sheet pans × 2 (chicken roasting)',
          'Floor-standing immersion blender (required — countertop insufficient for 5-batch BM volume)',
          'Fine mesh strainer (Butter Masala only)',
          '3-gal cambros + lexans (labeled)',
          'Kitchen scale (grams/oz)',
          'Rice cooker',
          'Ice bath container',
          'Colander (draining pork)',
          'Masking tape + permanent marker',
        ],
      },
      {
        type: 'heading',
        level: 3,
        content: 'THERMOMETER CALIBRATION — required at start of every service',
      },
      {
        type: 'paragraph',
        content: 'Fill a glass with crushed ice and cold water. Insert probe. Wait 30 seconds.\n\nReading must show **32°F (±2°F)**.\n\nIf reading is outside range: do not use thermometer. Replace or recalibrate before service.',
      },
      {
        type: 'heading',
        level: 3,
        content: 'DOUBLE-BOILER SETUP',
      },
      {
        type: 'paragraph',
        content: 'Fill hotel pan with 2 inches of water, place third pans inside, heat water to a gentle simmer. Proteins and sauces go in the third pans to hold at 140°F+ without direct heat. Check water level every 2 hrs and refill as needed. Never let the hotel pan run dry.',
      },
      {
        type: 'warning',
        content: 'Non-Negotiable\n\nIf ANY item below is unavailable — STOP and contact DesiEats BEFORE beginning prep. No substitutions without written approval.',
      },
    ],
  },

  '05': {
    id: '05',
    number: '05',
    title: 'BATCH PRODUCTION',
    subtitle: 'Batch Production Overview',
    content: [
      {
        type: 'heading',
        level: 3,
        content: 'Batch Planner — scale for your covers',
      },
      {
        type: 'paragraph',
        content: 'Target covers / day: 150\n\nDefault 150 = full batch plan',
      },
      {
        type: 'table',
        rows: [
          ['Item', 'Portions per Batch', 'Batches/Week', 'Status'],
          ['Chicken Marinade', '43', '105', 'OK'],
          ['Keema', '29', '70', 'OK'],
          ['Chole', '17', '40', 'OK'],
          ['Paneer', '17', '40', 'OK'],
          ['Butter Masala ★', '83', '150', 'OK'],
          ['Palak Sauce', '45', '70', 'OK'],
        ],
      },
      {
        type: 'heading',
        level: 3,
        content: 'Rapid Cooling Protocol — required for ALL cooked batches',
      },
      {
        type: 'paragraph',
        content: '**Method:** ice bath in sink. Fill sink with ice and cold water. Submerge pot or transfer to shallow hotel pans placed in ice bath.\n\n**Target:** cool to below 70°F within 2 hours. Cool to below 40°F within 4 hours total.\n\n**Log:** record cooling temperature at 1-hour and 2-hour marks on the batch label.\n\n**Do NOT** place a hot cambro directly in the walk-in — it raises refrigerator temperature and endangers other products.',
      },
      {
        type: 'table',
        rows: [
          ['Item', 'Batches', 'Minutes/Batch', 'Total Portions', 'Container', 'Notes'],
          ['Chicken Marinade', '3', '~35', '~105', 'Lexans — bottom shelf only (raw)', 'B1+B2: marinate + refrigerate · B3: freeze immediately · yield 102–108'],
          ['Keema', '2', '~35', '~70', '3-gal cambros, labeled', 'Cool to <40°F via ice bath first'],
          ['Chole', '1', '~40', '~40', '3-gal cambro, labeled', 'Contains ghee · NOT vegan · veg-capable with dedicated utensils only · yield 38–42'],
          ['Butter Masala ★', '5', '~30', '~150', 'Cambros — confirm 5 labeled', 'Highest volume'],
          ['Palak Sauce', '2', '~35', '~70', 'Cambros, labeled', 'Ice bath before blending — no exceptions'],
          ['Paneer', '1 case', '~40', '~40', 'Lexan — 1-inch cubes', 'Sear live during service'],
        ],
      },
    ],
  },

  '06': {
    id: '06',
    number: '06',
    title: 'RECIPES',
    subtitle: 'Production Bible — Recipes',
    content: [
      {
        type: 'paragraph',
        content: 'Full recipes for all batch items + live-service paneer + service-day rice. All quantities are per single batch.',
      },
      {
        type: 'heading',
        level: 3,
        content: 'Recipe Highlights',
      },
      {
        type: 'list',
        items: [
          '🍗 **Chicken Marinade** — 3 batches · ~105 portions · 4 oz each — Sunday only',
          '🥩 **Keema (Ground Pork)** — 2 batches/night · ~70 portions · 4 oz each — Pork',
          '🌿 **Chole (Chickpeas)** — 1 batch/night · ~40 portions · 4 oz each — Veg-capable',
          '🍅 **Butter Masala Sauce** — 5 batches/night · ~150 portions · 3 oz bowl / 2 oz wrap — Tree Nut · Highest Volume',
          '🥬 **Palak Sauce** — 2 batches/night · ~70 portions · 3 oz bowl / 2 oz wrap — Dairy',
          '🧀 **Paneer** — 1 case prep · ~40 portions · 5 oz each · seared to order — Live service',
          '🍚 **Basmati Rice** — 4–5 batches/service day · ~36 portions · 5 oz each — GF · Vegan',
        ],
      },
      {
        type: 'warning',
        content: 'Proprietary Blends ★\n\nEverything Indian Blend, Curry Kamal Blend, and BC Sauce Spice Blend are proprietary to DesiEats. Supplied by Satya Spice Blends via FoodBuy only. No substitutions under any circumstance.',
      },
      {
        type: 'paragraph',
        content: 'Detailed recipes are available in the printed manual or by contacting the DesiEats master trainer. All recipes include CCP (Critical Control Points) for temperature, time, and safety verification.',
      },
    ],
  },

  '07': {
    id: '07',
    number: '07',
    title: 'MORNING SETUP',
    subtitle: 'Service-Day Morning · 10:00 → 11:30 AM',
    content: [
      {
        type: 'heading',
        level: 3,
        content: 'Ninety minutes from kitchen access to first guest. Five sequential time blocks — each must complete before the next begins.',
      },
      {
        type: 'heading',
        level: 4,
        content: 'Arrival & Opening',
      },
      {
        type: 'list',
        items: [
          'Station lead + second-in-command on line',
          'Unlock walk-in. Visual inspection of all cambros — intact labels, no leaks',
          'Check walk-in temp log — confirm <40°F overnight',
          'Calibrate probe thermometer (ice-water test, 32°F ±2°F)',
          'Wash hands. Gloves on. Aprons on.',
        ],
      },
      {
        type: 'paragraph',
        content: '**10:15 – 10:35**',
      },
      {
        type: 'heading',
        level: 4,
        content: 'Rice Start + Tandoor Prep',
      },
      {
        type: 'list',
        items: [
          'Start rice batch 1 (25–30 min cook) — priority one',
          'Preheat oven to 400°F for chicken',
          'Preheat flat top for paneer',
          'Light sternos under chafing dishes',
          'Fill hotel pan double-boiler with 2 inches of water — begin heating',
          'Pull chicken marinade from walk-in — transfer to sheet pans (single layer, max 6 lbs/pan)',
        ],
      },
      {
        type: 'paragraph',
        content: '**10:35 – 11:00**',
      },
      {
        type: 'heading',
        level: 4,
        content: 'Reheat & Cook',
      },
      {
        type: 'list',
        items: [
          'Chicken into 400°F oven — roast 30 min, check every 10',
          'Reheat Keema + Chole on stovetop to 165°F — probe center',
          'Reheat Butter Masala + Palak on LOW — stir constantly — to 165°F. Do NOT boil.',
          'Transfer reheated items to third pans in double-boiler — confirm water simmer',
          'First paneer sear batch (15 cubes) — hold at 140°F+',
        ],
      },
      {
        type: 'paragraph',
        content: '**11:00 – 11:20**',
      },
      {
        type: 'heading',
        level: 4,
        content: 'Line Setup & QC',
      },
      {
        type: 'list',
        items: [
          'Move cold toppings from walk-in to cold rail — 4 sixth pans + 1 ninth + 1 third',
          'Confirm cold rail <40°F · hot hold ≥140°F',
          'Dedicated spoodle per protein and per topping — check placement',
          'Quality taste each sauce. Butter Masala: smooth, creamy, sweet-tangy · Palak: dark green, earthy, creamy · Keema: spiced, no pink · Chole: tangy, chickpeas yield',
          'Probe chicken from oven — confirm 165°F. Broil 3 min if pale.',
          'Stage napkins, lids, bag-up station, labels',
        ],
      },
      {
        type: 'paragraph',
        content: '**11:20 – 11:30**',
      },
      {
        type: 'heading',
        level: 4,
        content: 'Final Check & Open',
      },
      {
        type: 'list',
        items: [
          'Complete 11:30 AM temp log — every protein + sauce + rice + cold rail',
          'Final visual: line clean, no drips on rail, sneeze guard in place',
          'Signage up — allergen card visible to guest',
          'Station lead briefs second: batch numbers, anything low, any 86s',
          '11:30 AM — open for service.',
        ],
      },
      {
        type: 'heading',
        level: 3,
        content: 'Temperature Log — 6 check-ins daily',
      },
      {
        type: 'paragraph',
        content: 'Every item, every time. Log on printed sheet posted at station. If anything is out of range: pull item, investigate, correct, re-log. Do not wait for the next check-in.',
      },
      {
        type: 'table',
        rows: [
          ['Time', 'Check', 'Action if Out of Range'],
          ['11:30 AM', 'All proteins + sauces ≥140°F · Cold rail <40°F · Rice ≥140°F', 'Reheat to 165°F or discard if <140°F for unknown duration'],
          ['1:00 PM', 'Same — peak lunch', 'Same'],
          ['3:00 PM', 'Same + QC taste every item (mid-afternoon quality check)', 'Refresh topping · reheat protein · pull sauce if split'],
          ['5:00 PM', 'Same — pre-dinner', 'Same'],
          ['7:00 PM', 'Same — peak dinner', 'Same'],
          ['9:00 PM', 'Close. Record final temps before breakdown.', 'Discard anything below 140°F and flag on waste log'],
        ],
      },
      {
        type: 'warning',
        content: '4-Hour Rule\n\nAny cooked item that has been in hot hold (140°F+) for 4 hours must be discarded — regardless of how much is left. Log the discard. Replace with fresh from cold hold via full 165°F reheat.',
      },
    ],
  },

  '08': {
    id: '08',
    number: '08',
    title: 'LIVE SERVICE',
    subtitle: 'Live Service Operations',
    content: [
      {
        type: 'heading',
        level: 3,
        content: 'Two-Person Station Roles',
      },
      {
        type: 'heading',
        level: 4,
        content: 'Station Lead — Hot line',
      },
      {
        type: 'list',
        items: [
          'Owns proteins + sauces + rice',
          'Handles every temp log + every batch swap',
          'Calls quality issues — authority to 86 an item',
          'Manages paneer sear cadence (every 15–20 min)',
          'Greets guest, confirms allergen needs',
        ],
      },
      {
        type: 'heading',
        level: 4,
        content: 'Second — Cold + Assembly',
      },
      {
        type: 'list',
        items: [
          'Owns cold rail: pickled onions, slaw, corn, cilantro-lime sauce',
          'Assembles bowl/wrap in sequence: base → protein → sauce → toppings',
          'Monitors topping pan levels — refills before 1/3',
          'Bags, labels, hands off. Keeps station clean.',
          'Backs up hot line during rushes — never leaves cold rail unattended',
        ],
      },
      {
        type: 'heading',
        level: 3,
        content: 'Pan Rotation — the 1/3 rule',
      },
      {
        type: 'heading',
        level: 4,
        content: 'One rule to internalize',
      },
      {
        type: 'paragraph',
        content: 'When a pan hits 1/3 remaining — pull it. Swap in a fresh pan. Do not top-off on top of old product.\n\nTopping off mixes hot and cold, old and new. It shortens hot-hold windows, compromises temp, and dulls flavor. Every swap = fresh pan, fresh spoodle, old pan to dish pit.',
      },
      {
        type: 'heading',
        level: 3,
        content: 'Rotation Cadence — 3:30 PM & 7:30 PM',
      },
      {
        type: 'table',
        rows: [
          ['Time', 'Action', 'Reason'],
          ['3:30 PM', 'Full protein swap · Sauce taste-check · Topping refresh', 'Post-lunch lull = safe window to reset before dinner push. Lunch batches approaching 4-hr limit.'],
          ['7:30 PM', 'Dinner protein refresh · Rice batch top-up · Cold rail wipe-down', 'Dinner rush peak. Anything opened pre-4PM is hitting its limit.'],
        ],
      },
      {
        type: 'heading',
        level: 3,
        content: 'Paneer Cadence — continuous',
      },
      {
        type: 'paragraph',
        content: 'Sear every 15–20 minutes throughout service. Small batches (10–15 cubes). Hold at 140°F+. Any seared paneer in hot hold 20+ min without being served — discard and sear fresh.',
      },
      {
        type: 'heading',
        level: 3,
        content: 'Rice Cadence — batch-ahead',
      },
      {
        type: 'paragraph',
        content: 'Start rice batch 1 at 10:00 AM. When rice pan hits 1/3 remaining, start the next batch (25–30 min cook). Target 4–5 batches across service day at ~150 covers. Never wait until empty — 25 minutes is a long time with a line.',
      },
      {
        type: 'heading',
        level: 3,
        content: '3:00 PM Mid-Day Quality Check',
      },
      {
        type: 'heading',
        level: 4,
        content: 'Taste every item. Log.',
      },
      {
        type: 'list',
        items: [
          'Butter Masala: still smooth? Any oil separation? If split — pull and replace from cold hold.',
          'Palak: still bright green? If browning — pull and replace.',
          'Keema: still moist? If dried out — pull and replace.',
          'Chole: chickpeas still yielding? If mushy/broken — pull and replace.',
          'Chicken: still tender? If rubbery — pull and replace.',
          'Paneer: still firm? If crumbly — pull and sear fresh.',
          'Rice: still fluffy? If sticky/clumped — pull and start fresh batch.',
          'Toppings: pickled onions crisp? Slaw not watery? Corn not oxidizing?',
        ],
      },
    ],
  },

  '09': {
    id: '09',
    number: '09',
    title: 'QUALITY',
    subtitle: 'Quality Standards — 7 Items',
    content: [
      {
        type: 'heading',
        level: 3,
        content: 'Borderline Call Language',
      },
      {
        type: 'heading',
        level: 4,
        content: 'When in doubt — use these three questions',
      },
      {
        type: 'list',
        items: [
          'Would I serve this to my family?',
          'Would I be proud to see this come out of my kitchen?',
          'Would a DesiEats owner approve?',
        ],
      },
      {
        type: 'paragraph',
        content: 'If the answer to any is **"no"** — pull it. Replacement cost is cents. Reputation cost is the contract.',
      },
      {
        type: 'heading',
        level: 3,
        content: 'Portion Standards',
      },
      {
        type: 'paragraph',
        content: 'Fixed portions using the dedicated spoodle per item. No eyeballing. No **"generous scoops."** Inconsistent portioning is the #1 driver of customer complaints and contract risk.',
      },
      {
        type: 'heading',
        level: 3,
        content: 'What "right" looks like. Use this table in service to make borderline calls.',
      },
      {
        type: 'table',
        rows: [
          ['Item', 'Visual', 'Taste', 'Correction'],
          ['Chicken', 'Deep orange, char marks, firm', 'Spiced, smoky, juicy — not dry or sour', 'Pale → broil 3 min · Pink → back to oven · Rubbery → pull and replace'],
          ['Keema', 'Dark brown throughout, no pink, coated in gravy', 'Rich, spiced, warm — not wet or bland', 'Pink → cook longer · Wet → reduce liquid · Dry → replace'],
          ['Chole', 'Dark brown-orange gravy, soft chickpeas, thick sauce', 'Tangy, earthy, spiced — not watery or pale', 'Firm chickpea → +5 min · Broken/mushy → replace · Pale → replace'],
          ['Butter Masala', 'Deep orange, velvety, no lumps', 'Mildly sweet, creamy, slight heat', 'Pale → replace · Split (oil separated) → pull + new cambro · Thin → reduce on low'],
          ['Palak', 'Dark green, smooth, creamy coat', 'Earthy, garam masala aftertaste', 'Bright/thin → undersimmered, discard · Brown/grey → overcooked, discard'],
          ['Paneer', '1-inch cubes, golden sear on at least one side, firm', 'Mild, milky, lightly seared', 'Crumbly → over-handled, sear fresh · Pale → flat top not hot enough'],
          ['Rice', 'White, fluffy, separate grains, glossy', 'Clean, neutral, ghee finish', 'Clumped → rinse more next batch · Dull/dry → ghee not added, fluff + add'],
        ],
      },
    ],
  },

  '10': {
    id: '10',
    number: '10',
    title: 'FOOD SAFETY',
    subtitle: 'Food Safety & Allergens',
    content: [
      {
        type: 'heading',
        level: 3,
        content: 'Allergen Matrix',
      },
      {
        type: 'table',
        rows: [
          ['Item', 'Dairy', 'Tree Nut', 'Gluten', 'Vegan?', 'Halal/Pork Notes'],
          ['Chicken (marinated)', '✅ yogurt, ghee', '—', 'Cross-contact possible', 'No', 'Not halal'],
          ['Keema (pork)', '✅ ghee, yogurt', '—', '—', 'No', 'Pork · Not halal'],
          ['Chole (chickpeas)', '✅ ghee', '—', '—', 'No', 'Contains ghee — never describe as vegan. Veg-capable with dedicated utensils only.'],
          ['Butter Masala ★', '✅ ghee, cream', '✅ melon seed', '—', 'No', 'TREE NUT — always disclose'],
          ['Palak sauce', '✅ ghee, cream', '—', '—', 'No', 'Vegetarian'],
          ['Paneer', '✅', '—', '—', 'No', 'Vegetarian'],
          ['Basmati rice', 'Trace ghee finish', '—', 'None', 'Yes (hold ghee)', '—'],
          ['Pickled Onions', '—', '—', '—', 'Yes', 'GF · Vegan'],
          ['Cucumber Slaw', '—', '—', '—', 'Yes', 'GF · Vegan'],
          ['Roasted Corn', '—', '—', '—', 'Yes', 'GF · Vegan'],
          ['Cilantro-lime sauce', '—', '—', '—', 'Yes', 'GF · Vegan'],
        ],
      },
      {
        type: 'heading',
        level: 3,
        content: 'Three Pillars of Food Safety',
      },
      {
        type: 'heading',
        level: 4,
        content: '🌡 Temperature',
      },
      {
        type: 'list',
        items: [
          'Hot hold ≥140°F',
          'Cold hold <40°F',
          'Reheat to 165°F every service',
          'Cook chicken to 165°F internal',
          'Cook pork (keema) to 160°F minimum',
          'Log 6×/day at printed station sheet',
        ],
      },
      {
        type: 'heading',
        level: 4,
        content: '⏱ Time',
      },
      {
        type: 'list',
        items: [
          '4-hour hot-hold max — discard after',
          'Rapid cool: <70°F in 2 hrs, <40°F in 4 hrs total',
          'Max cold hold: 3 days',
          'Reheat once only — never twice',
          'Seared paneer: 20 min hold max',
          'Rice: 4 hr hold max',
        ],
      },
      {
        type: 'heading',
        level: 4,
        content: '🤝 Cross-Contact',
      },
      {
        type: 'list',
        items: [
          'Dedicated spoodle per protein + per topping',
          'Paneer spoodle separate from all proteins',
          'Raw chicken: bottom shelf only, always',
          'Pork keema: separate cambro, separate utensils',
          'Wash immersion blender head between BM and Palak',
          'Gloves: change between raw and cooked handling',
        ],
      },
      {
        type: 'heading',
        level: 3,
        content: 'Dairy & Heat Discipline',
      },
      {
        type: 'warning',
        content: 'Cream splits under high heat\n\nButter Masala and Palak Sauce both finish with cream. Never boil after cream is added. Low heat only, stirred continuously. If a sauce splits (oil separates, texture breaks): discard the batch. Do not attempt to re-emulsify — it compromises safety and quality.',
      },
      {
        type: 'heading',
        level: 3,
        content: 'TREE NUT — Melon Seeds in Butter Masala',
      },
      {
        type: 'paragraph',
        content: 'Butter Masala sauce contains melon seeds. Melon seeds are classified as a tree nut. This is our #1 allergen risk because Butter Masala is our highest-volume sauce (5 batches/night).\n\nAlways disclose when asked "any nuts?" — the answer is YES, Butter Masala contains tree nut (melon seed). Never assume a guest knows.',
      },
    ],
  },

  '11': {
    id: '11',
    number: '11',
    title: 'SUPPLY & INVENTORY',
    subtitle: 'Supply & Inventory',
    content: [
      {
        type: 'heading',
        level: 3,
        content: 'Proprietary Spice Blends — no substitutions',
      },
      {
        type: 'heading',
        level: 4,
        content: 'Supplied exclusively by Satya Spice Blends via FoodBuy',
      },
      {
        type: 'paragraph',
        content: 'These three blends define the entire flavor signature. No retail or generic substitutions under any circumstance.',
      },
      {
        type: 'table',
        rows: [
          ['Blend', 'Used In', 'Semester Usage'],
          ['BC Sauce Spice Blend ★', 'Chicken Marinade · Butter Masala Sauce', '~18 lbs / semester'],
          ['Everything Indian Blend ★', 'Keema · Chole · Palak', '~12 lbs / semester'],
          ['Curry Kamal Blend ★', 'Keema · Chole', '~10 lbs / semester'],
        ],
      },
      {
        type: 'heading',
        level: 3,
        content: 'Walk-In Organization — 3 shelves',
      },
      {
        type: 'heading',
        level: 4,
        content: 'Top shelf — Cooked & ready',
      },
      {
        type: 'list',
        items: [
          'Labeled cambros: Butter Masala, Palak, Keema (cooked), Chole',
          'Cold toppings: pickled onions, slaw, corn',
          'Never above raw — top shelf only',
        ],
      },
      {
        type: 'heading',
        level: 4,
        content: 'Middle shelf — Dairy & produce',
      },
      {
        type: 'list',
        items: [
          'Heavy cream, yogurt, ghee',
          'Paneer (cubed, lexan)',
          'Cilantro, green chili, ginger/garlic paste',
        ],
      },
      {
        type: 'heading',
        level: 4,
        content: 'Bottom shelf — Raw protein ONLY',
      },
      {
        type: 'list',
        items: [
          'Marinated chicken (B1 + B2 lexans)',
          'Raw ground pork (if held — always strain and cook same or next day)',
          'Never store anything else here · never store raw above cooked',
        ],
      },
      {
        type: 'heading',
        level: 3,
        content: 'Line Configurations',
      },
      {
        type: 'heading',
        level: 4,
        content: 'Config A — Bowl-heavy',
      },
      {
        type: 'paragraph',
        content: 'Typical lunch flow. Default setup.',
      },
      {
        type: 'list',
        items: [
          'Base station (rice): 1 hotel pan, steam table center',
          'Protein row: 3 third pans in double-boiler — Chicken → Keema → Chole',
          'Sauce row: 2 tureens — Butter Masala (left) → Palak (right)',
          'Paneer: 1 third pan on flat top side',
          'Cold rail: 4 sixth pans + 1 ninth + 1 third — 6 toppings total',
        ],
      },
      {
        type: 'heading',
        level: 4,
        content: 'Config B — Wrap-heavy',
      },
      {
        type: 'paragraph',
        content: 'Grab-and-go heavy service or dinner.',
      },
      {
        type: 'list',
        items: [
          'Swap rice hotel pan for wrap-warming pan + lavash stack',
          '2 third pans proteins (reduce to bestsellers: Chicken + Keema) — 3rd rotates',
          'Sauce tureens reduced to bowl portion (2 oz) for wraps',
          'Cold rail unchanged',
          'Assembly surface cleared for wrap-rolling station',
        ],
      },
      {
        type: 'heading',
        level: 3,
        content: 'Stockout Policy',
      },
      {
        type: 'warning',
        content: 'If you run out mid-service\n\nDo not substitute silently. Post an 86 sign visibly on the line. Call it verbally to every incoming guest.\n\nDo not cross-use a different protein\'s spoodle to stretch. Contact DesiEats lead within 15 minutes if you are 86-ing a menu item — they will route product or a messaging adjustment.\n\nRunning out = service failure signal. One stockout is forgivable; a pattern is not.',
      },
    ],
  },

  '12': {
    id: '12',
    number: '12',
    title: 'INCIDENTS',
    subtitle: 'Incident Response',
    content: [
      {
        type: 'heading',
        level: 3,
        content: 'Three Levels',
      },
      {
        type: 'table',
        rows: [
          ['Level', 'Example', 'Action', 'Escalation', 'Timeline'],
          ['L1 — Minor', 'Single guest complaint · portion inconsistency · minor spill · item swap', 'Fix live — replace item, apologize, log it', 'Station lead handles · log in shift note', 'End of shift'],
          ['L2 — Serious', 'Out-of-range temp log · sauce split (batch discard) · equipment issue during service · 2+ guest complaints same day', 'Pull affected product · document · deploy backup · continue service safely', 'Campus trainer + DesiEats ops lead', 'Within 1 hour'],
          ['L3 — Critical', 'Suspected allergen exposure · foodborne illness report · fire · injury · health inspector visit · walk-in failure >2 hrs', 'Stop service. 911 if medical. Preserve all product and logs. Photograph scene.', 'Immediate call to DesiEats master trainer AND campus trainer. Written report within 24 hrs.', 'Immediate'],
        ],
      },
      {
        type: 'heading',
        level: 3,
        content: 'Equipment Failure Scenarios',
      },
      {
        type: 'heading',
        level: 4,
        content: 'Walk-in failure',
      },
      {
        type: 'paragraph',
        content: 'Temp rises above 40°F.\n\n• Check temp — if still <50°F and caught within 2 hrs: move product to backup cold hold, call facilities\n• If >50°F OR duration unknown: L3 — discard all product, stop service\n• Notify DesiEats immediately — replacement product window is 24 hrs',
      },
      {
        type: 'heading',
        level: 4,
        content: 'Burner / stove down',
      },
      {
        type: 'paragraph',
        content: '• During prep: pause, call facilities, push prep to next available night if repair >1 hr\n• During service: switch to single-burner reheat cycle · 86 items that can\'t hold safely · notify DesiEats',
      },
      {
        type: 'heading',
        level: 4,
        content: 'Flat top / oven down',
      },
      {
        type: 'paragraph',
        content: '• Flat top down: 86 paneer for the service — no alternate sear surface approved\n• Oven down: chicken cannot be roasted — 86 chicken, contact DesiEats for pivot plan\n• Do not attempt stovetop chicken cook — product will not match quality standard',
      },
      {
        type: 'heading',
        level: 4,
        content: 'Hot hold / steam table down',
      },
      {
        type: 'paragraph',
        content: '• Double-boiler in a hotel pan on any working burner is the approved backup\n• Probe every 30 min while on backup — any drop below 140°F for >20 min = discard\n• Notify DesiEats — repair or replacement required before next service',
      },
      {
        type: 'warning',
        content: 'Suspected allergen exposure — L3 protocol\n\n1. Stop service for that item.\n2. Preserve sample of exact product served (label, photograph, refrigerate).\n3. Gather guest info, symptoms, time.\n4. Call DesiEats master trainer immediately.\n5. Do not speculate to the guest about cause.\n6. Written incident report within 24 hours.',
      },
    ],
  },

  '13': {
    id: '13',
    number: '13',
    title: 'CLOSING',
    subtitle: 'Closing & Breakdown · 9:00 PM',
    content: [
      {
        type: 'heading',
        level: 3,
        content: 'Closing Sequence',
      },
      {
        type: 'paragraph',
        content: 'Service ends at 9 PM. Closing is sequential — each step unlocks the next. Station lead signs off on every step.',
      },
      {
        type: 'heading',
        level: 4,
        content: 'Service stop',
      },
      {
        type: 'paragraph',
        content: '**9:00 – 9:10**',
      },
      {
        type: 'list',
        items: [
          'Last guest served · signage flipped to "Closed"',
          'Final 9:00 PM temp log entry',
          'Pull and tally all remaining product by item',
        ],
      },
      {
        type: 'heading',
        level: 4,
        content: 'Waste log + cold hold decisions',
      },
      {
        type: 'paragraph',
        content: '**9:10 – 9:30**',
      },
      {
        type: 'list',
        items: [
          'Record waste log: item · qty discarded · reason (4-hr rule, quality, spillage)',
          'Product that can return to cold hold: within 3-day max, passed 3 PM quality check, never split/broken',
          'Ice-bath anything still warm before returning to walk-in',
          'Re-label returned cambros with new DISCARD BY date',
        ],
      },
      {
        type: 'heading',
        level: 4,
        content: 'Line breakdown + clean',
      },
      {
        type: 'paragraph',
        content: '**9:30 – 10:00**',
      },
      {
        type: 'list',
        items: [
          'Empty all pans to dish pit · run spoodles + utensils through dish',
          'Wipe down cold rail, hot line, sneeze guard, counters',
          'Sanitize every contact surface (approved sanitizer at proper dilution)',
          'Empty and clean double-boiler hotel pan',
          'Trash out · recycling sorted · floor swept and mopped',
          'Final walk-in temp check logged',
        ],
      },
      {
        type: 'heading',
        level: 3,
        content: 'Friday Deep Clean — 7 items',
      },
      {
        type: 'paragraph',
        content: 'In addition to daily close, Friday night requires deep-clean of the following:',
      },
      {
        type: 'table',
        rows: [
          ['#', 'Item', 'Action'],
          ['1', 'Flat top grill', 'Scrape · degrease · season with light oil coat'],
          ['2', 'Oven interior', 'Pull racks · degreaser · wipe walls and floor'],
          ['3', 'Cold rail & drain lines', 'Empty pans · flush drain · sanitize reservoir'],
          ['4', 'Walk-in floor + shelves', 'Pull all product to bus tubs · wipe shelves · mop floor · sanitize'],
          ['5', 'Immersion blender disassembly', 'Remove head · soak in hot soapy water · sanitize · air dry'],
          ['6', 'All cambros & lexans', 'Empty any returning to prep Sunday · fully wash in dish · air dry upside down'],
          ['7', 'Sanitizer buckets + rags', 'Empty · wash buckets · launder rags'],
        ],
      },
      {
        type: 'paragraph',
        content: '**★ Monday reset starts Friday night**\n\nA clean close on Friday = a fast prep start on Sunday. Skip this and Sunday prep starts 30 minutes late — and 30 minutes late on Sunday means chicken marinade is still thawing on Monday morning.',
      },
    ],
  },

  '14': {
    id: '14',
    number: '14',
    title: 'SIGN-OFF',
    subtitle: 'Sign-Off · Portion Reference · Support',
    content: [
      {
        type: 'heading',
        level: 3,
        content: 'Operator Sign-Off — 10 steps to be cleared for solo service',
      },
      {
        type: 'paragraph',
        content: 'Every operator must complete these 10 steps with a master trainer present before running a station solo.',
      },
      {
        type: 'table',
        rows: [
          ['#', 'Step', 'Verified By', 'Sign-Off'],
          ['1', 'Read this playbook front to back', 'Master trainer', '___'],
          ['2', 'Pass ServSafe (or equivalent) food handler certification', 'HR record', '___'],
          ['3', 'Execute one full prep night start to finish (4 hrs)', 'Master trainer', '___'],
          ['4', 'Execute one full service-day morning setup (10:00–11:30 AM)', 'Master trainer', '___'],
          ['5', 'Run lunch service (11:30 AM – 2:30 PM) as second, then as lead', 'Master trainer', '___'],
          ['6', 'Demonstrate every recipe\'s CCP — probe, time, temp log', 'Master trainer', '___'],
          ['7', 'Handle a simulated L2 incident (sauce split, temp out-of-range)', 'Master trainer', '___'],
          ['8', 'Complete closing + waste log solo', 'Master trainer observes', '___'],
          ['9', 'Friday deep-clean solo', 'Campus trainer', '___'],
          ['10', 'Final taste panel — taste and evaluate every item against quality standards', 'Master trainer', '___'],
        ],
      },
      {
        type: 'heading',
        level: 3,
        content: 'Portion Reference — 8 items',
      },
      {
        type: 'table',
        rows: [
          ['Item', 'Bowl', 'Wrap', 'Utensil'],
          ['Basmati Rice', '5 oz', '—', 'Dedicated spoodle'],
          ['Chicken', '4 oz', '3 oz', 'Protein spoodle A'],
          ['Keema', '4 oz', '3 oz', 'Protein spoodle B (pork-dedicated)'],
          ['Chole', '4 oz', '3 oz', 'Protein spoodle C (veg-dedicated)'],
          ['Paneer (seared)', '5 oz', '3 oz', 'Paneer tongs — separate'],
          ['Butter Masala', '3 oz', '2 oz', '4 oz ladle, dedicated'],
          ['Palak', '3 oz', '2 oz', '4 oz ladle, dedicated'],
          ['Toppings (each)', '1 oz', '0.5 oz', 'Dedicated spoodle per topping'],
        ],
      },
      {
        type: 'heading',
        level: 3,
        content: 'Support Escalation',
      },
      {
        type: 'heading',
        level: 4,
        content: 'Campus trainer — first call',
      },
      {
        type: 'paragraph',
        content: 'On-site lead for day-to-day operational questions, shift coverage, minor incidents, L1–L2 escalations. Respond within the shift.',
      },
      {
        type: 'heading',
        level: 4,
        content: 'DesiEats master trainer — for L3 + recipe',
      },
      {
        type: 'paragraph',
        content: 'Escalate for L3 incidents, recipe/ingredient questions, proprietary blend issues, sign-off audits, contract-level concerns. Immediate phone call.',
      },
      {
        type: 'heading',
        level: 3,
        content: 'This playbook is the contract',
      },
      {
        type: 'paragraph',
        content: 'Every recipe, every temperature, every protocol in this document is the standard we\'ve agreed to deliver — to campus partners, to regulators, and to guests. Deviations erode trust faster than any marketing can rebuild it. When in doubt, follow the book. When the book is unclear, call your master trainer before improvising.\n\n**Cook with care. Serve with pride. Sign off clean.**',
      },
    ],
  },
};

export function getSopSection(id: SopSectionId): SopSection | null {
  return sopSections[id] || null;
}

export function getAllSopSectionIds(): SopSectionId[] {
  return Object.keys(sopSections) as SopSectionId[];
}

export function getSopSectionTitle(id: SopSectionId): string {
  const section = sopSections[id];
  return section ? `${section.number} · ${section.title}` : '';
}
