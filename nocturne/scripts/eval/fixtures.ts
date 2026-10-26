// Eval fixtures — 4 real lecture topics, hand-labeled for extraction quality.
//
// Each fixture contains:
//   slides          — representative slide text (as the route receives it)
//   transcriptText  — lecture transcript excerpt
//   guideText       — optional study guide (null when absent)
//   mustHaveTerms   — terms that MUST appear in extraction output (15-25 each)
//   noiseTerms      — generic/administrative terms that MUST NOT appear

export interface Slide {
  pageNumber: number
  text: string
}

export interface Fixture {
  name: string
  slides: Slide[]
  transcriptText: string
  guideText: string | null
  mustHaveTerms: string[]
  noiseTerms: string[]
}

// ── 1. Expected Utility Theory ────────────────────────────────────────────────
const expectedUtility: Fixture = {
  name: 'expected-utility',
  slides: [
    {
      pageNumber: 1,
      text: `Decision Under Uncertainty
- Choice among lotteries with probabilistic outcomes
- Rational agents maximize expected utility (EU)
- Key insight: utility ≠ monetary value
- Von Neumann–Morgenstern (vNM) theorem: under four axioms, preferences can be
  represented by an expected utility function`,
    },
    {
      pageNumber: 2,
      text: `vNM Axioms
1. Completeness — agent can rank any two lotteries
2. Transitivity — if A ≻ B and B ≻ C then A ≻ C
3. Continuity — indifference curves are continuous
4. Independence axiom — if A ≻ B then mixing both with C preserves the ranking
These axioms together imply EU maximization`,
    },
    {
      pageNumber: 3,
      text: `Risk Preferences
- Risk-averse agent: concave utility function, prefers certainty equivalent over
  a fair lottery; Jensen's inequality gives EU(lottery) < U(expected value)
- Risk-neutral: linear utility, indifferent between lottery and its expected value
- Risk-seeking: convex utility function
- Risk premium: amount an agent pays to avoid risk (= EV − CE)
- Certainty equivalent (CE): guaranteed payoff with same utility as lottery
- Coefficient of relative risk aversion (CRRA): −u″(w)·w / u′(w)`,
    },
    {
      pageNumber: 4,
      text: `Diminishing Marginal Utility
- Standard assumption: utility of wealth is concave
- Each additional dollar of wealth adds less utility than the previous
- Explains risk aversion among expected utility maximizers
- Bernoulli's original argument: utility ≈ log(wealth)
- St. Petersburg paradox: infinite expected monetary value but finite expected utility
  due to diminishing marginal utility`,
    },
    {
      pageNumber: 5,
      text: `Empirical Challenges
- Allais paradox: systematic violations of the independence axiom
- Ellsberg paradox: ambiguity aversion vs. risk aversion
- Kahneman–Tversky prospect theory: reference-dependent utility, loss aversion,
  probability weighting; descriptive model vs. normative EU
- Stochastic dominance: ranking lotteries without specifying utility form
  (first-order: A dominates B if F_A(x) ≤ F_B(x) for all x)`,
    },
  ],
  transcriptText: `Today we're continuing with expected utility theory. Remember from last week that we
defined a lottery as a probability distribution over outcomes. The key question is: how
should a rational agent choose among lotteries? Von Neumann and Morgenstern proved that
if preferences satisfy four axioms — completeness, transitivity, continuity, and the
independence axiom — then there exists a utility function such that the agent always
maximizes expected utility. This is the expected utility theorem.

Now, risk aversion. A risk-averse agent has a concave utility function. What does that
mean in practice? The certainty equivalent of a lottery is the guaranteed amount of money
that gives the same utility as the lottery itself. For a risk-averse agent, the certainty
equivalent is strictly less than the expected value of the lottery. The difference between
the expected value and the certainty equivalent is the risk premium — how much the agent
would pay to avoid the gamble entirely.

Diminishing marginal utility explains risk aversion: each extra dollar of wealth contributes
less to total utility than the previous one. Bernoulli noted this in the context of the
St. Petersburg paradox — a game with infinite expected monetary value but only finite
expected utility because of diminishing marginal utility of wealth.

The independence axiom is the most controversial. The Allais paradox shows that real people
violate it systematically. Kahneman and Tversky developed prospect theory as an empirically
motivated alternative, incorporating reference-dependent utility and loss aversion. Unlike
expected utility, prospect theory is descriptive rather than normative. Stochastic dominance
is a useful tool for ranking lotteries without committing to a specific utility function.`,
  guideText: `Key concepts for the midterm:
- Expected utility theorem and vNM axioms
- Risk aversion, risk premium, certainty equivalent
- St. Petersburg paradox and Allais paradox
- Prospect theory vs expected utility`,
  mustHaveTerms: [
    'expected utility',
    'von neumann-morgenstern',
    'independence axiom',
    'completeness',
    'transitivity',
    'risk aversion',
    'risk premium',
    'certainty equivalent',
    'concave utility',
    'diminishing marginal utility',
    'st. petersburg paradox',
    'allais paradox',
    'prospect theory',
    'loss aversion',
    'stochastic dominance',
    'coefficient of relative risk aversion',
    'bernoulli utility',
    'lottery',
  ],
  noiseTerms: [
    'theory',
    'function',
    'value',
    'problem',
    'example',
    'agent',
    'model',
    'result',
  ],
}

