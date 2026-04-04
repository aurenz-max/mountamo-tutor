# PRD: K-12 Economics Primitives Suite

## Executive Summary

Economics is a core social studies strand required across all 50 US states, yet Lumina has zero economics primitives. The platform's existing infrastructure — interactive canvas simulations, drag-and-drop, real-time graphing, Gemini content generation, and multi-phase evaluation — is perfectly suited for economics education, where the core challenge is making abstract systems tangible through visualization and simulation.

This PRD proposes **20 new primitives** spanning elementary economic concepts (wants vs needs, exchange, prices) through advanced microeconomics and macroeconomics (marginal analysis, monetary policy, market structures). The design philosophy follows the "living simulation" pattern: students don't read about markets — they *run* them.

---

## Standards Alignment

Economics education maps to three major frameworks:

| Framework | Scope | Our Coverage |
|-----------|-------|-------------|
| **Council for Economic Education (CEE)** — 20 Standards | K-12, voluntary national | Primary alignment target |
| **C3 Framework (NCSS)** — Dimension 2, Economics | K-12, widely adopted | Secondary alignment |
| **AP Economics** (Micro + Macro) | Grades 11-12 | Advanced primitives |

### CEE Standards Mapped

| CEE Standard | Primitives Targeting It |
|---|---|
| 1. Scarcity | `wants-needs-sorter`, `resource-allocator` |
| 2. Decision Making | `opportunity-cost-calculator`, `resource-allocator` |
| 3. Allocation | `resource-allocator`, `market-simulator` |
| 4. Incentives | `incentive-explorer`, `market-simulator` |
| 5. Trade | `trade-route-builder`, `comparative-advantage-lab` |
| 6. Specialization | `comparative-advantage-lab` |
| 7. Markets & Prices | `supply-demand-grapher`, `market-simulator`, `price-discovery-auction` |
| 8. Role of Prices | `price-discovery-auction`, `supply-demand-grapher` |
| 9. Competition | `market-structure-analyzer`, `market-simulator` |
| 10. Institutions | `circular-flow-explorer` |
| 11. Money | `money-and-banking-sim`, `inflation-dashboard` |
| 12. Interest Rates | `money-and-banking-sim` |
| 13. Income | `circular-flow-explorer`, `labor-market-sim` |
| 14. Entrepreneurship | `business-builder` |
| 15. Investment | `investment-portfolio-lab` |
| 16. Government Role | `fiscal-policy-mixer`, `market-simulator` |
| 17. Government Failure | `fiscal-policy-mixer` |
| 18. Economic Fluctuations | `business-cycle-tracker`, `inflation-dashboard` |
| 19. Unemployment & Inflation | `inflation-dashboard`, `labor-market-sim` |
| 20. Fiscal & Monetary Policy | `fiscal-policy-mixer`, `monetary-policy-console` |

---

## Available Multimodal Infrastructure

| Capability | Existing Service | Economics Usage |
|-----------|---------|----------------|
| **Interactive Canvas** | Canvas/SVG in engineering primitives | Supply-demand curves, circular flow diagrams, business cycle graphs |
| **Drag-and-Drop** | React DnD (word-builder, engineering) | Sort goods, allocate resources, build trade routes |
| **Sliders & Controls** | Engineering primitives (PropulsionLab, etc.) | Adjust price, quantity, tax rate, interest rate |
| **Real-Time Graphing** | GraphBoard, DoubleNumberLine | Supply/demand curves, cost/revenue graphs, Phillips curve |
| **Multi-Phase Evaluation** | `useChallengeProgress`, `usePhaseResults` hooks | Predict → Simulate → Analyze pattern |
| **Gemini Generation** | All generator services | Context-appropriate scenarios, market data, economic narratives |
| **AI Tutoring** | Gemini tutoring sessions | Socratic questioning about economic reasoning |

---

## Proposed Primitives (20)

---

## TIER 1: Elementary Foundations (Grades K-3)

### 1. `wants-needs-sorter` — Distinguish Wants from Needs

**What it does:** Students sort items into "wants" and "needs" categories by dragging illustrated cards into two zones. Items range from obvious (food, shelter → need; video game → want) to nuanced (phone — want or need? depends on context). After sorting, students encounter "tricky cards" where the answer depends on context — a winter coat is a need in Minnesota but not in Hawaii. Students explain their reasoning for edge cases.

**Multimodal features:**
- **Visual:** AI-generated illustrations for each item. Two sorting zones with clear visual distinction (house icon for needs, star icon for wants). Items animate into place on sort. Context cards show geographic/situational scenes.
- **Interactive:** Drag items to categories. Tap "tricky cards" to reveal context clues. Select reasoning from multiple choice for edge cases.

**Learning goals by grade:**
- K: Basic wants vs needs (food, water, shelter, clothing = needs; toys, candy = wants). 6-8 items.
- Grade 1: Expanded categories. Introduction of "services" (doctor, teacher). 10-12 items.
- Grade 2: Context-dependent sorting. "Is this a want or a need for ___?" Introduce "it depends" reasoning.
- Grade 3: Opportunity cost preview — "If you can only have one, which do you give up?" Rank wants by priority.

**Interaction model:** Phase 1 (Sort) — drag 8-12 items into wants/needs. Phase 2 (Tricky) — sort 3-4 context-dependent items with reasoning. Phase 3 (Reflect) — answer "What makes something a need?" in structured response.

**Evaluable:** Yes.

**Evaluation metrics:**
- `type: 'wants-needs-sorter'`
- `itemsSortedCorrectly` / `itemsTotal`
- `trickyItemsCorrect` / `trickyItemsTotal`
- `reasoningProvided` (boolean — did they explain edge cases)
- `contextType` ('basic' | 'situational' | 'cultural')
- `attemptsCount`

---

### 2. `opportunity-cost-calculator` — Every Choice Has a Cost

**What it does:** Students face real-world decision scenarios with limited resources (money, time, or both) and must choose how to allocate them. The primitive visualizes what they gain AND what they give up — the opportunity cost is always visible, never hidden. Scenarios progress from simple (spend your $5 allowance on ice cream OR a book) to multi-option (you have 3 hours after school — homework, soccer practice, video games, reading — pick 2, see the cost of the other 2).

**Multimodal features:**
- **Visual:** Balance-scale visualization showing chosen option vs opportunity cost. Budget bar that depletes as choices are made. "What you get" / "What you give up" split-screen. AI-generated scenario illustrations.
- **Interactive:** Select from 2-4 options per decision. Drag budget tokens to chosen items. Toggle between scenarios.

**Learning goals by grade:**
- K-1: Binary choices with clear trade-offs. "You can have A or B. If you pick A, you can't have B."
- Grade 2: Three-option choices. Introduction of the term "opportunity cost." Identify the next-best alternative.
- Grade 3: Multi-resource decisions (spend time AND money). Ranking alternatives. "Was the opportunity cost worth it?"
- Grade 4-5: Production possibility scenarios. Opportunity cost in community decisions (build a park or a parking lot).

**Interaction model:** Phase 1 (Choose) — face a scenario, make a choice. Phase 2 (Identify) — name the opportunity cost (what you gave up). Phase 3 (Evaluate) — compare your choice with the opportunity cost and explain your reasoning.

**Evaluable:** Yes.

