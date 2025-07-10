---
title: "Version Resolution"
description: "Understanding semantic versioning, conflict detection, and dependency resolution"
order: 6
category: "advanced"
---

## Overview

Jelly provides advanced semantic versioning (semver) resolution and conflict detection, ensuring your dependencies are resolved consistently and reliably. This system prevents the common "dependency hell" problems that plague other package managers.

## Semantic Versioning Support

Jelly supports the full range of semantic versioning patterns used in modern package management.

### Version Format

All versions follow the semver format: `MAJOR.MINOR.PATCH`

- **MAJOR**: Breaking changes
- **MINOR**: New features (backwards compatible)
- **PATCH**: Bug fixes (backwards compatible)

### Range Patterns

#### Exact Versions

Specify an exact version when you need precise control:

```json
{
  "dependencies": {
    "sleitnick/signal": "1.5.0"
  }
}
```

**Resolves to**: Exactly `1.5.0`

#### Caret Ranges (Compatible)

Most commonly used pattern - accepts compatible versions:

```json
{
  "dependencies": {
    "roblox/roact": "^1.4.0"
  }
}
```

**Resolves to**: `>=1.4.0 <2.0.0` (latest 1.x.x version)

**Examples**:

- `^1.4.0` → `1.4.0`, `1.4.1`, `1.5.0`, `1.9.2` ✅
- `^1.4.0` → `2.0.0`, `2.1.0` ❌

#### Tilde Ranges (Patch Level)

Accepts patch-level changes only:

```json
{
  "dependencies": {
    "roblox/rodux": "~3.1.0"
  }
}
```

**Resolves to**: `>=3.1.0 <3.2.0` (patch updates only)

**Examples**:

- `~3.1.0` → `3.1.0`, `3.1.1`, `3.1.9` ✅
- `~3.1.0` → `3.2.0`, `3.0.9` ❌

#### Greater Than or Equal

Accept any version above a threshold:

```json
{
  "dependencies": {
    "evaera/promise": ">=4.0.0"
  }
}
```

**Resolves to**: Any version `>=4.0.0`

### Range Examples in Practice

```json
{
  "dependencies": {
    "roblox/roact": "^1.4.0",      // Latest 1.x compatible
    "roblox/rodux": "~3.1.0",      // Patch updates only
    "evaera/promise": ">=4.0.0",   // Minimum version
    "sleitnick/signal": "1.5.0",   // Exact version
    "osyrisrblx/t": "^3.0.0"       // Latest 3.x compatible
  }
}
```

## Conflict Detection

When multiple packages require different versions of the same dependency, Jelly automatically detects and resolves conflicts.

### How Conflicts Occur

**Scenario**: Two packages with conflicting requirements

```json
{
  "dependencies": {
    "package-a": "^1.0.0",  // requires shared-lib@^1.2.0
    "package-b": "^2.0.0"   // requires shared-lib@^1.5.0
  }
}
```

### Resolution Process

Jelly analyzes all requirements and finds compatible versions:

```bash
jelly install
# or analyze without installing
jelly analyze
```

**Output Example**:

```text
🪼 Analyzing dependencies...

⚠️  Version conflicts detected:
  shared-lib:
    package-a requires ^1.2.0
    package-b requires ^1.5.0
    → Resolved to 1.5.2

✅ Dependency analysis complete!
📦 Resolved packages:
  package-a@1.0.3
  package-b@2.1.0
  shared-lib@1.5.2

📊 Resolution statistics:
  Total packages: 3
  Conflicts: 1
  Cache size: 3 packages
```

### Resolution Strategy

Jelly uses an intelligent multi-step resolution strategy:

1. **Range Intersection**: Find versions that satisfy ALL requirements
2. **Latest Compatible**: Choose the highest version within the intersection
3. **Conflict Reporting**: Clearly show what was conflicted and how it was resolved
4. **Fallback Handling**: When no intersection exists, report the irresolvable conflict

### Example Resolution Cases

#### Case 1: Compatible Ranges

```text
Package A requires: ^1.2.0  (>=1.2.0 <2.0.0)
Package B requires: ^1.5.0  (>=1.5.0 <2.0.0)
Intersection: >=1.5.0 <2.0.0
Resolution: 1.8.3 (latest in range)
```

#### Case 2: Overlapping Ranges

```text
Package A requires: ~1.4.0  (>=1.4.0 <1.5.0)
Package B requires: ^1.4.2  (>=1.4.2 <2.0.0)
Intersection: >=1.4.2 <1.5.0
Resolution: 1.4.9 (latest in range)
```

#### Case 3: Irresolvable Conflict

```text
Package A requires: ^1.0.0  (>=1.0.0 <2.0.0)
Package B requires: ^2.0.0  (>=2.0.0 <3.0.0)
Intersection: NONE
Resolution: ERROR - No compatible version found
```

## Dependency Analysis Command

Use the `jelly analyze` command to inspect your dependency tree without installing packages:

```bash
# Analyze dependencies and show conflicts
jelly analyze

# Short alias
jelly deps
```

### Analysis Output

The analysis command provides comprehensive information:

#### Resolution Summary

```text
📦 Resolved packages:
  roblox/roact@1.4.2
  roblox/rodux@3.0.1
  sleitnick/signal@1.5.0
  evaera/promise@4.0.2
```

#### Conflict Details

```text
⚠️  Version conflicts detected:
  roblox/roact:
    my-ui-lib requires ^1.4.0
    another-lib requires ^1.3.0
    → Resolved to 1.4.2

  shared-utils:
    package-x requires ~2.1.0
    package-y requires ^2.0.5
    → Resolved to 2.1.3
```

#### Statistics

```text
📊 Resolution statistics:
  Total packages: 12
  Direct dependencies: 4
  Transitive dependencies: 8
  Conflicts resolved: 2
  Cache hits: 8/12
  Resolution time: 1.2s
```

## Lockfile Integration

All resolved versions are locked in `jelly-lock.json` for reproducible installs:

```json
{
  "version": 1,
  "packages": {
    "roblox/roact": {
      "version": "1.4.2",
      "resolved": "https://api.wally.run/v1/package-contents/roblox/roact/1.4.2",
      "integrity": "sha512-..."
    },
    "shared-lib": {
      "version": "1.5.2",
      "resolved": "https://api.wally.run/v1/package-contents/owner/shared-lib/1.5.2",
      "integrity": "sha512-...",
      "requiredBy": ["package-a", "package-b"]
    }
  },
  "resolutions": {
    "shared-lib": "1.5.2"
  }
}
```

### Lockfile Benefits

1. **Reproducible builds**: Same versions across all environments
2. **Conflict tracking**: Records how conflicts were resolved
3. **Performance**: Faster installs using cached resolutions
4. **Debugging**: Clear audit trail of version decisions

## Advanced Resolution Scenarios

### Peer Dependencies

Some packages expect specific versions of common libraries:

```json
{
  "dependencies": {
    "ui-framework": "^2.0.0"     // expects roact@^1.4.0
  },
  "peerDependencies": {
    "roblox/roact": "^1.4.0"
  }
}
```

Jelly ensures peer dependency requirements are satisfied during resolution.

### Workspace Resolution

In workspaces, dependencies are resolved across all packages:

```text
workspace/
├── packages/
│   ├── shared-ui/      # requires roact@^1.4.0
│   └── game-logic/     # requires roact@^1.3.0
└── apps/
    └── main-game/      # requires roact@^1.4.2
```

**Resolution**: Finds the highest version that satisfies all requirements: `roact@1.4.5`

### Override Resolution

Force specific versions when automatic resolution isn't suitable:

```json
{
  "resolutions": {
    "roblox/roact": "1.4.0",      // Force exact version
    "shared-lib": "^2.0.0"        // Override range
  }
}
```

## Best Practices

### 1. Use Appropriate Range Types

- **Libraries**: Use caret ranges (`^1.4.0`) for flexibility
- **Applications**: Consider exact versions for stability
- **Breaking changes**: Use tilde ranges (`~1.4.0`) when cautious

### 2. Regular Analysis

Run dependency analysis regularly:

```bash
# Before major changes
jelly analyze

# After adding dependencies
jelly add new-package && jelly analyze

# During CI/CD
jelly lockfile --verify
```

### 3. Monitor Conflict Reports

Pay attention to conflict resolution:

- **Many conflicts**: Consider updating dependencies
- **Forced resolutions**: May indicate architectural issues
- **Version sprawl**: Look for opportunities to consolidate

### 4. Keep Dependencies Updated

```bash
# Check for outdated packages
jelly outdated

# Update to latest compatible versions
jelly update

# Update specific packages
jelly update roblox/roact roblox/rodux
```

### 5. Use Lockfile Verification

In CI/CD pipelines, verify lockfile integrity:

```bash
# Verify lockfile matches jelly.json
jelly lockfile --verify

# Regenerate if needed
jelly lockfile --regenerate
```

## Troubleshooting

### Common Issues

#### Version Not Found

```text
Error: No version of 'owner/package' satisfies '^2.0.0'
```

**Solution**: Check available versions with `jelly info owner/package`

#### Irresolvable Conflicts

```text
Error: Cannot resolve version conflict for 'shared-lib'
  Package A requires ^1.0.0
  Package B requires ^2.0.0
```

**Solutions**:

1. Update packages to compatible versions
2. Use resolution overrides
3. Find alternative packages

#### Lockfile Conflicts

```text
Warning: jelly-lock.json is out of sync with jelly.json
```

**Solution**: Run `jelly lockfile --regenerate`

### Debugging Commands

```bash
# Detailed analysis
jelly analyze --verbose

# Check specific package versions
jelly info package-name

# Verify lockfile
jelly lockfile --verify

# Clear cache and retry
jelly clean && jelly install
```