// ── 2. Variable Elimination ───────────────────────────────────────────────────
const variableElimination: Fixture = {
  name: 'variable-elimination',
  slides: [
    {
      pageNumber: 1,
      text: `Probabilistic Inference in Bayesian Networks
- Bayesian network: DAG encoding conditional independence structure
- Joint distribution factored as product of local conditional probability tables (CPTs)
- Inference task: compute P(query | evidence) by marginalizing over hidden variables
- Exact inference vs approximate inference (e.g., MCMC, belief propagation)`,
    },
    {
      pageNumber: 2,
      text: `Variable Elimination Algorithm
1. Choose an elimination ordering over hidden variables
2. For each variable to eliminate:
   a. Collect all factors mentioning that variable
   b. Compute factor product of those factors
   c. Sum out (marginalize) the variable → new factor
3. Multiply remaining factors, normalize to get posterior

Key operations:
- Factor product: pointwise multiplication of two factors
- Marginalization (sum-out): summing a factor over one variable`,
    },
    {
      pageNumber: 3,
      text: `Elimination Ordering and Complexity
- The size of intermediate factors depends critically on the elimination ordering
- Fill edges: edges added to the moral graph during elimination
- Induced width / treewidth: maximum clique size in the induced graph minus 1
- Finding optimal ordering is NP-hard
- Heuristics: min-fill (choose variable that adds fewest fill edges),
  min-degree (choose variable with fewest neighbors in current graph)`,
    },
    {
      pageNumber: 4,
      text: `Factor Graphs and Sum-Product
- Factor graph: bipartite graph with variable nodes and factor nodes
- Sum-product algorithm: passes messages between variable and factor nodes
  to compute marginals efficiently
- Equivalent to variable elimination on a tree-structured model
- For loopy graphs: loopy belief propagation (approximate, no convergence guarantee)
- Dynamic programming interpretation: each message = pre-computed partial sum`,
    },
    {
      pageNumber: 5,
      text: `Connections to Other Algorithms
- Viterbi algorithm: same structure with max instead of sum (max-product)
- Junction tree algorithm: convert general graph to a clique tree,
  then run sum-product on the tree — exact inference for arbitrary BNs
- Variable elimination = one forward pass of junction tree
- Computational bottleneck: treewidth determines tractability`,
    },
  ],
  transcriptText: `Variable elimination is the canonical exact inference algorithm for Bayesian networks.
Given a query variable and some observed evidence, we want to compute the posterior
distribution over the query by marginalizing out all the hidden variables one at a time.

The algorithm works by maintaining a set of factors — basically tables of potential
values. At each step we pick a variable to eliminate, collect all factors that mention
it, form their factor product, and then sum out the variable. This produces a new
factor that no longer mentions the eliminated variable. We repeat until only the query
variable's factor remains, then normalize.

The critical issue is the elimination ordering. Different orderings produce different
intermediate factor sizes. When we eliminate a variable, we may create fill edges in
the moral graph — edges between pairs of neighbors that weren't connected before. The
induced width, which equals the treewidth of the original graph, measures the complexity.
Inference is polynomial in the number of variables but exponential in the treewidth.

Finding the optimal ordering is NP-hard, so we use heuristics. The min-fill heuristic
greedily picks the variable that adds the fewest fill edges. Min-degree picks the
variable with the fewest neighbors. Neither is optimal in general.

The sum-product algorithm on factor graphs is essentially variable elimination organized
as message passing on a tree. For non-tree graphs, the junction tree algorithm converts
the network into a clique tree and then runs sum-product exactly. Variable elimination
is also closely related to dynamic programming — each eliminated factor is a cached
partial computation.`,
  guideText: null,
  mustHaveTerms: [
    'variable elimination',
    'bayesian network',
    'factor',
    'factor product',
    'marginalization',
    'elimination ordering',
    'treewidth',
    'induced width',
    'fill edges',
    'min-fill heuristic',
    'sum-product algorithm',
    'factor graph',
    'conditional probability table',
    'hidden variable',
    'junction tree',
    'belief propagation',
    'clique tree',
    'dynamic programming',
  ],
  noiseTerms: [
    'variable',
    'algorithm',
    'method',
    'process',
    'result',
    'step',
    'table',
    'graph',
  ],
}

