# Jelly 🪼

> ⚠️ **Beta Release**: Jelly is currently in beta (v0.1.0). While functional, expect some rough edges and breaking changes. Feedback and contributions welcome!

A modern package manager for Roblox, built on top of Wally. Jelly provides a streamlined, pnpm-like experience by integrating dependency management directly into your Rojo project files, eliminating the need for separate `wally.toml` files.

## Features

- 📦 **Unified Configuration**: Manage dependencies directly in your `default.project.json` files
- 🧹 **Smart Package Cleanup**: Automatically removes unnecessary files (docs, tests, README) and optimizes package structure
- 💡 **Intelligent Module Resolution**: Handles messy package structures and fixes require paths automatically
- 🔍 **Enhanced Package Search**: Search the Wally registry with customizable result limits
- 📋 **Detailed Package Info**: Get comprehensive information about any package
- 🚀 **Project Initialization**: Create new Rojo projects with a single command
- 🎯 **Wally Compatible**: Uses the same packages and registry as Wally
- 💾 **Space Efficient**: Like pnpm, removes bloat and keeps only what you need

## Installation

### Aftman (Recommended for Roblox developers)

Add Jelly to your `aftman.toml`:

```toml
[tools]
jelly = "OMouta/jelly@0.1.0"
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
# Install all dependencies from project.json
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

## How it works

Instead of maintaining a separate `wally.toml` file, Jelly integrates dependency management directly into your Rojo project configuration. Your `default.project.json` file can now include a `dependencies` and `devDependencies` section:

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
  "tree": {
    "$className": "DataModel",
    "ReplicatedStorage": {
      "Shared": {
        "$path": "src/shared"
      },
      "Packages": {
        "$path": "Packages"
      }
    }
  }
}
```

## Smart Package Cleanup 🧹

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

# Add dependencies (integrated in default.project.json)
jelly add roblox/roact
jelly add sleitnick/signal

# Build with Rojo as usual
rojo build --output game.rbxl
```

No more managing separate `wally.toml` files - everything is in your `default.project.json`!

## Commands

### `jelly init [options]`

Initialize a new Rojo project with Jelly support.

**Options:**

- `-n, --name <name>`: Project name

### `jelly install [packages...]`

Install packages from the Wally registry.

**Options:**

- `-D, --dev`: Install as dev dependency
- `--save`: Save to project.json dependencies (default)

### `jelly add <packages...>`

Add packages to project.json and install them.

**Options:**

- `-D, --dev`: Add as dev dependency

### `jelly remove <packages...>`

Remove packages from project.json and uninstall them.

### `jelly list`

List all installed packages and their versions.

**Alias:** `ls`

### `jelly search <query> [options]`

Search for packages in the Wally registry.

**Options:**

- `-l, --limit <number>`: Maximum number of results to show (default: 10)

### `jelly info <package>`

Show detailed information about a package.

## Package Name Format

Jelly uses the same package naming convention as Wally:

- `scope/name` - Install latest version
- `scope/name@version` - Install specific version
- `scope/name@^version` - Install compatible version

## Examples

```bash
# Initialize a new project
jelly init --name my-awesome-game

# Add popular packages
jelly add roblox/roact
jelly add roblox/rodux
jelly add -D roblox/testez

# List what's installed
jelly list

# Search for roact libraries
jelly search roact --limit 5

# Get info about a specific package
jelly info roblox/roact

# Install all dependencies
jelly install

# Remove a package
jelly remove roblox/roact
```

## Project Structure

After running `jelly init`, your project will have the following structure:

```md
my-project/
├── default.project.json    # Rojo project config with dependencies
├── src/
│   ├── client/
│   │   └── init.client.luau
│   ├── server/
│   │   └── init.server.luau
│   └── shared/
│       └── Hello.luau
```

## Comparison with Wally

| Feature | Wally | Jelly |
|---------|-------|-------|
| Configuration | Separate `wally.toml` | Integrated in `default.project.json` |
| Package Cleanup | Downloads entire repos | Smart cleanup, removes bloat |
| Package Registry | Wally Registry | Same Wally Registry |
| Package Format | Same | Same |
| CLI Interface | Basic | Enhanced with search limits |
| Space Efficiency | Downloads everything | pnpm-like optimization |

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT License - see LICENSE file for details.

## Links

- [Wally Package Manager](https://github.com/UpliftGames/wally)
- [Rojo](https://github.com/rojo-rbx/rojo)
- [Wally Registry](https://wally.run/)
