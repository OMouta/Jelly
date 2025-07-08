# Jelly 🪼

> ⚠️ **Beta Release**: Jelly is currently in beta (v0.3.0). While functional, expect some rough edges and breaking changes. Feedback and contributions welcome!

A modern package manager for Roblox, built on top of Wally. Jelly provides a streamlined, pnpm-like experience with intelligent package optimization and a clean JSON configuration format.

## Features

- 📦 **Clean JSON Configuration**: Manage dependencies in a familiar `jelly.json` format
- 🔒 **Lockfile Support**: Reproducible installs with `jelly-lock.json` (like package-lock.json)
- 🏢 **Workspace/Monorepo Support**: Manage multiple packages in a single repository (like npm/pnpm workspaces)
- 🧹 **Smart Package Cleanup**: Automatically removes unnecessary files (docs, tests, README) and optimizes package structure
- 💡 **Intelligent Module Resolution**: Handles messy package structures and fixes require paths automatically
- 🔍 **Enhanced Package Search**: Search the Wally registry with customizable result limits
- 📋 **Detailed Package Info**: Get comprehensive information about any package
- 🎯 **Wally Compatible**: Uses the same packages and registry as Wally
- 💾 **Space Efficient**: Like pnpm, removes bloat and keeps only what you need

## Installation

### Aftman (Recommended for Roblox developers)

Add Jelly to your `aftman.toml`:

```bash
aftman add OMouta/Jelly
```

Then install:

```bash
aftman install
```

*Note: Jelly is currently in beta. Other installation methods will be available in future releases.*

## Quick Start

### Initialize a new project

```bash
jelly init --name my-roblox-game
cd my-roblox-game
```

### Add dependencies

```bash
# Add a package to dependencies
jelly add omouta/roact

# Add a package to devDependencies
jelly add -D roblox/testez
```

### Install dependencies

```bash
# Install all dependencies from jelly.json
jelly install

# Install specific packages
jelly install roblox/roact roblox/rodux
```

### List installed packages

```bash
jelly list
# or use short alias
jelly ls
```

### Search for packages

```bash
# Search with default limit (10 results)
jelly search roact

# Search with custom limit
jelly search ui --limit 20

# Search with short alias
jelly s signal -l 5
```

### Get package information

```bash
jelly info roblox/roact
```

### Remove packages

```bash
jelly remove roblox/roact
```

### Run scripts

```bash
# List available scripts
jelly scripts

# Run a script
jelly run build

# Run a script with arguments
jelly run build --output game.rbxl
```

## How it works

Jelly uses a separate `jelly.json` file alongside your `default.project.json` to manage dependencies. This approach keeps your Rojo configuration clean while providing familiar JSON-based dependency management.

### Project Structure

```text
my-project/
├── default.project.json   
├── jelly.json             # Jelly dependencies
├── jelly-lock.json        # Lockfile for reproducible installs
├── Packages/              # Your packages
└── src/
```

### jelly.json Format

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

## Smart Package Cleanup

Unlike traditional package managers that dump entire repositories into your project, Jelly intelligently processes packages to keep only what you need:

### Before (Raw Wally Package)

```bash
some_messy_package/
├── README.md           # ❌ Documentation bloat
├── LICENSE             # ❌ Legal files
├── .gitignore          # ❌ Git config
├── .github/            # ❌ CI/CD configs
├── docs/               # ❌ Documentation
├── test/               # ❌ Test files
├── examples/           # ❌ Example code
├── wally.toml          # ❌ Package config
├── default.project.json
└── lib/                # ✅ Actual module
    └── init.lua        # ✅ Main module file
```

### After (Jelly Processed)

```bash
some_messy_package/
└── init.lua            # ✅ Only the essential module
```

### Intelligent Module Resolution

Jelly automatically handles different package structures:

- **Standard packages**: Direct `init.lua` at root → `require("@self/package_name")`
- **Nested packages**: Reads `default.project.json` → `require("@self/package_name/lib")`
- **Messy repositories**: Extracts main module, cleans everything else

This results in **dramatically smaller package directories** and **faster load times**, similar to how pnpm optimizes Node.js projects.

## Perfect Roblox Development Workflow

Jelly integrates seamlessly with the existing Roblox toolchain:

```toml
# aftman.toml - One tool manager for everything
[tools]
rojo = "rojo-rbx/rojo@7.4.0"
wally = "UpliftGames/wally@0.3.2"    # Keep Wally for other projects
jelly = "OMouta/jelly@0.1.0"         # Use Jelly for new projects
```

```bash
# Install all tools at once
aftman install

# Initialize a new project with Jelly
jelly init --name my-awesome-game
cd my-awesome-game

# Add dependencies (stored in jelly.json)
jelly add roblox/roact
jelly add sleitnick/signal

# Build with Rojo as usual
rojo build --output game.rbxl
```