**Evaluation metrics:**
- `type: 'opportunity-cost-calculator'`
- `opportunityCostIdentified` / `scenariosTotal`
- `reasoningQuality` (0-100, AI-assessed)
- `scenarioComplexity` ('binary' | 'multi-option' | 'multi-resource')
- `nextBestAlternativeCorrect` (boolean)
- `attemptsCount`

---

### 3. `trade-route-builder` — Why People and Countries Trade

**What it does:** A map-based simulation where students connect producers to consumers via trade routes. Start simple: a farmer has apples, a baker has bread — draw a trade line to show exchange. Progress to multi-party barter, then money as a medium of exchange. Advanced levels introduce geographic specialization (coastal towns fish, inland towns farm) and the concept that trade makes everyone better off when each party specializes.

**Multimodal features:**
- **Visual:** Illustrated map with producer/consumer nodes. Animated goods flowing along trade routes. Resource icons at each node. Trade surplus/deficit indicators. Routes animate with flowing goods when active.
- **Interactive:** Draw trade routes by dragging between nodes. Set trade terms (how many apples for how much bread). Add money as intermediary. Observe outcomes.

**Learning goals by grade:**
- K-1: Direct exchange — match who has what with who needs what. 2-3 traders.
- Grade 2: Barter problems (double coincidence of wants). Money solves barter problems. 3-4 traders.
- Grade 3: Geographic specialization. "Why does this town fish and that town farm?" 4-6 nodes.
- Grade 4-5: Voluntary trade benefits both parties. Surplus from specialization. Import/export concepts.

**Interaction model:** Phase 1 (Connect) — draw trade routes between nodes based on who produces what and who needs what. Phase 2 (Optimize) — adjust trade terms until both parties benefit. Phase 3 (Analyze) — answer "Why did this trade happen? Who benefits?"

**Evaluable:** Yes.

**Evaluation metrics:**
- `type: 'trade-route-builder'`
- `routesCorrect` / `routesRequired`
- `mutualBenefitAchieved` (boolean — both parties better off)
- `tradeTermsFair` (boolean — no exploitative ratios)
- `specializations identified` / `specializationsTotal`
- `moneyIntroduced` (boolean — did they use money to solve barter)
- `attemptsCount`

---

### 4. `resource-allocator` — Scarcity Forces Choices

**What it does:** Students manage a fixed pool of resources (time, money, materials, workers) and must allocate them across competing goals. The primitive makes scarcity visceral — you can see the resource pool shrinking as you allocate, and unmet goals turn red. Scenarios range from personal (plan your weekend with 10 hours) to community (your town has $100K — roads, school, park, library — allocate) to national (guns vs butter).

**Multimodal features:**
- **Visual:** Resource pool represented as a tangible bucket/bar that drains as allocations are made. Goal cards with satisfaction meters. Allocation sliders or drag-and-drop tokens. Results dashboard showing outcomes.
- **Interactive:** Drag resource tokens to goals or use sliders. See real-time impact on outcome meters. Compare multiple allocation strategies side-by-side.

**Learning goals by grade:**
- K-1: Limited toys/supplies, sharing and taking turns. "There aren't enough for everyone — what do we do?"
- Grade 2: Personal budget with 3 goals and not enough money for all. Prioritization.
- Grade 3: Community allocation — town budget with competing needs. Majority preference vs minority needs.
- Grade 4-5: National allocation (production possibilities). Trade-offs between categories (defense vs education).

**Interaction model:** Phase 1 (Allocate) — distribute resources across goals. Phase 2 (Observe) — see outcomes of your allocation. Phase 3 (Reflect) — answer "What didn't get funded? Was that the right trade-off?"

**Evaluable:** Yes.

