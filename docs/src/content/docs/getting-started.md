---
title: "Getting Started"
description: "Learn how to install and use Jelly package manager for your Roblox projects"
order: 1
category: "basics"
---

<div class="bg-primary-50 border border-primary-200 p-6 mb-8 not-prose">
  <div class="flex items-center space-x-2 mb-2">
    <span class="text-lg">⚠️</span>
    <span class="font-semibold text-primary-800">Beta Release Notice</span>
  </div>
  <p class="text-primary-700 mb-0">
    Jelly is currently in beta (v0.3). While functional, expect some rough edges and breaking changes. 
    Feedback and contributions are welcome!
  </p>
</div>

## Installation

Jelly can be installed via Aftman. Choose the method that works best for your setup:

### Via Aftman (Recommended for Roblox developers)

Add Jelly to your `aftman.toml`:

```bash
aftman add OMouta/Jelly
```

Then install:

```bash
aftman install
```

### Note on Installation Methods

*Note: Jelly is currently in beta. Additional installation methods will be available in future releases.*

## Creating Your First Project

Initialize a new Jelly project in your current directory:

```bash
jelly init --name my-roblox-game
```

This creates a `jelly.json` file with basic project configuration:

```json
{
  "name": "my-roblox-game",
  "version": "1.0.0",
  "dependencies": {}
}
```

## Adding Dependencies

Add packages to your project using the `jelly add` command:

```bash
# Add a single package
jelly add omouta/roact

# Add multiple packages
jelly add roblox/roact roblox/rodux

# Add with specific version
jelly add roblox/roact@^1.4.0

# Add as dev dependency
jelly add -D roblox/testez
```

## Installing Dependencies

Install all dependencies listed in your `jelly.json`:

```bash
jelly install
```

This creates a `jelly-lock.json` file to ensure reproducible installs and downloads packages to the `Packages` directory.

## Basic Commands

### Package Management

- `jelly init --name <name>` - Initialize new project
- `jelly install` - Install dependencies
- `jelly add <package>` - Add package
- `jelly remove <package>` - Remove package
- `jelly update [packages...]` - Update packages

### Discovery & Information

- `jelly search <query>` - Search packages
- `jelly info <package>` - Package information
- `jelly list` - List installed packages

### Utility Commands

- `jelly run <script>` - Run project scripts
- `jelly clean` - Clean packages directory
- `jelly outdated` - Check for outdated packages

## Next Steps

Now that you have Jelly installed, explore these topics:

- [Commands Reference](./commands) - Complete list of all Jelly commands
- [Project Configuration](./configuration) - Advanced jelly.json configuration
- [Package Optimization](./package-optimization) - How Jelly optimizes packages
- [Version Resolution](./version-resolution) - Understanding semver and conflicts
