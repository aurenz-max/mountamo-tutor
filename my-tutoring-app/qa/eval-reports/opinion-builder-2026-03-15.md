# Eval Report: opinion-builder — 2026-03-15

## Results

| Eval Mode | Status | Issues |
|-----------|--------|--------|
| oreo | PASS | — |
| cer | FAIL | 1 CRITICAL, 1 HIGH |

## Issues

### cer — Wrong grade level causes missing counter-argument phase
- **Severity:** CRITICAL
- **What's broken:** CER framework is for grades 5-6, but eval-test API sends `gradeLevel: 'elementary'` which maps to grade '3'. At grade 3, `counterArgumentEnabled: false` (requires grade >= 5), so the counter-argument phase — a core CER differentiator — is entirely skipped. CER mode becomes identical to OREO.
- **Data:** `framework: "cer", gradeLevel: "3", counterArgumentEnabled: false`
- **Fix in:** GENERATOR — when evalConstraint resolves to `cer`, force grade to 5+. Also eval-test route default `gradeLevel: 'elementary'` is invalid for this primitive.

### cer — Validator doesn't check `framework` field
- **Severity:** HIGH
- **What's broken:** Eval-test validator checks type field names ['type', 'mode', 'operation'...] but not 'framework'. Validation returns `valid: true` without confirming framework matches allowed challengeType.
- **Data:** Validator reports "No challenge array found" and passes
- **Fix in:** EVAL-TEST ROUTE — add 'framework' to typeFieldNames
