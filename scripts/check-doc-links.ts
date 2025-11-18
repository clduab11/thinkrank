#!/usr/bin/env ts-node
/**
 * Documentation Link Checker
 *
 * Validates all links in markdown files and JSDoc comments
 * to ensure documentation paths are correct.
 *
 * @see Issue #9: MINOR - Documentation Path References Mismatch
 * @created 2024-11-16
 */

import * as fs from 'fs';
import * as path from 'path';
import { glob } from 'glob';

interface BrokenLink {
  file: string;
  line: number;
  link: string;
  reason: string;
  severity: 'error' | 'warning';
}

const MARKDOWN_LINK_REGEX = /\[([^\]]+)\]\(([^)]+)\)/g;
const JSDOC_SEE_REGEX = /@see\s+(.+)/g;
const JSDOC_LINK_REGEX = /\{@link\s+([^}]+)\}/g;

/**
 * Check if a path exists
 */
function checkPathExists(basePath: string, link: string): boolean {
  // Skip external links
  if (link.startsWith('http://') || link.startsWith('https://')) {
    return true;
  }

  // Skip anchors
  if (link.startsWith('#')) {
    return true;
  }

  // Skip mailto links
  if (link.startsWith('mailto:')) {
    return true;
  }

  // Remove anchor from path
  const linkPath = link.split('#')[0];
  if (!linkPath) return true;

  // Resolve relative path
  const fullPath = path.resolve(path.dirname(basePath), linkPath);

  return fs.existsSync(fullPath);
}

/**
 * Check markdown files for broken links
 */
async function checkMarkdownFiles(): Promise<BrokenLink[]> {
  const brokenLinks: BrokenLink[] = [];

  const mdFiles = await glob('**/*.md', {
    ignore: ['node_modules/**', '**/node_modules/**', 'dist/**', '**/dist/**']
  });

  console.log(`📝 Checking ${mdFiles.length} markdown files...\n`);

  for (const file of mdFiles) {
    const content = fs.readFileSync(file, 'utf-8');
    const lines = content.split('\n');

    lines.forEach((line, index) => {
      let match;

      // Reset regex
      MARKDOWN_LINK_REGEX.lastIndex = 0;

      while ((match = MARKDOWN_LINK_REGEX.exec(line)) !== null) {
        const [, text, link] = match;

        if (!checkPathExists(file, link)) {
          brokenLinks.push({
            file,
            line: index + 1,
            link,
            reason: 'File not found',
            severity: 'error'
          });
        }
      }
    });
  }

  return brokenLinks;
}

/**
 * Check TypeScript files for broken JSDoc links
 */
async function checkTypeScriptFiles(): Promise<BrokenLink[]> {
  const brokenLinks: BrokenLink[] = [];

  const tsFiles = await glob('backend/**/*.ts', {
    ignore: ['**/node_modules/**', '**/dist/**', '**/*.d.ts']
  });

  console.log(`📘 Checking ${tsFiles.length} TypeScript files...\n`);

  for (const file of tsFiles) {
    const content = fs.readFileSync(file, 'utf-8');
    const lines = content.split('\n');

    lines.forEach((line, index) => {
      // Check @see tags
      JSDOC_SEE_REGEX.lastIndex = 0;
      let match;

      while ((match = JSDOC_SEE_REGEX.exec(line)) !== null) {
        const link = match[1].trim();

        // Check if it's a file path (contains /)
        if (link.includes('/') && !link.startsWith('http')) {
          if (!checkPathExists(file, link)) {
            brokenLinks.push({
              file,
              line: index + 1,
              link,
              reason: 'Referenced file not found',
              severity: 'error'
            });
          }
        }
      }

      // Check {@link} tags
      JSDOC_LINK_REGEX.lastIndex = 0;
      while ((match = JSDOC_LINK_REGEX.exec(line)) !== null) {
        const link = match[1].trim();

        if (link.includes('/') && !link.startsWith('http')) {
          if (!checkPathExists(file, link)) {
            brokenLinks.push({
              file,
              line: index + 1,
              link,
              reason: 'Linked file not found',
              severity: 'warning'
            });
          }
        }
      }
    });
  }

  return brokenLinks;
}

/**
 * Display results
 */
function displayResults(brokenLinks: BrokenLink[]): void {
  if (brokenLinks.length === 0) {
    console.log('✅ All documentation links are valid!\n');
    return;
  }

  console.log(`❌ Found ${brokenLinks.length} broken links:\n`);

  // Group by file
  const byFile = brokenLinks.reduce(
    (acc, link) => {
      if (!acc[link.file]) {
        acc[link.file] = [];
      }
      acc[link.file].push(link);
      return acc;
    },
    {} as Record<string, BrokenLink[]>
  );

  Object.entries(byFile).forEach(([file, links]) => {
    console.log(`📄 ${file}`);

    links.forEach(link => {
      const icon = link.severity === 'error' ? '❌' : '⚠️ ';
      console.log(`  ${icon} Line ${link.line}:`);
      console.log(`     Link: ${link.link}`);
      console.log(`     Reason: ${link.reason}`);
    });

    console.log();
  });

  // Summary
  const errors = brokenLinks.filter(l => l.severity === 'error').length;
  const warnings = brokenLinks.filter(l => l.severity === 'warning').length;

  console.log('📊 Summary:');
  console.log(`   Errors: ${errors}`);
  console.log(`   Warnings: ${warnings}`);
  console.log();
}

/**
 * Main execution
 */
async function main() {
  console.log('Documentation Link Checker\n');
  console.log('==========================\n');

  const [markdownLinks, tsLinks] = await Promise.all([checkMarkdownFiles(), checkTypeScriptFiles()]);

  const allBrokenLinks = [...markdownLinks, ...tsLinks];

  displayResults(allBrokenLinks);

  // Exit code
  const errors = allBrokenLinks.filter(l => l.severity === 'error').length;
  process.exit(errors > 0 ? 1 : 0);
}

// Run if called directly
if (require.main === module) {
  main().catch(error => {
    console.error('Error running link checker:', error);
    process.exit(1);
  });
}

export { checkMarkdownFiles, checkTypeScriptFiles, displayResults };
