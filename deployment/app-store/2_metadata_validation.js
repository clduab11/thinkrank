#!/usr/bin/env node

/**
 * ThinkRank App Store Metadata Validation and Compliance Checker
 *
 * This script validates App Store metadata for compliance with store policies,
 * character limits, and optimization best practices.
 *
 * Usage: node deployment/app-store/2_metadata_validation.js --platform ios|android
 */

const fs = require('fs');
const path = require('path');

// Configuration
const METADATA_PATHS = {
  ios: './deployment/app-store/ios/metadata.json',
  android: './deployment/app-store/android/play-store-metadata.json'
};

// Validation Rules
const VALIDATION_RULES = {
  ios: {
    title: { maxLength: 30 },
    subtitle: { maxLength: 30 },
    description: { maxLength: 4000 },
    keywords: {
      maxCount: 100,
      maxLength: 100,
      pattern: /^[a-zA-Z0-9\s,]+$/
    },
    screenshots: { minCount: 3, maxCount: 10 },
    appPreview: { maxCount: 3 }
  },
  android: {
    title: { maxLength: 50 },
    shortDescription: { maxLength: 80 },
    fullDescription: { maxLength: 4000 },
    screenshots: { minCount: 2, maxCount: 8 },
    featureGraphic: { required: true },
    icon: { required: true }
  }
};

/**
 * Validates iOS metadata
 */
function validateIOSMetadata(metadata) {
  const rules = VALIDATION_RULES.ios;
  const errors = [];
  const warnings = [];

  // Validate required fields
  if (!metadata.localizations?.['en-US']?.name) {
    errors.push('Missing required field: localizations.en-US.name');
  }
  if (!metadata.localizations?.['en-US']?.description) {
    errors.push('Missing required field: localizations.en-US.description');
  }

  // Validate title length
  const title = metadata.localizations?.['en-US']?.name || '';
  if (title.length > rules.title.maxLength) {
    errors.push(`Title exceeds maximum length: ${title.length}/${rules.title.maxLength}`);
  }

  // Validate subtitle length
  const subtitle = metadata.localizations?.['en-US']?.subtitle || '';
  if (subtitle.length > rules.subtitle.maxLength) {
    errors.push(`Subtitle exceeds maximum length: ${subtitle.length}/${rules.subtitle.maxLength}`);
  }

  // Validate description length
  const description = metadata.localizations?.['en-US']?.description || '';
  if (description.length > rules.description.maxLength) {
    errors.push(`Description exceeds maximum length: ${description.length}/${rules.description.maxLength}`);
  }

  // Validate keywords
  const keywords = metadata.localizations?.['en-US']?.keywords || '';
  if (keywords) {
    const keywordList = keywords.split(',').map(k => k.trim());
    if (keywordList.length > rules.keywords.maxCount) {
      errors.push(`Too many keywords: ${keywordList.length}/${rules.keywords.maxCount}`);
    }
    keywordList.forEach(keyword => {
      if (keyword.length > rules.keywords.maxLength) {
        errors.push(`Keyword too long: "${keyword}" (${keyword.length}/${rules.keywords.maxLength})`);
      }
      if (!rules.keywords.pattern.test(keyword)) {
        errors.push(`Invalid keyword format: "${keyword}"`);
      }
    });
  }

  // Validate screenshots
  const screenshots = metadata.screenshots || {};
  const totalScreenshots = Object.values(screenshots).flat().length;
  if (totalScreenshots < rules.screenshots.minCount) {
    warnings.push(`Too few screenshots: ${totalScreenshots}/${rules.screenshots.minCount} minimum`);
  }
  if (totalScreenshots > rules.screenshots.maxCount) {
    errors.push(`Too many screenshots: ${totalScreenshots}/${rules.screenshots.maxCount} maximum`);
  }

  // Check for placeholder content
  if (title.toLowerCase().includes('placeholder') || title.toLowerCase().includes('todo')) {
    warnings.push('Title contains placeholder content');
  }
  if (description.toLowerCase().includes('lorem ipsum')) {
    errors.push('Description contains Lorem Ipsum placeholder text');
  }

  return { errors, warnings };
}

/**
 * Validates Android metadata
 */
