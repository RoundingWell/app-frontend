# Five9 CRM SDK Package

This package provides a clean ES module wrapper for the Five9 CRM SDK.

## Features

- **Automatic Updates**: Downloads the latest SDK from Five9 during `npm install`
- **Clean Imports**: Modern ES module interface with named exports
- **No Global Pollution**: Cleans up `window.Five9` and `window.crmSdkVersion` after import
- **Auto-Generated Exports**: Dynamically detects and exports all APIs and enums

## Usage

```javascript
// Import the full SDK
import Five9SDK from '@roundingwell/five9';

// Import specific APIs
import { interactionApi, crmApi } from '@roundingwell/five9';

// Import with defaults and named exports
import Five9SDK, { interactionApi, ApiErrorCode } from '@roundingwell/five9';
```

## Available Exports

The package automatically exports:

### Main SDK
- `Five9SDK` (default export) - The main CRM SDK object

### API Modules
- `defineApi` - API definition utilities
- `interactionApi` - Interaction management APIs
- `customComponentsApi` - Custom component APIs
- `crmApi` - Core CRM APIs
- `hookApi` - Event hook APIs
- `customMethodsApi` - Custom method APIs
- `sfNativeApi` - Salesforce native APIs
- `applicationApi` - Application lifecycle APIs

### Constants & Enums
- `ApiErrorCode` - Error code constants
- `HookStatusCode` - Hook status constants
- `version` - SDK version string

## Automatic Updates

The SDK is automatically downloaded and updated when the package is installed:

```bash
npm install # Updates all workspace packages (includes Five9)
cd packages/care-ops-five9 && npm run update  # Direct package update
```

The update script (`update-sdk.js`):
1. Downloads the latest SDK from `https://app.five9.com/dev/sdk/crm/latest/five9.crm.sdk.js`
2. Validates the downloaded file
3. Patches the UMD wrapper to attach to `globalThis.Five9` even when an AMD `define()` is present
4. Analyzes the SDK structure to detect all APIs and enums
5. Auto-generates the ES module wrapper with current exports
6. Updates `index.js` with the latest API surface

## File Structure

```
packages/care-ops-five9/
├── package.json         # Package configuration with postinstall hook
├── update-sdk.js        # SDK download and wrapper generation script
├── index.js            # Auto-generated ES module wrapper
├── sdk/five9.crm.sdk.js    # Downloaded Five9 SDK (excluded from git)
└── README.md           # This file
```

## Global Capture

The wrapper captures the SDK global:
- Captures `window.Five9.CrmSdk` and `window.crmSdkVersion`
- Exports the captured values through clean ES module interface

This keeps the ES module exports stable even when browser tooling has installed an AMD `define()`.
