import chalk from 'chalk';
import figlet from 'figlet';

// Brand colors inspired by professional CLIs
const colors = {
  primary: '#2563eb',      // Blue-500
  secondary: '#111827',    // Indigo-500
  success: '#10B981',      // Emerald-500
  warning: '#F59E0B',      // Amber-500
  error: '#EF4444',        // Red-500
  info: '#06B6D4',         // Cyan-500
  muted: '#6B7280',        // Gray-500
  text: '#F9FAFB',         // Gray-50
  dim: '#9CA3AF',          // Gray-400
};

// Icons for better visual hierarchy
const icons = {
  success: '✨',
  error: '💥',
  warning: '⚠️',
  info: 'ℹ️',
  loading: '🔄',
  package: '📦',
  search: '🔍',
  download: '⬇️',
  upload: '⬆️',
  clean: '🧹',
  lock: '🔒',
  rocket: '🚀',
  gear: '⚙️',
  jelly: '🪼',
  arrow: '→',
  bullet: '•',
  check: '✓',
  cross: '✗',
  plus: '+',
  minus: '-',
  star: '⭐',
  heart: '❤️',
  code: '👨‍💻',
  github: '🐙',
  key: '🔑',
  shield: '🛡️',
  sparkles: '✨',
  zap: '⚡',
  tree: '🌳',
  link: '🔗',
};

export class Output {
  private static indent = '  ';
  private static doubleIndent = '    ';

  // Core output methods
  static log(message: string): void {
    console.log(message);
  }

  static newLine(): void {
    console.log();
  }

  static clear(): void {
    console.clear();
  }

  // Brand header
  static jellyHeader(): void {
    const header = figlet.textSync('🪼 Jelly', { 
      horizontalLayout: 'fitted',
      font: 'Standard'
    });
    console.log(chalk.hex(colors.primary)(header));
    console.log(chalk.hex(colors.dim)('  A modern package manager for Roblox developers'));
    console.log();
  }

  // Status messages
  static success(message: string, details?: string): void {
    console.log(chalk.hex(colors.success)(`${icons.success} ${message}`));
    if (details) {
      console.log(chalk.hex(colors.dim)(`${this.indent}${details}`));
    }
  }

  static error(message: string, details?: string): void {
    console.log(chalk.hex(colors.error)(`${icons.error} ${message}`));
    if (details) {
      console.log(chalk.hex(colors.dim)(`${this.indent}${details}`));
    }
  }

  static warning(message: string, details?: string): void {
    console.log(chalk.hex(colors.warning)(`${icons.warning} ${message}`));
    if (details) {
      console.log(chalk.hex(colors.dim)(`${this.indent}${details}`));
    }
  }

  static info(message: string, details?: string): void {
    console.log(chalk.hex(colors.info)(`${icons.info} ${message}`));
    if (details) {
      console.log(chalk.hex(colors.dim)(`${this.indent}${details}`));
    }
  }

  // Action messages with jellyfish icon
  static action(message: string): void {
    console.log(chalk.hex(colors.primary)(`${icons.jelly} ${message}`));
  }

  // Step-by-step process indicators
  static step(step: number, total: number, message: string): void {
    const stepIndicator = chalk.hex(colors.secondary)(`[${step}/${total}]`);
    console.log(`${stepIndicator} ${chalk.hex(colors.text)(message)}`);
  }

  // List items with consistent formatting
  static listItem(text: string, secondary?: string): void {
    console.log(`${this.indent}${chalk.hex(colors.primary)(icons.arrow)} ${chalk.hex(colors.text)(text)}`);
    if (secondary) {
      console.log(`${this.doubleIndent}${chalk.hex(colors.dim)(secondary)}`);
    }
  }

  static bulletPoint(text: string, color?: string): void {
    const bullet = color ? chalk.hex(color)(icons.bullet) : chalk.hex(colors.primary)(icons.bullet);
    console.log(`${this.indent}${bullet} ${chalk.hex(colors.text)(text)}`);
  }

  // Command usage formatting
  static usage(command: string, description?: string): void {
    console.log(`${this.indent}${chalk.hex(colors.primary)(icons.arrow)} ${chalk.hex(colors.secondary)(command)}`);
    if (description) {
      console.log(`${this.doubleIndent}${chalk.hex(colors.dim)(description)}`);
    }
  }

  // Package information formatting
  static packageInfo(name: string, version: string, description?: string): void {
    console.log(`${this.indent}${chalk.hex(colors.primary)(icons.package)} ${chalk.hex(colors.text)(name)}${chalk.hex(colors.dim)('@' + version)}`);
    if (description) {
      console.log(`${this.doubleIndent}${chalk.hex(colors.dim)(description)}`);
    }
  }

  // Progress indicators
  static progress(message: string, current: number, total: number): void {
    const percentage = Math.round((current / total) * 100);
    const progressBar = this.createProgressBar(current, total, 20);
    console.log(`${chalk.hex(colors.primary)(icons.jelly)} ${message}`);
    console.log(`${this.indent}${progressBar} ${chalk.hex(colors.dim)(`${percentage}% (${current}/${total})`)}`);
  }

  private static createProgressBar(current: number, total: number, width: number): string {
    const filled = Math.round((current / total) * width);
    const empty = width - filled;
    const filledBar = chalk.hex(colors.primary)('█'.repeat(filled));
    const emptyBar = chalk.hex(colors.muted)('░'.repeat(empty));
    return `[${filledBar}${emptyBar}]`;
  }

