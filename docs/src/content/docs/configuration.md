---
title: "Project Configuration"
description: "Complete guide to configuring your Jelly projects with jelly.json"
order: 3
category: "configuration"
---

## jelly.json Overview

Jelly uses a `jelly.json` file to manage project dependencies and configuration.

## Basic Configuration

### Minimal Configuration

```json
{
  "name": "my-game",
  "dependencies": {}
}
```

### Complete Configuration

```json
{
  "name": "my-game",
  "version": "1.0.0",
  "description": "My awesome Roblox game",
  "dependencies": {
    "roblox/roact": "^1.4.0",
    "roblox/rodux": "^3.0.0"
  },
  "devDependencies": {
    "roblox/testez": "^0.4.0"
  },
  "scripts": {
    "build": "rojo build",
    "serve": "rojo serve", 
    "build:release": "rojo build --output game.rbxl",
    "test": "rojo test",
    "lint": "selene src"
  },
  "jelly": {
    "cleanup": true,
    "optimize": true,
    "packagesPath": "Packages"
  }
}
```

## Configuration Fields

### Basic Fields

#### `name` (required)

- **Type**: `string`
- **Description**: The name of your project
- **Example**: `"my-awesome-game"`

#### `version` (optional if not publishing)

- **Type**: `string`
- **Description**: The version of your project (semver format)
- **Example**: `"1.0.0"`

#### `description` (optional)

- **Type**: `string`
- **Description**: A brief description of your project
- **Example**: `"My awesome Roblox game"`

### Dependencies

#### `dependencies`

- **Type**: `object`
- **Description**: Production dependencies required for your project
- **Example**:

```json
{
  "dependencies": {
    "roblox/roact": "^1.4.0",
    "roblox/rodux": "^3.0.0",
    "sleitnick/signal": "1.5.0"
  }
}
```

#### `devDependencies`

- **Type**: `object`
- **Description**: Development dependencies (testing, linting, etc.)
- **Example**:

```json
{
  "devDependencies": {
    "roblox/testez": "^0.4.0",
    "kampfkarren/selene": "^0.25.0"
  }
}
```

### Scripts

#### `scripts`

- **Type**: `object`
- **Description**: Custom scripts that can be run with `jelly run <script>`
- **Example**:

```json
{
  "scripts": {
    "build": "rojo build",
    "serve": "rojo serve",
    "build:release": "rojo build --output game.rbxl",
    "test": "rojo test",
    "lint": "selene src",
    "format": "stylua src",
    "dev": "rojo serve --port 34872"
  }
}
```

### Binary Package Target

#### `target`

- **Type**: `object`
- **Description**: Configuration for binary packages that can be executed with `jelly exec`
- **Required for binary packages**: Yes

##### `target.environment`

- **Type**: `string`
- **Description**: The runtime environment to use for executing the package
- **Supported values**: `"lune"`, `"luau"`, `"lua"`, `"node"`, `"python"`, `"deno"`

##### `target.bin`

- **Type**: `string`
- **Description**: Path to the main executable file relative to the package root
- **Example**: `"main.luau"`, `"cli.py"`, `"index.js"`

##### `target.args` (optional)

- **Type**: `string[]`
- **Description**: Default arguments to pass to the binary when executed

**Example:**

```json
{
  "name": "my-cli-tool",
  "version": "1.0.0",
  "target": {
    "environment": "lune",
    "bin": "src/main.luau",
    "args": ["--default-config"]
  },
  "dependencies": {}
}
```

**Complete Binary Package Example:**

```json
{
  "name": "code-formatter",
  "version": "2.1.0",
  "description": "A Luau code formatter tool",
  "target": {
    "environment": "lune",
    "bin": "cli/format.luau"
  },
  "scripts": {
    "test": "lune run tests/runner.luau"
  },
  "dependencies": {
    "lune-org/luau-ast": "^0.7.0"
  }
}
```

### Jelly-Specific Configuration

#### `jelly`

- **Type**: `object`
- **Description**: Jelly-specific configuration options

##### `jelly.cleanup`

- **Type**: `boolean`
- **Default**: `true`
- **Description**: Whether to clean up unnecessary files from packages
- **Example**: `"cleanup": true`

##### `jelly.optimize`

