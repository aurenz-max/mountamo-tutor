# Visual Schema Recommender - Deployment Checklist

## Pre-Deployment

### 1. Environment Configuration
- [ ] Add new environment variables to `.env`:
  ```bash
  SCHEMA_RECOMMENDER_USE_LLM=True
  SCHEMA_RECOMMENDER_MODEL=gemini-flash-lite-latest
  SCHEMA_RECOMMENDER_TEMPERATURE=0.3
  SCHEMA_RECOMMENDER_MAX_SCHEMAS=7
  SCHEMA_RECOMMENDER_CACHE_TTL_MINUTES=60
  ```
- [ ] Verify `GEMINI_API_KEY` is set and valid
- [ ] Verify `GOOGLE_CLOUD_PROJECT` and BigQuery credentials are configured

### 2. Database Verification
- [ ] Confirm `curriculum_primitives` table exists in BigQuery
- [ ] Verify table has all 26 visual schemas seeded with metadata
- [ ] Test query: `SELECT COUNT(*) FROM curriculum_primitives` (should return 26)
- [ ] Verify all schemas have `best_for`, `avoid_for`, and `example` fields populated

### 3. Code Review
- [ ] Review changes in `app/core/database.py`
- [ ] Review changes in `app/core/config.py`
- [ ] Review changes in `app/generators/visual_schema_recommender.py`
- [ ] Review changes in `app/services/foundations_service.py`

### 4. Testing
- [ ] Run unit tests: `pytest tests/test_visual_schema_recommender.py -v`
- [ ] Run manual tests: `python -m tests.manual_test_recommender`
- [ ] Run integration tests: `pytest tests/test_foundations_api.py -v`
- [ ] Test legacy fallback by setting `SCHEMA_RECOMMENDER_USE_LLM=False`

## Staging Deployment

### 1. Deploy Code
- [ ] Push code to staging branch
- [ ] Deploy to staging environment
- [ ] Verify service starts successfully
- [ ] Check logs for any initialization errors

### 2. Smoke Tests
- [ ] Test foundations generation endpoint: `POST /api/subskills/{id}/foundations/generate`
- [ ] Verify LLM recommendations are returned
- [ ] Check logs for "🤖 Requesting LLM recommendations..." messages
- [ ] Verify "💭 Reasoning:" appears in logs
- [ ] Test with 3-5 different subskills across subjects

### 3. Performance Testing
- [ ] Measure first request latency (expect 2-4 seconds)
- [ ] Measure cached request latency (expect < 100ms)
- [ ] Verify cache hit logs: "📦 Using cached..."
- [ ] Monitor BigQuery query costs
- [ ] Monitor Gemini API usage/costs

### 4. Error Testing
- [ ] Test with invalid `GEMINI_API_KEY` (should fall back to legacy)
- [ ] Test with BigQuery unavailable (should use static fallback)
- [ ] Verify fallback messages in logs: "⚠️ Falling back to rule-based system"
- [ ] Confirm legacy recommendations work correctly

## Production Deployment

### 1. Pre-Production
- [ ] Review staging test results
- [ ] Verify no errors in staging logs
- [ ] Check API cost estimates are acceptable
- [ ] Get approval from team/stakeholders

### 2. Deploy to Production
- [ ] Update production environment variables
- [ ] Deploy code to production
- [ ] Verify service health after deployment
- [ ] Monitor logs for first 15 minutes

### 3. Post-Deployment Monitoring (First Hour)
- [ ] Watch for error rate increase
- [ ] Monitor API latency
- [ ] Check Gemini API usage
- [ ] Verify cache is working (cache hit logs)
- [ ] Confirm no fallback loops (excessive "⚠️" logs)

### 4. Post-Deployment Monitoring (First Week)
- [ ] Track LLM vs legacy usage ratio
- [ ] Monitor API costs
- [ ] Review educator feedback on recommendations
- [ ] Compare recommendation quality with legacy system
- [ ] Check for any unexpected error patterns

## Rollback Plan

If issues occur:

### Immediate Rollback (No Code Change)
1. [ ] Set `SCHEMA_RECOMMENDER_USE_LLM=False` in environment
2. [ ] System automatically uses legacy rule-based system
3. [ ] No service restart needed
4. [ ] Verify legacy recommendations working

### Full Rollback (Code Revert)
1. [ ] Revert to previous git commit
2. [ ] Redeploy previous version
3. [ ] Verify service functionality
4. [ ] Document issue for investigation

## Monitoring Checklist

### Daily (First Week)
- [ ] Check error logs for LLM failures
- [ ] Review API cost reports
- [ ] Monitor cache hit rates
- [ ] Check for any performance degradation

### Weekly (First Month)
- [ ] Gather educator feedback on recommendation quality
- [ ] Analyze most common recommendations
- [ ] Review fallback frequency
- [ ] Optimize cache TTL if needed

### Monthly (Ongoing)
- [ ] Review API costs vs. budget
- [ ] Analyze recommendation effectiveness
- [ ] Consider schema metadata updates
- [ ] Plan future enhancements

## Success Metrics

### Performance
- ✅ First request: < 5 seconds
- ✅ Cached request: < 200ms
- ✅ Cache hit rate: > 70%
- ✅ Error rate: < 2%

### Cost
- ✅ API cost per recommendation: < $0.002
- ✅ Monthly API costs within budget
- ✅ No unexpected cost spikes

### Quality
- ✅ Educator satisfaction with recommendations
- ✅ Fewer manual edits to recommendations
- ✅ Diverse schema usage across subjects

## Troubleshooting Guide

### Issue: LLM Not Being Called
- Check: `SCHEMA_RECOMMENDER_USE_LLM=True` in environment
- Check: `GEMINI_API_KEY` is set and valid
- Look for: "⚠️ Gemini client not available" in logs

### Issue: High API Costs
- Increase: `SCHEMA_RECOMMENDER_CACHE_TTL_MINUTES` (e.g., 120)
- Check: Cache hit rate in logs
- Consider: Reducing `SCHEMA_RECOMMENDER_MAX_SCHEMAS`

### Issue: Slow Response Times
- Check: BigQuery query performance
- Verify: Cache is being used (check timestamps)
- Monitor: Gemini API latency

### Issue: Poor Recommendations
- Review: Schema metadata in BigQuery (`best_for`, `avoid_for`)
- Adjust: `SCHEMA_RECOMMENDER_TEMPERATURE` (lower = more consistent)
- Consider: Improving master context generation

### Issue: Frequent Fallbacks
- Check: Gemini API quota/limits
- Verify: Network connectivity to Google APIs
- Review: Error messages in logs for root cause

## Contact Information

- **Tech Lead:** [Name]
- **On-Call Engineer:** [Name]
- **Gemini API Support:** [Link to Google Cloud Support]
- **Documentation:** See `docs/visual_schema_recommender.md`

## Sign-Off

- [ ] Code reviewed by: _________________ Date: _______
- [ ] Tests reviewed by: _________________ Date: _______
- [ ] Staging tested by: _________________ Date: _______
- [ ] Production deployed by: ____________ Date: _______
- [ ] Monitoring setup by: _______________ Date: _______

## Notes

_Add any deployment-specific notes here:_
