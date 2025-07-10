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

## Workspace Commands

### `jelly workspace [command]`

Manage workspaces for monorepo development.

**Subcommands:**

- `init`: Initialize workspace root
- `create <path>`: Create new workspace package  
- `list`: List all workspaces
- `install`: Install dependencies for all workspaces
- `add <workspace> <packages...>`: Add packages to specific workspace
- `run <script>`: Run script in all workspaces

**Options:**

- `--parallel`: Run operations in parallel
- `--filter <patterns...>`: Filter workspaces by name/path
- `--exclude <patterns...>`: Exclude workspaces by name/path

**Examples:**

```bash
# Initialize a workspace root
jelly workspace init

# Create workspace packages
jelly workspace create packages/shared-ui --name shared-ui
jelly workspace create packages/game-logic --name game-logic

# List all workspaces
jelly workspace list

# Install dependencies for all workspaces
jelly workspace install

# Install dependencies in parallel (faster)
jelly workspace install --parallel

# Add packages to specific workspace
jelly workspace add shared-ui roblox/roact roblox/rodux

# Run scripts across all workspaces
jelly workspace run build

# Run scripts with filters
jelly workspace run test --filter packages
jelly workspace run build --exclude apps

# Run scripts in parallel
jelly workspace run build --parallel
```

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
