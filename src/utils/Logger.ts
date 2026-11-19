export type LogLevel = 'INFO' | 'WARN' | 'ERROR' | 'PASS' | 'STEP';

export class Logger {
  private static startTime = Date.now();

  constructor(private context: string) {}

  private getElapsed(): string {
    const elapsed = ((Date.now() - Logger.startTime) / 1000).toFixed(1);
    return `+${elapsed}s`.padStart(7, ' ');
  }

  private format(badge: string, color: string, message: string): void {
    const time = `\x1b[90m${this.getElapsed()}\x1b[0m`;
    const tag = `\x1b[1m\x1b[${color}m${badge}\x1b[0m`;
    const ctx = `\x1b[33m[${this.context}]\x1b[0m`;
    console.log(`${time} ${tag} ${ctx} ${message}`);
  }

  info(message: string): void {
    this.format('[INFO] ', '36', message); // Cyan
  }

  step(message: string): void {
    this.format('[STEP] ', '34', message); // Blue
  }

  pass(message: string): void {
    this.format('[PASS] ', '32', message); // Green
  }

  warn(message: string): void {
    this.format('[WARN] ', '35', message); // Magenta
  }

  error(message: string): void {
    this.format('[ERROR]', '31', message); // Red
  }
}