// ── 3. First Amendment Doctrine (Constitutional Law — non-STEM) ──────────────
const constitutionalLaw: Fixture = {
  name: 'first-amendment-doctrine',
  slides: [
    {
      pageNumber: 1,
      text: `First Amendment Overview
- "Congress shall make no law… abridging the freedom of speech, or of the press"
- Applies to states via incorporation doctrine (Fourteenth Amendment, selective incorporation)
- Protects expression from government restriction; no protection against private actors
- Content-based vs. content-neutral restrictions — threshold distinction`,
    },
    {
      pageNumber: 2,
      text: `Tiers of Scrutiny for Speech Restrictions
- Content-based laws: strict scrutiny — government must show compelling interest
  served by narrowly tailored means; presumptively unconstitutional
- Content-neutral laws (time, place, manner restrictions): intermediate scrutiny —
  must serve significant government interest, leave open alternative channels
- Prior restraint: presumptively unconstitutional (Near v. Minnesota);
  government bears heavy burden to justify any pre-publication ban`,
    },
    {
      pageNumber: 3,
      text: `Unprotected and Low-Value Speech
- True threats, incitement (Brandenburg test: imminent lawless action + intent),
  obscenity (Miller test: average person, community standards, SLAPS),
  defamation (actual malice for public figures — New York Times v. Sullivan),
  fighting words (Chaplinsky)
- Categorical exclusions: not protected by First Amendment at all
- Overbreadth doctrine: law that sweeps too broadly is facially unconstitutional
- Vagueness doctrine: law must be specific enough to give fair notice`,
    },
    {
      pageNumber: 4,
      text: `Establishment Clause and Free Exercise Clause
- Establishment clause (Lemon test): secular purpose, neither advances nor inhibits
  religion, no excessive entanglement
- Kennedy v. Bremerton (2022): Lemon test largely displaced by historical practices
- Free exercise clause: government may not target religion (Employment Division v. Smith —
  neutral, generally applicable laws need only rational basis review)
- Religious Freedom Restoration Act (RFRA): statutory compelling-interest test
- Hybrid rights: combination with another constitutional right triggers heightened scrutiny`,
    },
    {
      pageNumber: 5,
      text: `Due Process and Equal Protection
- Substantive due process: protects fundamental rights not listed in text
  (Griswold, Roe, Lawrence, Obergefell)
- Procedural due process: adequate process before deprivation of life, liberty, property
  (Mathews balancing test: private interest, risk of error, government burden)
- Equal protection clause (14th Amendment): rational basis for ordinary classifications;
  intermediate scrutiny for sex/gender; strict scrutiny for suspect classes (race)
- Washington v. Davis: discriminatory purpose required, disparate impact insufficient`,
    },
  ],
  transcriptText: `Constitutional law is built around a tiered system of judicial review. When government
restricts speech, the first question is always whether the restriction is content-based
or content-neutral. Content-based restrictions — those targeting a particular viewpoint
or subject matter — trigger strict scrutiny. The government must show a compelling
interest and that the restriction is narrowly tailored to achieve it. Content-neutral
restrictions, like time, place, and manner regulations, face intermediate scrutiny.

Prior restraint is treated with special hostility. The Court established in Near v.
Minnesota that pre-publication bans carry a heavy presumption of unconstitutionality.
The government almost never wins when imposing a prior restraint.

The overbreadth doctrine lets courts strike down laws facially — not just as applied —
when the law sweeps in too much protected speech along with the unprotected speech it
targets. Similarly, the vagueness doctrine requires laws to give fair notice of what
they prohibit, preventing chilling effects.

For the religion clauses, the Lemon test — named for Lemon v. Kurtzman — was the
dominant framework for establishment clause analysis for decades, requiring secular
purpose, no advancement of religion, and no excessive entanglement. Kennedy v. Bremerton
has moved the Court toward a historical practices and understandings approach.

Free exercise analysis after Employment Division v. Smith applies only rational basis
review to neutral, generally applicable laws — a significant limitation. RFRA restores
the compelling interest test as a statutory matter. Equal protection doctrine parallels
this tier structure: rational basis for ordinary economic legislation, intermediate
scrutiny for sex-based classifications, and strict scrutiny for racial classifications.`,
  guideText: `Final exam prep — First Amendment and 14th Amendment:
- Scrutiny tiers (strict, intermediate, rational basis) and when each applies
- Prior restraint, overbreadth, vagueness doctrines
- Establishment clause, free exercise clause, RFRA
- Substantive vs procedural due process
- Equal protection tiers`,
  mustHaveTerms: [
    'first amendment',
    'incorporation doctrine',
    'strict scrutiny',
    'intermediate scrutiny',
    'rational basis review',
    'content-based restriction',
    'content-neutral restriction',
    'prior restraint',
    'overbreadth doctrine',
    'vagueness doctrine',
    'establishment clause',
    'lemon test',
    'free exercise clause',
    'substantive due process',
    'procedural due process',
    'equal protection clause',
    'time place and manner',
    'actual malice',
    'compelling interest',
    'selective incorporation',
  ],
  noiseTerms: [
    'right',
    'court',
    'law',
    'protection',
    'standard',
    'test',
    'clause',
    'case',
  ],
}

