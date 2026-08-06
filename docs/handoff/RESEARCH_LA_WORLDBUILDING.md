# Los Angeles Worldbuilding Research — Confirmed Findings

**Purpose:** hard, citable numbers for a browser-based Three.js open-world superhero game set in a recognizable-but-invented Los Angeles. Hand-authored street layouts, no OSM import.

**Status:** Research was halted partway through. Everything in sections 1–7 is **confirmed with a source URL**. Section 8 (`OPEN — NOT RESEARCHED`) lists what is missing — read it before assuming coverage. Section 9 is a **PROVISIONAL** synthesis to be challenged, not trusted.

**Date of research:** July 2026.

---

## 1. The two street grids

Los Angeles has two clashing grids, and the seam between them is a genuinely usable level-design device.

### 1.1 The Spanish / Ord grid (~36° off cardinal)

- Felipe de Neve founded the pueblo in **1781**. The Laws of the Indies dictated the plaza be oriented **45° off the cardinal directions** (so that no facade faces directly into a prevailing wind, and so streets get sun on all sides).
- Because of the course of the Los Angeles River, the *pobladores* only ever achieved a **36° skew** — the river forced the alignment and 36° was "deemed close enough."
- U.S. Army engineer **E.O.C. Ord** surveyed the city in **1849** (the Ord and Hutton survey — the first map of the newly American city) and *preserved* the skew, laying out "an orthogonal grid of city blocks that extended south from the plaza at a 36-degree angle."
- D. J. Waldie calls this L.A.'s **"crooked heart."**