  // Table formatting for lists
  static table(headers: string[], rows: string[][]): void {
    if (rows.length === 0) return;

    // Calculate column widths
    const colWidths = headers.map((header, i) => {
      const maxRowWidth = Math.max(...rows.map(row => (row[i] || '').length));
      return Math.max(header.length, maxRowWidth);
    });

    // Print headers
    const headerRow = headers.map((header, i) => 
      chalk.hex(colors.secondary)(header.padEnd(colWidths[i]))
    ).join('  ');
    console.log(`${this.indent}${headerRow}`);

    // Print separator
    const separator = colWidths.map(width => 
      chalk.hex(colors.dim)('─'.repeat(width))
    ).join('  ');
    console.log(`${this.indent}${separator}`);

    // Print rows
    rows.forEach(row => {
      const formattedRow = row.map((cell, i) => 
        chalk.hex(colors.text)((cell || '').padEnd(colWidths[i]))
      ).join('  ');
      console.log(`${this.indent}${formattedRow}`);
    });
  }

  // Authentication flow specific formatting
  static authStart(registry: string): void {
    this.newLine();
    console.log(chalk.hex(colors.primary).bold(`${icons.lock} Authentication Required`));
    console.log(`${this.indent}${chalk.hex(colors.dim)('Registry:')} ${chalk.hex(colors.primary)(registry)}`);
  }

  static authCode(verificationUri: string, userCode: string): void {
    this.newLine();

    console.log(`${this.indent}${chalk.hex(colors.dim)('Code:')} ${chalk.hex(colors.warning).bold(userCode)}`);
    console.log(`${this.indent}${chalk.hex(colors.dim)('URL:')} ${chalk.hex(colors.info)(verificationUri)}`);
    this.newLine();

    console.log(`${this.indent}${chalk.hex(colors.text)('1. Open the URL in your browser')}`);
    console.log(`${this.indent}${chalk.hex(colors.text)('2. Enter the verification code')}`);
    this.newLine();
  }

  // Command help formatting
  static commandHelp(name: string, description: string, usage?: string, options?: Array<{flags: string, description: string}>, commands?: Array<{name: string, description: string}>): void {
    this.jellyHeader();
    
    console.log(chalk.hex(colors.text)(description));
    this.newLine();

    if (usage) {
      console.log(chalk.hex(colors.secondary).bold('Usage:'));
      console.log(`${this.indent}${chalk.hex(colors.primary)(name)} ${chalk.hex(colors.text)(usage)}`);
      this.newLine();
    }

    if (options && options.length > 0) {
      console.log(chalk.hex(colors.secondary).bold('Options:'));
      options.forEach(option => {
        console.log(`${this.indent}${chalk.hex(colors.primary)(icons.arrow)} ${chalk.hex(colors.info)(option.flags.padEnd(25))} ${chalk.hex(colors.dim)(option.description)}`);
      });
      this.newLine();
    }

    if (commands && commands.length > 0) {
      console.log(chalk.hex(colors.secondary).bold('Commands:'));
      commands.forEach(command => {
        console.log(`${this.indent}${chalk.hex(colors.primary)(icons.arrow)} ${chalk.hex(colors.info)(command.name.padEnd(25))} ${chalk.hex(colors.dim)(command.description)}`);
      });
      this.newLine();
    }

    console.log(chalk.hex(colors.dim)(`${icons.jelly} Made with ${icons.heart} for the Roblox community`));
  }

  // Version display
  static version(version: string): void {
    this.jellyHeader();
    console.log(`${this.indent}${chalk.hex(colors.dim)('Version:')} ${chalk.hex(colors.primary)(version)}`);
    console.log(`${this.indent}${chalk.hex(colors.dim)('Built with')} ${chalk.hex(colors.error)(icons.heart)} ${chalk.hex(colors.dim)('for the Roblox community')}`);
    this.newLine();
  }

  // Dividers and separators
  static divider(): void {
    console.log(chalk.hex(colors.dim)('─'.repeat(55)));
  }

  static section(title: string): void {
    this.newLine();
    console.log(chalk.hex(colors.secondary).bold(title));
    console.log(chalk.hex(colors.dim)('─'.repeat(title.length)));
  }

  // Loading states
  static loading(message: string): void {
    console.log(chalk.hex(colors.primary)(`${icons.loading} ${message}`));
  }

  // File operations
  static fileOperation(operation: string, file: string): void {
    console.log(`${this.indent}${chalk.hex(colors.dim)(operation)} ${chalk.hex(colors.text)(file)}`);
  }

  // Git-style diff display
  static diff(added: string[], removed: string[], modified: string[]): void {
    if (added.length > 0) {
      console.log(chalk.hex(colors.success).bold('Added:'));
      added.forEach(item => {
        console.log(`${this.indent}${chalk.hex(colors.success)(icons.plus)} ${chalk.hex(colors.text)(item)}`);
      });
      this.newLine();
    }

    if (removed.length > 0) {
      console.log(chalk.hex(colors.error).bold('Removed:'));
      removed.forEach(item => {
        console.log(`${this.indent}${chalk.hex(colors.error)(icons.minus)} ${chalk.hex(colors.text)(item)}`);
      });
      this.newLine();
    }

    if (modified.length > 0) {
      console.log(chalk.hex(colors.warning).bold('Modified:'));
      modified.forEach(item => {
        console.log(`${this.indent}${chalk.hex(colors.warning)(icons.gear)} ${chalk.hex(colors.text)(item)}`);
      });
      this.newLine();
    }
  }

  // Footer
  static footer(): void {
    this.newLine();
    console.log(chalk.hex(colors.dim).italic(`Run ${chalk.hex(colors.primary)('jelly --help')} for more information`));
  }
}

// Convenience exports for commonly used functions
export const { 
  success, 
  error, 
  warning, 
  info, 
  action, 
  step, 
  listItem, 
  packageInfo,
  authStart,
  authCode,
  jellyHeader,
  version,
  newLine,
  table,
  section,
  divider
} = Output;
