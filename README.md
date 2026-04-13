# Jelly 🪼

> [!WARNING]  
> Jelly is no longer mantained, check out [stackfox-labs/luumen](https://github.com/stackfox-labs/luumen) for a better way to control your roblox stack!

A modern package manager for Roblox, built on top of Wally. Jelly provides a streamlined, npm-like experience with intelligent package optimization and a clean JSON configuration format.

## Key Features

- 📦 **Clean JSON Configuration** - Familiar `jelly.json` format like npm
- 🔒 **Lockfile Support** - Reproducible installs with `jelly-lock.json`
- 🧹 **Smart Package Cleanup** - Size reduction by removing bloat
- 🎯 **Wally Compatible** - Uses same packages and registry as Wally
- 💾 **Space Efficient** - Only keeps what you need

## Installation

### Using [Rokit](https://github.com/rojo-rbx/rokit)

- Add and install:

  ```bash
  rokit add OMouta/Jelly
  ```

### Using [Aftman](https://github.com/LPGhatguy/aftman) (deprecated)

- Add Jelly to your `aftman.toml`:

  ```bash
  aftman add OMouta/Jelly
  ```

- Then install:

  ```bash
  aftman install
  ```

### Manual

- Go to the latest [GitHub release](https://github.com/OMouta/Jelly/releases)
- Download the executable for your platform

## Quick Start

```bash
# Initialize new project
jelly init --name my-roblox-game
cd my-roblox-game

# Add dependencies
jelly add roblox/roact roblox/rodux

# Install dependencies
jelly install

# List installed packages
jelly list
```

## Project Structure

```text
my-project/
├── default.project.json   # Rojo configuration
├── jelly.json             # Jelly dependencies
├── jelly-lock.json        # Lockfile for reproducible installs
├── Packages/              # Optimized packages
└── src/
```

## Configuration Example

```json
{
  "name": "my-game",
  "version": "1.0.0",
  "dependencies": {
    "roblox/roact": "^1.4.0",
    "roblox/rodux": "^3.0.0"
  },
  "scripts": {
    "build": "rojo build",
    "serve": "rojo serve"
  }
}
```

## Package Optimization

**Before** (Raw Wally Package):

```text
package/
├── README.md, LICENSE, docs/  ❌ Bloat
├── test/, examples/, .github/ ❌ Unnecessary
└── lib/init.lua              ✅ Actual code
```

**After** (Jelly Processed):

```text
package/
└── init.lua                  ✅ Clean & optimized
```

## Essential Commands

```bash
# Package Management
jelly add <package>         # Add dependency
jelly remove <package>      # Remove dependency
jelly install              # Install all dependencies
jelly update               # Update packages

# Discovery
jelly search <query>       # Search packages
jelly info <package>       # Package details
jelly list                # List installed

# Utilities
jelly run <script>         # Run npm-style scripts
jelly clean               # Clear cache
jelly analyze             # Check dependency conflicts
```

## Documentation

- 📚 **[Full Documentation](./docs)** - Complete guides and API reference
- 🚀 **[Getting Started](./docs/getting-started.md)** - Installation and first project
- ⚙️ **[Configuration](./docs/configuration.md)** - jelly.json reference
- 🔧 **[Commands](./docs/commands.md)** - Complete command reference

## Links

- [Wally Registry](https://wally.run/) - Package repository
- [Rojo](https://github.com/rojo-rbx/rojo) - Roblox project management
- [Aftman](https://github.com/LPGhatguy/aftman) - Tool manager

## Contributing

Contributions welcome! Please submit a Pull Request.

## License

MIT License - see LICENSE file for details.
