export const delay = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

export function normalizeBRNumber(raw: string): string {
  const hasPercent = raw.includes('%');
  const clean = raw.trim()
    .replace(/\s+/g, ' ')
    .replace('%', '')
    .replace(/\./g, '')
    .replace(',', '.');
  
  if (!clean || clean === '-' || clean === '0.00' || clean === '0,00%') return '';
  
  return hasPercent ? `${clean}%` : clean;
}

export const AGENTS: readonly string[] = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
] as const;

export function getRandomAgent(): string {
  return AGENTS[Math.floor(Math.random() * AGENTS.length)];
}
