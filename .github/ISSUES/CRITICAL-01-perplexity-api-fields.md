# [CRITICAL] Perplexity Adapter API Field Mismatches

## Labels
`critical`, `bug`, `api`, `integration`, `pr-9`

## Priority
🔴 **CRITICAL** - Immediate attention required

## Description
The Perplexity adapter is accessing incorrect response fields from the Perplexity API, causing integration failures and broken search functionality.

## Current Behavior
Code accesses:
- `data.citations` (doesn't exist in API response)
- `data.images` (doesn't exist in API response)

## Expected Behavior
Code should access:
- `data.search_results` or `data.top_sources` for citations
- `data.top_images` for images

## Impact
- **Severity:** HIGH
- **Users Affected:** All users using search functionality
- **Business Impact:** Core feature broken, affects AI research integration

## Files Affected
- `backend/services/ai-service/src/adapters/perplexity-adapter.ts` (estimated location)

## Proposed Solution
```typescript
// ❌ CURRENT (INCORRECT)
const citations = response.data.citations;
const images = response.data.images;

// ✅ PROPOSED FIX
const citations = response.data.search_results || response.data.top_sources;
const images = response.data.top_images;

// Add response validation
interface PerplexityResponse {
  search_results?: SearchResult[];
  top_sources?: Source[];
  top_images?: Image[];
}

// Add schema validation
const PerplexityResponseSchema = z.object({
  search_results: z.array(SearchResultSchema).optional(),
  top_sources: z.array(SourceSchema).optional(),
  top_images: z.array(ImageSchema).optional(),
});
```

## Acceptance Criteria
- [ ] Update all Perplexity API field references to correct field names
- [ ] Add Zod schema validation for API responses
- [ ] Add integration tests with mocked API responses
- [ ] Add error handling for missing fields
- [ ] Document API version and field mappings in code comments
- [ ] Update API integration documentation

## Testing Requirements
1. Unit tests for field mapping
2. Integration tests with mocked Perplexity responses
3. Error case testing (missing fields)
4. Backward compatibility testing if API version changes

## Estimated Effort
2 hours

## Related Issues
- PR #9: Repository analysis and improvements
- Related to API integration testing gaps

## References
- Perplexity API Documentation: [Add link]
- CodeRabbit Review Comments: PR #9
