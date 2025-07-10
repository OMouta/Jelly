---
title: "Package Optimization"
description: "How Jelly optimizes packages for smaller footprint"
order: 5
category: "advanced"
---

## Overview

Unlike traditional package managers that dump entire repositories into your project, Jelly intelligently processes packages to keep only what you need. This results in **smaller package directories**.

## Smart Package Cleanup

Jelly automatically removes unnecessary files and optimizes package structure during installation.

### Before: Raw Wally Package

When you install a package with traditional tools, you get everything:

```text
some_messy_package/
├── README.md           # ❌ Documentation bloat
├── LICENSE             # ❌ Legal files
├── .gitignore          # ❌ Git configuration
├── .github/            # ❌ CI/CD configurations
│   ├── workflows/
│   └── ISSUE_TEMPLATE/
├── docs/               # ❌ Documentation
│   ├── getting-started.md
│   └── api-reference.md
├── test/               # ❌ Test files
│   ├── init.spec.lua
│   └── TestUtils.lua
├── examples/           # ❌ Example code
│   ├── basic-usage.lua
│   └── advanced-usage.lua
├── wally.toml          # ❌ Package configuration
├── default.project.json
├── build/              # ❌ Build artifacts
├── node_modules/       # ❌ Node.js dependencies
└── lib/                # ✅ Actual module
    ├── init.lua        # ✅ Main module file
    ├── Utils.lua       # ✅ Supporting modules
    └── Types.lua       # ✅ Type definitions
```

### After: Jelly Processed

Jelly extracts only the essential code:

```text
some_messy_package/
└── init.lua            # ✅ Only the essential module
```

Or for more complex packages:

```text
complex_package/
├── init.lua            # ✅ Main module
├── Utils.lua           # ✅ Supporting modules
└── Types.lua           # ✅ Type definitions
```

## Intelligent Module Resolution

Jelly automatically handles different package structures and finds the main module:

### Standard Packages

For packages with `init.lua` at the root:

```text
package/
└── init.lua
```

**Result**: Direct `require("@self/package_name")`

### Nested Packages

For packages using `default.project.json` structure:

```text
package/
├── default.project.json
└── lib/
    └── init.lua
```

**Jelly reads the project file** and extracts the main module:

**Result**: `require("@self/lib")`

### Messy Repositories

For packages with complex directory structures:

```text
messy_package/
├── src/
│   └── MyModule/
│       └── init.lua
├── tests/
├── docs/
└── examples/
```

**Jelly intelligently locates** the main module and flattens the structure:

**Result**: Clean, optimized package structure

## File Type Filtering

Jelly removes files based on patterns known to be unnecessary for runtime:

### Removed File Types

- **Documentation**: `README.md`, `LICENSE`, `CHANGELOG.md`
- **Configuration**: `.gitignore`, `.editorconfig`, `wally.toml`
- **CI/CD**: `.github/`, `.gitlab-ci.yml`, `azure-pipelines.yml`
- **Development**: `test/`, `tests/`, `spec/`, `__tests__/`
- **Examples**: `examples/`, `demo/`, `sample/`
- **Build artifacts**: `node_modules/`, `target/`, `dist/`, `build/`
- **IDE files**: `.vscode/`, `.idea/`, `*.code-workspace`

### Preserved File Types

- **Lua modules**: `*.lua`
- **Type definitions**: `*.d.lua`
- **Project files**: `default.project.json`
- **Essential configs**: Files required for module resolution

## Configuration Options

Control Jelly's optimization behavior in your `jelly.json`:

```json
{
  "jelly": {
    "cleanup": true,        // Enable file cleanup
    "optimize": true,       // Enable structure optimization
    "packagesPath": "Packages"
  }
}
```

### Cleanup Option

**Default**: `true`

Controls whether Jelly removes unnecessary files:

```json
{
  "jelly": {
    "cleanup": false  // Keep all files
  }
}
```

### Optimize Option

**Default**: `true`

Controls whether Jelly optimizes package structure:

```json
{
  "jelly": {
    "optimize": false  // Keep original structure
  }
}
```
