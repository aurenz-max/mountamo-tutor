# Migration Checklist: Default Templates Removal

## Summary
The curriculum authoring system has been updated to remove the "default template" dependency and enable an evaluation-driven prompt improvement workflow.

## Backend Changes ✅ Complete

- [x] Removed template override in `problem_generator_service.py`
- [x] System now always uses context variety (primitives)
- [x] Actual prompts stored with each problem
- [x] Removed default template creation from seed script
- [x] API endpoints compatible with new workflow

## Frontend Changes ✅ Complete

- [x] Removed `useActivePrompt('default')` dependency
- [x] Updated `ProblemGenerationPanel` to work without templates
- [x] Updated `PromptTemplateEditor` to show context variety mode
- [x] Removed template feedback panel from generation UI
- [x] Cleaned up unused imports and state

## Database Migration 🔄 Optional

### If you have existing "default" templates in BigQuery:

```sql
-- Check for default templates
SELECT template_id, template_name, version, is_active
FROM `your-project.curriculum_authoring.prompt_templates`
WHERE template_name = 'default'
  AND template_type = 'problem_generation';

-- Optional: Deactivate them (don't delete, for audit trail)
UPDATE `your-project.curriculum_authoring.prompt_templates`
SET is_active = false
WHERE template_name = 'default'
  AND template_type = 'problem_generation';
```

**Note**: You don't need to delete these. The system simply won't look for them anymore.

## Testing Checklist

### Backend Testing

- [ ] **Test 1**: Generate problems without custom_prompt
  ```bash
  POST /api/subskills/{id}/problems/generate
  {
    "version_id": "v1",
    "count": 3,
    "auto_evaluate": true
  }
  ```
  **Expected**: Problems generated with varied contexts

- [ ] **Test 2**: Check generation_prompt field
  ```bash
  GET /api/subskills/{id}/problems?version_id=v1
  ```
  **Expected**: Each problem has `generation_prompt` with primitives

- [ ] **Test 3**: Evaluate problems
  ```bash
  POST /api/subskills/{id}/problems/batch-evaluate
  {
    "version_id": "v1"
  }
  ```
  **Expected**: Evaluations returned with scores

- [ ] **Test 4**: Best performing prompts
  ```bash
  GET /api/prompts/production/prompts/best-performing?min_approval_rate=0.85
  ```
  **Expected**: Returns high-quality prompts (or 404 if none yet)

### Frontend Testing

- [ ] **Test 5**: Open problem generation panel
  - **Expected**: Template editor shows "Context Variety Mode" message
  - **Expected**: No errors about missing template

- [ ] **Test 6**: Generate problems
  - **Expected**: Generation works without template
  - **Expected**: Problems created successfully

- [ ] **Test 7**: View generated problems
  - **Expected**: Can see generation_prompt field
  - **Expected**: Prompts contain varied contexts

- [ ] **Test 8**: Custom prompt override
  - **Expected**: Can paste custom prompt
  - **Expected**: Custom prompt used instead of variety

- [ ] **Test 9**: Batch evaluate
  - **Expected**: Evaluation runs successfully
  - **Expected**: Results show scores and recommendations

- [ ] **Test 10**: Batch regenerate rejected
  - **Expected**: Low-scoring problems regenerated
  - **Expected**: New variations created

## Deployment Steps

### 1. Backend Deployment

```bash
cd curriculum-authoring-service

# Install dependencies (if needed)
pip install -r requirements.txt

# Run tests (if you have them)
pytest tests/

# Deploy backend service
# (Your deployment process here)
```

### 2. Frontend Deployment

```bash
cd curriculum-designer-app

# Install dependencies (if needed)
npm install

# Build
npm run build

# Deploy frontend
# (Your deployment process here)
```

### 3. Verify in Production

- [ ] Generate test problems
- [ ] Check generation_prompt field
- [ ] Run evaluation
- [ ] Monitor for errors

## Rollback Plan (If Needed)

If you need to rollback:

### Backend Rollback
```bash
git revert <commit-hash>
# Redeploy previous version
```

### Frontend Rollback
```bash
git revert <commit-hash>
# Rebuild and redeploy
```

### Quick Fix (Emergency)
If you need templates immediately:
1. Run the old seed script manually
2. Create a "default" template via API
3. System will use it if it exists

## What's Different Now

### Before (With Default Template)
```
1. Seed script creates "default" template
2. Template stored in prompt_templates table
3. Problem generator fetches "default" template
4. Same prompt used for all problems ❌
5. No natural variation
```

### After (Context Variety)
```
1. No default template needed
2. Problem generator samples primitives
3. Unique prompt per problem type ✅
4. Natural variation in contexts
5. Actual prompts stored for evaluation
```

## Expected Behavior

### Problem Generation
- **Input**: `{ count: 5, problem_types: ['multiple_choice'] }`
- **Process**:
  - System samples 10 primitives (2× count)
  - Creates prompt with: 3 objects, 3 characters, 2 scenarios, 2 locations
  - Generates 5 multiple choice problems with varied contexts
- **Output**: 5 problems, each with unique context variety

### Evaluation Flow
- **Generate**: 5 problems with varied prompts
- **Evaluate**: Get scores for each problem
- **Results**:
  - 3 approved (>85%)
  - 1 needs revision (60-85%)
  - 1 rejected (<60%)
- **Action**: Regenerate the rejected one with new variation

### Prompt Library Building
- **Week 1**: Generate 100 problems, evaluate
- **Week 2**: Identify 40 high-scoring prompts (>85%)
- **Week 3**: Promote best 10 prompts to template library
- **Week 4**: Query best-performing endpoint for production use

## Support Contacts

- **Backend Issues**: Check `curriculum-authoring-service/app/services/problem_generator_service.py`
- **Frontend Issues**: Check `curriculum-designer-app/components/curriculum-designer/problems/`
- **API Issues**: Check `curriculum-authoring-service/app/api/prompts.py`

## Success Metrics

Track these to measure success:

- [ ] **Variety**: Each problem has different contexts (objects, characters, scenarios)
- [ ] **Quality**: Average evaluation score >7.5/10
- [ ] **Approval Rate**: >70% of problems approved
- [ ] **Prompt Diversity**: Multiple high-scoring prompt variations

## Documentation

- [x] Backend changes documented in code comments
- [x] Frontend changes documented in code comments
- [x] Evaluation workflow guide created
- [x] Migration checklist created (this file)
- [ ] (Optional) Update team wiki/docs
- [ ] (Optional) Create demo video

## Timeline

- **Completed**: Backend and frontend changes
- **Next**: Testing and verification
- **After**: Production deployment
- **Future**: Build prompt library UI

## Notes

- The template system still exists for custom use cases
- You can still create manual templates if needed
- The "default" template concept is simply no longer required
- All existing functionality preserved, just more flexible now

## Questions or Issues?

If you encounter issues:

1. Check this checklist first
2. Review the evaluation workflow guide
3. Inspect the generation_prompt field on problems
4. Check backend logs for context primitive sampling
5. Verify no "default" template lookup errors

---

**Status**: ✅ Ready for testing and deployment
**Last Updated**: 2025-11-22