// ── 4. SN2/SN1/E2/E1 Reaction Mechanisms (Organic Chemistry — STEM) ──────────
const organicChemistry: Fixture = {
  name: 'sn1-sn2-e1-e2-mechanisms',
  slides: [
    {
      pageNumber: 1,
      text: `Nucleophilic Substitution Overview
- Substrate reacts with nucleophile to replace leaving group
- Two limiting mechanisms: SN2 (bimolecular) and SN1 (unimolecular)
- Key factors: substrate structure, nucleophile strength, leaving group ability, solvent
- Leaving group ability correlates with stability of leaving anion (I⁻ > Br⁻ > Cl⁻ > F⁻)`,
    },
    {
      pageNumber: 2,
      text: `SN2 Mechanism
- One concerted step: nucleophile attacks from backside (180° to leaving group)
- Walden inversion: inversion of configuration at the stereocenter
- Rate = k[substrate][nucleophile] — bimolecular rate law
- Favored by: primary > secondary substrates; strong, unhindered nucleophile;
  polar aprotic solvent (DMSO, acetone); good leaving group
- Steric hindrance at α-carbon is the dominant obstacle`,
    },
    {
      pageNumber: 3,
      text: `SN1 Mechanism
- Two-step: rate-limiting ionization to form carbocation intermediate, then
  nucleophile attacks
- Rate = k[substrate] — unimolecular, independent of nucleophile
- Carbocation stability determines rate: tertiary > secondary; resonance-stabilized
- Racemization: planar carbocation attacked from both faces
- Favored by: tertiary/secondary substrates; weak nucleophile; polar protic solvent
  (water, alcohols — stabilizes ions via solvation); good leaving group`,
    },
    {
      pageNumber: 4,
      text: `E2 Elimination
- Concerted, one-step: base abstracts β-hydrogen while leaving group departs
- Requires anti-periplanar geometry (H and LG must be 180° apart) — stereospecific
- Rate = k[substrate][base] — bimolecular
- Zaitsev's rule: major product is more substituted (thermodynamically stable) alkene
- Hofmann product: less substituted alkene, formed with bulky bases (e.g., t-BuOK)
- Regioselectivity controlled by base size; stereochemistry controlled by periplanar constraint`,
    },
    {
      pageNumber: 5,
      text: `E1 Elimination
- Two-step: same ionization to carbocation as SN1, then loss of β-proton
- Rate = k[substrate] — unimolecular (rate-limiting step is carbocation formation)
- Gives Zaitsev product (more substituted alkene) as major product
- Competes with SN1; temperature favors elimination (higher T → more E1 vs SN1)
- E1cb: carbanion intermediate; base removes proton before leaving group departs
  (when leaving group is poor and β-H is acidic)`,
    },
  ],
  transcriptText: `Let's work through all four of the core substitution and elimination mechanisms.
SN2 is a single concerted step where the nucleophile attacks the backside of the carbon
bearing the leaving group. This backside attack causes a Walden inversion — the
configuration at the stereocenter inverts, like an umbrella turning inside out. The rate
law is bimolecular: rate equals k times substrate concentration times nucleophile
concentration. SN2 works best at primary carbons where there's minimal steric hindrance.
Polar aprotic solvents like DMSO or acetone stabilize the nucleophile without tying it up
in hydrogen bonds, making it more reactive.

SN1 is the opposite. The rate-limiting step is ionization to form a carbocation
intermediate. The rate law is unimolecular — only the substrate appears. Because the
carbocation is planar, the nucleophile can attack from either face, leading to
racemization. Polar protic solvents favor SN1 by stabilizing the carbocation and the
leaving group anion through solvation.

E2 elimination is also concerted, but it requires anti-periplanar geometry. The base
must abstract a beta hydrogen that is 180 degrees anti to the leaving group. This
periplanar constraint makes E2 stereospecific. Zaitsev's rule predicts the more
substituted alkene as the major product because it is more stable. But with a bulky
base like potassium tert-butoxide you get the Hofmann product — the less hindered,
less substituted alkene.

E1 shares the carbocation intermediate with SN1 but then loses a beta proton in a
second step to form the alkene. Higher reaction temperatures favor elimination over
substitution, which is why you can tune selectivity by adjusting temperature.
The E1cb pathway — carbanion intermediate — applies when the leaving group is poor
but the beta hydrogen is especially acidic.`,
  guideText: null,
  mustHaveTerms: [
    'sn2 reaction',
    'sn1 reaction',
    'e2 elimination',
    'e1 elimination',
    'nucleophile',
    'electrophile',
    'leaving group',
    'carbocation',
    'backside attack',
    'walden inversion',
    'zaitsev\'s rule',
    'hofmann product',
    'anti-periplanar',
    'rate-determining step',
    'bimolecular reaction',
    'unimolecular reaction',
    'racemization',
    'polar aprotic solvent',
  ],
  noiseTerms: [
    'reaction',
    'compound',
    'group',
    'atom',
    'product',
    'substrate',
    'molecule',
    'carbon',
  ],
}

export const fixtures: Fixture[] = [
  expectedUtility,
  variableElimination,
  constitutionalLaw,
  organicChemistry,
]
