---
title: "Commands Reference"
description: "Complete reference for all Jelly commands and their options"
order: 2
category: "reference"
---

## Package Management Commands

### `jelly init [options]`

Initialize a new project with Jelly.

**Options:**

- `-n, --name <name>`: Project name

**Example:**

```bash
jelly init --name my-awesome-game
cd my-awesome-game
```

### `jelly install [packages...]`

Install packages from the Wally registry.

**Options:**

- `-D, --dev`: Install as dev dependency
- `--save`: Save to jelly.json dependencies (default)

**Examples:**

```bash
# Install all dependencies from jelly.json
jelly install

# Install specific packages
jelly install roblox/roact roblox/rodux

# Install as dev dependency
jelly install -D roblox/testez
```

### `jelly exec <package> [args...]`

Execute a binary package with smart detection. Checks for locally installed packages first, then downloads from registry if needed.

**Alias:** `jelly x`

**Options:**

- `-y, --yes`: Skip confirmation prompt for remote packages

**Examples:**

```bash
# Execute local package if available, otherwise download from registry
jelly exec my-tool

# Use the short alias
jelly x my-tool

# Skip confirmation for remote packages
jelly exec myuser/formatter -y

# Pass arguments to the binary
jelly exec linter --fix src/

# Execute specific version from registry
jelly exec myuser/tool@1.2.0 --help
```

**How it works:**

- First checks for locally installed packages (in Packages/ or Packages/_Index/)
- If not found locally and package spec includes scope/version, downloads from registry
- Requires `target` configuration in the package's `jelly.json`
- Supports multiple runtimes (Lune, Luau, Node.js, Python, etc.)
- Automatically cleans up temporary files after execution

### `jelly add <packages...>`

Add packages to jelly.json and install them.

**Options:**

- `-D, --dev`: Add as dev dependency

**Examples:**

```bash
# Add a package to dependencies
jelly add omouta/roact

# Add a package to devDependencies
jelly add -D roblox/testez

# Add multiple packages
jelly add roblox/roact roblox/rodux

# Add with specific version
jelly add roblox/roact@^1.4.0
```

### `jelly remove <packages...>`

Remove packages from jelly.json and uninstall them.

**Example:**

```bash
jelly remove roblox/roact
```

### `jelly update [packages...]`

Update packages to their latest compatible versions.

**Options:**

- If no packages specified, updates all outdated packages
- Specify package names to update only those packages

**Examples:**

```bash
# Update all packages
jelly update

# Update specific packages
jelly update roblox/roact roblox/rodux
```

## Discovery Commands

### `jelly list`

List all installed packages and their versions.

**Alias:** `ls`

**Example:**

```bash
jelly list
# or use short alias
jelly ls
```

### `jelly search <query> [options]`

Search for packages in the Wally registry.

**Options:**

- `-l, --limit <number>`: Maximum number of results to show (default: 10)

**Examples:**

```bash
# Search with default limit (10 results)
jelly search roact

# Search with custom limit
jelly search ui --limit 20

# Search with short alias
jelly s signal -l 5
```

### `jelly info <package>`

Show detailed information about a package.

**Example:**

```bash
jelly info roblox/roact
```

### `jelly outdated`

Check for outdated packages and show which ones can be updated.

**Example:**

```bash
jelly outdated
```

## Utility Commands

### `jelly clean`

Clean up the Packages directory by removing unused dependencies and clearing cache.

**Example:**

```bash
jelly clean
```

### `jelly scripts`

List all available scripts defined in jelly.json.

**Example:**

```bash
jelly scripts
```

### `jelly run <script> [args...]`

Run a script defined in jelly.json.

**Examples:**

```bash
# Run the build script
jelly run build

# Run build script with arguments
jelly run build --output game.rbxl

# Run the serve script
jelly run serve
```

### `jelly runtimes`

List available runtimes for executing binary packages.

**Example:**

```bash
jelly runtimes
```

**Output shows:**

- Available runtimes installed on your system  
- Unavailable runtimes that could be installed
- Status of each runtime (available/not available)

## Lockfile Commands

### `jelly lockfile [options]`

Manage the lockfile for reproducible installs.

**Options:**

- `--verify`: Verify lockfile integrity against jelly.json
- `--regenerate`: Regenerate lockfile from jelly.json

**Examples:**

```bash
# Verify lockfile is up to date
jelly lockfile --verify

# Regenerate lockfile (useful after manual jelly.json edits)
jelly lockfile --regenerate
```

## Analysis Commands

### `jelly analyze`

Analyze dependency tree and show version conflicts without installing packages.

**Alias:** `deps`

**Features:**

- Resolves all semver ranges to exact versions
- Detects and reports version conflicts  
- Shows dependency resolution statistics
- Displays package cache information

**Examples:**

```bash
# Analyze dependencies and show conflicts
jelly analyze

# Short alias
jelly deps
```

## Command Aliases

For faster workflow, Jelly provides several command aliases:

- `jelly ls` → `jelly list`
- `jelly s` → `jelly search`
- `jelly deps` → `jelly analyze`
- `jelly x` → `jelly exec`
