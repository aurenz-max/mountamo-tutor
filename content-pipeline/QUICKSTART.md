# Quick Start Guide

Get the content evaluation framework up and running in 5 minutes.

## Prerequisites

- Python 3.10+
- Your FastAPI backend running locally
- Gemini API key (get one at https://ai.google.dev/)

## Step 1: Install Dependencies

```bash
cd content-pipeline
pip install -r requirements.txt
```

## Step 2: Configure Environment

```bash
# Copy the example environment file
cp .env.example .env

# Edit .env and add your Gemini API key
# GEMINI_API_KEY=your_key_here
```

## Step 3: Start Your Backend

In a separate terminal:

```bash
cd backend
uvicorn app.main:app --reload
```

Wait for: `Uvicorn running on http://127.0.0.1:8000`

## Step 4: Verify Connection

```bash
python content_ops.py health-check
```

Expected output:
```
✓ Backend is healthy
```

## Step 5: Run Your First Evaluation

```bash
# Test 5 math problems (fast, no LLM costs)
python content_ops.py test-generation --subject Mathematics --max-tests 1 --model flash-lite
python content_ops.py test-generation --subject "Language Arts" --max-tests 1 --model flash-lite
```

You should see:
```
Content Generation Quality Test

Initializing services...
✓ Backend connected
Fetching curriculum structure...
✓ Found 5 testable curriculum nodes

[Progress bar]

✓ Evaluation complete: 5 problems evaluated
```

A CSV report will be saved to `reports/eval-{timestamp}.csv`

## Step 6: Run Full Evaluation with LLM

```bash
# Test 3 problems with full LLM evaluation
python content_ops.py test-generation --subject math --max-tests 3 --model flash
```

This will run all three tiers:
- ✅ Tier 1: Structural validation
- ✅ Tier 2: Heuristic checks + visual coherence
- ✅ Tier 3: Gemini-powered pedagogical evaluation

## Common Issues

### "Backend health check failed"
- Make sure your backend is running on `http://localhost:8000`
- Try: `python content_ops.py health-check --backend-url http://localhost:8000`

### "GEMINI_API_KEY not found"
- Make sure you created the `.env` file
- Verify the API key is set: `cat .env | grep GEMINI_API_KEY`

### "No curriculum nodes found"
- Check available subjects: `python content_ops.py list-curriculum`
- Verify curriculum is loaded in your backend

## Next Steps

1. **Review the report:** Open `reports/eval-{timestamp}.csv` in Excel/Google Sheets
2. **Filter results:** Look for rows where `final_recommendation = "reject"`
3. **Analyze failures:** Check the `tier1_issues` and `tier2_issues` columns
4. **Read the full README:** [README.md](README.md) for advanced usage

## Quick Reference

```bash
# List all available curriculum
python content_ops.py list-curriculum

# Test specific skill
python content_ops.py test-generation --skill-id "counting" --max-tests 10

# Test specific grade
python content_ops.py test-generation --subject math --grade K --max-tests 20

# Fast heuristic-only test
python content_ops.py test-generation --subject math --max-tests 50 --skip-llm

# Full evaluation with high-quality model
python content_ops.py test-generation --subject math --max-tests 10 --model flash

# Cost-effective evaluation
python content_ops.py test-generation --subject math --max-tests 100 --model flash-lite
```

## Understanding the Output

The tool evaluates each problem across three tiers and provides:

1. **Console Summary** - Quick overview of pass/fail rates
2. **CSV Report** - Detailed metrics for every problem
3. **Recommendations** - Approve, revise, or reject for each problem

### What to Look For

✅ **Good Problems:**
- `tier1_pass = true` (valid schema)
- `tier2_pass = true` (readable, no overflow)
- `pedagogy_score >= 7`
- `correctness_score >= 8`
- `final_recommendation = "approve"`

⚠️ **Problems to Review:**
- `visual_overflow_risk = true` (might break UI)
- `readability_score` doesn't match grade level
- `pedagogy_score < 6`
- `final_recommendation = "revise"`

❌ **Problems to Reject:**
- `tier1_pass = false` (invalid schema)
- `has_placeholders = true` (contains TODO, [INSERT])
- `correctness_score < 5`
- `final_recommendation = "reject"`

## Getting Help

- 📖 Read the [full README](README.md)
- 🏗️ Review the [architecture plan](../content_evaluation_plan.md)
- 📊 Examine the CSV reports for detailed diagnostics

---

**Ready to evaluate your entire curriculum?** See [README.md](README.md) for advanced usage.
