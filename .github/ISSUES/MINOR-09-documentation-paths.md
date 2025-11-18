# [MINOR] Documentation Path References Mismatch

## Labels
`minor`, `documentation`, `developer-experience`, `pr-9`

## Priority
🔵 **MINOR** - Low priority

## Description
Documentation files contain path references that don't match the actual repository structure, causing broken links and developer confusion.

## Impact
- **Severity:** LOW
- **Developer Experience:** Confusion finding referenced files
- **Onboarding:** New developers struggle with broken links
- **Maintenance:** Harder to maintain documentation

## Examples of Issues

### 1. Incorrect Relative Paths
```markdown
❌ INCORRECT (in README.md)
See [Architecture Docs](docs/architecture/design.md)
<!-- File actually at: docs/ARCHITECTURE.md -->

✅ CORRECT
See [Architecture Docs](docs/ARCHITECTURE.md)
```

### 2. Missing Path Updates After Refactoring
```markdown
❌ INCORRECT (in CONTRIBUTING.md)
Import from `src/utils/logger.ts`
<!-- File moved to: backend/shared/src/utils/logger.ts -->

✅ CORRECT
Import from `backend/shared/src/utils/logger.ts`
```

### 3. Broken JSDoc Links
```typescript
// ❌ INCORRECT
/**
 * @see ../../../docs/api/authentication.md
 */
// File doesn't exist at that path

// ✅ CORRECT
/**
 * @see ../../../docs/API.md#authentication
 */
```

## Proposed Solution

### 1. Automated Link Checker
```typescript
// scripts/check-doc-links.ts

import * as fs from 'fs';
import * as path from 'path';
import { glob } from 'glob';

interface BrokenLink {
  file: string;
  line: number;
  link: string;
  reason: string;
}

const MARKDOWN_LINK_REGEX = /\[([^\]]+)\]\(([^)]+)\)/g;
const JSDOC_SEE_REGEX = /@see\s+(.+)/g;

async function checkDocumentationLinks(): Promise<BrokenLink[]> {
  const brokenLinks: BrokenLink[] = [];

  // Check Markdown files
  const mdFiles = await glob('**/*.md', {
    ignore: ['node_modules/**', '**/node_modules/**']
  });

  for (const file of mdFiles) {
    const content = fs.readFileSync(file, 'utf-8');
    const lines = content.split('\n');

    lines.forEach((line, index) => {
      // Check markdown links
      let match;
      while ((match = MARKDOWN_LINK_REGEX.exec(line)) !== null) {
        const [, text, link] = match;

        // Skip external links
        if (link.startsWith('http://') || link.startsWith('https://')) {
          continue;
        }

        // Skip anchors
        if (link.startsWith('#')) {
          continue;
        }

        // Check if file exists
        const fullPath = path.resolve(path.dirname(file), link.split('#')[0]);
        if (!fs.existsSync(fullPath)) {
          brokenLinks.push({
            file,
            line: index + 1,
            link,
            reason: 'File not found'
          });
        }
      }
    });
  }

  // Check TypeScript files for JSDoc @see tags
  const tsFiles = await glob('backend/**/*.ts', {
    ignore: ['**/node_modules/**', '**/dist/**']
  });

  for (const file of tsFiles) {
    const content = fs.readFileSync(file, 'utf-8');
    const lines = content.split('\n');

    lines.forEach((line, index) => {
      let match;
      while ((match = JSDOC_SEE_REGEX.exec(line)) !== null) {
        const link = match[1].trim();

        // Skip URLs
        if (link.startsWith('http://') || link.startsWith('https://')) {
          continue;
        }

        // Check relative path
        if (link.includes('/')) {
          const fullPath = path.resolve(path.dirname(file), link.split('#')[0]);
          if (!fs.existsSync(fullPath)) {
            brokenLinks.push({
              file,
              line: index + 1,
              link,
              reason: 'Referenced file not found'
            });
          }
        }
      }
    });
  }

  return brokenLinks;
}

// Run checker
checkDocumentationLinks().then(brokenLinks => {
  if (brokenLinks.length === 0) {
    console.log('✅ All documentation links are valid');
    process.exit(0);
  }

  console.log(`❌ Found ${brokenLinks.length} broken links:\n`);

  brokenLinks.forEach(({ file, line, link, reason }) => {
    console.log(`${file}:${line}`);
    console.log(`  Link: ${link}`);
    console.log(`  Reason: ${reason}\n`);
  });

  process.exit(1);
});
```

