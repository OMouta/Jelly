# Contributing to Jelly 🪼

Thank you for your interest in contributing to Jelly! We welcome contributions from the community and are excited to see what you'll bring to the project.

## Table of Contents

- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [How to Contribute](#how-to-contribute)
- [Pull Request Process](#pull-request-process)
- [Coding Standards](#coding-standards)
- [Testing](#testing)
- [Documentation](#documentation)

## Getting Started

1. **Fork the repository** on GitHub
2. **Clone your fork** locally
3. **Create a feature branch** from `main`
4. **Make your changes**
5. **Test your changes**
6. **Submit a pull request**

## Development Setup

### Prerequisites

- Node.js 18+ (we recommend using the latest LTS version)
- npm 9+ or yarn 3+
- Git

### Local Development

```bash
# Clone your fork
git clone https://github.com/OMouta/Jelly.git
cd Jelly

# Install dependencies
npm install

# Build the project
npm run build

# Run tests
npm test

# Link for local testing
npm link

# Test the CLI
jelly --version
```

### Project Structure

```text
Jelly/
├── src/
│   ├── bin/           # CLI entry point
│   ├── lib/           # Core library code
│   └── types/         # TypeScript type definitions
├── test/              # Test files
├── examples/          # Example projects
├── docs/              # Documentation
└── dist/              # Compiled output
```

## How to Contribute

### Reporting Bugs

1. **Check existing issues** to avoid duplicates
2. **Use the bug report template** when creating new issues
3. **Provide detailed reproduction steps**
4. **Include system information** (OS, Node.js version, Jelly version)

### Suggesting Features

1. **Check existing feature requests** to avoid duplicates
2. **Use the feature request template**
3. **Explain the problem** your feature would solve
4. **Provide detailed use cases**

### Code Contributions

We welcome the following types of contributions:

- 🐛 **Bug fixes**
- ✨ **New features**
- 📚 **Documentation improvements**
- 🧪 **Test coverage improvements**
- ⚡ **Performance optimizations**
- 🔧 **Code refactoring**

## Pull Request Process

### Before You Start

1. **Discuss major changes** in an issue first
2. **Check that your idea aligns** with the project goals
3. **Ensure no one else is working** on the same feature

### Creating a Pull Request

1. **Create a feature branch** from `main`:

   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes** following our coding standards

3. **Add tests** for your changes

4. **Update documentation** if needed

5. **Commit your changes** with descriptive messages:

   ```bash
   git commit -m "feat: add workspace dependency analysis"
   ```

6. **Push to your fork**:

   ```bash
   git push origin feature/your-feature-name
   ```

7. **Create a pull request** using our template

### Pull Request Requirements

- [ ] All tests pass
- [ ] Code follows our style guidelines
- [ ] Documentation is updated (if applicable)
- [ ] Commit messages follow conventional commits
- [ ] No breaking changes (unless discussed)
- [ ] Self-review completed

## Coding Standards

### TypeScript

- Use **TypeScript** for all new code
- Follow **strict mode** settings
- Provide **proper type annotations**
- Use **interfaces** for public APIs

### Code Style

We use **Prettier** and **ESLint** for code formatting:

```bash
# Format code
npm run format

# Lint code
npm run lint

# Fix lint issues
npm run lint:fix
```

### Naming Conventions

- **Classes**: PascalCase (`JellyManager`)
- **Functions/Variables**: camelCase (`installPackages`)
- **Constants**: UPPER_SNAKE_CASE (`DEFAULT_REGISTRY`)
- **Files**: camelCase (`jellyManager.ts`)

### Error Handling

- Use **descriptive error messages**
- Include **context** in error messages
- Handle **edge cases** gracefully
- **Log errors** appropriately

### Example

```typescript
export class PackageManager {
  async installPackage(name: string, version?: string): Promise<void> {
    try {
      if (!name) {
        throw new Error('Package name is required');
      }

      const resolvedVersion = version || await this.getLatestVersion(name);
      await this.downloadPackage(name, resolvedVersion);
    } catch (error) {
      throw new Error(`Failed to install ${name}: ${error.message}`);
    }
  }
}
```

## Testing

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

### Writing Tests

- Write **unit tests** for all new functionality
- Use **descriptive test names**
- Test **both success and error cases**
- Mock **external dependencies**

### Test Structure

```typescript
describe('PackageManager', () => {
  describe('installPackage', () => {
    it('should install package with latest version when no version specified', async () => {
      // Arrange
      const manager = new PackageManager();
      
      // Act
      await manager.installPackage('test/package');
      
      // Assert
      expect(/* assertion */).toBe(/* expected */);
    });

    it('should throw error when package name is empty', async () => {
      // Arrange
      const manager = new PackageManager();
      
      // Act & Assert
      await expect(manager.installPackage('')).rejects.toThrow('Package name is required');
    });
  });
});
```

## Documentation

### README Updates

- Update **feature descriptions**
- Add **new CLI commands**
- Include **usage examples**
- Update **comparison tables**

### Code Documentation

- Add **JSDoc comments** for public APIs
- Document **complex algorithms**
- Explain **non-obvious code**

### Example

```typescript
/**
 * Resolves package dependencies and detects version conflicts
 * @param dependencies - Map of package names to version ranges
 * @param visited - Set of already processed packages to avoid cycles
 * @returns Promise resolving to dependency resolution result
 */
async resolveDependencyTree(
  dependencies: Record<string, string>,
  visited: Set<string> = new Set()
): Promise<DependencyResolutionResult> {
  // Implementation...
}
```

## Commit Message Format

We use [Conventional Commits](https://www.conventionalcommits.org/):

```text
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

### Types

- **feat**: New feature
- **fix**: Bug fix
- **docs**: Documentation changes
- **style**: Code style changes (formatting, etc.)
- **refactor**: Code refactoring
- **test**: Adding or updating tests
- **chore**: Maintenance tasks

### Examples

```text
feat(cli): add workspace dependency analysis command

fix(lockfile): resolve version conflicts correctly

docs(readme): update installation instructions

test(manager): add tests for package removal
```

## Getting Help

- 💬 **GitHub Discussions**: For questions and ideas
- 🐛 **GitHub Issues**: For bug reports and feature requests
- 📧 **Email**: For security issues or private concerns

## Recognition

Contributors are recognized in:

- **CONTRIBUTORS.md** file
- **Release notes** for their contributions
- **GitHub contributors** graph

Thank you for contributing to Jelly! 🪼
