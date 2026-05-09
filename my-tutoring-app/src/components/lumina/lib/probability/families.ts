/**
 * Probability family registry — pure TS, zero side effects.
 *
 * Each entry exposes the four functions every primitive in the advanced-
 * probability PRD needs: PMF/PDF, CDF, support, moments. Distribution
 * Explorer is the first consumer; CLT Demonstrator, Joint Distribution Lab,
 * and Loss Model Lab will reuse this engine without rewriting Poisson three
 * times.
 *
 * Wave-1 scope: Binomial (discrete), Poisson (discrete), Exponential
 * (continuous). Add more families by appending to FAMILIES — the workbench
 * picks them up automatically.
 */
import type {
  DistributionFamily,
  ParameterSchema,
  FamilyDefinition,
  EvaluatedDistribution,
  PMFPoint,
  PDFPoint,
} from '../../primitives/distribution-explorer/types';

// ── Helpers ──────────────────────────────────────────────────────────

/** ln Γ(x) via Lanczos. Accurate enough for Binomial coefficients up to n≈170 and Poisson up to λ≈700. */
function lnGamma(x: number): number {
  const g = 7;
  const c = [
    0.99999999999980993, 676.5203681218851, -1259.1392167224028,
    771.32342877765313, -176.61502916214059, 12.507343278686905,
    -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7,
  ];
  if (x < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * x)) - lnGamma(1 - x);
  x -= 1;
  let a = c[0];
  const t = x + g + 0.5;
  for (let i = 1; i < g + 2; i++) a += c[i] / (x + i);
  return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(a);
}

function lnFactorial(n: number): number {
  return lnGamma(n + 1);
}

function lnBinomCoeff(n: number, k: number): number {
  if (k < 0 || k > n) return -Infinity;
  return lnFactorial(n) - lnFactorial(k) - lnFactorial(n - k);
}

// ── Binomial ─────────────────────────────────────────────────────────

const BINOMIAL_PARAMS: ParameterSchema[] = [
  { name: 'n', label: 'n (trials)', min: 1, max: 50, step: 1, defaultValue: 10, integer: true },
  { name: 'p', label: 'p (success probability)', min: 0.01, max: 0.99, step: 0.01, defaultValue: 0.5 },
];

function binomialPMF(k: number, params: Record<string, number>): number {
  const { n, p } = params;
  if (k < 0 || k > n || !Number.isInteger(k)) return 0;
  return Math.exp(lnBinomCoeff(n, k) + k * Math.log(p) + (n - k) * Math.log(1 - p));
}

function binomialEvaluate(params: Record<string, number>): EvaluatedDistribution {
  const { n, p } = params;
  const points: PMFPoint[] = [];
  for (let k = 0; k <= n; k++) {
    points.push({ x: k, p: binomialPMF(k, params) });
  }
  // Cumulative for CDF
  let running = 0;
  const cdf = points.map(({ x, p }) => {
    running += p;
    return { x, p: running };
  });
  return {
    kind: 'discrete',
    pmf: points,
    cdf,
    moments: {
      mean: n * p,
      variance: n * p * (1 - p),
      skewness: (1 - 2 * p) / Math.sqrt(n * p * (1 - p)),
      kurtosis: (1 - 6 * p * (1 - p)) / (n * p * (1 - p)),
    },
    support: { lower: 0, upper: n },
  };
}

const BINOMIAL: FamilyDefinition = {
  family: 'binomial',
  label: 'Binomial',
  kind: 'discrete',
  parameters: BINOMIAL_PARAMS,
  description: 'Number of successes in n independent Bernoulli(p) trials.',
  formula: 'P(X = k) = \\binom{n}{k} p^k (1-p)^{n-k}',
  evaluate: binomialEvaluate,
};

// ── Poisson ──────────────────────────────────────────────────────────

const POISSON_PARAMS: ParameterSchema[] = [
  { name: 'lambda', label: 'λ (rate)', min: 0.1, max: 30, step: 0.1, defaultValue: 4 },
];

function poissonPMF(k: number, lambda: number): number {
  if (k < 0 || !Number.isInteger(k)) return 0;
  return Math.exp(k * Math.log(lambda) - lambda - lnFactorial(k));
}