### 2. Path Fixer Script
```typescript
// scripts/fix-doc-paths.ts

import * as fs from 'fs';
import * as path from 'path';
import { glob } from 'glob';

const PATH_MAPPINGS = {
  'src/utils/logger.ts': 'backend/shared/src/utils/logger.ts',
  'docs/architecture/design.md': 'docs/ARCHITECTURE.md',
  'docs/api/authentication.md': 'docs/API.md#authentication',
  // Add more mappings as discovered
};

async function fixDocumentationPaths(): Promise<number> {
  let fixedCount = 0;
  const files = await glob('**/*.{md,ts}', {
    ignore: ['node_modules/**', '**/node_modules/**', '**/dist/**']
  });

  for (const file of files) {
    let content = fs.readFileSync(file, 'utf-8');
    let modified = false;

    Object.entries(PATH_MAPPINGS).forEach(([oldPath, newPath]) => {
      const oldRegex = new RegExp(
        oldPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
        'g'
      );

      if (content.includes(oldPath)) {
        content = content.replace(oldRegex, newPath);
        modified = true;
        fixedCount++;
      }
    });

    if (modified) {
      fs.writeFileSync(file, content, 'utf-8');
      console.log(`✅ Fixed paths in ${file}`);
    }
  }

  return fixedCount;
}

// Run fixer
fixDocumentationPaths().then(count => {
  console.log(`\n✅ Fixed ${count} path references`);
});
```

### 3. Add to CI/CD Pipeline
```yaml
# .github/workflows/documentation.yml

name: Documentation Checks

on:
  pull_request:
    paths:
      - '**.md'
      - '**.ts'
      - 'docs/**'

jobs:
  check-links:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install dependencies
        run: npm ci

      - name: Check documentation links
        run: npm run check:doc-links

      - name: Validate path references
        run: npm run validate:paths

  markdown-lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Lint markdown files
        uses: articulate/actions-markdownlint@v1
        with:
          config: .markdownlint.json
          files: '**/*.md'
          ignore: node_modules
```

### 4. Pre-commit Hook
```bash
#!/bin/sh
# .husky/pre-commit

# Check documentation links
npm run check:doc-links || {
  echo "❌ Documentation link check failed"
  echo "Run 'npm run fix:doc-paths' to auto-fix known issues"
  exit 1
}
```

## Acceptance Criteria
- [ ] Audit all markdown files for broken links
- [ ] Audit all TypeScript files for broken JSDoc @see references
- [ ] Create automated link checker script
- [ ] Create path fixer script for common issues
- [ ] Update all broken links to correct paths
- [ ] Add documentation link checker to CI/CD
- [ ] Add pre-commit hook for link validation
- [ ] Create path mapping configuration
- [ ] Document correct path structure in CONTRIBUTING.md

## Common Path Patterns to Fix

### Backend Services
```
❌ src/services/auth/
✅ backend/services/auth-service/src/

❌ shared/types/
✅ backend/shared/types/
```

### Documentation
```
❌ docs/architecture/
✅ docs/ARCHITECTURE.md

❌ docs/api/
✅ docs/API.md
```

### Client
```
❌ client/unity/
✅ client/unity-project/

❌ mobile/
✅ client/unity-project/ (mobile builds)
```

## Package.json Scripts
```json
{
  "scripts": {
    "check:doc-links": "ts-node scripts/check-doc-links.ts",
    "fix:doc-paths": "ts-node scripts/fix-doc-paths.ts",
    "validate:paths": "npm run check:doc-links && echo 'All paths valid'"
  }
}
```

## Implementation Checklist
- [ ] Create link checker script
- [ ] Create path fixer script
- [ ] Run link checker on codebase
- [ ] Generate broken link report
- [ ] Create path mapping configuration
- [ ] Run path fixer
- [ ] Manually verify fixes
- [ ] Add CI/CD workflow
- [ ] Add pre-commit hook
- [ ] Update CONTRIBUTING.md with path conventions

## Estimated Effort
1 hour

## Related Issues
- PR #9: Repository analysis
- Developer documentation improvements
- Onboarding experience enhancement

## References
- Markdown Link Checking: https://github.com/tcort/markdown-link-check
- Documentation Best Practices
- Repository Structure Standards