function validateAndroidMetadata(metadata) {
  const rules = VALIDATION_RULES.android;
  const errors = [];
  const warnings = [];

  // Validate required fields
  if (!metadata.appDetails?.title) {
    errors.push('Missing required field: appDetails.title');
  }
  if (!metadata.appDetails?.shortDescription) {
    errors.push('Missing required field: appDetails.shortDescription');
  }
  if (!metadata.appDetails?.fullDescription) {
    errors.push('Missing required field: appDetails.fullDescription');
  }

  // Validate title length
  const title = metadata.appDetails?.title || '';
  if (title.length > rules.title.maxLength) {
    errors.push(`Title exceeds maximum length: ${title.length}/${rules.title.maxLength}`);
  }

  // Validate short description length
  const shortDescription = metadata.appDetails?.shortDescription || '';
  if (shortDescription.length > rules.shortDescription.maxLength) {
    errors.push(`Short description exceeds maximum length: ${shortDescription.length}/${rules.shortDescription.maxLength}`);
  }

  // Validate full description length
  const fullDescription = metadata.appDetails?.fullDescription || '';
  if (fullDescription.length > rules.fullDescription.maxLength) {
    errors.push(`Full description exceeds maximum length: ${fullDescription.length}/${rules.fullDescription.maxLength}`);
  }

  // Validate graphics
  if (rules.featureGraphic.required && !metadata.graphics?.featureGraphic) {
    errors.push('Missing required feature graphic');
  }
  if (rules.icon.required && !metadata.graphics?.icon) {
    errors.push('Missing required icon');
  }

  // Validate screenshots
  const screenshots = metadata.screenshots?.phone || [];
  if (screenshots.length < rules.screenshots.minCount) {
    warnings.push(`Too few screenshots: ${screenshots.length}/${rules.screenshots.minCount} minimum`);
  }
  if (screenshots.length > rules.screenshots.maxCount) {
    errors.push(`Too many screenshots: ${screenshots.length}/${rules.screenshots.maxCount} maximum`);
  }

  // Check for placeholder content
  if (title.toLowerCase().includes('placeholder') || title.toLowerCase().includes('todo')) {
    warnings.push('Title contains placeholder content');
  }
  if (fullDescription.toLowerCase().includes('lorem ipsum')) {
    errors.push('Description contains Lorem Ipsum placeholder text');
  }

  return { errors, warnings };
}

/**
 * Main validation function
 */
function validateMetadata(platform) {
  const metadataPath = METADATA_PATHS[platform];

  if (!fs.existsSync(metadataPath)) {
    console.error(`❌ Metadata file not found: ${metadataPath}`);
    process.exit(1);
  }

  console.log(`🔍 Validating ${platform.toUpperCase()} metadata...`);

  let metadata;
  try {
    metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
  } catch (error) {
    console.error(`❌ Invalid JSON in metadata file: ${error.message}`);
    process.exit(1);
  }

  let results;
  if (platform === 'ios') {
    results = validateIOSMetadata(metadata);
  } else if (platform === 'android') {
    results = validateAndroidMetadata(metadata);
  } else {
    console.error(`❌ Unsupported platform: ${platform}`);
    process.exit(1);
  }

  // Report results
  console.log(`\n📊 Validation Results for ${platform.toUpperCase()}:`);

  if (results.errors.length === 0 && results.warnings.length === 0) {
    console.log('✅ All validations passed!');
    return true;
  }

  if (results.errors.length > 0) {
    console.log('\n❌ Errors:');
    results.errors.forEach(error => console.log(`  • ${error}`));
  }

  if (results.warnings.length > 0) {
    console.log('\n⚠️  Warnings:');
    results.warnings.forEach(warning => console.log(`  • ${warning}`));
  }

  if (results.errors.length > 0) {
    console.log('\n❌ Validation failed due to errors above.');
    return false;
  }

  console.log('\n✅ Validation passed (with warnings).');
  return true;
}

/**
 * CLI interface
 */
function main() {
  const args = process.argv.slice(2);
  const platformArg = args.find(arg => arg.startsWith('--platform='))?.split('=')[1];

  if (!platformArg) {
    console.error('Usage: node 2_metadata_validation.js --platform=ios|android');
    process.exit(1);
  }

  const success = validateMetadata(platformArg);
  process.exit(success ? 0 : 1);
}

if (require.main === module) {
  main();
}

module.exports = { validateMetadata, validateIOSMetadata, validateAndroidMetadata };