function poissonEvaluate(params: Record<string, number>): EvaluatedDistribution {
  const { lambda } = params;
  // Truncate the support at the point where tail mass is negligible.
  // For Poisson, k ≈ λ + 6√λ captures > 99.999% of mass.
  const upper = Math.max(20, Math.ceil(lambda + 6 * Math.sqrt(lambda)));
  const points: PMFPoint[] = [];
  for (let k = 0; k <= upper; k++) {
    points.push({ x: k, p: poissonPMF(k, lambda) });
  }
  let running = 0;
  const cdf = points.map(({ x, p }) => {
    running += p;
    return { x, p: running };
  });
  return {
    kind: 'discrete',
    pmf: points,
    cdf,
    moments: {
      mean: lambda,
      variance: lambda,
      skewness: 1 / Math.sqrt(lambda),
      kurtosis: 1 / lambda,
    },
    support: { lower: 0, upper },
  };
}

const POISSON: FamilyDefinition = {
  family: 'poisson',
  label: 'Poisson',
  kind: 'discrete',
  parameters: POISSON_PARAMS,
  description: 'Number of events in a fixed interval when events occur independently at rate λ.',
  formula: 'P(X = k) = \\frac{\\lambda^k e^{-\\lambda}}{k!}',
  evaluate: poissonEvaluate,
};

// ── Exponential ──────────────────────────────────────────────────────

const EXPONENTIAL_PARAMS: ParameterSchema[] = [
  { name: 'lambda', label: 'λ (rate)', min: 0.1, max: 5, step: 0.05, defaultValue: 1 },
];

function exponentialPDF(x: number, lambda: number): number {
  return x < 0 ? 0 : lambda * Math.exp(-lambda * x);
}

function exponentialEvaluate(params: Record<string, number>): EvaluatedDistribution {
  const { lambda } = params;
  // Sample to the 99.99th percentile so the tail is visible.
  const upper = -Math.log(0.0001) / lambda;
  const sampleCount = 200;
  const pdf: PDFPoint[] = [];
  const cdf: PDFPoint[] = [];
  for (let i = 0; i <= sampleCount; i++) {
    const x = (upper * i) / sampleCount;
    pdf.push({ x, density: exponentialPDF(x, lambda) });
    cdf.push({ x, density: 1 - Math.exp(-lambda * x) });
  }
  return {
    kind: 'continuous',
    pdf,
    cdf,
    moments: {
      mean: 1 / lambda,
      variance: 1 / (lambda * lambda),
      skewness: 2,
      kurtosis: 6,
    },
    support: { lower: 0, upper },
  };
}

const EXPONENTIAL: FamilyDefinition = {
  family: 'exponential',
  label: 'Exponential',
  kind: 'continuous',
  parameters: EXPONENTIAL_PARAMS,
  description: 'Waiting time between events in a Poisson process. Memoryless.',
  formula: 'f(x) = \\lambda e^{-\\lambda x}, \\quad x \\geq 0',
  evaluate: exponentialEvaluate,
};

// ── Registry ─────────────────────────────────────────────────────────

export const FAMILIES: Record<DistributionFamily, FamilyDefinition> = {
  binomial: BINOMIAL,
  poisson: POISSON,
  exponential: EXPONENTIAL,
};

export const FAMILY_LIST: FamilyDefinition[] = [BINOMIAL, POISSON, EXPONENTIAL];

export function getFamily(family: DistributionFamily): FamilyDefinition {
  const def = FAMILIES[family];
  if (!def) throw new Error(`Unknown distribution family: ${family}`);
  return def;
}

/**
 * Apply parameter defaults for any params the caller omitted, and clamp
 * provided values to the schema's [min, max] range. Used both at component
 * mount and after the orchestrator picks initial values.
 */
export function resolveParameters(
  family: DistributionFamily,
  provided: Partial<Record<string, number>> | undefined,
): Record<string, number> {
  const def = getFamily(family);
  const result: Record<string, number> = {};
  for (const schema of def.parameters) {
    const raw = provided?.[schema.name];
    const value = typeof raw === 'number' && Number.isFinite(raw) ? raw : schema.defaultValue;
    const clamped = Math.min(schema.max, Math.max(schema.min, value));
    result[schema.name] = schema.integer ? Math.round(clamped) : clamped;
  }
  return result;
}
