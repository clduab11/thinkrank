#!/usr/bin/env node
/**
 * Simple code quality monitoring script for ThinkRank
 * Checks for basic quality issues and provides reports
 */

const fs = require('fs');
const path = require('path');

class CodeQualityMonitor {
  constructor() {
    this.issues = [];
    this.stats = {
      totalFiles: 0,
      largeFiles: 0,
      largeFunctions: 0,
      consoleStatements: 0
    };
  }

  // Quick scan for most common issues
  quickScan(rootDir = '.') {
    console.log('🔍 Running quick code quality check...\n');
    
    const files = this.getCodeFiles(rootDir);
    
    for (const file of files) {
      this.checkFile(file);
    }
    
    this.printReport();
  }

  getCodeFiles(dir) {
    const files = [];
    const extensions = ['.ts', '.tsx', '.js', '.jsx'];
    const excludeDirs = ['node_modules', 'dist', 'coverage', '.git', 'backup_20250609_161056'];
    
    const walkDir = (currentDir) => {
      if (!fs.existsSync(currentDir)) return;
      
      const items = fs.readdirSync(currentDir);
      for (const item of items) {
        const fullPath = path.join(currentDir, item);
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory()) {
          if (!excludeDirs.some(exclude => item.includes(exclude))) {
            walkDir(fullPath);
          }
        } else if (extensions.some(ext => item.endsWith(ext))) {
          files.push(fullPath);
        }
      }
    };
    
    walkDir(dir);
    return files;
  }

  checkFile(filePath) {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const lines = content.split('\n');
      this.stats.totalFiles++;
      
      // Check file size
      if (lines.length > 500) {
        this.stats.largeFiles++;
        this.issues.push({
          file: filePath,
          type: 'LARGE_FILE',
          message: `${lines.length} lines (max 500)`,
          severity: 'warning'
        });
      }
      
      // Check for console statements (excluding tests)
      if (!filePath.includes('test') && !filePath.includes('spec')) {
        const consoleLines = lines.filter(line => /console\.(log|error|warn|info)/.test(line));
        if (consoleLines.length > 0) {
          this.stats.consoleStatements += consoleLines.length;
          this.issues.push({
            file: filePath,
            type: 'CONSOLE_STATEMENT',
            message: `${consoleLines.length} console statements found`,
            severity: 'info'
          });
        }
      }
      
      // Simple function size check
      this.checkFunctionSizes(content, filePath);
      
    } catch (error) {
      // Skip files that can't be read
    }
  }

  checkFunctionSizes(content, filePath) {
    const lines = content.split('\n');
    let braceDepth = 0;
    let functionStart = -1;
    let inFunction = false;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Simple function detection
      if (/(?:function|async\s+function|\w+\s*\(.*\)\s*\{|\w+:\s*(?:async\s+)?\(.*\)\s*=>)/.test(line)) {
        if (braceDepth === 0) {
          functionStart = i;
          inFunction = true;
        }
      }
      
      // Track braces
      const openBraces = (line.match(/\{/g) || []).length;
      const closeBraces = (line.match(/\}/g) || []).length;
      braceDepth += openBraces - closeBraces;
      
      // Function ended
      if (inFunction && braceDepth === 0 && closeBraces > 0) {
        const functionLength = i - functionStart + 1;
        if (functionLength > 50) {
          this.stats.largeFunctions++;
          this.issues.push({
            file: filePath,
            type: 'LARGE_FUNCTION',
            message: `Function ~${functionLength} lines (max 50) starting at line ${functionStart + 1}`,
            severity: 'warning'
          });
        }
        inFunction = false;
      }
    }
  }

  printReport() {
    console.log('📊 QUICK QUALITY CHECK RESULTS');
    console.log('='.repeat(40));
    console.log(`📁 Files scanned: ${this.stats.totalFiles}`);
    console.log(`🔴 Issues found: ${this.issues.length}`);
    console.log();
    
    if (this.issues.length === 0) {
      console.log('✅ No quality issues detected! Great job! 🎉');
      return;
    }
    
    console.log('📈 ISSUE SUMMARY:');
    console.log(`   Large files (>500 lines): ${this.stats.largeFiles}`);
    console.log(`   Large functions (>50 lines): ${this.stats.largeFunctions}`);
    console.log(`   Console statements: ${this.stats.consoleStatements}`);
    console.log();
    
    // Group and show issues
    const grouped = this.groupIssues();
    
    for (const [type, issues] of Object.entries(grouped)) {
      const icon = type === 'LARGE_FILE' ? '📄' : type === 'LARGE_FUNCTION' ? '⚡' : '🖥️';
      console.log(`${icon} ${type.replace('_', ' ')} (${issues.length} issues):`);
      
      for (const issue of issues.slice(0, 3)) {
        const relativePath = path.relative('.', issue.file);
        console.log(`   • ${relativePath}: ${issue.message}`);
      }
      
      if (issues.length > 3) {
        console.log(`   ... and ${issues.length - 3} more`);
      }
      console.log();
    }
    
    console.log('💡 QUICK FIXES:');
    if (this.stats.largeFiles > 0) {
      console.log('   • Consider breaking large files into smaller modules');
    }
    if (this.stats.largeFunctions > 0) {
      console.log('   • Refactor large functions into smaller, focused functions');
    }
    if (this.stats.consoleStatements > 0) {
      console.log('   • Replace console statements with proper logging');
    }
  }

  groupIssues() {
    const grouped = {};
    for (const issue of this.issues) {
      if (!grouped[issue.type]) {
        grouped[issue.type] = [];
      }
      grouped[issue.type].push(issue);
    }
    return grouped;
  }
}

// CLI usage
if (require.main === module) {
  const rootDir = process.argv[2] || '.';
  const monitor = new CodeQualityMonitor();
  monitor.quickScan(rootDir);
}

module.exports = CodeQualityMonitor;