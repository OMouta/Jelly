---
title: "Comparison with Wally"
description: "Feature comparison between Jelly and Wally package managers"
order: 8
category: "reference"
---

## Overview

Jelly builds on top of the Wally ecosystem while providing significant improvements in developer experience, performance, and features. Both tools use the same package registry and format, making migration seamless.

## Feature Comparison Table

| Feature | Wally | Jelly |
|---------|-------|-------|
| **Configuration Format** | `wally.toml` | `jelly.json` |
| **Lockfile Support** | `wally-lock.toml` | `jelly-lock.json` |
| **Version Resolution** | Basic semver | Advanced with conflict detection |
| **Package Cleanup** | Downloads entire repos | Smart cleanup, removes bloat |
| **Package Registry** | Wally Registries | Wally Registries |
| **Package Format** | Standard | Same |
| **CLI Interface** | Basic commands | Enhanced with more options |
| **Space Efficiency** | Downloads everything | Optimizes packages |
| **Dependency Analysis** | No | Built-in conflict detection |
| **Scripts Support** | No | npm-style scripts |

## Detailed Comparisons

### Configuration Files

#### Wally Configuration (`wally.toml`)

```toml
[package]
name = "my-game"
version = "1.0.0"
registry = "https://github.com/UpliftGames/wally-index"
realm = "shared"

[dependencies]
Roact = "roblox/roact@^1.4.0"
Rodux = "roblox/rodux@^3.0.0"

[dev-dependencies]
TestEZ = "roblox/testez@^0.4.0"
```

#### Jelly Configuration (`jelly.json`)

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
    "test": "rojo test"
  },
  "jelly": {
    "cleanup": true,
    "optimize": true,
    "packagesPath": "Packages"
  }
}
```

**Advantages of JSON**:

- More familiar to web developers
- Better IDE support and validation
- Easier programmatic manipulation
- Support for complex data structures

### Package Management

#### Wally Approach

```bash
# Basic Wally commands
wally install
wally add roblox/roact
wally remove roblox/roact
wally list
wally login
wally publish
```

#### Jelly Approach

```bash
# Enhanced Jelly commands
jelly install
jelly add roblox/roact
jelly remove roblox/roact
jelly list
jelly search roact --limit 20
jelly info roblox/roact
jelly update
jelly outdated
jelly clean
jelly run build
```

### Version Resolution

#### Wally Version Resolution

Basic semver resolution with limited conflict handling:

```bash
# Wally might silently pick incompatible versions
wally install
```

#### Jelly Version Resolution

Advanced resolution with clear conflict reporting:

```bash
jelly install
# or analyze first
jelly analyze
```

**Output Example**:

```text
⚠️  Version conflicts detected:
  roblox/roact:
    package-a requires ^1.4.0
    package-b requires ^1.3.0
    → Resolved to 1.4.2

✅ All conflicts resolved successfully!
```

### CLI Experience

#### Command Comparison

| Operation | Wally | Jelly |
|-----------|-------|-------|
| **Initialize** | `wally init` | `jelly init` |
| **Install** | `wally install` | `jelly install` |
| **Add package** | `wally add roblox/roact` | `jelly add roblox/roact` |
| **Search** | `wally search roblox/roact` | `jelly search roact --limit 10` |
| **Package info** | No built-in info | `jelly info roblox/roact` |
| **List packages** | `wally list` | `jelly list` |
| **Update packages** | Manual editing | `jelly update` |
| **Check outdated** | No command | `jelly outdated` |
| **Run scripts** | No support | `jelly run build` |
| **Clean packages** | No command | `jelly clean` |

#### Enhanced Search

**Jelly Search Features**:

```bash
# Configurable result limits
jelly search ui --limit 20

# Detailed package information
jelly info roblox/roact

# Short aliases
jelly s roact -l 5
```

## Migration Guide

### From Wally to Jelly

#### 1. Install Jelly

```bash
# Add to aftman.toml
aftman add OMouta/Jelly
aftman install
```

#### 2. Convert Configuration

**Transform `wally.toml`**:

```toml
[package]
name = "my-game"
version = "1.0.0"

[dependencies]
Roact = "roblox/roact@^1.4.0"
```

**To `jelly.json`**:

```json
{
  "name": "my-game",
  "version": "1.0.0",
  "dependencies": {
    "roblox/roact": "^1.4.0"
  }
}
```

#### 3. Clean and Reinstall

```bash
# Remove Wally packages
rm -rf Packages
rm wally.toml wally-lock.toml

# Install with Jelly
jelly install
```

#### 4. Update Scripts

Replace Wally commands in your scripts:

**Before**:

```bash
wally install
wally list
```

**After**:

```bash
jelly install
jelly list
```

### Dual Usage

You can use both tools in the same project during transition:

```text
project/
├── wally.toml          # Keep for team members using Wally
├── jelly.json          # Add for Jelly users
├── Packages/           # Shared by both tools
└── default.project.json
```

Keep dependencies synchronized between both files until full migration.