- **Type**: `boolean`
- **Default**: `true`
- **Description**: Whether to optimize package structure
- **Example**: `"optimize": true`

##### `jelly.packagesPath`

- **Type**: `string`
- **Default**: `"Packages"`
- **Description**: Path where packages should be installed
- **Example**: `"packagesPath": "Dependencies"`

## Project Structure

### Standard Project Layout

```text
my-project/
├── default.project.json   # Rojo configuration
├── jelly.json             # Jelly dependencies
├── jelly-lock.json        # Lockfile for reproducible installs
├── Packages/              # Your packages (auto-generated)
├── src/
│   ├── init.server.lua
│   └── ...
└── README.md
```

### Custom Packages Path

If you prefer a different directory name for packages:

```json
{
  "jelly": {
    "packagesPath": "Dependencies"
  }
}
```

This will create:

```text
my-project/
├── default.project.json
├── jelly.json
├── jelly-lock.json
├── Dependencies/          # Custom packages directory
└── src/
```

## Version Ranges

Jelly supports full semantic versioning (semver) ranges:

### Exact Versions

```json
{
  "dependencies": {
    "roblox/roact": "1.4.0"
  }
}
```

### Caret Ranges (Compatible)

```json
{
  "dependencies": {
    "roblox/roact": "^1.4.0"  // >=1.4.0 <2.0.0
  }
}
```

### Tilde Ranges (Patch Level)

```json
{
  "dependencies": {
    "roblox/rodux": "~3.1.0"  // >=3.1.0 <3.2.0
  }
}
```

### Greater Than or Equal

```json
{
  "dependencies": {
    "evaera/promise": ">=4.0.0"
  }
}
```

## Environment-Specific Configuration

### Development vs Production

Use `devDependencies` for packages only needed during development:

```json
{
  "dependencies": {
    "roblox/roact": "^1.4.0",
    "roblox/rodux": "^3.0.0"
  },
  "devDependencies": {
    "roblox/testez": "^0.4.0",
    "kampfkarren/selene": "^0.25.0"
  }
}
```

### Script Organization

Organize scripts by environment and purpose:

```json
{
  "scripts": {
    "dev": "rojo serve --port 34872",
    "build": "rojo build",
    "build:release": "rojo build --output game.rbxl",
    "test": "rojo test",
    "test:watch": "rojo test --watch",
    "lint": "selene src",
    "lint:fix": "selene src --fix",
    "format": "stylua src",
    "format:check": "stylua src --check"
  }
}
```

## Integration with Rojo

### Recommended default.project.json

```json
{
  "name": "MyGame",
  "tree": {
    "$className": "DataModel",
    "ReplicatedStorage": {
      "$className": "ReplicatedStorage",
      "Packages": {
        "$path": "Packages"
      },
      "Shared": {
        "$path": "src/shared"
      }
    },
    "ServerScriptService": {
      "$className": "ServerScriptService",
      "Server": {
        "$path": "src/server"
      }
    },
    "StarterPlayer": {
      "$className": "StarterPlayer",
      "StarterPlayerScripts": {
        "$className": "StarterPlayerScripts",
        "Client": {
          "$path": "src/client"
        }
      }
    }
  }
}
```

### Accessing Packages in Code

With the above configuration, you can require packages like:

```lua
local Roact = require(game.ReplicatedStorage.Packages.Roact)
local Rodux = require(game.ReplicatedStorage.Packages.Rodux)
```

## Best Practices

### 1. Use Semantic Versioning

- Use caret ranges (`^1.4.0`) for most dependencies
- Use exact versions only when necessary
- Use tilde ranges (`~1.4.0`) for patch-level updates only

### 2. Organize Dependencies

- Keep production and dev dependencies separate
- Group related scripts together
- Use descriptive script names

### 3. Commit Lockfile

Always commit `jelly-lock.json` to ensure reproducible builds:

```gitignore
# Don't ignore these files
!jelly.json
!jelly-lock.json

# Ignore packages directory (it's generated)
Packages/
```

### 4. Use Scripts for Common Tasks

Define common development tasks in scripts:

```json
{
  "scripts": {
    "start": "rojo serve",
    "build": "rojo build --output game.rbxl",
    "test": "rojo test",
    "clean": "jelly clean"
  }
}
```