**Evaluation metrics:**
- `type: 'resource-allocator'`
- `resourcesAllocated` / `resourcesTotal`
- `goalsFullyFunded` / `goalsTotal`
- `budgetBalanced` (boolean — didn't overspend)
- `tradeOffIdentified` (boolean — named what was sacrificed)
- `allocationEfficiency` (0-100, outcome score given constraints)
- `attemptsCount`

---

### 5. `incentive-explorer` — Why People Do What They Do

**What it does:** Students examine scenarios where incentives (positive and negative, monetary and non-monetary) drive behavior. The primitive presents a situation and asks "What would happen if...?" — then simulates the result. Examples: "What if the school gives extra recess for reading 5 books?" (positive incentive) → more students read. "What if littering gets a $50 fine?" (negative incentive) → less littering. Students predict outcomes, then see the simulation play out. Explores unintended consequences.

**Multimodal features:**
- **Visual:** Before/after scenes showing behavior change. Incentive cards (carrot = positive, stick = negative). Population behavior meter showing predicted vs actual response. AI-generated scenario illustrations.
- **Interactive:** Select/design incentives for scenarios. Predict outcomes with sliders. Compare prediction to simulation result.

**Learning goals by grade:**
- Grade 2: Basic positive incentives (rewards). "Why do people do X? Because they get Y."
- Grade 3: Positive vs negative incentives. Rules and consequences as incentives.
- Grade 4: Monetary vs non-monetary incentives. Price as incentive (higher price → people buy less).
- Grade 5: Unintended consequences. "The school rewards perfect attendance → sick students come to school." Perverse incentives.
- Grade 6-8: Incentive design challenges. "Design an incentive to reduce cafeteria food waste."

**Interaction model:** Phase 1 (Predict) — read the scenario, predict how people will respond to the incentive. Phase 2 (Simulate) — watch the simulated outcome. Phase 3 (Analyze) — compare prediction to result, identify any unintended consequences.

**Evaluable:** Yes.

**Evaluation metrics:**
- `type: 'incentive-explorer'`
- `predictionAccuracy` (0-100, how close to simulated outcome)
- `incentiveTypeIdentified` ('positive' | 'negative' | 'monetary' | 'non-monetary')
- `unintendedConsequenceFound` (boolean)
- `scenarioComplexity` ('basic' | 'multi-factor' | 'design-challenge')
- `attemptsCount`

---

## TIER 2: Middle School Core (Grades 5-8)

### 6. `supply-demand-grapher` — The Laws of Supply and Demand

**What it does:** An interactive coordinate-plane graphing tool where students build, shift, and interpret supply and demand curves. Students plot points from a data table to draw curves, then manipulate shifters (input costs, consumer income, number of sellers/buyers, preferences, expectations, related goods) and watch curves shift in real time. The equilibrium point updates dynamically. Students must predict the direction of shift before seeing it.

**Multimodal features:**
- **Visual:** Coordinate plane with price (Y) and quantity (X). Animated curve drawing as students plot points. Equilibrium point highlighted with price and quantity labels. Shifter control panel with labeled sliders. Surplus/shortage zones shaded when price is above/below equilibrium.
- **Interactive:** Plot points to build curves. Use shifter controls to shift curves. Predict shift direction before execution. Read equilibrium price/quantity from graph.

**Learning goals by grade:**
- Grade 5-6: Law of demand (price up → quantity down) and law of supply (price up → quantity up). Plot from data table. Find equilibrium.
- Grade 7: Demand shifters (income, preferences, related goods, expectations, number of buyers). Shift left/right with prediction.
- Grade 8: Supply shifters (input costs, technology, expectations, number of sellers, government policy). Combined shifts. Surplus and shortage analysis.
- Grade 9+: Elasticity introduction. Price ceilings and floors. Tax incidence.

**Interaction model:** Phase 1 (Build) — plot supply and demand curves from data. Identify equilibrium. Phase 2 (Shift) — given a scenario (e.g., "a drought destroys wheat crops"), predict which curve shifts and in which direction, then execute. Phase 3 (Analyze) — describe the new equilibrium and explain the real-world meaning.

**Evaluable:** Yes.

**Evaluation metrics:**
- `type: 'supply-demand-grapher'`
- `curveBuiltCorrectly` (boolean — points plotted with correct slope direction)
- `equilibriumIdentified` (boolean)
- `shiftDirectionPredicted` / `shiftsTotal`
- `surplusShortageIdentified` (boolean)
- `shifterType` ('demand' | 'supply' | 'both')
- `scenarioComplexity` ('single-shift' | 'double-shift' | 'with-controls')
- `attemptsCount`

---

### 7. `circular-flow-explorer` — How the Economy Connects

**What it does:** An interactive circular flow diagram where students build and trace the flows of money, goods/services, and resources between households, firms, government, and the foreign sector. Students drag flow arrows between sectors, label what flows along each arrow, and trace complete circuits. The model starts simple (two-sector: households ↔ firms) and adds sectors progressively (government taxes/spending, foreign trade).

**Multimodal features:**
- **Visual:** Animated circular flow diagram with sector nodes (house icon, factory icon, capitol building, globe). Flow arrows animate with icons representing what's flowing (dollar signs, briefcases, goods). Real-time GDP calculation from flow volumes.
- **Interactive:** Drag arrows between sectors. Label each arrow's flow. Add/remove sectors. Adjust flow volumes with sliders and see GDP change.

**Learning goals by grade:**
- Grade 5-6: Two-sector model (households provide labor, firms provide goods). Product market vs factor market.
- Grade 7: Add government sector (taxes, public services). Transfer payments.
- Grade 8: Add foreign sector (imports, exports). Net exports and trade balance.
- Grade 9+: Injections and leakages. Multiplier effect introduction. Savings → investment flow.

**Interaction model:** Phase 1 (Build) — construct the circular flow by drawing arrows between sectors. Phase 2 (Label) — label each arrow with what flows (money, goods, labor, etc.). Phase 3 (Trace) — follow a dollar through the complete circuit and explain each stop.

**Evaluable:** Yes.

**Evaluation metrics:**
- `type: 'circular-flow-explorer'`
- `arrowsCorrect` / `arrowsRequired`
- `labelsCorrect` / `labelsRequired`
- `circuitTraced` (boolean — followed a complete loop)
- `sectorsIncluded` (count: 2, 3, or 4)
- `gdpCalculationCorrect` (boolean, advanced)
- `attemptsCount`

---

### 8. `market-simulator` — Run a Market

**What it does:** A full market simulation where the student plays the role of a seller (set price, choose quantity to produce) competing against AI sellers in a market with AI buyers. The simulation runs in rounds — each round, buyers with different willingness-to-pay decide whether to buy, and sellers see their revenue, costs, and profit. Students learn that market forces push price toward equilibrium without anyone planning it. Introduces surplus, shortage, competition, and price discovery through lived experience rather than graph reading.

**Multimodal features:**
- **Visual:** Market dashboard with: price/quantity controls, live transaction log, profit/loss tracker, competitor prices sidebar, buyer satisfaction meter. Round-by-round graph building up the market history. AI buyer agents visualized as avatars with speech bubbles ("Too expensive!" / "Great deal!").
- **Interactive:** Set your price each round. Choose quantity to stock. Watch transactions execute. Adjust strategy based on results. View market statistics.

**Learning goals by grade:**
- Grade 5-6: Set price, see demand respond. "If I charge too much, nobody buys. Too little, I lose money." Find a profitable price.
- Grade 7: Competition — multiple sellers, race to equilibrium. Undercutting, price wars, differentiation.
- Grade 8: Costs introduced — producing more has increasing marginal cost. Profit = revenue - cost.
- Grade 9+: Perfect competition convergence. Consumer and producer surplus. Introduction to market efficiency.

**Interaction model:** Phase 1 (Setup) — choose what to sell, set initial price. Phase 2 (Simulate) — run 5-8 market rounds, adjusting price each round. Phase 3 (Analyze) — review your profit history, identify optimal pricing strategy, explain why the market settled where it did.

**Evaluable:** Yes.

**Evaluation metrics:**
- `type: 'market-simulator'`
- `totalProfit` (cumulative over rounds)
- `priceConvergedToEquilibrium` (boolean — final price within 10% of market equilibrium)
- `roundsPlayed`
- `strategyAdaptation` (0-100 — did they adjust based on feedback)
- `surplusShortageCreated` (count of rounds with unsold inventory or unmet demand)
- `attemptsCount`

---

### 9. `price-discovery-auction` — How Markets Find Prices

**What it does:** Students participate in a simulated auction that demonstrates how prices emerge from the interaction of buyers and sellers — nobody sets "the right price," the market discovers it. Multiple formats: English auction (ascending bids), Dutch auction (descending price), sealed-bid, and double auction (buyers and sellers post offers simultaneously). Students play as both buyer and seller across rounds and see how the auction mechanism aggregates private valuations into a market price.

**Multimodal features:**
- **Visual:** Auction floor visualization with bidder avatars. Live bid ticker. Price chart building in real-time. Buyer/seller surplus shaded on final price graph. Auction format comparison dashboard.
- **Interactive:** Place bids (as buyer) or set ask prices (as seller). Watch AI agents bid. Compare outcomes across auction formats.

**Learning goals by grade:**
- Grade 5-6: English auction — highest bidder wins. "Why did the price stop where it did?" Concept of willingness to pay.
- Grade 7: Seller side — setting reserve prices, understanding willingness to sell. Double auction introduction.
- Grade 8: Comparing auction mechanisms — which is "fairer"? Which finds the true market price faster? Winner's curse concept.
- Grade 9+: Efficient market hypothesis introduction. Information aggregation. Auction theory applications (spectrum auctions, eBay).

**Interaction model:** Phase 1 (Bid) — participate in 3-5 auction rounds as buyer or seller. Phase 2 (Analyze) — identify the market-clearing price and explain why it settled there. Phase 3 (Compare) — try a different auction format and compare outcomes.

**Evaluable:** Yes.

**Evaluation metrics:**
- `type: 'price-discovery-auction'`
- `auctionsWon` / `auctionsParticipated`
- `surplusCaptured` (buyer surplus or seller surplus earned)
- `marketPriceIdentified` (boolean)
- `auctionFormat` ('english' | 'dutch' | 'sealed-bid' | 'double')
- `overbidCount` (times paid more than valuation — indicates understanding)
- `attemptsCount`

---

### 10. `comparative-advantage-lab` — Why Specialization Works

**What it does:** Two "countries" (or people) can each produce two goods but with different efficiencies. Students calculate opportunity costs, identify who has the comparative advantage in each good, and set up a trade deal that makes both parties better off. The primitive uses production possibility frontiers (PPFs) that students can manipulate. Key insight: even if one party is better at EVERYTHING (absolute advantage), trade still helps both if they specialize based on comparative (relative) advantage.

**Multimodal features:**
- **Visual:** Side-by-side PPF graphs for two countries. Production/consumption points plotted before and after trade. "Gains from trade" zone highlighted. Animated goods flowing between countries on trade execution.
- **Interactive:** Adjust production points on PPF. Calculate opportunity costs via guided tables. Propose trade terms. Execute trade and see both countries' consumption expand beyond their PPFs.

**Learning goals by grade:**
- Grade 6-7: Two people, two tasks. "Who should do what?" based on who gives up less. Simple numerical examples.
- Grade 8: PPF graphs. Opportunity cost calculation. Absolute vs comparative advantage distinction.
- Grade 9: Terms of trade — what trade ratios work for both parties? Why trade ratios must be between the two opportunity costs.
- Grade 10+: Multi-good comparative advantage. Gains from trade with real-world data. Criticism and limitations.

**Interaction model:** Phase 1 (Calculate) — compute opportunity costs for each country/each good. Phase 2 (Specialize) — identify comparative advantages and assign production. Phase 3 (Trade) — propose trade terms and verify both parties gain.

**Evaluable:** Yes.

**Evaluation metrics:**
- `type: 'comparative-advantage-lab'`
- `opportunityCostsCorrect` / `calculationsTotal`
- `comparativeAdvantageIdentified` (boolean)
- `tradeTermsValid` (boolean — within the valid range)
- `bothPartiesGain` (boolean — post-trade consumption > autarky)
- `ppfInterpretedCorrectly` (boolean)
- `attemptsCount`

---

## TIER 3: High School Microeconomics (Grades 9-12)

### 11. `market-structure-analyzer` — Perfect Competition to Monopoly

**What it does:** Students examine four market structures (perfect competition, monopolistic competition, oligopoly, monopoly) through interactive simulations. For each structure, they control a firm's output and pricing decisions and see the market-level consequences. Side-by-side comparison mode shows how the same product behaves differently under different market structures. Key visualization: the demand curve a firm faces changes shape (horizontal in perfect competition, downward-sloping in monopoly).

**Multimodal features:**
- **Visual:** Firm-level graph (price, quantity, cost curves, profit rectangle) alongside market-level graph (industry supply/demand). Market structure selector with characteristic checklist (number of firms, product differentiation, barriers to entry, price-taking vs price-making). Profit/loss shading.
- **Interactive:** Choose output level, see price determined by market structure. Compare profit across structures. Toggle cost curves (MC, ATC, AVC). Add/remove firms to see long-run dynamics.

**Learning goals by grade:**
- Grade 9-10: Identify market structures from real-world examples. Key characteristics (number of sellers, barriers, product type).
- Grade 11 (AP Micro): Perfect competition short-run and long-run equilibrium. Profit maximization at MC = MR. Zero economic profit in long run.
- Grade 11-12: Monopoly pricing and deadweight loss. Monopolistic competition with product differentiation. Oligopoly game theory introduction.

**Interaction model:** Phase 1 (Classify) — given real-world industries, classify into market structures and justify. Phase 2 (Optimize) — control a firm in each structure, find profit-maximizing output. Phase 3 (Compare) — compare consumer welfare (price, quantity, surplus) across structures.

**Evaluable:** Yes.

**Evaluation metrics:**
- `type: 'market-structure-analyzer'`
- `classificationsCorrect` / `classificationsTotal`
- `profitMaximizingOutputFound` (boolean — chose Q where MC = MR)
- `structuresCompared` (count)
- `deadweightLossIdentified` (boolean, monopoly)
- `longRunEquilibriumUnderstood` (boolean)
- `marketStructure` ('perfect-competition' | 'monopolistic-competition' | 'oligopoly' | 'monopoly')
- `attemptsCount`

---

### 12. `marginal-analysis-lab` — Thinking at the Margin

**What it does:** The core microeconomics reasoning tool. Students work with marginal cost (MC) and marginal revenue (MR) curves, learning that optimal decisions happen where the next unit's benefit equals its cost. The primitive presents scenarios: "Should the factory make one more widget?" and students compare MC to MR visually and numerically. Builds from concrete (lemonade stand: should I make one more cup?) to abstract (firm profit maximization with full cost curves).

**Multimodal features:**
- **Visual:** MC and MR curves on the same graph, with profit-maximizing quantity at their intersection highlighted. Total profit rectangle. Data table alongside graph showing per-unit calculations. "One more?" decision arrow at the margin. Animated "stepping along the curve" as students add units.
- **Interactive:** Click "produce one more" to step along the cost curve. See marginal profit for each unit. Toggle between total and marginal views. Drag output level and watch profit change.

**Learning goals by grade:**
- Grade 8-9: Intuitive marginal thinking. "Is the next one worth it?" with simple lemonade-stand numbers.
- Grade 10: MC and MR as curves. Diminishing marginal returns. When MC > MR → stop producing.
- Grade 11 (AP Micro): Formal profit maximization (MC = MR). Shut-down condition (P < AVC). Break-even (P = ATC).
- Grade 12: Marginal analysis beyond production — marginal utility, marginal social cost, optimal pollution level.

**Interaction model:** Phase 1 (Step) — produce units one at a time, recording MC and MR for each. Phase 2 (Optimize) — identify the profit-maximizing quantity. Phase 3 (Analyze) — explain why producing one more or one fewer would reduce profit.

**Evaluable:** Yes.

**Evaluation metrics:**
- `type: 'marginal-analysis-lab'`
- `optimalQuantityFound` (boolean — identified MC = MR intersection)
- `marginalReasoningCorrect` (boolean — explained why one more/fewer is worse)
- `dataTableComplete` (boolean — filled MC/MR for all units)
- `profitCalculatedCorrectly` (boolean)
- `conceptLevel` ('intuitive' | 'graphical' | 'formal' | 'extended')
- `attemptsCount`

---

### 13. `elasticity-calculator` — How Sensitive Are Markets?

**What it does:** Students calculate and interpret price elasticity of demand and supply using the midpoint method. The primitive presents real-world price changes and quantity responses, and students compute the elasticity coefficient, classify it (elastic, inelastic, unit elastic), and predict consequences (total revenue impact). Visual: the demand curve changes shape from steep (inelastic) to flat (elastic) as students manipulate elasticity, building intuition for the mathematical concept.

**Multimodal features:**
- **Visual:** Demand curve with adjustable elasticity — students see the curve flatten or steepen. Total revenue rectangle that changes as price moves along the curve. Elasticity spectrum visualization (perfectly inelastic → unit elastic → perfectly elastic). Real-world product cards sorted by elasticity.
- **Interactive:** Input price/quantity data, compute elasticity step-by-step. Drag price along curve and watch revenue rectangle change. Sort products by predicted elasticity and check answers.

**Learning goals by grade:**
- Grade 9-10: Intuitive elasticity — "If the price doubles, do people still buy it?" Sort goods by sensitivity. Necessities vs luxuries.
- Grade 11 (AP Micro): Midpoint method calculation. Elastic (|E| > 1), inelastic (|E| < 1), unit elastic (|E| = 1). Total revenue test.
- Grade 12: Cross-price elasticity (substitutes and complements). Income elasticity (normal vs inferior goods). Tax burden and elasticity.

**Interaction model:** Phase 1 (Predict) — given a price change, predict whether quantity changes a lot or a little. Phase 2 (Calculate) — compute elasticity using the midpoint formula step-by-step. Phase 3 (Apply) — predict total revenue change and verify on the graph.

**Evaluable:** Yes.

**Evaluation metrics:**
- `type: 'elasticity-calculator'`
- `elasticityCalculatedCorrectly` (boolean)
- `classificationCorrect` ('elastic' | 'inelastic' | 'unit-elastic')
- `revenueImpactPredicted` (boolean)
- `midpointMethodUsed` (boolean — used correct formula)
- `elasticityType` ('price' | 'cross-price' | 'income')
- `attemptsCount`

---

### 14. `business-builder` — From Idea to Profit

**What it does:** A multi-round entrepreneurship simulation where students start a business and make decisions about production, pricing, marketing, and hiring. Each round introduces a new economic concept: fixed vs variable costs, economies of scale, diminishing returns, break-even analysis. Students see income statements and must achieve profitability. Failures are pedagogical — a bad pricing decision teaches more than a lecture about price theory.

**Multimodal features:**
- **Visual:** Business dashboard with income statement, cost breakdown (fixed vs variable), production function graph, break-even chart. Round-by-round history with trend lines. Employee/resource cards with productivity ratings.
- **Interactive:** Make decisions each round (hire workers, set price, choose production volume, invest in equipment). See results play out. Adjust strategy for next round.

**Learning goals by grade:**
- Grade 6-7: Revenue and costs. "Did you make money or lose money?" Fixed costs (rent) vs variable costs (ingredients).
- Grade 8: Break-even analysis. Economies of scale. When does adding another worker stop helping?
- Grade 9-10: Income statement reading. Profit maximization. Short-run vs long-run decisions (invest now, profit later).
- Grade 11+: Full cost curve analysis (MC, ATC, AVC). Entrepreneurial decision-making under uncertainty.

**Interaction model:** Phase 1 (Plan) — design your business: what product, what price, what costs. Phase 2 (Operate) — run 5-8 rounds, making production and pricing decisions each round. Phase 3 (Analyze) — review your income statement history, identify your break-even point, explain what you'd do differently.

**Evaluable:** Yes.

**Evaluation metrics:**
- `type: 'business-builder'`
- `profitAchieved` (boolean — reached profitability)
- `breakEvenRound` (which round they first broke even, or null)
- `totalProfit` (final cumulative profit/loss)
- `costClassificationCorrect` (boolean — correctly sorted fixed/variable)
- `strategyAdaptation` (0-100 — improved decisions over rounds)
- `roundsPlayed`
- `attemptsCount`

---

### 15. `labor-market-sim` — Supply and Demand for Workers

**What it does:** The supply-demand model applied specifically to labor markets. Students control wage rates and see how labor supply (workers willing to work) and labor demand (firms willing to hire) respond. Introduces minimum wage effects, human capital, and wage differentials. The student alternates between worker perspective (accept or reject job offers based on reservation wage) and employer perspective (hire based on worker productivity vs wage).

**Multimodal features:**
- **Visual:** Labor market supply-demand graph with wage (Y) and quantity of labor (X). Worker avatar queue (supply side) and job posting board (demand side). Minimum wage line that creates surplus/shortage. Wage differential visualization by occupation.
- **Interactive:** Set wage rate, observe hiring outcomes. Toggle minimum wage on/off. Compare occupations by skill level and wage. Play as worker (accept/reject) or employer (hire/pass).

**Learning goals by grade:**
- Grade 7-8: Jobs, wages, and skills. "Why do some jobs pay more?" Human capital concept.
- Grade 9: Supply and demand applied to labor. Equilibrium wage. Unemployment when wage is too high.
- Grade 10-11: Minimum wage debate — model both sides. Labor unions. Monopsony.
- Grade 12 (AP): Marginal revenue product (MRP). Derived demand for labor. Wage discrimination models.

**Interaction model:** Phase 1 (Explore) — set different wage rates and observe labor market outcomes. Phase 2 (Policy) — introduce a minimum wage and predict/observe the effect on employment and unemployment. Phase 3 (Analyze) — explain why different occupations have different equilibrium wages.

**Evaluable:** Yes.

**Evaluation metrics:**
- `type: 'labor-market-sim'`
- `equilibriumWageFound` (boolean)
- `minimumWageEffectPredicted` (boolean)
- `wageSetAboveEquilibrium` / `wageSetBelowEquilibrium` (experimentation count)
- `surplusShortageIdentified` (boolean)
- `humanCapitalConceptApplied` (boolean)
- `attemptsCount`

---

## TIER 4: High School Macroeconomics (Grades 10-12)

### 16. `inflation-dashboard` — Measuring and Understanding Inflation

**What it does:** Students build a Consumer Price Index (CPI) from a "market basket" of goods, then use it to calculate inflation rates and convert between nominal and real values. The primitive makes inflation tangible — students see the same basket of goods cost more over time, and their purchasing power erode. Interactive timeline shows historical inflation data with major events annotated (oil shocks, 2008 crisis, COVID).

**Multimodal features:**
- **Visual:** Shopping basket visualization with price tags that change over time. CPI index graph building year-by-year. Inflation rate bar chart. Nominal vs real dollar comparison (a $100 bill shrinking in purchasing power). Historical inflation timeline with event annotations.
- **Interactive:** Select basket items and weights. Calculate CPI year-over-year. Convert nominal to real values. Explore historical inflation data.

**Learning goals by grade:**
- Grade 8-9: Prices change over time. "How much did this cost in 1990 vs today?" Purchasing power concept.
- Grade 10: CPI calculation. Inflation rate formula. Why inflation matters to savers and borrowers.
- Grade 11: Nominal vs real GDP, nominal vs real wages. CPI limitations (substitution bias, new goods, quality changes).
- Grade 12 (AP Macro): Demand-pull vs cost-push inflation. Inflation expectations. Phillips curve introduction.

**Interaction model:** Phase 1 (Build) — construct a market basket, assign weights, record prices for two periods. Phase 2 (Calculate) — compute CPI and inflation rate step-by-step. Phase 3 (Apply) — convert a nominal wage to a real wage and determine if workers are better or worse off.

**Evaluable:** Yes.

**Evaluation metrics:**
- `type: 'inflation-dashboard'`
- `cpiCalculatedCorrectly` (boolean)
- `inflationRateCorrect` (boolean)
- `realNominalConversionCorrect` (boolean)
- `basketConstructed` (boolean — selected items and weights)
- `historicalEventIdentified` (boolean — connected inflation spike to cause)
- `attemptsCount`

---

### 17. `business-cycle-tracker` — Booms, Busts, and Recovery

**What it does:** An interactive real GDP graph where students identify and label the phases of the business cycle (expansion, peak, contraction/recession, trough) and associated economic indicators (unemployment, inflation, consumer confidence, investment). Students annotate historical GDP data and predict which phase comes next based on indicator readings. Connects to fiscal and monetary policy primitives — "What should the government/Fed do in this phase?"

**Multimodal features:**
- **Visual:** Real GDP over time (wavy line) with phase regions color-coded. Indicator dashboard (unemployment rate, inflation rate, consumer confidence, investment levels) that changes with cycle phase. Leading/lagging/coincident indicator classification panel.
- **Interactive:** Label phases on the GDP graph. Match indicators to phases. Given indicator readings, predict current phase. Recommend policy responses.

**Learning goals by grade:**
- Grade 9-10: Four phases of the business cycle. Real GDP as the measure. Recession = two consecutive quarters of decline.
- Grade 11: Leading, lagging, and coincident indicators. Predicting phase transitions. Automatic stabilizers.
- Grade 12 (AP Macro): Output gap. Potential GDP vs actual GDP. Recessionary and inflationary gaps. Self-correction mechanism.

**Interaction model:** Phase 1 (Identify) — label the four phases on a GDP graph. Phase 2 (Diagnose) — given current indicator readings, determine the current phase and whether the economy is in a gap. Phase 3 (Prescribe) — recommend fiscal or monetary policy response and explain the mechanism.

**Evaluable:** Yes.

**Evaluation metrics:**
- `type: 'business-cycle-tracker'`
- `phasesLabeledCorrectly` / `phasesTotal`
- `currentPhaseIdentified` (boolean)
- `indicatorsMatchedToPhases` / `indicatorsTotal`
- `policyRecommendationAppropriate` (boolean)
- `gapTypeIdentified` ('recessionary' | 'inflationary' | 'none')
- `attemptsCount`

---

### 18. `fiscal-policy-mixer` — Government Spending and Taxation

**What it does:** A policy simulation where students control government spending (G) and taxation (T) levels and observe the effects on aggregate demand, GDP, unemployment, and the national debt. The multiplier effect is visualized — a $1 increase in G leads to more than $1 increase in GDP as spending cascades through the economy. Students face realistic constraints: increasing spending is popular but increases debt; cutting taxes stimulates but reduces revenue.

**Multimodal features:**
- **Visual:** AD-AS model graph with fiscal policy shifting AD. Budget dashboard (revenue, spending, deficit/surplus, debt). Multiplier cascade animation (each round of spending creates income that creates more spending). GDP/unemployment/debt gauges that respond in real-time to policy changes.
- **Interactive:** Slider controls for government spending and tax rates. Choose expansionary (spend more, tax less) or contractionary (spend less, tax more) policy. See short-run and long-run effects.

**Learning goals by grade:**
- Grade 10: Government collects taxes, spends money. Budget deficit/surplus. National debt concept.
- Grade 11: Fiscal policy as demand management. Expansionary vs contractionary. Automatic stabilizers (unemployment insurance, progressive taxes).
- Grade 12 (AP Macro): Spending multiplier (1/MPS). Tax multiplier (MPC/MPS). Balanced budget multiplier. Crowding out. Lags in fiscal policy.

**Interaction model:** Phase 1 (Diagnose) — given economic conditions (recession or overheating), identify the appropriate policy direction. Phase 2 (Implement) — adjust spending and tax levels. Phase 3 (Evaluate) — observe GDP, unemployment, and debt effects; identify trade-offs and potential crowding out.

**Evaluable:** Yes.

**Evaluation metrics:**
- `type: 'fiscal-policy-mixer'`
- `policyDirectionCorrect` (boolean — expansionary for recession, contractionary for inflation)
- `multiplierCalculatedCorrectly` (boolean)
- `gdpEffectPredicted` (boolean)
- `tradeOffIdentified` (boolean — named deficit/debt concern)
- `crowdingOutIdentified` (boolean, advanced)
- `policyType` ('expansionary' | 'contractionary' | 'balanced')
- `attemptsCount`

---

### 19. `monetary-policy-console` — The Federal Reserve Dashboard

**What it does:** Students play the role of the Federal Reserve Chair, controlling monetary policy tools (federal funds rate, open market operations, reserve requirements) and observing effects on money supply, interest rates, investment, and aggregate demand. The transmission mechanism is visualized step-by-step: Fed buys bonds → bank reserves increase → money supply expands → interest rates fall → investment rises → AD shifts right → GDP increases. Students must navigate the same trade-offs real central bankers face.

**Multimodal features:**
- **Visual:** "Fed control room" dashboard with: money supply gauge, federal funds rate dial, bond market panel, bank reserves meter. Transmission mechanism flow diagram that lights up step-by-step as policy propagates. AD-AS graph showing policy impact. Money multiplier visualization (deposits → loans → deposits).
- **Interactive:** Execute open market operations (buy/sell bonds). Adjust federal funds rate target. Change reserve requirements. Watch each tool propagate through the transmission mechanism.

**Learning goals by grade:**
- Grade 10-11: What the Fed does. Interest rates affect borrowing and spending. "Easy money" vs "tight money."
- Grade 11 (AP Macro): Open market operations. Federal funds rate. Money multiplier (1/reserve ratio). Transmission mechanism to AD.
- Grade 12: Quantitative easing. Zero lower bound problem. Inflation targeting. Taylor Rule introduction.

**Interaction model:** Phase 1 (Diagnose) — given economic conditions, decide whether to tighten or loosen monetary policy. Phase 2 (Execute) — choose a tool and execute the operation. Phase 3 (Trace) — follow the transmission mechanism step-by-step and verify the AD shift direction.

**Evaluable:** Yes.

**Evaluation metrics:**
- `type: 'monetary-policy-console'`
- `policyDirectionCorrect` (boolean)
- `toolSelected` ('open-market' | 'fed-funds-rate' | 'reserve-requirement')
- `transmissionMechanismTraced` (boolean — correctly ordered the steps)
- `moneyMultiplierCalculated` (boolean)
- `adShiftPredicted` (boolean)
- `attemptsCount`

---

### 20. `investment-portfolio-lab` — Risk, Return, and Diversification

**What it does:** Students build an investment portfolio from asset classes (stocks, bonds, savings accounts, real estate, commodities) and run historical simulations to see how their portfolio performs over time. The key lesson: higher expected return = higher risk, and diversification reduces risk without proportionally reducing return. Students see their portfolio value fluctuate through bull and bear markets, and learn why "don't put all your eggs in one basket" is mathematically sound.

**Multimodal features:**
- **Visual:** Portfolio pie chart with asset allocation. Performance line chart running through historical periods. Risk-return scatter plot comparing asset classes. Diversification benefit visualization (portfolio risk < weighted average of individual risks). Market event timeline annotations.
- **Interactive:** Drag allocation sliders for each asset class. Run simulation through different historical periods. Compare portfolios (all-stocks vs all-bonds vs diversified). Adjust time horizon.

**Learning goals by grade:**
- Grade 8-9: Saving vs investing. Risk and reward trade-off. Simple interest vs compound interest.
- Grade 10: Asset classes and their risk-return profiles. "Stocks are risky but grow more over time." Time horizon matters.
- Grade 11: Diversification reduces risk. Correlation between assets. Portfolio allocation strategies.
- Grade 12 (AP): Efficient frontier introduction. Real vs nominal returns. Impact of inflation on investment. Opportunity cost of holding cash.

**Interaction model:** Phase 1 (Allocate) — build a portfolio with target allocation percentages summing to 100%. Phase 2 (Simulate) — run the portfolio through 10-20 years of market data and observe performance. Phase 3 (Optimize) — compare your portfolio to benchmarks, adjust allocation, and explain your strategy.

**Evaluable:** Yes.

**Evaluation metrics:**
- `type: 'investment-portfolio-lab'`
- `allocationSumsTo100` (boolean)
- `diversificationScore` (0-100 — penalize 100% in one asset)
- `riskReturnTradeoffUnderstood` (boolean — can explain why stocks return more)
- `portfolioReturnVsBenchmark` (percentage)
- `timeHorizonConsidered` (boolean — adjusted strategy for short vs long term)
- `attemptsCount`

---

## Catalog & Domain Structure

### New Economics Catalog

All 20 primitives form a new `ECONOMICS_CATALOG` in `catalog/economics.ts`.

**Subcategories within the catalog:**

| Subcategory | Primitives |
|---|---|
| Fundamentals (K-5) | `wants-needs-sorter`, `opportunity-cost-calculator`, `trade-route-builder`, `resource-allocator`, `incentive-explorer` |
| Markets & Prices (5-8) | `supply-demand-grapher`, `market-simulator`, `price-discovery-auction`, `circular-flow-explorer`, `comparative-advantage-lab` |
| Microeconomics (9-12) | `market-structure-analyzer`, `marginal-analysis-lab`, `elasticity-calculator`, `business-builder`, `labor-market-sim` |
| Macroeconomics (10-12) | `inflation-dashboard`, `business-cycle-tracker`, `fiscal-policy-mixer`, `monetary-policy-console`, `investment-portfolio-lab` |

### Generator Domain

New directory: `service/economics/` with individual generator files. New `economicsGenerators.ts` in the generators registry.

---

## Infrastructure Reuse Summary

| Infrastructure | Primitives Using It | Status |
|---|---|---|
| **Drag-and-Drop** | `wants-needs-sorter`, `trade-route-builder`, `resource-allocator`, `circular-flow-explorer` | Exists (word-builder, engineering) |
| **Interactive Graphs** | `supply-demand-grapher`, `marginal-analysis-lab`, `elasticity-calculator`, `business-cycle-tracker`, `fiscal-policy-mixer`, `monetary-policy-console`, `investment-portfolio-lab` | Exists (GraphBoard, DoubleNumberLine) |
| **Simulation Loops** | `market-simulator`, `price-discovery-auction`, `business-builder`, `labor-market-sim` | Pattern exists (engineering sims) |
| **Slider Controls** | `resource-allocator`, `supply-demand-grapher`, `fiscal-policy-mixer`, `monetary-policy-console`, `investment-portfolio-lab` | Exists (PropulsionLab) |
| **Multi-Phase Evaluation** | All 20 primitives | Exists (shared hooks) |
| **Gemini Generation** | All 20 primitives | Exists |
| **Canvas Animation** | `trade-route-builder`, `circular-flow-explorer`, `monetary-policy-console` | Exists (engineering) |

### New Infrastructure Required

| Capability | Used By | Complexity |
|---|---|---|
| **Multi-round simulation engine** | `market-simulator`, `business-builder`, `price-discovery-auction` | Medium — round-based state machine with AI agents |
| **Historical data service** | `inflation-dashboard`, `business-cycle-tracker`, `investment-portfolio-lab` | Low — static data sets from FRED/BLS loaded via Gemini |
| **AI economic agents** | `market-simulator`, `price-discovery-auction`, `labor-market-sim` | Medium — simple behavioral agents (willingness-to-pay/sell) |

---

## File Inventory

### New Files (per primitive: component + generator = 2 files)

| # | Primitive | Component File | Generator File |
|---|-----------|---------------|---------------|
| 1 | `wants-needs-sorter` | `primitives/visual-primitives/economics/WantsNeedsSorter.tsx` | `service/economics/gemini-wants-needs-sorter.ts` |
| 2 | `opportunity-cost-calculator` | `primitives/visual-primitives/economics/OpportunityCostCalculator.tsx` | `service/economics/gemini-opportunity-cost-calculator.ts` |
| 3 | `trade-route-builder` | `primitives/visual-primitives/economics/TradeRouteBuilder.tsx` | `service/economics/gemini-trade-route-builder.ts` |
| 4 | `resource-allocator` | `primitives/visual-primitives/economics/ResourceAllocator.tsx` | `service/economics/gemini-resource-allocator.ts` |
| 5 | `incentive-explorer` | `primitives/visual-primitives/economics/IncentiveExplorer.tsx` | `service/economics/gemini-incentive-explorer.ts` |
| 6 | `supply-demand-grapher` | `primitives/visual-primitives/economics/SupplyDemandGrapher.tsx` | `service/economics/gemini-supply-demand-grapher.ts` |
| 7 | `circular-flow-explorer` | `primitives/visual-primitives/economics/CircularFlowExplorer.tsx` | `service/economics/gemini-circular-flow-explorer.ts` |
| 8 | `market-simulator` | `primitives/visual-primitives/economics/MarketSimulator.tsx` | `service/economics/gemini-market-simulator.ts` |
| 9 | `price-discovery-auction` | `primitives/visual-primitives/economics/PriceDiscoveryAuction.tsx` | `service/economics/gemini-price-discovery-auction.ts` |
| 10 | `comparative-advantage-lab` | `primitives/visual-primitives/economics/ComparativeAdvantageLab.tsx` | `service/economics/gemini-comparative-advantage-lab.ts` |
| 11 | `market-structure-analyzer` | `primitives/visual-primitives/economics/MarketStructureAnalyzer.tsx` | `service/economics/gemini-market-structure-analyzer.ts` |
| 12 | `marginal-analysis-lab` | `primitives/visual-primitives/economics/MarginalAnalysisLab.tsx` | `service/economics/gemini-marginal-analysis-lab.ts` |
| 13 | `elasticity-calculator` | `primitives/visual-primitives/economics/ElasticityCalculator.tsx` | `service/economics/gemini-elasticity-calculator.ts` |
| 14 | `business-builder` | `primitives/visual-primitives/economics/BusinessBuilder.tsx` | `service/economics/gemini-business-builder.ts` |
| 15 | `labor-market-sim` | `primitives/visual-primitives/economics/LaborMarketSim.tsx` | `service/economics/gemini-labor-market-sim.ts` |
| 16 | `inflation-dashboard` | `primitives/visual-primitives/economics/InflationDashboard.tsx` | `service/economics/gemini-inflation-dashboard.ts` |
| 17 | `business-cycle-tracker` | `primitives/visual-primitives/economics/BusinessCycleTracker.tsx` | `service/economics/gemini-business-cycle-tracker.ts` |
| 18 | `fiscal-policy-mixer` | `primitives/visual-primitives/economics/FiscalPolicyMixer.tsx` | `service/economics/gemini-fiscal-policy-mixer.ts` |
| 19 | `monetary-policy-console` | `primitives/visual-primitives/economics/MonetaryPolicyConsole.tsx` | `service/economics/gemini-monetary-policy-console.ts` |
| 20 | `investment-portfolio-lab` | `primitives/visual-primitives/economics/InvestmentPortfolioLab.tsx` | `service/economics/gemini-investment-portfolio-lab.ts` |

### Shared Files (created once)

| File | Purpose |
|---|---|
| `service/registry/generators/economicsGenerators.ts` | Register all 20 generators |

### Existing Files Modified

| File | Changes |
|---|---|
| `types.ts` | Add 20 new ComponentIds to union |
| `config/primitiveRegistry.tsx` | Add 20 registry entries |
| `evaluation/types.ts` | Add 20 metrics interfaces + union members |
| `evaluation/index.ts` | Export new metrics types |
| `service/manifest/catalog/economics.ts` | New file — 20 catalog entries with descriptions |
| `service/manifest/catalog/index.ts` | Import and register economics catalog |
| `service/registry/generators/index.ts` | Import `economicsGenerators.ts` |

**Total: 41 new files + 5 existing file modifications.**

---

## Implementation Priority

### Wave 1 — Foundations (highest K-8 impact, establish the domain)

| Primitive | Rationale |
|-----------|-----------|
| `supply-demand-grapher` | The #1 most-taught economics concept. Anchors the entire domain. Reuses existing graphing infra. |
| `wants-needs-sorter` | Entry point for K-2 students. Simple drag-and-drop, fast to build. |
| `opportunity-cost-calculator` | Core economic reasoning skill. Every other concept builds on it. |
| `circular-flow-explorer` | Connects all economic actors. Reference diagram for the entire macro suite. |

### Wave 2 — Markets Come Alive

| Primitive | Rationale |
|-----------|-----------|
| `market-simulator` | Most engaging primitive — students "play" the market. Proves the simulation engine for other primitives. |
| `resource-allocator` | Scarcity is the foundation of economics. Visceral budget-draining UX teaches it better than any lecture. |
| `incentive-explorer` | Highly relatable scenarios, strong predict-then-observe loop. |
| `trade-route-builder` | Visual, map-based, appealing to younger learners. Teaches the gains from trade. |

### Wave 3 — Micro Depth

| Primitive | Rationale |
|-----------|-----------|
| `marginal-analysis-lab` | Core AP Micro skill. "Thinking at the margin" is the economist's toolkit. |
| `business-builder` | Engaging multi-round sim. Teaches cost concepts through experience rather than graphs. |
| `market-structure-analyzer` | Major AP Micro topic. Builds on supply-demand-grapher. |
| `elasticity-calculator` | Extends supply-demand-grapher. Required for AP Micro. |

### Wave 4 — Macro & Advanced

| Primitive | Rationale |
|-----------|-----------|
| `inflation-dashboard` | Highly relevant to students' lives ("why is everything more expensive?"). |
| `business-cycle-tracker` | Connects to current events. Framework for all macro policy. |
| `fiscal-policy-mixer` | Government policy simulation. Connects to civics. |
| `monetary-policy-console` | Most complex macro primitive. Requires circular-flow-explorer as prerequisite. |
| `comparative-advantage-lab` | Key trade theory. PPF visualization reuses graphing infra. |
| `price-discovery-auction` | Fascinating but niche. Enrichment for advanced students. |
| `labor-market-sim` | Applies S&D to labor. Good for career education connections. |
| `investment-portfolio-lab` | Financial literacy capstone. Strong real-world application. |

---

## Cross-Primitive Learning Paths

### The Market Foundations Path
```
wants-needs-sorter -> opportunity-cost-calculator -> resource-allocator -> supply-demand-grapher -> market-simulator
    (scarcity)            (trade-offs)                  (allocation)          (model)                (experience)
```

### The Trade & Specialization Path
```
trade-route-builder -> comparative-advantage-lab -> circular-flow-explorer
     (exchange)            (specialization)              (system)
```

### The Microeconomics Path (AP Prep)
```
supply-demand-grapher -> elasticity-calculator -> marginal-analysis-lab -> market-structure-analyzer
      (S&D model)           (sensitivity)           (optimization)            (market types)
```

### The Macroeconomics Path (AP Prep)
```
circular-flow-explorer -> business-cycle-tracker -> fiscal-policy-mixer -> monetary-policy-console
    (macro framework)          (diagnosis)              (fiscal Rx)            (monetary Rx)
```

### The Entrepreneurship Path
```
opportunity-cost-calculator -> incentive-explorer -> business-builder -> investment-portfolio-lab
       (decision-making)          (motivation)          (operations)         (growth)
```

### The Money & Banking Path
```
trade-route-builder -> inflation-dashboard -> monetary-policy-console -> investment-portfolio-lab
   (why money exists)     (price level)         (money supply)              (financial markets)
```

---

## Cross-Domain Connections

| Economics Primitive | Connects To | How |
|---|---|---|
| `supply-demand-grapher` | `DoubleNumberLine` (math) | Same coordinate-plane graphing interaction |
| `resource-allocator` | `categorization-activity` (assessment) | Same drag-to-zone pattern |
| `circular-flow-explorer` | `nested-hierarchy` (core) | Same node-and-edge graph pattern |
| `business-builder` | `PropulsionLab` (engineering) | Same multi-round simulation with controls |
| `market-simulator` | `FlightForcesExplorer` (engineering) | Same "adjust-and-observe" physics pattern |
| `trade-route-builder` | `timeline-explorer` (core) | Map-based interactive visualization |
| `investment-portfolio-lab` | `GraphBoard` (math) | Multi-series line chart visualization |
| `inflation-dashboard` | `DoubleNumberLine` (math) | Numerical comparison visualization |
| `wants-needs-sorter` | `word-sorter` (literacy) | Same drag-to-category interaction pattern |
| `opportunity-cost-calculator` | `scenario-question` (assessment) | Same decision-with-reasoning pattern |

---

## Open Questions

1. **Historical data sourcing** — `inflation-dashboard`, `business-cycle-tracker`, and `investment-portfolio-lab` benefit from real economic data (FRED, BLS, S&P historical). Should generators embed simplified historical datasets, or should we build a thin data service? Gemini can generate realistic synthetic data, but real data is more pedagogically valuable.

2. **AI agent complexity** — `market-simulator` and `price-discovery-auction` require AI buyer/seller agents. How sophisticated should they be? Options: (a) simple rule-based (buy if price < valuation), (b) adaptive (learn from student's pricing), (c) Gemini-powered (realistic but slow). Recommend starting with rule-based.

3. **Simulation determinism** — Should market simulations produce the same result for the same inputs (deterministic, good for evaluation) or include randomness (realistic, teaches uncertainty)? Recommend: deterministic core with optional noise parameter controlled by eval mode.

4. **Political sensitivity** — Fiscal and monetary policy primitives touch politically charged topics (government spending, taxation, national debt). The primitives should present mechanisms, not advocate positions. Both "government spending stimulates the economy" and "government spending crowds out private investment" are valid economic models — present both, let students explore.

5. **Financial literacy scope** — `investment-portfolio-lab` borders on financial literacy (personal finance). Should we expand into budgeting, credit, compound interest, etc.? These are high-demand topics in many state standards. Recommend: defer to a separate Financial Literacy PRD, keep this PRD focused on economic theory and market systems.

6. **Grade-level math prerequisites** — Some primitives (elasticity, multiplier calculations) require algebra. Should these primitives include a "math scaffold" mode that walks through the arithmetic, or assume math competency? Recommend: include step-by-step calculation scaffolding as a toggleable feature.

7. **Current events integration** — Economics is uniquely suited to connecting to current events (gas prices, job reports, Fed decisions). Should generators pull in recent economic data or news? This would make content feel alive but adds complexity and potential for outdated/controversial content.

8. **Game theory** — Oligopoly naturally leads to game theory (prisoner's dilemma, Nash equilibrium). Is a dedicated `game-theory-lab` primitive warranted, or should this be a mode within `market-structure-analyzer`? Recommend: mode within market-structure-analyzer for v1, standalone primitive if demand exists.