Source: [PBS SoCal / Lost LA — "Why L.A. Has Clashing Street Grids"](https://www.pbssocal.org/shows/lost-la/why-l-a-has-clashing-street-grids)
Also: [Ord's 1849 map, Calisphere](https://calisphere.org/item/ebfa730cc8f26d9c3acbc1fac0477e70/)

### 1.2 The cardinal PLSS / township grid

- The rest of the city aligns to the **Public Land Survey System**, established by the **Land Ordinance of 1785**, which divides much of the U.S. into townships.
- For Southern California it is measured from **San Bernardino Mountain** (the San Bernardino Base and Meridian).
- This grid runs **exactly north–south and east–west**.
- **Santa Monica Boulevard** and **Vermont Avenue** both trace PLSS **section lines** — i.e. they are 1-mile grid lines, not arbitrary streets.

Source: [PBS SoCal / Lost LA](https://www.pbssocal.org/shows/lost-la/why-l-a-has-clashing-street-grids)

### 1.3 Where the two grids meet

- The grids converge at **Hoover Street**. At Hoover, "Wilshire leaves behind the original Spanish pueblo of Los Angeles and enters the national survey grid."
- Design implication: the transition is not a smooth curve, it is a **shear line** producing wedge-shaped and triangular blocks, awkward five- and six-way intersections, and streets that dead-end into the flank of the other grid. This is free, authentic urban texture.

Source: [PBS SoCal / Lost LA](https://www.pbssocal.org/shows/lost-la/why-l-a-has-clashing-street-grids)

---

## 2. Street right-of-way standards — City of Los Angeles Standard Plan S-470-1

This is the authoritative table. Recovered two ways, which cross-check each other exactly:

- **Primary:** Standard Plan S-470-1 sheets 1–4, published as Exhibit E to CPC-2013-0910 — [cityclerk.lacity.org PDF](https://cityclerk.lacity.org/onlinedocs/2015/15-0719_misc_11_06-10-2015.pdf). This plan became effective concurrent with the adoption of Mobility Plan 2035 (approved 2015, drawing D-22549, supersedes S-470-0).
- **Corroborating:** Mobility Plan 2035 Draft EIR Chapter 3, Tables 3.3 and 3.4 — [street-classifications.pdf](https://losangeles2b.wordpress.com/wp-content/uploads/2012/12/street-classifications.pdf).

Note from the EIR text: *"The right-of-way describes the distance from property line to property line. The roadway dimension illustrates the distance between the curbs. The sidewalk width is calculated by subtracting the roadway width from the right-of-way dimension and dividing by two."* So **sidewalk width per side = (ROW − roadway) / 2**, and it includes the parkway/verge — LA's standard plan does not separately dimension the planting strip; the "border" is the whole curb-to-property-line zone.

### 2.1 Arterial streets (S-470-1 Sheet 1)

| Class | Legacy name | ROW ft (m) | Roadway ft (m) | Sidewalk each side ft (m) | Half-roadway ft | Typical travel lanes | Target speed |
|---|---|---|---|---|---|---|---|
| **Boulevard I** | Major Highway Class I | 136 (41.45) | 100 (30.48) | 18 (5.49) | 50 + 50 | 6–8 | 40 mph |
| **Boulevard II** | Major Highway Class II | 110 (33.53) | 80 (24.38) | 15 (4.57) | 40 + 40 | 4–6 | 35 mph |
| **Avenue I** | Secondary Highway | 100 (30.48) | 70 (21.34) | 15 (4.57) | 35 + 35 | 4 | 35 mph |
| **Avenue II** | Secondary Highway | 86 (26.21) | 56 (17.07) | 15 (4.57) | 28 + 28 | 2–4 | 30 mph |
| **Avenue III** | Secondary Highway | 72 (21.95) | 46 (14.02) | 13 (3.96) | 23 + 23 | 2 | 25 mph |

Superseded legacy dimensions, for reference (these are what is often *actually built* on the ground):
- Major Highway Class I: 126/102 ft
- Major Highway Class II: 104/80 ft
- Secondary Highway: 90/70 ft
- Collector: 64/44 ft

Named real-world examples from EIR Table 3.4 — useful for calibrating the invented city's hierarchy:
- **Boulevard I:** Lincoln Blvd (south of Venice), Sepulveda Blvd (I-105 to Culver City limits)
- **Boulevard II:** Santa Monica Blvd (I-405 to Beverly Hills limits), Olympic Blvd, Beverly Blvd, Venice Blvd, Ventura Blvd, Lankershim Blvd
- **Avenue I:** Wilshire Blvd (Alvarado to Beverly Hills limits), **Sunset Blvd**, **Hollywood Blvd**, Pico Blvd (west of Crenshaw), Chatsworth St (east of De Soto), Bundy Dr
- **Avenue II:** 3rd St, 7th St, Robertson Blvd, Alvarado St, Pico Blvd (east of Crenshaw)
- **Avenue III:** Normandie Ave (north of Pico), Rose Ave, Fountain Ave, Crescent Heights Blvd

> **Important for authenticity:** Hollywood, Santa Monica, and Sunset Boulevards are all classed **Avenue I (100/70)**, *not* Boulevard. The iconic LA boulevard is a 100 ft ROW with a 70 ft roadway and 15 ft sidewalks — narrower than people assume. Wilshire east of Beverly Hills is also Avenue I.

### 2.2 Non-arterial streets (S-470-1 Sheet 2)

| Class | ROW ft (m) | Roadway ft (m) | Sidewalk each side ft (m) | Half-roadway ft | Lanes | Target speed |
|---|---|---|---|---|---|---|
| **Collector Street** | 66 (20.12) | 40 (12.19) | 13 (3.96) | 20 + 20 | 2 | 25 mph |
| **Industrial Collector Street** | 68 (20.73) | 48 (14.63) | 10 (3.05) | 24 + 24 | 2 | 25 mph |
| **Industrial Local Street** | 64 (19.51) | 44 (13.41) | 10 (3.05) | 22 + 22 | 2 | 20 mph |
| **Local Street – Standard** (Continuous) | 60 (18.29) | 36 (10.97) | 12 (3.66) | 18 + 18 | 2 | 20 mph |
| **Local Street – Limited** (Non-Continuous) | 50 (15.24) | 30 (9.14) | 10 (3.05) | 15 + 15 | 2 | 15 mph |

### 2.3 Hillside streets (S-470-1 Sheet 2) — unchanged by Mobility Plan 2035

| Class | ROW ft (m) | Roadway ft (m) | Border each side ft (m) | Half-roadway ft | Notes |
|---|---|---|---|---|---|
| **Hillside Collector** | 50 (15.24) | 40 (12.19) | 5 (1.52) | 20 + 20 | 2:1 max side slopes, 2% max cross |
| **Hillside Local** | 44 (13.41) | 36 (10.97) | 4 (1.22) | 18 + 18 | 2:1 max side slopes; 3 ft berm on private property; 2 ft min |
| **Hillside Limited** | 36 (10.97) | 28 (8.53) | 4 (1.22) | 14 + 14 | 1 ft min offsets |
| **Public Stairway** | variable | — | 5 ft min walk / 10 ft min | — | Per BOE standard plans |

> **Design implication:** hillside streets have **4–5 ft borders**, i.e. effectively no sidewalk. This is why the Hollywood Hills read as rural-in-the-city: 36–50 ft ROW, no curb-to-property buffer, retaining walls or 2:1 cut slopes right at the pavement edge. Contrast with 136 ft Boulevard I in the flats — a **~3.8×** difference in ROW between the widest arterial and the narrowest hillside street.

### 2.4 Other rights-of-way (S-470-1 Sheet 3)

| Type | ROW ft | Roadway ft | Notes |
|---|---|---|---|
| **Pedestrian Walkway** (inner block walk) | 10–25 | — | Min 10 ft; also OK for slow cyclists |
| **Shared Street** | 30 | 10 | 4 ft pedestrian zone each side on S-470-1 sheet 3; EIR text says min 20 ft plus 5 ft protected pedestrian areas. No raised sidewalk — all users share surface. Vehicles at 3–5 mph. Target 5 mph. **Discrepancy between the two sources — verify before use.** |
| **One-Way Service Road** (adjoining arterials) | EIR: 28–35 · Sheet 3: 26 or 32 | 12, or 18 with parking on one side | Sheet 3 also shows a 10 ft walk |
| **Bi-Directional Service Road** (adjoining arterials) | EIR: 33–41 · Sheet 3: 34 or 42 | 20, or 28 with parking on one side | Sheet 3 also shows a 10 ft walk |
| **Access Roadway** | 20 | — | — |
| **Stormwater Greenway** | variable | 15+ | Target 5 mph. Example: Humboldt St between Ave 18 and the LA River |
| **Alley** | 20 min | — | Legacy text: **36 ft** in predominantly industrial zones, **20 ft** commercial and residential |

### 2.5 Alley, cul-de-sac, corner and flare geometry (S-470-1 Sheet 3 + Notes on Sheet 4)

- **Alley standard turning area:** R = 20 ft, envelope 20 × 60 ft
- **Alley minimum turning area:** R = 20 ft, envelope 20 × 25 ft / 30 × 20 ft
- **Alley standard cut corners:** 10 × 10 ft, diagonal **14.14 ft**
- **Cul-de-sac:** R = **50 ft** (standard, variable), R = **35 ft** minimum. May be unsymmetrical. In **industrial areas, 50 ft curb radii instead of the standard 35 ft** (Note 6). Fire-truck clearance: no obstruction taller than 6 in within 3 ft of the curb; on-street parking prohibited.
- **Standard flare section** (arterial tapering down to a lesser designation): R = 25 ft, taper envelope **30 × 150 ft** at the P.I. of the property line, flared on both sides.
- **Intersection corner dedications** (Note 8):
  - Arterial × any other street: **15 × 15 ft cut corner** or **20 ft curved corner radius**
  - Non-arterial and/or hillside streets: **10 × 10 ft cut corner** or **15 ft curved corner radius**
- **Note 11:** the dimension of any median, divided strip, and/or transit way is **included** when determining the ROW dimension. So a "divided Avenue II" is wider than 86 ft overall.
- **Note 10:** all streets designated *divided* are deemed to have met their standard; dedication is only what's needed to bring the sidewalk into compliance.

### 2.6 Lane and parking widths — Street Design Manual E 612.2

- Parking lane: **absolute minimum 8 ft**, **desirable minimum 10 ft**
- Travel lane: **absolute minimum 9 ft**, **desirable minimum 10 ft**, **standard 11 ft**, **maximum 12 ft**
- Default arrangement: *"major and secondary highways are divided into three equal standard width lanes in each direction"* — i.e. **3 × 11 ft = 33 ft per direction**, with right-turn flares and left-turn-pocket medians at intersections.
- Where there is a median, or where only slow traffic is expected (**downtown business districts**), the **widest lane goes nearest the curb** (buses/trucks use it; easier clearance judgement; reduces conflict with parked cars).
- On undivided high-speed or sinuous streets, the **widest lane goes nearest the centerline** (safety margin between opposing flows).

Source: [E 612 Width Standards and Component Arrangements](https://completestreetdesignmanual.engineering.lacity.gov/e-600-cross-section-elements/e-610-streets/e-612-width-standards-and-component-arrangements)

### 2.7 Sidewalk geometry — Street Design Manual E 652

- Sidewalk width is **always measured from the top of curb face**. When the entire border is paved, deduct 0.5 ft for the top of curb.
- **Transverse (cross) slope normally 2.5%**; **maximum 6%**, **minimum 1%**; drains from property line toward the roadway.
- **Maximum longitudinal grade change for sidewalk slopes: 6%.**
- In new subdivisions the back of sidewalk abuts the property line; where existing walls/buildings encroach, offset the back of sidewalk **0.5 ft or 1 ft** from the property line.
- **In commercially zoned areas or near schools (high pedestrian volume), the parkway is eliminated and sidewalk is constructed across the entire width of the border.** This is exactly the DTLA / Hollywood Blvd / Broadway condition: full-width hardscape, no planting strip.
- Where less than **5 ft** of sidewalk exists between property line and curb face, adjust the curb return radius or add a property-line cutoff.
- Sidewalk may be omitted in **M-3 or less industrial areas** with full-width pavement between property lines (→ the Arts District / Skid Row-adjacent condition: no sidewalk at all, pavement wall-to-wall).

Source: [E 652 Sidewalks](https://completestreetdesignmanual.engineering.lacity.gov/e-600-cross-section-elements/e-650-borders/e-652-sidewalks)

### 2.8 Street grades — Street Design Manual E 391

- **Grades of 6% or less are preferable.** There is no "desirable" rate.
- **Maximum desirable grade on major or secondary streets: 6%. Absolute maximum: 7%.**
- **All other streets have a normal maximum limit of 15%.** ← the key figure for hillside road authoring
- Minimum desirable grade **0.400%**; where unavoidable **0.200%** (use concrete gutter on flat grades).
- **Crossfall:** cross-sections held **level** on major/secondary highways; **≤1.50%** on other streets; **maximum 8% crossfall** permitted where necessary to meet existing improvements on existing hillside streets.
- **Approaching intersections in hillside areas:** develop crossfall as a smooth transition **starting 75 ft from the BCR**; set ~**two-thirds** of the intersecting street's grade at the BCR with **crossfall not exceeding 10%** there; develop the remaining one-third within the intersection.
- **Grade breaks:** replace with vertical curves where the chord grade difference exceeds **1.25% on local streets** / **0.50% on major and secondary highways**. Grade breaks spaced ~**25 ft** on flat grades, ~**10 ft** on steeper grades, **5 ft minimum**, rarely exceeding **100 ft**.
- Local-street / T-intersection grade breaks within an intersection: desirable max **3.50%**, absolute max **6%**.
- **Alleys in steep hillside areas: maximum allowable longitudinal grade 15%.** ([E 516](https://completestreetdesignmanual.engineering.lacity.gov/e-500-design-criteria-special-street-components-and-projects/e-510-alleys/e-516-grade-determination))

Source: [E 391 Design Details](https://completestreetdesignmanual.engineering.lacity.gov/e-300-roadway-design-controls-and-criteria/e-390-grade-design-policy/e-391-design-details)

### 2.9 Real-world grade outliers

- **Baxter Street, Echo Park:** the stretch between Alessandro and Alvarado claims a **32% grade** — among the steepest in the city and the nation. Just over the hill past Lemoyne, a **grid pattern embedded in the concrete** helps tires grip. It is a historic street predating modern standards, grandfathered in — an extreme outlier, more than **double** the 15% normal maximum.
- Sources: [Heavy Duty Trucking — "In L.A. Beware of Baxter Street's 32% Grade"](https://www.truckinginfo.com/279827/in-l-a-beware-of-baxter-streets-32-grade), [PBS SoCal — "How Baxter Became One of L.A.'s Steepest Streets"](https://www.pbssocal.org/shows/lost-la/how-baxter-became-one-of-l-a-s-steepest-streets), [Los Angeles Explorers Guild — The Steep Streets of Los Angeles](https://losangelesexplorersguild.com/2021/09/27/steep-streets-of-los-angeles/)
- The **15% natural slope** threshold is also the trigger for the City's **Baseline Hillside Ordinance** — properties with natural slopes ≥15% (per USGS topo data) fall under BHO grading/height/slope-density rules. Useful as the definition of "hillside" vs "flats" in the invented city. ([BOE clearance summary](https://permitmanual.engineering.lacity.gov/building-safety-clearances/technical-procedures/clearance-summary-worksheet-clearances/10-bho))

---

## 3. Building heights

### 3.1 The 20 tallest buildings in Los Angeles

All Downtown unless noted.

| # | Name | Height ft | Height m | Floors | Year |
|---|---|---|---|---|---|
| 1 | Wilshire Grand Center (InterContinental) | 1,100 | **335.3** | 73 | 2017 |
| 2 | U.S. Bank Tower | 1,018 | **310.3** | 73 | 1990 |
| 3 | Aon Center | 858 | **261.5** | 62 | 1974 |
| 4 | Two California Plaza | 750 | 228.6 | 52 | 1992 |
| 5 | Gas Company Tower | 749 | 228.3 | 52 | 1991 |
| 6 | Wells Fargo Tower | 740 | 225.6 | 54 | 1983 |
| 7 | Bank of America Plaza | 735 | 224.0 | 55 | 1975 |
| 8 | 777 Tower | 725 | 221.0 | 53 | 1991 |
| 9 | Figueroa at Wilshire | 717 | 218.5 | 52 | 1989 |
| 10 | City National Tower | 699 | 213.1 | 52 | 1971 |
| 11 | Paul Hastings Tower | 699 | 213.1 | 52 | 1971 |
| 12 | The Beaudry | 695 | 211.7 | 64 | 2023 |
| 13 | The Ritz-Carlton Los Angeles | 667 | 203.3 | 54 | 2010 |
| 14 | Thea at Metropolis Tower 3 | 627 | 191.1 | 56 | 2019 |
| 15 | FourFortyFour South Flower | 625 | 190.5 | 48 | 1982 |
| 16 | 611 Place | 620 | 189.0 | 42 | 1969 |
| 17 | Wells Fargo South Tower | 606 | 184.8 | 45 | 1984 |
| 18 | Olympic and Hill | 594 | 181.0 | 53 | 2025 |
| 19 | One California Plaza | 578 | 176.2 | 42 | 1985 |
| 20 | Century Plaza Tower I (**Century City**) | 571 | 174.0 | 44 | 1975 |

Source: [Wikipedia — List of tallest buildings in Los Angeles](https://en.wikipedia.org/wiki/List_of_tallest_buildings_in_Los_Angeles)

Observations for the level designer:
- The DTLA financial core is a **cluster of ~10 towers in the 210–335 m band**, plus a long tail in the 175–210 m band. It is a *plateau*, not a spire — no single dominant peak the way Manhattan or Chicago read.
- Note the **1971–1992 concentration**: 13 of the top 20 were built in that window. That is one architectural generation — dark glass and stone-clad boxes with flat tops.
- **Century City** is a second, detached high-rise cluster ~10 km west of DTLA. LA's skyline is polycentric: DTLA, Century City, plus the Wilshire Corridor. Worth reproducing — a single downtown misreads LA badly.

### 3.2 The 150 ft height limit (the reason LA is flat)

- The City enacted an ordinance prohibiting any building taller than **150 ft (46 m)** — *"effectively limiting the height of buildings to 13 stories."* Sources give the date as **1904** (Wikipedia) and **1905** (PBS SoCal) — **unreconciled; verify.**
- **Los Angeles City Hall** was the sole exception at **450 ft**, completed **1928**, and *"dominated the skyline for over three decades."*
- The limit was **removed in 1957** — by **voter referendum**, per PBS SoCal.

Sources: [Wikipedia — Tallest buildings in LA](https://en.wikipedia.org/wiki/List_of_tallest_buildings_in_Los_Angeles), [PBS SoCal — Five Highest Buildings to See L.A. From Above](https://www.pbssocal.org/shows/socal-wanderer/five-highest-buildings-to-see-l-a-from-above)

### 3.3 The flat-roof / helipad ordinance (the reason LA's towers have no tops)

- An ordinance imposed in **1958** — **LAFD Requirement No. 10** — required high-rise buildings to have **flat roofs with a rooftop helipad**, to give firefighting helicopters access. LA was **the only major American city with such a rule**.
- This constraint shaped essentially all LA high-rise development from the **1960s through the 1980s** — hence the flat-topped, crownless silhouettes.
- **Rescinded in 2014** (Mayor Garcetti, Councilmember Huizar, LAFD). The revised policy **exempts new buildings between 420 and 1,000 ft** from the helipad requirement.
- **U.S. Bank Tower is the tallest building in the world with a helipad on its roof.**

Sources: [Wikipedia](https://en.wikipedia.org/wiki/List_of_tallest_buildings_in_Los_Angeles), [LAist — LA high-rises no longer require helipads](https://laist.com/shows/take-two/la-high-rises-no-longer-require-helipads), [CBS LA](https://www.cbsnews.com/losangeles/news/la-modifies-fire-code-requirement-for-all-skyscrapers-to-be-topped-with-helipad/), [LAFD Requirement No. 10, revised 11/17/2014 (PDF)](https://lafd.org/sites/default/files/pdf_files/EHLF-Reg10.pdf), [OH&S](https://ohsonline.com/articles/2014/10/01/la-scraps-skyscraper-helipad-rule.aspx)

> **This is the single most important skyline fact for the game.** Pre-2014 LA towers = flat roofs with a painted helipad circle and an "H". Post-2017 towers (Wilshire Grand) = sculpted/spired crowns. A skyline that mixes both, with flat tops dominating, reads unmistakably as Los Angeles. For a *flying* superhero, the flat helipad roofs are also a gift: hundreds of legible, authentic landing pads.

### 3.4 Mid-rise and low-rise reference

- **Capitol Records Building, Hollywood: 151 ft (46 m), 13 stories.** Note that this is *exactly* the old 150 ft limit — Capitol Records is a physical monument to the height cap. ([Wikipedia](https://en.wikipedia.org/wiki/Capitol_Records_Building), [Skyscraper Center](https://www.skyscrapercenter.com/building/wd/15121))
- Broadway theatre district buildings: movie palaces built **1910–1931** (see §5.3).
- Dominant sprawl fabric is **1–2 story** — see the dingbat (2-story) and mini-mall (1-story) typologies in §6.

---

## 4. Topography

| Feature | Elevation ft | Elevation m |
|---|---|---|
| **Mount Lee** (Hollywood Sign) | 1,708 | **521** |
| **Mount Hollywood** (Griffith Park) | 1,625 | **495** |
| **Griffith Observatory** | 1,135 | **346** |

Sources: [Wikipedia — Mount Lee](https://en.wikipedia.org/wiki/Mount_Lee), [Wikipedia — Griffith Observatory](https://en.wikipedia.org/wiki/Griffith_Observatory), [Hikespeak — Mount Hollywood, Mount Bell and Mount Chapel](https://www.hikespeak.com/trails/mount-hollywood-bell-chapel-griffith-park/), [SoCal Hiker](https://socalhiker.net/hiking-mt-hollywood-in-griffith-park/)

**Conflict to resolve:** one source calls Mount Hollywood *"the highest peak in Griffith Park"*, another calls it *"the second tallest peak in Griffith Park"* at 1,625 ft. Mount Lee at 1,708 ft is outside/adjacent depending on boundary definition. **Verify before using in copy.**

**Scale relationship worth internalizing:** Mt Lee (521 m) is only **~1.68×** the height of U.S. Bank Tower (310 m). The Hollywood Hills are *modest* — they read as dramatic because they rise directly out of a flat basin at close range with no foothills. Do not over-scale them; exaggerating the hills is the classic mistake (see Mt Chiliad, §7).

Hillside road grades: see §2.8 (15% normal max) and §2.9 (Baxter St 32%).

---

## 5. Landmarks with dimensions

### 5.1 Los Angeles River

- **Total length: 47.9 miles (77.1 km)**, San Fernando Valley to Long Beach.
- Concrete encasement began after the devastating floods of the 1930s; following the **Los Angeles Flood of 1938** the **U.S. Army Corps of Engineers** began encasing the bed and banks in concrete.
- **Soft-bottom / natural riverbed sections** (the only green stretches):
  - The **Sepulveda Basin** flood-control area behind Sepulveda Dam near Van Nuys
  - The **Glendale Narrows — an 11-mile (17.7 km) stretch east of Griffith Park**, earthen-bottomed, with a bike path
  - The final miles approaching Long Beach
- Flow: average **226 cfs** at Long Beach; maximum recorded **129,000 cfs**.

Source: [Wikipedia — Los Angeles River](https://en.wikipedia.org/wiki/Los_Angeles_River)

**Channel cross-section dimensions** — two distinct section types, and the difference is dramatic:

| Section type | Where | Bottom width | Top width | Depth |
|---|---|---|---|---|
| **Trapezoidal** | Downstream portions | **200–400 ft** (61–122 m) | **400–600 ft** (122–183 m) | **20–35 ft** (6–11 m) |
| **Rectangular / box** | Upstream portions | **60–120 ft** (18–37 m) | same (vertical walls) | **12–20 ft** (3.7–6 m) |

- Both types carry a **low-flow channel in the center** — a narrow trickle-width trough in an otherwise dry concrete plain.
- Channel invert at a constant slope of approximately **0.003 ft/ft** (0.3%) over several portions.

Sources: [LA River Master Plan — Concrete Channel (Kit of Parts)](https://larivermasterplan.org/design/kit-of-parts/concrete-channel/), [LA County DPW / USACE LA District document (PDF)](https://dpw.lacounty.gov/lacfcd/WDR/files/WG/040215/Main%20(2).pdf), [LA Regional Water Board — LA River Metals Appendix A (PDF)](https://www.waterboards.ca.gov/losangeles/board_decisions/basin_plan_amendments/technical_documents/2005-006/04_0712/Dry%20Weather/LA%20River%20Metals-Appendix%20A.pdf)

> **Design implication:** the trapezoidal downstream channel is a **400–600 ft wide, 20–35 ft deep concrete canyon** — that is wider than a Boulevard I ROW (136 ft) by a factor of 3–4. It is one of the largest continuous open spaces in the city and the natural choice for a high-speed flight corridor, chase set-piece, or the game's "highway for superheroes." The box sections (60–120 ft) are tight, tunnel-like, and read completely differently.

### 5.2 Sixth Street Viaduct ("Ribbon of Light")

- **Total length: 3,500 ft (1,100 m)**
- **Width: 30.48 m (100 ft)** — 4 road lanes (2 each direction) plus pedestrian and cyclist lanes each direction
- **10 continuous concrete arch pairs, leaning outward by 9°**, in three heights:
  - **60 ft** — 2 pairs, over the railroads
  - **40 ft** — 1 pair, over US 101
  - **30 ft** — 7 pairs, remaining
- **10 sets of LED-lit arches that can change color**
- Opened **July 9, 2022**; a tied-arch bridge replacing the 1932 viaduct (which had two pairs of arches over the river section)

Sources: [Wikipedia — Sixth Street Viaduct](https://en.wikipedia.org/wiki/Sixth_Street_Viaduct), [LA Bureau of Engineering project page](https://engineering.lacity.gov/about-us/major-projects/sixth-street-viaduct-replacement-project), [HNTB fact sheet](https://www.hntb.com/press_release/project-fact-sheet-sixth-street-viaduct-replacement/), [Michael Maltzan Architecture](https://www.mmaltzan.com/projects/sixth-street-viaduct/)

### 5.3 Four Level Interchange (the Stack) — US 101 × SR 110

- **The first stack interchange in the world.**
- Constructed **1949**; opened **September 22, 1953**.
- **Four-level reinforced concrete structure.**
- **Unusual configuration: the mainline traffic of US 101 is at the TOP of the interchange, above the ramps** — a rarity in stack interchanges. (Normally the mainlines are the lower two levels.)
- Connects **US 101** (Hollywood Fwy / Santa Ana Fwy) and **SR 110** (Harbor Fwy / Arroyo Seco Pkwy), at the northern edge of Downtown.
- The stack form was chosen because *"surrounding buildings and terrain made construction of a cloverleaf interchange impractical."*
- Cost **$5.5 million** in 1953 (~$52 million in 2024 dollars); displaced **over 4,000 people** from their homes.
- Renamed the **Bill Keene Memorial Interchange** in 2006.
- **Overall height in ft/m was NOT found** — see §8.

Source: [Wikipedia — Four Level Interchange](https://en.wikipedia.org/wiki/Four_Level_Interchange)

### 5.4 Hollywood Walk of Fame

- **Length: about 1.3 miles**
- **2,840 stars** as of April 2026
- Embedded in the sidewalks along **fifteen blocks of Hollywood Boulevard and three blocks of Vine Street**

Sources: [Wikipedia — Hollywood Walk of Fame](https://en.wikipedia.org/wiki/Hollywood_Walk_of_Fame), [walkoffame.com history](https://walkoffame.com/history/)

> Hollywood Blvd is an **Avenue I (100 ft ROW / 70 ft roadway / 15 ft sidewalks)** per §2.1. So the Walk of Fame is a **15 ft wide** hardscape band — and per E 652, commercial zoning means no parkway, full-width paving. 15 blocks × ~1.3 mi / 15 ≈ **~460 ft per block** along Hollywood Blvd.

### 5.5 Broadway Theater District, DTLA

- Stretches **six blocks, from 3rd to 9th Streets** along **South Broadway**
- **12 movie theatres, built between 1910 and 1931**
- At its height the **neon-drenched** district had **the highest concentration of cinemas in the world**, with seating for **more than 15,000 patrons**
- Added to the **National Register of Historic Places in May 1979** — the first and largest historic theatre district listed
- **The only large concentration of movie palaces left in the United States**

Sources: [Wikipedia — Broadway Theater District (Los Angeles)](https://en.wikipedia.org/wiki/Broadway_Theater_District_(Los_Angeles)), [Discover Los Angeles](https://www.discoverlosangeles.com/things-to-do/discover-the-historic-theatres-on-broadway-in-downtown-los-angeles), [LA Conservancy walking tour](https://www.laconservancy.org/tours-events/events-calendar/broadway-historic-theatre-and-commercial-district-walking-tour/)

> 12 theatres in 6 blocks = **2 marquees per block**, both sides. Vertical blade signs and projecting marquees over the sidewalk are the defining silhouette. This is the highest signage density in the invented city outside the Sunset Strip.

### 5.6 Santa Monica Pier

- **Total length: 1,651.5 ft (500 m)**

Source: [Wikipedia — Santa Monica Pier](https://en.wikipedia.org/wiki/Santa_Monica_Pier)

### 5.7 Venice Canals and Boardwalk

- **Venice Canals:** **six canals**, approximately **1.5 miles** total length, **50 ft wide**, **5 ft deep at center**
- **Venice Beach Boardwalk / Ocean Front Walk:** a **two-mile** promenade

Sources: [Venice Canals Association — About the Canals](https://venicecanals.org/canals/), [Wikipedia — Venice Beach Boardwalk](https://en.wikipedia.org/wiki/Venice_Beach_Boardwalk)

> The canals at 50 ft wide are exactly the width of a **Local Street – Limited ROW (50 ft)**. Useful shortcut: author the canal district on the same grid module as a narrow residential street network, swapping pavement for water and adding footbridges.

### 5.8 Koreatown density

- **The most densely populated district by population in Los Angeles County: 120,000 residents in 2.7 square miles.**
- **~42,611 people per square mile (2000)**, rising to **46,208 per square mile (2008)**
- One of the most crowded neighborhoods in the United States
- Note: the LA Times *Mapping L.A.* project uses a **larger** Koreatown boundary than other definitions, including Wilshire Center

Sources: [Wikipedia — Koreatown, Los Angeles](https://en.wikipedia.org/wiki/Koreatown,_Los_Angeles), [Statistical Atlas — Koreatown population](https://statisticalatlas.com/neighborhood/California/Los-Angeles/Koreatown/Population)

> **46,208/sq mi ≈ 17,840 per km².** For comparison this is Manhattan-adjacent density achieved almost entirely with **4–6 story courtyard and mid-rise blocks plus dingbats** — no towers. Koreatown is the answer to "how do I make a dense-feeling district without building skyscrapers."

### 5.9 Sunset Strip signage

- The **Sunset Strip Off-Site Signage Policy** covers a **1.6-mile corridor** of Sunset Boulevard in West Hollywood.
- Three sign types are recognized: **Traditional Billboards, Digital Billboards, and Tall Wall Signs.**
- Example digital billboard: **20 ft 6 in tall × 50 ft 5 in wide**, **936 × 2,304 px** (more than 2 million pixels).
- The **Sunset Spectacular** design competition set limits of **no higher than 90 ft** with **no more than 1,000 sq ft of digital display elements**. (Finalists included Zaha Hadid and Gensler.)
- The Strip has a *"rich history of creative signage."*

Sources: [City of West Hollywood — Sunset Strip Off-Site Signage Policy IS/ND (PDF)](https://www.weho.org/home/showdocument?id=31160), [West Hollywood Municipal Code Ch. 19.34 Sign Standards](https://ecode360.com/43927995), [SNA Displays — Sunset Gateway](https://snadisplays.com/projects/the-sunset-gateway/), [OBM — Sunset Spectacular](https://obm.com/sunset-spectacular/)

> Practical numbers: a standard tall billboard face is roughly **20 × 50 ft (6 × 15 m)**; the maximum structure envelope is **90 ft (27 m)** tall — i.e. **taller than a 6-story building**. On a 1.6-mile corridor these are the dominant vertical elements, not the buildings.

---

## 6. LA visual language — confirmed items

### 6.1 Palms

| Species | Common name | Typical height | Notes |
|---|---|---|---|
| **Washingtonia robusta** | Mexican fan palm | **40–80 ft** commonly; **70–100 ft** achievable | The iconic LA street palm. **Mass-planted in Los Angeles in the 1930s** — both as a beautification project for the **1932 Olympics** and as a Depression-era work scheme. Tall, whip-thin, disproportionate crown. Fastest-growing of the three. |
| **Washingtonia filifera** | California fan palm | **30–50 ft** (native range); usually not much over **60–70 ft** | Native evergreen monocot. Distinguished from robusta by **shorter stature and a stouter trunk with a less pronounced flare at the base**. Much slower to reach height. |
| **Phoenix canariensis** | Canary Island date palm | **40–50 ft** | Slow growing, requires many years to attain that height. Massive pineapple-shaped crown on a thick trunk — reads as formal/estate, not street. |

Sources: [USDA Forest Service FEIS — Washingtonia filifera](https://research.fs.usda.gov/feis/species-reviews/wasfil), [UCLA Botanical Garden StreetPlants — Washingtonia robusta (PDF)](https://www.botgard.ucla.edu/wp-content/uploads/sites/120/2019/03/StreetPlants_Washingtonia_robusta.pdf), [Gardenia — Washingtonia robusta](https://www.gardenia.net/plant/washingtonia-robusta), [Dave's Garden — Washingtonia Palms: Wonders or Weeds?](https://davesgarden.com/guides/articles/view/3066), [UF/IFAS EDIS — Phoenix canariensis](https://edis-news.ifas.ufl.edu/?p=9473), [Sandra's Garden — Hollywood palms](https://sandrasgardenblog.wordpress.com/2014/08/27/hollywood-palms/)

**Queen palm (*Syagrus romanzoffiana*): heights NOT confirmed. See §8.**

### 6.2 Street tree stock — scale only

- Los Angeles has **nearly 700,000 street trees** growing along **6,700 miles of streets**, comprising **nearly 1,000 different species**.
- **Four species make up the majority of the palm trees** in Los Angeles, but there are **at least thirty other palm species** growing along city streets.
- One list of most-common species in the region: **Italian cypress, scrub oak, laurel sumac, Mexican fan palm, Indian laurel** (*Ficus microcarpa*).

Sources: [LA Bureau of Street Services — Urban Forestry FAQs](http://lastreets.lacity.org/faqs-ufd), [Natural History Museum — L.A.'s Street Trees](https://nhm.org/stories/las-street-trees)

**Per-species percentages for jacaranda / ficus / magnolia / eucalyptus / crape myrtle were NOT obtained. See §8.**

### 6.3 Marine layer / June gloom

- The marine layer **can be as shallow as a hundred feet or as deep as 5,000 feet.**
- **Cloud base below 2,500 ft** is the threshold used for low-cloud / marine-layer monitoring.
- Within the **May–August** window, marine-layer cloud occurrence along the coast **reaches a maximum in early June** then gradually decreases through summer.
- During **May–June the clouds are thickest**, and the thicker the cloud the longer it takes to dissipate during the day. The **highest inversions** — and therefore thickest marine layer clouds — occur in **late May and early June**, corresponding to maximum daytime cloud coverage.
- When strong and deep, the marine layer **fills the LA Basin and spills over into the San Fernando and San Gabriel Valleys**, occasionally reaching the Santa Clarita Valley and Inland Empire.

Sources: [Wikipedia — June Gloom](https://en.wikipedia.org/wiki/June_Gloom), [Spectrum News 1](https://spectrumnews1.com/ca/la/weather/2021/04/30/may-gray-and-june-gloom--the-marine-layer-isn-t-isolated-to-california), [Surfline — June Gloom / May Gray](https://www.surfline.com/surf-news/june-gloom-may-gray-how-southern-california-marine-layer-moves-in/88707), [Scripps/UCSD — Marine Layer Seasonal Cycle](http://meteora.ucsd.edu/~iacob/ml_seasonal.html), [LAist](https://laist.com/news/climate-environment/los-angeles-beach-marine-layer-june-gloom-climate-change)

> **Direct rendering hook:** a **100–1,500 m** thick stratus deck with a base **below 760 m (2,500 ft)** is the June-gloom preset. Because Mt Lee is **521 m** and Griffith Observatory is **346 m**, a typical marine layer **buries the observatory and leaves the Hollywood Sign in sunlight above the deck** — a spectacular and completely authentic flight set-piece. Likewise the tops of the DTLA towers (310–335 m) can poke through.

### 6.4 Sun angles

- Los Angeles latitude ~**34.05°N** (one source states 34.11°N).
- **Summer solstice: midday sun reaches 79.3° above the horizon.**
- **Winter solstice: midday sun reaches only 32.4°.**
- A swing of **about 47°** in midday sun height across the year.
- Golden hour is roughly a **60-minute window** after sunrise and before sunset, with the sun **typically below 6° elevation**; shorter near the equinoxes, longer in winter when the sun tracks at a shallower angle.
- The sun rises roughly east — swinging **northeast in summer, southeast in winter** — and sets roughly west, swinging **northwest in summer, southwest in winter**.

Sources: [SunMap — Sunlight Hours in Los Angeles](https://sunmap.co/locations/los-angeles-ca/), [timeanddate — Los Angeles astronomy](https://www.timeanddate.com/astronomy/usa/los-angeles), [Wikipedia — Los Angeles](https://en.wikipedia.org/wiki/Los_Angeles)

> **Grid interaction worth exploiting:** because the outer city is on the **cardinal PLSS grid** (§1.2), around the equinoxes the setting sun aligns down the east–west boulevards — the LA equivalent of Manhattanhenge. But the **DTLA core is rotated 36°**, so the same sunset rakes DTLA streets at an angle instead. The two grids light differently at the same hour. Free visual differentiation between districts.

### 6.5 Architecture typologies — distinguishing features

**Dingbat apartment** (dominant multifamily type in Southern California **1950–1970**, proliferating **1950s–1970s**):
- **Two-story**, box-shaped vernacular type, clad primarily in **stucco**
- **Overhanging eaves**; apartments **propped up on stilts over open carports** ("tuck-under parking")
- **Skinny steel columns**, **simple boxed balconies**, simple rectangular forms
- Built to **fill the entire lot**, from the sidewalk property line to the back
- **Flat box top** is the defining feature
- Decorated with **bespoke light fixtures, relief designs, starbursts**, and **large typography spelling out names** such as *"The Capri"* or *"The Palms"*
- Described as "primitive modern"; architects Thurman Grant and James Black associated with the type

Sources: [LAist photo essay](https://laist.com/news/la-history/photos-the-beautiful-dingbats-of-lo), [Woodbury University — Dingbat 2.0](https://woodbury.edu/news/dingbat-2-0/), [Bloomberg — A Design History of L.A.'s Dingbat Apartment Buildings](https://www.bloomberg.com/news/features/2021-09-24/a-design-history-of-l-a-s-dingbat-apartment-buildings), [LA Digs](https://ladigs.com/los-angeles-dingbat-apartments/)

**Courtyard apartment:**
- Roughly **donut-shaped building** around a **rectangular courtyard** whose **long side runs perpendicular to the street** (forming the "donut hole")
- Entrance to the courtyard through an **open or gated breezeway through the first floor**
- Apartments ring the courtyard, **usually only a couple of stories high**, occasionally more

Sources: [Let's Go LA — Courtyard Buildings](https://letsgola.wordpress.com/2015/02/18/courtyard-buildings/), [LA Citywide Historic Context Statement — Multi-Family Residential Development 1910–1980 (PDF)](https://planning.lacity.gov/odocument/1a7b1647-4516-45da-9cff-db2db3b9b440/Multi-FamilyResidentialDevelopment_1910-1980.pdf)

**Googie:**
- **Upswept roofs**; **curvilinear, geometric shapes**; **bold use of glass, steel and neon**
- **Evolved out of Streamline Moderne** of the 1930s–40s

Sources: [AMLI — Googie Architecture Style in Los Angeles](https://www.amli.com/blog/googie-architecture-style-in-los-angeles), [Robb Report — Googie Architecture, Explained](https://robbreport.com/shelter/gallery/googie-architecture-explained-los-angeles-1235623713/)

**Streamline Moderne:**
- A classic expression of **Art Deco**; a **more sleek and slender variety** of the 1920s–30s Deco style; the direct ancestor of Googie

Source: [Patrick Ediger — Mid-Century Modern & Googie](https://www.patrickediger.com/post/how-mid-century-modern-and-googie-architecture-changed-the-landscape-of-los-angeles-forever)

**Spanish Colonial Revival:**
- **Stucco exteriors** and **red tile roofs**

Source: [Landmarks Architects — Los Angeles Architectural Styles](https://landmarksarchitects.com/los-angeles-architectural-styles/)

**Mini-mall / strip mall:**
- When **gas stations began disappearing in the 1970s** (a result of the oil crisis), developers bought the **cheap corner lots** they had occupied and converted them into strip malls — **stuccoed centers united by small parking lots**.
- **A structure at Osborne Street and Woodman Avenue in Panorama City, constructed in 1973, is considered (per LA Times reporter Mary Melton) to have been the first mini-mall since the 1920s.**

Sources: [Metropolis — How Strip Malls Reflect the Diversity of Los Angeles's Neighborhoods](https://metropolismag.com/viewpoints/los-angeles-strip-malls/), [PCAD](https://pcad.lib.washington.edu/building/6715)

> **Authoring rule that falls out of this:** the mini-mall lives on the **corner lot**, one story, stucco, L-shaped around a small parking apron with the parking **in front** and signage stacked on a pylon. Since it descends from gas-station parcels, place them at **intersections of arterials**, not mid-block. Combined with the dingbat (mid-block, 2-story, lot-line-to-lot-line), these two typologies alone generate most of the LA sprawl fabric.

---

## 7. Open-world city scale — comparative table

| Game | Real place | Stated area | Notes / verification |
|---|---|---|---|
| **GTA V** (2013) | Greater Los Angeles + hinterland | **~49 sq mi / 127 km²** total incl. water; **~75.84 km²** also widely cited, described as **70% land / 30% water** | The two figures are **not reconciled** across sources — the 127 km² number appears to include the full water/ocean extent, the 75.84 km² the playable landmass+near water. Described as **roughly one-tenth the size of the City of Los Angeles (1,305 km²)**. Larger than the real San Francisco, Paris, or central Tokyo; **over twice the size of Manhattan**. |
| **Marvel's Spider-Man** (PS4, 2018) | Manhattan | **~4.6 sq mi (~11.9 km²)** | **Roughly 1/4 scale of Manhattan.** In-game island is **over 3.5 mi long**, **~1.2 mi wide**, **~1.5 mi at its widest**. The island is **proportionally wider in the game than in real life** — deliberate distortion for gameplay. Map is **6× Sunset Overdrive**; Insomniac's biggest game at the time. |
| **L.A. Noire** (2011) | Los Angeles, **1947** | **8 sq mi (~20.7 km²)** | "Near-perfectly recreated." Team Bondi consulted LA-area archives; at the **Huntington Library** they found map collections that let them reconstruct the street layout of an era **before the Hollywood or Harbor freeways**, plus building locations and conditions, public transportation routes and traffic patterns. |
| **True Crime: Streets of LA** (2003) | Los Angeles | **240 sq mi (620 km²)** | Verified: "an extensive 240-square-mile (620 km²) re-creation of a large part of Los Angeles with most street names, landmarks, and highways," including most of Beverly Hills and Santa Monica. **Buildings are random except for certain landmarks.** Downtown → Santa Monica takes ~**15 minutes** driving the 10. **The cautionary tale: largest area, thinnest content.** |
| **Midnight Club: Los Angeles** (2008) | Los Angeles | area not stated | **Four areas: Hollywood, Downtown, the Beaches, the Hills**; a fifth (**South Central**) added by the Premium Upgrade, **~1/3 the size of the original map**, extending **south to the 105 Freeway**. Map equals **all three cities of Midnight Club 3: DUB Edition combined**. Real landmarks reproduced: **Exposition Park, USC campus, Watts Towers, Shrine Auditorium, Crenshaw Plaza, LA Memorial Coliseum**. Approach = **named districts + real landmark anchors**, not a continuous accurate grid. |
| **Just Cause 1 / 2 / 3 / 4** | fictional | **1,025 / ~1,035.55 / ~2,025 (≈45 × 45 km) / 1,024 km²** | Included for the upper bound. JC2 **loads the entire map** with very low LOD at distance, so better hardware simply sees further in more detail. Orders of magnitude larger than any LA game and correspondingly sparse. |

### 7.1 GTA V district → real place mapping (confirmed)

| Los Santos | Real Los Angeles |
|---|---|
| **Vinewood** | Hollywood |
| **Vinewood Sign** | Hollywood Sign |
| **Vespucci Beach** | Venice Beach |
| **Del Perro** | Santa Monica |
| **Del Perro Pier** | Santa Monica Pier |
| **Rockford Hills** | Beverly Hills |
| **Davis / South Los Santos** | South Central |
| **Little Seoul** | Koreatown |
| **Downtown Los Santos** | Downtown LA |

Sources: [GTA Wiki — Los Santos (HD Universe)](https://gta.fandom.com/wiki/Los_Santos_(HD_Universe)), [Beebom — GTA 5 Map Guide](https://beebom.com/gta-5-map-guide/), [archup — Comparing the Los Santos map to Los Angeles](https://archup.net/comparing-los-santos-map-los-angeles/), [ExpertBeacon](https://expertbeacon.com/how-accurate-is-gta-map-to-la/)

### 7.2 Vertical exaggeration — Mount Chiliad

- **Mount Chiliad is 2,744 m in-game**, the highest peak in San Andreas.
- Compare **Mount Lee at 521 m**. That is a **~5.3× vertical exaggeration** over the real Hollywood Hills equivalent, and taller than any peak in the LA Basin's immediate surrounds.
- Rockstar horizontally **compressed ~10:1** while vertically **exaggerating ~5×**. The lesson: horizontal compression makes a city feel small, and exaggerated verticality is the cheap compensation — it restores a sense of scale and gives long sightlines a terminus.

Sources: [GTA Wiki — Mount Chiliad (HD Universe)](https://gta.fandom.com/wiki/Mount_Chiliad_(HD_Universe)), [GTAForums — Mt. Chiliad and other mountains height research](https://gtaforums.com/topic/539308-research-mt-chiliad-and-other-mountains-height/)

### 7.3 Confirmed compression ratios

Only two are firmly established:

- **GTA V vs City of Los Angeles: ~1:10 by area** (127 km² vs 1,305 km²).
- **Spider-Man PS4 vs Manhattan: ~1:4 by area**, with **deliberate aspect-ratio distortion** (the island made proportionally wider than reality).

Both are area ratios. A 1:4 area ratio is a **1:2 linear** compression; 1:10 area is **~1:3.2 linear**. The general principle — block-count reduction, why designers shrink blocks and narrow streets, landmark density vs realism — was **not researched**; see §8.

---

## 8. OPEN — NOT RESEARCHED

**Read this before assuming the document is complete.** Six items were not finished when research was halted.

### (a) Visibility-in-miles → haze/fog parameters — NOT DONE

What is missing: average and range of **visual range in miles/km** for the LA Basin, decadal trend, brown-layer inversion depth, and the mapping to fog/depth-haze parameters.

**A primary source is already downloaded and cached — do not re-fetch it:**
```
/Users/calvinyang/.claude/projects/-Users-calvinyang-game-prototype/139f27c4-90b3-46af-8070-e17c8403949a/tool-results/webfetch-1785374656488-qj3r5v.pdf
```
This is LaDochy & Fuentes, **"Visibility trends in the Los Angeles Basin, 1933–present"** ([original URL](https://www.witpress.com/Secure/elibrary/papers/AIR99/AIR99099FU.pdf)). WebFetch could not parse it (binary), but `pypdf` is already installed at:
```
/private/tmp/claude-501/-Users-calvinyang-game-prototype/139f27c4-90b3-46af-8070-e17c8403949a/scratchpad/pylibs
```
Extract with `PYTHONPATH=<that path> python3 -c "import pypdf; ..."`. **This one extraction should close item (a).**

Partial fragments obtained but insufficient to build fog parameters from:
- In the LA area it is common to get reports of **clear skies below 12,000 ft and 3-mile visibility in haze** under typical conditions ([AOPA — California Flying](https://www.aopa.org/news-and-media/all-news/2005/september/pilot/california-flying-(9)))
- **1943**, LA's first lingering smog event: visibility reduced to **three city blocks**
- **1955** downtown smog measured **0.68 ppm** — nearly **three times** the highest level recorded in 1996
- 1950s photographs show pollution thick enough to obscure the tops of skyscrapers
- Mountains trap pollution in the Basin; **inversions** act as a lid holding cold smoggy air near the ground
- Coastal visibility correlates most with **humidity**; inland visibility correlates more with **nitrates and sulfates**
- Sources: [Water and Power Associates — Smog in Early Los Angeles](https://waterandpower.org/museum/Smog_in_Early_Los_Angeles.html), [Caltech — Fifty Years of Clearing the Skies](https://www.caltech.edu/about/news/fifty-years-clearing-skies), [Sierra Club](https://www.sierraclub.org/sierra/2023-2-summer/notes-here-there/la-s-battle-against-smog-isn-t-over), [Clarity.io](https://www.clarity.io/blog/a-closer-look-at-los-angeles-infamous-summer-smog-what-drives-this-air-pollution-phenomenon)

### (b) DTLA and suburban block dimensions — NOT DONE

Only weak/secondary figures were obtained, and they conflict:
- One general source: *"Los Angeles has an average city block measuring around 350 feet on each side"*; and *"in many parts of the United States, particularly the South and West, one city block typically measures about 300 feet."* These are **tertiary blog sources, not authoritative** — do not build on them.
- Better lead, **not yet followed**: the **Ord survey in varas**. The Homestead Museum blog on the 1849 Ord survey mentions lots of **40 varas wide × 56 varas deep** (a vara ≈ 3 ft) and blocks *"respectively 112 and 200 yards long"* in different areas of the survey. → [All Over the Map: Jonathan Temple and the Ord Survey of Los Angeles, 1849](https://homesteadmuseum.blog/2020/09/27/all-over-the-map-jonathan-temple-and-the-ord-survey-of-los-angeles-1849/)
  - **112 yards = 336 ft = 102 m; 200 yards = 600 ft = 183 m.** These are plausible and worth confirming against a primary source.
- Cross-check available from §5.4: 15 blocks over ~1.3 mi of Hollywood Blvd ⇒ **~460 ft (140 m) per block** in Hollywood. Note Hollywood is on the cardinal grid, not the Ord grid, so DTLA blocks may differ.
- Also unexamined: [LAMC Sec. 17.05 Design Standards](https://codelibrary.amlegal.com/codes/los_angeles/latest/lapz/0-0-0-13784) (subdivision design standards — likely contains maximum block length for new subdivisions, which would give the suburban figure directly).

### (c) District-by-district visual character writeup — NOT DONE

Districts with **no** dedicated research yet: **DTLA financial core** (partial — see tower list), **Arts District**, **Skid Row-adjacent industrial**, **Griffith Park/Observatory as an environment**, **the freeway system as a visual system** (I-10/I-110 interchange lane counts and geometry, freeway mileage, sound walls, on-ramp spacing), **palm-lined boulevards as named cases** (Windsor Blvd, Beverly Hills rows were requested and **not** researched).

Districts with usable material already in this document: Historic Core / Broadway (§5.5), Koreatown (§5.8), Hollywood (§5.4, §3.4), Sunset Strip (§5.9), Venice (§5.7), Santa Monica Pier (§5.6), LA River (§5.1), Four Level (§5.3), Sixth Street Viaduct (§5.2).

Also **not** researched: Chinese Theatre, materials/color palettes per district, signage inventories, specific vegetation per district.

### (d) LA street tree species percentages — NOT DONE

Have only totals (§6.2: ~700,000 street trees, 6,700 mi of streets, ~1,000 species). **No per-species share** for jacaranda, ficus/Indian laurel, magnolia, eucalyptus, crape myrtle. **Queen palm heights also missing** (§6.1).

Untried leads: [ScienceDirect — "Diversity and structure in California's urban forest: what over six million data points tell us"](https://www.sciencedirect.com/science/article/pii/S1618866722002229) (most promising — six million trees, should have species ranks), [StreetsLA policies and guidelines](https://streets.lacity.gov/resources/policies-and-guidelines), [Center for Data Innovation — Tracking Street Trees in Los Angeles](https://datainnovation.org/2024/05/tracking-street-trees-in-los-angeles/).

### (e) Superhero-flight streaming specifics — NOT DONE

Searches for **Prototype**, **Crackdown**, **Saints Row IV**, and **Superman** games returned **no usable technical figures** — no world sizes in km², no traversal speeds, no draw distances, no streaming/LOD architecture. Confirmed only that Saints Row IV's Super Sprint has multiple tiered speed upgrades and a glide upgrade over Steelport ([Saints Row Wiki](https://saintsrow.fandom.com/wiki/Super_Powers_in_Saints_Row_IV)) — no numbers.

What *is* usable and already captured: Spider-Man PS4's 1:4 Manhattan compression and dimensions (§7), and Just Cause 2's load-everything-at-low-LOD approach (§7).

Untried leads: **Insomniac GDC talks** on Spider-Man traversal and streaming; Spider-Man 2 "speed" press material (a Regina Leader-Post piece "Speed will thrill in Spider-man 2" surfaced but was not read); Rockstar/Avalanche technical postmortems.

### (f) Final synthesis: recommended world extent, chunk size, near/far planes — NOT COMPLETED

A **PROVISIONAL** recommendation is given in §9 below. It is derived from the float32 analysis and the comparative scale table, both of which *are* confirmed. Treat the numbers as a starting position to be challenged, not as a researched conclusion.

---

## 9. Float32 precision, depth buffer, and PROVISIONAL scale recommendation

### 9.1 The float32 math (confirmed)

- A 32-bit float has **24 bits of precision** — 23 mantissa bits plus one implicit leading 1.
- **For a value X, the precision near X is X · 2⁻²⁴.** This is the whole story; everything else follows.
- Consequences, worked:

| Required precision | Max distance from origin |
|---|---|
| **0.1 mm** (10⁻⁴ m) | 10⁻⁴ × 2²⁴ = **1,678 m (1.678 km)** |
| **1 mm** (10⁻³ m) | **16,780 m (16.78 km)** |
| **1 cm** | ~167.8 km |

- Stated bluntly in one source: *"if the minimum absolute position precision needed is around 1 mm, floats cannot achieve that beyond a 10 km scale."*
- At magnitude **~4 × 10⁸ the smallest float32 increment is 64** — total quantization collapse. (This is why Earth-centered coordinates at ~6,371,000 m are unworkable on the GPU.)
- Practical guidance found: for open-world games, **a playable on-foot area not exceeding 8,192 × 8,192 m centered on the world origin keeps precision acceptable even for a first-person game.**
- float32 also only has **~16 million distinct values** available in total.

Sources: [Frozen Fractal — Around The World, Part 14: Floating the origin](https://frozenfractal.com/blog/2024/4/11/around-the-world-14-floating-the-origin/), [GameDev.net — Determining player size and speed for optimal floating point accuracy](https://gamedev.net/forums/topic/715570-determining-player-size-and-speed-for-optimal-floating-point-accuracy/), [Demofox — Demystifying Floating Point Precision](https://blog.demofox.org/2017/11/21/floating-point-precision/), [Godot docs — Large world coordinates](https://github.com/godotengine/godot-docs/blob/4.2/tutorials/physics/large_world_coordinates.rst), [pythonspeed — The problem with float32](https://pythonspeed.com/articles/float64-float32-precision/)

### 9.2 What this means in three.js specifically (confirmed)

- **Reported jitter threshold: around 200,000 coordinate units.** On the three.js forum, a `PlaneGeometry` of `200000 × 200000` produces noticeable jitter; **adding intermediate vertices** (subdividing from 1×1 to 2×2 segments) resolves it. So part of the "jitter" at large scale is a *geometry* problem (huge triangles interpolated in float32), not only a *transform* problem.
- **Adjusting near/far planes provides limited benefit** unless objects remain relatively close to the origin regardless of absolute coordinate magnitude.
- **Skinned/bone models exhibit unique deformation problems at large coordinates** that standard fixes do not address — suggesting shader-level precision loss during bone calculations. **Relevant: a superhero character is a skinned mesh.** If the player model deforms at distance, this is the cause.
- Three.js has the same core problem as CesiumJS and Unreal: **the GPU uses float32**, and in three.js **precision is destroyed before the transform is applied**, so Cesium's origin-shift trick does not transplant directly.
- The industry mitigation is **floating origin** / **camera-relative rendering** / **Relative-To-Center (RTC)**: define every position relative to an origin close enough that float32 suffices for the offset. Floating origin is *"typically used in 3D video games with large or procedurally infinite worlds to avoid rendering glitches caused by precision loss ... when moving the camera or player far away from the origin"*; the characteristic artifact is *"graphical spatial jitter caused by vertices in polygon meshes snapping to the nearest available coordinate."*

Sources: [three.js forum — Large coordinates](https://discourse.threejs.org/t/large-coordinates/50621), [Precision-Safe Rendering of Large-Coordinate CAD Drawings in Three.js](https://medium.com/@mlightcad/precision-safe-rendering-of-large-coordinate-cad-drawings-in-three-js-c49c299b3afc), [Wikipedia — Floating origin](https://en.wikipedia.org/wiki/Floating_origin), [CESIUM_RTC glTF extension](https://github.com/liwcv/glTF/blob/master/extensions/1.0/Vendor/CESIUM_RTC/README.md)

### 9.3 Logarithmic depth buffer (confirmed)

- `logarithmicDepthBuffer` gives *"a constant range of z-buffer precision over the whole scene, rather than the normal linear z-buffer which concentrates all of the precision closest to the near plane."*
- When active it *"allows the camera to have a camera near plane of 0 and a far plane of any size, without suffering z-fighting or tearing of geometry."*
- It is intended for **very large scenes with wildly mixed object scales** — the three.js example runs a **far plane of 1e24**, spanning **1 micrometer to 120,000 light years**.
- **Costs, and why it is off by default:** it depends on **`EXT_frag_depth`** (available in release Chrome and part of the WebGL2 spec), and *"there are performance implications in addition to issues with small scales."* Writing `gl_FragDepth` in the fragment shader **defeats early-Z / hierarchical-Z rejection**, so overdraw becomes much more expensive — a real concern for a dense city viewed from the air.
- Enable via `new THREE.WebGLRenderer({ logarithmicDepthBuffer: true })`.
- General rule stated: *"the ratio of the near clipping plane to far clipping plane should be adjusted as appropriate to ensure a desired minimum level of Z-buffer precision."*

Sources: [three.js docs — WebGLRenderer.logarithmicDepthBuffer](https://threejs.org/docs/#api/en/renderers/WebGLRenderer.logarithmicDepthBuffer), [three.js example — logarithmic depth buffer](https://threejs.org/examples/webgl_camera_logarithmicdepthbuffer.html), [three.js PR #3880 — Logarithmic depth buffer support](https://github.com/mrdoob/three.js/pull/3880), [Camera near/far and z-fighting](https://quanleio.hashnode.dev/camera-near-far-and-z-fighting)

### 9.4 The key implication, stated explicitly

**Float32 is NOT the binding constraint on this project's world size.** Run the numbers against the plausible design space:

| World half-extent | Worst-case float32 precision at the far corner (X · 2⁻²⁴) | Verdict |
|---|---|---|
| ±2,048 m (4 km world) | **0.12 mm** | Vastly more than adequate |
| ±3,072 m (6 km world) | **0.18 mm** | Vastly more than adequate |
| ±4,096 m (8 km world) | **0.24 mm** | Comfortable |
| ±8,192 m (16 km world) | **0.49 mm** | Still comfortable; matches the published 8,192 m guidance |
| ±16,384 m (33 km world) | **0.98 mm** | ~1 mm — the documented practical edge |

At **any** world size a hand-authoring team can realistically fill, position precision is sub-millimetre. **The real constraints are (i) content authoring cost, (ii) draw-call/overdraw budget in a browser, and (iii) depth-buffer precision — not coordinate precision.**

Two caveats that *do* bite before 16 km:
1. **Large single meshes must be subdivided.** The 200,000-unit jitter report was a *single 200,000-unit plane*. Ground planes, water bodies, and the LA River channel must be broken into tiles with intermediate vertices regardless of world size.
2. **Skinned meshes degrade at large coordinates** independently of world extent. Camera-relative rendering protects the player character; a floating origin is cheap insurance even in a 4 km world.

### 9.5 PROVISIONAL recommendation — CHALLENGE THIS

> ⚠️ **This section is provisional.** It was written after research was halted and is not itself a researched result. It is a defensible starting position derived from §9.1–§9.4 (confirmed) and §7 (confirmed). Item (f) in §8 remains open.

**World extent — recommend 4,096 × 4,096 m (16.8 km²), hard ceiling 6,144 × 6,144 m (37.8 km²).**

Reasoning:
- **16.8 km² is ~1.4× Spider-Man PS4's ~11.9 km²** and about **13% of GTA V's 127 km²**. Spider-Man's map was built by a large AAA studio; matching it is already ambitious for a browser project with hand-authored streets.
- **True Crime: Streets of LA is the cautionary bound**: 620 km² of real street grid with *"buildings random except for certain landmarks."* Area without authored content produces exactly the failure this project is trying to avoid by rejecting OSM import.
- Applying GTA V's ~1:10 area compression to the City of LA's 1,305 km² gives 127 km² — far beyond hand-authoring. Applying Spider-Man's ~1:4 to a *selected subset* of LA is the right mental model: **do not compress all of LA, choose ~6–8 districts and compress each less aggressively.**
- Keep the world **centered on the origin** (±2,048 m) so float32 precision at the corner is 0.12 mm and there is headroom to grow to ±3,072 m without revisiting anything.

**Suggested district budget within 4,096 × 4,096 m,** using confirmed real dimensions as the compression yardstick:
- DTLA core (Ord 36° grid) — the tower cluster from §3.1, flat helipad roofs
- Historic Core / Broadway — 6 blocks, 12 marquees (§5.5) — this one should be near **1:1**, it is small and dense already
- Hollywood Blvd corridor — the Walk of Fame is only **1.3 mi (2.1 km)** real (§5.4), so it fits at **~1:2** within the world
- Koreatown — density without towers (§5.8)
- Sunset Strip — **1.6 mi (2.6 km)** real (§5.9), fits at ~1:2
- Hollywood Hills / Observatory — vertical relief up to **~521 m** (§4)
- LA River channel + Sixth Street Viaduct — the **3,500 ft (1,100 m)** viaduct (§5.2) is ~27% of the world's width at 1:1, so compress to ~1:3
- Venice / beach + pier — canals at **50 ft** wide, pier **500 m** (§5.6, §5.7)

The **Historic Core lesson**: several of LA's most iconic set-pieces are genuinely small (6 blocks, 1.3 mi, 1.6 mi). Build those at or near 1:1 and compress only the *connective tissue* between districts. This is the opposite of uniform scaling and is probably the single most important authoring decision.

**Chunk size — recommend 256 m, i.e. a 16 × 16 grid of 256 chunks for a 4,096 m world.**
- 256 m is roughly **2 LA blocks plus their streets** if a block is ~100–140 m (see §8(b) — block dimensions are unconfirmed, so **this number should be revisited once (b) is closed**).
- Chunk boundaries should fall on **street centerlines**, never through buildings.
- 3 LOD rings suggested; at flight speed prefetch along the velocity vector, not radially.
- Alternative if draw calls dominate: 512 m chunks (8 × 8 = 64 chunks) with more aggressive per-chunk merging.

**Near/far planes — recommend near 0.5 m, far 12,000 m, WITHOUT logarithmicDepthBuffer initially.**
- A 4,096 m world has a ground diagonal of ~5,800 m. Add flight altitude (the marine layer sits below ~760 m, Mt Lee is 521 m, towers reach 335 m) and a far plane of **~12,000 m** guarantees you never see the world edge clip.
- **near 0.5 / far 12,000 = a ratio of 2.4 × 10⁴.** With a 24-bit depth buffer this is workable. **near 0.1 would give 1.2 × 10⁵ and is likely to z-fight** — resist the temptation to set a tiny near plane.
- Prefer **reversed-Z** or simply a generous near plane over `logarithmicDepthBuffer`, because of the confirmed `EXT_frag_depth` early-Z penalty (§9.3) — a dense city seen from above is overdraw-heavy, exactly the case where losing early-Z hurts most. Enable log depth only if z-fighting proves unfixable.
- **Hide the far plane with atmospheric haze**, never with a visible clip. Provisional: haze onset ~1,200 m, saturating ~6,000 m. **These two numbers are guesses** — item (a) in §8 exists precisely to replace them with real LA visual-range data.
- Implement **camera-relative rendering / floating origin** from the start regardless of world size, as insurance against the skinned-mesh degradation in §9.2.

---

## 10. Source index

Primary / authoritative:
- [Standard Plan S-470-1, Standard Street Dimensions (as Exhibit E to CPC-2013-0910)](https://cityclerk.lacity.org/onlinedocs/2015/15-0719_misc_11_06-10-2015.pdf)
- [Mobility Plan 2035 Draft EIR Ch. 3 — Street Classifications, Tables 3.3 & 3.4](https://losangeles2b.wordpress.com/wp-content/uploads/2012/12/street-classifications.pdf)
- [LA Bureau of Engineering Street Design Manual](https://completestreetdesignmanual.engineering.lacity.gov/) — E 612 (widths/lanes), E 652 (sidewalks), E 391 (grades), E 516 (alley grades)
- [LA City Planning — Mobility Plan 2035](https://planning.lacity.gov/plans-policies/initiatives-policies/mobility)
- [LA Complete Street Design Guide (PDF)](https://planning.lacity.gov/odocument/c9596f05-0f3a-4ada-93aa-e70bbde68b0b/Complete_Street_Design_Guide.pdf)
- [LAFD Requirement No. 10, revised 11/17/2014](https://lafd.org/sites/default/files/pdf_files/EHLF-Reg10.pdf)
- [LA Citywide Historic Context Statement — Multi-Family Residential 1910–1980](https://planning.lacity.gov/odocument/1a7b1647-4516-45da-9cff-db2db3b9b440/Multi-FamilyResidentialDevelopment_1910-1980.pdf)
- [LA River Master Plan — Kit of Parts](https://larivermasterplan.org/design/kit-of-parts/concrete-channel/)
- [three.js docs — logarithmicDepthBuffer](https://threejs.org/docs/#api/en/renderers/WebGLRenderer.logarithmicDepthBuffer) · [PR #3880](https://github.com/mrdoob/three.js/pull/3880) · [forum: Large coordinates](https://discourse.threejs.org/t/large-coordinates/50621)

Note: `completestreetdesignmanual.engineering.lacity.gov` and `planning.lacity.gov/odocument/*` return **HTTP 403 to WebFetch** but serve fine to `curl` with a browser User-Agent. Use curl + local HTML/PDF parsing for those hosts.

Cached locally (do not re-download):
- LaDochy & Fuentes, *Visibility trends in the Los Angeles Basin, 1933–present* → `/Users/calvinyang/.claude/projects/-Users-calvinyang-game-prototype/139f27c4-90b3-46af-8070-e17c8403949a/tool-results/webfetch-1785374656488-qj3r5v.pdf`
- Mobility Plan 2035 street classifications → `/Users/calvinyang/.claude/projects/-Users-calvinyang-game-prototype/139f27c4-90b3-46af-8070-e17c8403949a/tool-results/webfetch-1785374008302-rhl69y.pdf`
- S-470-1 → `/private/tmp/claude-501/-Users-calvinyang-game-prototype/139f27c4-90b3-46af-8070-e17c8403949a/scratchpad/s470.pdf`
- `pypdf` installed at `/private/tmp/claude-501/-Users-calvinyang-game-prototype/139f27c4-90b3-46af-8070-e17c8403949a/scratchpad/pylibs`