## Commands

### `jelly init [options]`

Initialize a new Rojo project with Jelly support.

**Options:**

- `-n, --name <name>`: Project name

### `jelly install [packages...]`

Install packages from the Wally registry.

**Options:**

- `-D, --dev`: Install as dev dependency
- `--save`: Save to jelly.json dependencies (default)

### `jelly add <packages...>`

Add packages to jelly.json and install them.

**Options:**

- `-D, --dev`: Add as dev dependency

### `jelly remove <packages...>`

Remove packages from jelly.json and uninstall them.

### `jelly list`

List all installed packages and their versions.

**Alias:** `ls`

### `jelly search <query> [options]`

Search for packages in the Wally registry.

**Options:**

- `-l, --limit <number>`: Maximum number of results to show (default: 10)

### `jelly info <package>`

Show detailed information about a package.

### `jelly outdated`

Check for outdated packages and show which ones can be updated.

### `jelly update [packages...]`

Update packages to their latest compatible versions.

**Options:**

- If no packages specified, updates all outdated packages
- Specify package names to update only those packages

### `jelly clean`

Clean up the Packages directory by removing unused dependencies and clearing cache.

### `jelly scripts`

List all available scripts defined in jelly.json.

### `jelly run <script> [args...]`

Run a script defined in jelly.json.

**Examples:**

- `jelly run build` - Run the build script
- `jelly run build --output game.rbxl` - Run build script with arguments
- `jelly run serve` - Run the serve script

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

### `jelly lockfile [options]`

Manage the lockfile for reproducible installs.

**Options:**

- `--verify`: Verify lockfile integrity against jelly.json
- `--regenerate`: Regenerate lockfile from jelly.json

### `jelly analyze`

Analyze dependency tree and show version conflicts without installing packages.

**Alias:** `deps`

**Features:**

- Resolves all semver ranges to exact versions
- Detects and reports version conflicts  
- Shows dependency resolution statistics
- Displays package cache information

## Lockfile Support

Jelly uses a `jelly-lock.json` file to ensure reproducible installs across different environments. This file:

- **Locks exact versions** of all dependencies and their sub-dependency
- **Stores resolved URLs** for faster downloads
- **Prevents version drift** between different machines/CI environments
- **Ensures consistent builds** for your team

### How lockfiles work

1. **First install**: Jelly generates `jelly-lock.json` based on your `jelly.json`
2. **Subsequent installs**: Jelly uses the lockfile to install exact versions
3. **Adding packages**: The lockfile is automatically updated
4. **Removing packages**: The lockfile is regenerated to remove unused entries

### Lockfile commands

```bash
# Verify lockfile is up to date
jelly lockfile --verify

# Regenerate lockfile (useful after manual jelly.json edits)
jelly lockfile --regenerate
```

**Note**: Like npm's `package-lock.json`, you should commit `jelly-lock.json` to version control to ensure your team gets identical dependency versions.

## Workspace/Monorepo Support

Jelly supports workspaces (monorepos) similar to npm/pnpm workspaces, allowing you to manage multiple Roblox projects in a single repository.

### Setting up a workspace

```bash
# Initialize a new project
jelly init --name my-roblox-workspace
cd my-roblox-workspace

# Convert to workspace root
jelly workspace init

# Create workspace packages
jelly workspace create packages/shared-ui --name shared-ui
jelly workspace create packages/game-logic --name game-logic
jelly workspace create apps/main-game --name main-game
```

### Workspace structure

```text
my-roblox-workspace/
├── jelly.json              # Root workspace config
├── jelly-lock.json         # Shared lockfile
├── packages/
│   ├── shared-ui/
│   │   ├── jelly.json
│   │   ├── default.project.json
│   │   └── src/
│   └── game-logic/
│       ├── jelly.json
│       ├── default.project.json
│       └── src/
├── apps/
│   └── main-game/
│       ├── jelly.json
│       ├── default.project.json
│       └── src/
└── Packages/               # Shared dependencies
```

### Workspace commands

