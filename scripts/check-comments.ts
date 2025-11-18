#!/usr/bin/env ts-node
/**
 * Comment Checker Script
 *
 * Audits codebase for incorrect terminology and outdated information
 * in AI-generated comments.
 *
 * @see Issue #7: MINOR - Copilot Comments with Incorrect Information
 * @created 2024-11-16
 */

import * as fs from 'fs';
import * as path from 'path';
import { glob } from 'glob';

interface CommentIssue {
  file: string;
  line: number;
  issue: string;
  suggestion?: string;
  severity: 'error' | 'warning' | 'info';
}

/**
 * Terminology corrections
 */
const TERMINOLOGY_ISSUES: Record<string, string> = {
  'salt rounds': 'cost factor',
  'hash rounds': 'cost factor',
  'bcrypt rounds': 'cost factor (2^N iterations)',
  'v1 API': 'v2 API (verify if v1 deprecated)',
  'Master/Slave': 'Primary/Replica',
  'Whitelist': 'Allowlist',
  'Blacklist': 'Denylist'
};

/**
 * Date validation
 */
const DATE_PATTERN = /@(created|updated)\s+(\d{4}-\d{2}-\d{2})/g;
const PROJECT_START_DATE = new Date('2024-01-01');

/**
 * Check for missing imports in examples
 */
function checkExampleImports(content: string, lineIndex: number): CommentIssue | null {
  const lines = content.split('\n');
  const line = lines[lineIndex];

  if (line.includes('Example') && line.includes('usage')) {
    const nextLines = lines.slice(lineIndex, lineIndex + 10).join('\n');

    // Check if example has code but no import
    if (nextLines.includes('const ') || nextLines.includes('await ')) {
      if (!nextLines.includes('import {') && !nextLines.includes('import *')) {
        return {
          file: '',
          line: lineIndex + 1,
          issue: 'Code example missing import statement',
          suggestion: 'Add import statement to make example complete',
          severity: 'warning'
        };
      }
    }
  }

  return null;
}

/**
 * Main comment checking function
 */
async function checkComments(): Promise<CommentIssue[]> {
  const issues: CommentIssue[] = [];

  console.log('🔍 Scanning TypeScript files for comment issues...\n');

  // Find all TypeScript files
  const files = await glob('backend/**/*.ts', {
    ignore: ['**/node_modules/**', '**/dist/**', '**/*.d.ts']
  });

  console.log(`Found ${files.length} TypeScript files to check\n`);

  for (const file of files) {
    const content = fs.readFileSync(file, 'utf-8');
    const lines = content.split('\n');

    lines.forEach((line, index) => {
      // Check terminology
      Object.entries(TERMINOLOGY_ISSUES).forEach(([wrong, correct]) => {
        if (line.toLowerCase().includes(wrong.toLowerCase())) {
          // Check if it's in a comment
          const trimmed = line.trim();
          if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/**')) {
            issues.push({
              file,
              line: index + 1,
              issue: `Incorrect terminology: "${wrong}"`,
              suggestion: `Use "${correct}" instead`,
              severity: 'error'
            });
          }
        }
      });

      // Check dates
      const dateMatches = line.matchAll(DATE_PATTERN);
      for (const match of dateMatches) {
        const dateStr = match[2];
        const date = new Date(dateStr);

        if (date < PROJECT_START_DATE) {
          issues.push({
            file,
            line: index + 1,
            issue: `Date ${dateStr} is before project start (2024-01-01)`,
            suggestion: 'Verify and update creation/update date',
            severity: 'warning'
          });
        }

        // Check future dates
        if (date > new Date()) {
          issues.push({
            file,
            line: index + 1,
            issue: `Date ${dateStr} is in the future`,
            suggestion: 'Correct the date to current or past date',
            severity: 'error'
          });
        }
      }

      // Check example imports
      const exampleIssue = checkExampleImports(content, index);
      if (exampleIssue) {
        issues.push({ ...exampleIssue, file });
      }
    });
  }

  return issues;
}

/**
 * Format and display results
 */
function displayResults(issues: CommentIssue[]): void {
  if (issues.length === 0) {
    console.log('✅ No comment issues found!\n');
    return;
  }

  console.log(`❌ Found ${issues.length} comment issues:\n`);

  // Group by severity
  const byFile = issues.reduce(
    (acc, issue) => {
      if (!acc[issue.file]) {
        acc[issue.file] = [];
      }
      acc[issue.file].push(issue);
      return acc;
    },
    {} as Record<string, CommentIssue[]>
  );

  Object.entries(byFile).forEach(([file, fileIssues]) => {
    console.log(`📄 ${file}`);

    fileIssues.forEach(issue => {
      const icon = issue.severity === 'error' ? '❌' : issue.severity === 'warning' ? '⚠️ ' : 'ℹ️ ';
      console.log(`  ${icon} Line ${issue.line}: ${issue.issue}`);
      if (issue.suggestion) {
        console.log(`     💡 ${issue.suggestion}`);
      }
    });

    console.log();
  });

  // Summary
  const errors = issues.filter(i => i.severity === 'error').length;
  const warnings = issues.filter(i => i.severity === 'warning').length;
  const infos = issues.filter(i => i.severity === 'info').length;

  console.log('📊 Summary:');
  console.log(`   Errors: ${errors}`);
  console.log(`   Warnings: ${warnings}`);
  console.log(`   Info: ${infos}`);
  console.log();
}

/**
 * Auto-fix function
 */
async function autoFix(issues: CommentIssue[]): Promise<number> {
  let fixedCount = 0;

  const fileChanges = new Map<string, string>();

  for (const issue of issues) {
    if (issue.severity !== 'error') continue;

    let content = fileChanges.get(issue.file) || fs.readFileSync(issue.file, 'utf-8');

    // Fix terminology
    Object.entries(TERMINOLOGY_ISSUES).forEach(([wrong, correct]) => {
      if (issue.issue.includes(wrong)) {
        const regex = new RegExp(wrong, 'gi');
        content = content.replace(regex, correct);
        fixedCount++;
      }
    });

    fileChanges.set(issue.file, content);
  }

  // Write changes
  for (const [file, content] of fileChanges.entries()) {
    fs.writeFileSync(file, content, 'utf-8');
    console.log(`✅ Fixed issues in ${file}`);
  }

  return fixedCount;
}

/**
 * Main execution
 */
async function main() {
  const args = process.argv.slice(2);
  const shouldFix = args.includes('--fix');

  console.log('Comment Checker\n');
  console.log('===============\n');

  const issues = await checkComments();

  displayResults(issues);

  if (shouldFix && issues.length > 0) {
    console.log('🔧 Attempting to auto-fix errors...\n');
    const fixed = await autoFix(issues);
    console.log(`✅ Fixed ${fixed} issues\n`);

    // Re-check
    const remaining = await checkComments();
    console.log(`📊 ${remaining.length} issues remaining (require manual fix)\n`);
  }

  // Exit code
  const errors = issues.filter(i => i.severity === 'error').length;
  process.exit(errors > 0 ? 1 : 0);
}

// Run if called directly
if (require.main === module) {
  main().catch(error => {
    console.error('Error running comment checker:', error);
    process.exit(1);
  });
}

export { checkComments, displayResults, autoFix };
