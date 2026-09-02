/**
 * Narrow arithmetic evaluator shared by Formula Lab's renderer and generator.
 *
 * Formula Lab intentionally accepts a tiny expression language instead of
 * executing generated JavaScript. Supported syntax: finite numbers, ASCII
 * variable symbols, pi, parentheses, and + - * / ^ (including unary +/-).
 */

type OperatorToken = '+' | '-' | '*' | '/' | '^' | 'u+' | 'u-';

type Token =
  | { kind: 'number'; value: number }
  | { kind: 'symbol'; value: string }
  | { kind: 'operator'; value: OperatorToken }
  | { kind: 'left-paren' }
  | { kind: 'right-paren' };

const PRECEDENCE: Record<OperatorToken, number> = {
  '+': 1,
  '-': 1,
  '*': 2,
  '/': 2,
  'u+': 3,
  'u-': 3,
  '^': 4,
};

const RIGHT_ASSOCIATIVE = new Set<OperatorToken>(['^', 'u+', 'u-']);

function tokenize(expression: string): Token[] | null {
  const tokens: Token[] = [];
  let index = 0;
  let expectsValue = true;

  while (index < expression.length) {
    const rest = expression.slice(index);
    const whitespace = rest.match(/^\s+/);
    if (whitespace) {
      index += whitespace[0].length;
      continue;
    }

    const number = rest.match(/^(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?/);
    if (number) {
      const parsed = Number(number[0]);
      if (!Number.isFinite(parsed)) return null;
      tokens.push({ kind: 'number', value: parsed });
      index += number[0].length;
      expectsValue = false;
      continue;
    }

    const symbol = rest.match(/^[A-Za-z][A-Za-z0-9_]*/);
    if (symbol) {
      tokens.push({ kind: 'symbol', value: symbol[0] });
      index += symbol[0].length;
      expectsValue = false;
      continue;
    }

    const char = expression[index];
    if (char === '(') {
      tokens.push({ kind: 'left-paren' });
      index += 1;
      expectsValue = true;
      continue;
    }
    if (char === ')') {
      tokens.push({ kind: 'right-paren' });
      index += 1;
      expectsValue = false;
      continue;
    }
    if ('+-*/^'.includes(char)) {
      const value = expectsValue && (char === '+' || char === '-')
        ? (`u${char}` as OperatorToken)
        : (char as OperatorToken);
      if (expectsValue && value !== 'u+' && value !== 'u-') return null;
      tokens.push({ kind: 'operator', value });
      index += 1;
      expectsValue = true;
      continue;
    }

    return null;
  }

  return tokens.length > 0 && !expectsValue ? tokens : null;
}

function toPostfix(tokens: Token[]): Token[] | null {
  const output: Token[] = [];
  const operators: Token[] = [];

  for (const token of tokens) {
    if (token.kind === 'number' || token.kind === 'symbol') {
      output.push(token);
      continue;
    }
    if (token.kind === 'operator') {
      while (operators.length > 0) {
        const top = operators[operators.length - 1];
        if (top.kind !== 'operator') break;
        const shouldPop = RIGHT_ASSOCIATIVE.has(token.value)
          ? PRECEDENCE[token.value] < PRECEDENCE[top.value]
          : PRECEDENCE[token.value] <= PRECEDENCE[top.value];
        if (!shouldPop) break;
        output.push(operators.pop()!);
      }
      operators.push(token);
      continue;
    }
    if (token.kind === 'left-paren') {
      operators.push(token);
      continue;
    }
    if (token.kind === 'right-paren') {
      let matched = false;
      while (operators.length > 0) {
        const top = operators.pop()!;
        if (top.kind === 'left-paren') {
          matched = true;
          break;
        }
        output.push(top);
      }
      if (!matched) return null;
    }
  }

  while (operators.length > 0) {
    const top = operators.pop()!;
    if (top.kind === 'left-paren' || top.kind === 'right-paren') return null;
    output.push(top);
  }
  return output;
}

export function validateFormulaExpression(
  expression: string,
  allowedSymbols: readonly string[],
): boolean {
  const tokens = tokenize(expression);
  if (!tokens || !toPostfix(tokens)) return false;
  const allowed = new Set([...allowedSymbols, 'pi']);
  return tokens.every((token) => token.kind !== 'symbol' || allowed.has(token.value));
}

export function evaluateFormulaExpression(
  expression: string,
  scope: Record<string, number>,
): number | null {
  const tokens = tokenize(expression);
  const postfix = tokens ? toPostfix(tokens) : null;
  if (!postfix) return null;

  const stack: number[] = [];
  for (const token of postfix) {
    if (token.kind === 'number') {
      stack.push(token.value);
      continue;
    }
    if (token.kind === 'symbol') {
      const value = token.value === 'pi' ? Math.PI : scope[token.value];
      if (!Number.isFinite(value)) return null;
      stack.push(value);
      continue;
    }
    if (token.kind !== 'operator') return null;

    if (token.value === 'u+' || token.value === 'u-') {
      const operand = stack.pop();
      if (operand === undefined) return null;
      stack.push(token.value === 'u-' ? -operand : operand);
      continue;
    }

    const right = stack.pop();
    const left = stack.pop();
    if (left === undefined || right === undefined) return null;
    let result: number;
    switch (token.value) {
      case '+': result = left + right; break;
      case '-': result = left - right; break;
      case '*': result = left * right; break;
      case '/':
        if (Math.abs(right) < 1e-12) return null;
        result = left / right;
        break;
      case '^': result = left ** right; break;
      default: return null;
    }
    if (!Number.isFinite(result)) return null;
    stack.push(result);
  }

  return stack.length === 1 && Number.isFinite(stack[0]) ? stack[0] : null;
}