```bash
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

### Root workspace configuration

```json
{
  "name": "my-roblox-workspace",
  "version": "1.0.0",
  "description": "My awesome Roblox workspace",
  "workspaces": [
    "packages/*",
    "apps/*"
  ],
  "scripts": {
    "build:all": "jelly workspace run build",
    "test:all": "jelly workspace run test",
    "install:all": "jelly workspace install --parallel"
  },
  "dependencies": {},
  "devDependencies": {
    "roblox/testez": "^0.4.0"
  }
}
```

### Advanced workspace patterns

```json
{
  "workspaces": {
    "packages": [
      "packages/*",
      "apps/*",
      "tools/*"
    ],
    "nohoist": [
      "**/roblox/roact",
      "apps/*/roblox/**"
    ]
  }
}
```

### Benefits of workspaces

- **Shared dependencies**: Install common packages once in the root
- **Consistent versions**: All workspaces use the same dependency versions via shared lockfile
- **Efficient builds**: Run scripts across multiple packages with one command
- **Easy maintenance**: Update dependencies across all packages simultaneously
- **Better organization**: Separate concerns into focused packages

## Version Resolution & Range Handling

Jelly provides advanced semver version resolution and conflict detection, ensuring your dependencies are resolved consistently and reliably.

### Semver Range Support

Jelly supports the full range of semantic versioning patterns:

```json
{
  "dependencies": {
    "roblox/roact": "^1.4.0",      // Compatible with 1.x.x (>=1.4.0 <2.0.0)
    "roblox/rodux": "~3.1.0",      // Compatible with 3.1.x (>=3.1.0 <3.2.0)
    "evaera/promise": ">=4.0.0",   // Any version >= 4.0.0
    "sleitnick/signal": "1.5.0"    // Exact version 1.5.0
  }
}
```

### Version Conflict Detection

When multiple packages require different versions of the same dependency, Jelly automatically detects conflicts and attempts to resolve them:

```bash
jelly install
# or
jelly analyze  # For dependency analysis only
```

### Example: Conflict Resolution

**Scenario**: Two packages require different versions of the same dependency

```json
{
  "dependencies": {
    "package-a": "^1.0.0",  // requires shared-lib@^1.2.0
    "package-b": "^2.0.0"   // requires shared-lib@^1.5.0
  }
}
```

**Jelly Output**:

```bash
🪼 Analyzing dependencies...

⚠️  Version conflicts detected:
  shared-lib:
    package-a requires ^1.2.0
    package-b requires ^1.5.0
    → Resolved to 1.5.2

✔ Dependency analysis complete!
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

Jelly uses an intelligent resolution strategy:

1. **Range Intersection**: Finds the highest version that satisfies all requirements
2. **Conflict Detection**: Identifies when no compatible version exists
3. **Clear Reporting**: Shows which packages caused conflicts and how they were resolved
4. **Lockfile Integration**: Locks resolved versions for reproducible installs

### Dependency Analysis Command

Use the `analyze` command to inspect your dependency tree without installing:

```bash
# Analyze dependencies and show conflicts
jelly analyze

# Short alias
jelly deps
```

This command will:

- Resolve all dependency ranges
- Detect version conflicts
- Show resolution statistics
- Display cache information

### Benefits Over Basic Package Managers

- **No Silent Failures**: Conflicts are detected and reported clearly
- **Predictable Resolutions**: Same input always produces same output
- **Performance Optimized**: Caches package metadata for faster resolution
- **Developer Friendly**: Clear conflict reporting helps debug dependency issues

## Comparison with Wally

| Feature | Wally | Jelly |
|---------|-------|-------|
| Configuration | Separate `wally.toml` | Separate `jelly.json` |
| Lockfile Support | `wally-lock.toml` | `jelly-lock.json` |
| Version Resolution | Basic | Advanced semver with conflict detection |
| Workspace Support | None | Full monorepo/workspace support |
| Package Cleanup | Downloads entire repos | Smart cleanup, removes bloat |
| Package Registry | Wally Registry | Same Wally Registry |
| Package Format | Same | Same |
| CLI Interface | Basic | Enhanced with search limits |
| Space Efficiency | Downloads everything | pnpm-like optimization |
| Parallel Operations | No | Yes, for workspaces and installs |
| Dependency Analysis | No | Built-in conflict detection and reporting |

## Why JavaScript?

You might be wondering: "Why JavaScript instead of Rust?" Great question! Here's my take:

### Development Speed > Execution Speed

While Rust would certainly give us blazing-fast performance, JavaScript allows us to:

- 🚀 **Ship features faster** - More time building cool stuff, less time fighting the borrow checker
- 🔧 **Fix bugs quicker** - Rapid iteration means faster bug fixes and improvements
- 🎯 **Focus on UX** - Spend time on the features that matter to developers
- 🌐 **Leverage ecosystem** - Massive npm ecosystem with battle-tested libraries

### Performance Reality Check

Let's be honest - Jelly is primarily doing:

- HTTP requests to Wally registry
- File I/O operations
- ZIP extraction and cleanup

The bottleneck is network and disk I/O, not CPU. JavaScript is more than fast enough for these tasks and Jelly is still faster than python!

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT License - see LICENSE file for details.

## Links

- [Wally Package Manager](https://github.com/UpliftGames/wally)
- [Rojo](https://github.com/rojo-rbx/rojo)
- [Wally Registry](https://wally.run/)
