#!/usr/bin/env node
/* eslint-disable no-console */

import { writeFile, readFile, access } from 'fs/promises';
import { constants as fsConstants } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIVE9_SDK_URL = 'https://app.five9.com/dev/sdk/crm/latest/five9.crm.sdk.js';
const SDK_PATH = join(__dirname, 'sdk/five9.crm.sdk.js');
const INDEX_PATH = join(__dirname, 'sdk/index.js');

async function fileExists(filePath) {
  try {
    await access(filePath, fsConstants.F_OK);
    return true;
  } catch {
    return false;
  }
}

/* eslint-disable-next-line complexity */
async function downloadSDK() {
  const hasLocalCopy = await fileExists(SDK_PATH);
  let localContent = null;

  // If we have a local copy, read it as backup
  if (hasLocalCopy) {
    try {
      localContent = await readFile(SDK_PATH, 'utf8');
      console.log(`� Found existing local SDK (${ Math.round(localContent.length / 1024) }KB)`);
    } catch(error) {
      console.warn('⚠️  Could not read existing local copy:', error.message);
    }
  }

  console.log('🔄 Attempting to download latest Five9 CRM SDK...');

  try {
    // Download the SDK
    const response = await fetch(FIVE9_SDK_URL);
    if (!response.ok) {
      throw new Error(`HTTP ${ response.status }: ${ response.statusText }`);
    }

    const sdkContent = await response.text();

    // Strict validation checks
    if (!sdkContent.includes('Five9') || !sdkContent.includes('CrmSdk')) {
      throw new Error('Downloaded content does not contain expected Five9 CRM SDK markers');
    }

    // Additional validation - check for expected API structure
    const hasApis = /\w+Api\s*:/.test(sdkContent);
    if (!hasApis) {
      throw new Error('Downloaded content does not contain expected API structure');
    }

    // Fix the UMD wrapper to use globalThis instead of this
    // This fixes the issue where 'this' is undefined in ES modules
    let fixedContent = sdkContent.replace(
      /}\(this,\s*function/g,
      '}(globalThis, function',
    );

    // Add eslint disable comment at the top since this is a third-party file
    if (!fixedContent.startsWith('/* eslint-disable */')) {
      fixedContent = `/* eslint-disable */\n${ fixedContent }`;
    }

    console.log(`✅ Downloaded valid SDK (${ Math.round(fixedContent.length / 1024) }KB)`);

    // Always update with new download if validation passes
    await writeFile(SDK_PATH, fixedContent);
    console.log('📁 Updated local SDK file');
    return fixedContent;
  } catch(error) {
    console.warn('⚠️  Download failed:', error.message);

    if (localContent) {
      console.log('📂 Continuing with existing local copy...');
      return localContent;
    }
    console.error('💥 No local copy available and download failed!');
    throw new Error('Cannot proceed without SDK file');
  }
}

async function main() {
  try {
    const sdkContent = await downloadSDK();

    // Extract API structure by analyzing the downloaded SDK
    console.log('🔍 Analyzing SDK structure...');

    // Look for API definitions in the code
    const apiMatches = sdkContent.match(/(\w+Api)\s*:/g) || [];
    const apis = [...new Set(apiMatches.map(match => match.replace(':', '').trim()))];

    // Look for enum/constant definitions
    const enumMatches = sdkContent.match(/(Api\w+Code|Hook\w+Code)\s*:/g) || [];
    const enums = [...new Set(enumMatches.map(match => match.replace(':', '').trim()))];

    console.log(`📋 Found APIs: ${ apis.join(', ') }`);
    console.log(`📋 Found Enums: ${ enums.join(', ') }`);

    // Generate the updated index.js
    const indexContent = generateIndexContent(apis, enums);
    await writeFile(INDEX_PATH, indexContent);
    console.log(`📝 Updated ${ INDEX_PATH }`);

    console.log('🎉 Five9 SDK ready!');
  } catch(error) {
    console.warn('⚠️  Issue during SDK update:', error.message);

    // Always try to continue with existing files
    const hasLocalSDK = await fileExists(SDK_PATH);
    const hasLocalIndex = await fileExists(INDEX_PATH);

    if (hasLocalSDK && hasLocalIndex) {
      console.log('📂 Continuing with existing files - package should work normally');
      console.log('💡 You can run `npm run update` later to retry the update');
    } else if (hasLocalSDK) {
      console.warn('⚠️  Missing index.js - package may not work correctly');
      console.log('💡 Try running `npm run update` to regenerate wrapper');
    } else {
      console.error('💥 Missing SDK file - package will not work!');
      console.log('💡 Check network connection and run `npm run update`');
    }

    // Always exit successfully to avoid blocking installs
    // The package will work with existing files, or user can update later
  }
}

// Run the main function
main();

function generateIndexContent(apis, enums) {
  const apiExports = apis.map(api => `export const ${ api } = Five9SDK?.${ api };`).join('\n');
  const enumExports = enums.map(enumName => `export const ${ enumName } = Five9SDK?.${ enumName };`).join('\n');

  return `// Clean ES module wrapper for Five9 CRM SDK
// Auto-generated by update-sdk.js
import './five9.crm.sdk.js';

// The SDK attaches itself to globalThis.Five9 when imported (fixed UMD wrapper)
// We'll capture the values and clean up the global namespace

const Five9SDK = globalThis.Five9?.CrmSdk;
const sdkVersion = globalThis.crmSdkVersion;

// Export the main SDK
export default Five9SDK;

// Export individual APIs for convenience
${ apiExports }

// Export error codes and status codes
${ enumExports }

// Export the SDK version
export const version = sdkVersion;
`;
}
