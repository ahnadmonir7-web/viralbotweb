export interface ColorTheme {
  bg: string;
  hoverBg: string;
  softBg: string;
  text: string;
  border: string;
  bar: string;
}

const COLOR_MAP: Record<string, ColorTheme> = {
  teal: {
    bg: 'bg-teal-600',
    hoverBg: 'hover:bg-teal-700',
    softBg: 'bg-teal-50',
    text: 'text-teal-700',
    border: 'border-teal-200',
    bar: 'bg-teal-600',
  },
  indigo: {
    bg: 'bg-indigo-600',
    hoverBg: 'hover:bg-indigo-700',
    softBg: 'bg-indigo-50',
    text: 'text-indigo-700',
    border: 'border-indigo-200',
    bar: 'bg-indigo-600',
  },
  rose: {
    bg: 'bg-rose-600',
    hoverBg: 'hover:bg-rose-700',
    softBg: 'bg-rose-50',
    text: 'text-rose-700',
    border: 'border-rose-200',
    bar: 'bg-rose-500',
  },
  emerald: {
    bg: 'bg-emerald-600',
    hoverBg: 'hover:bg-emerald-700',
    softBg: 'bg-emerald-50',
    text: 'text-emerald-700',
    border: 'border-emerald-200',
    bar: 'bg-emerald-500',
  },
  sky: {
    bg: 'bg-sky-600',
    hoverBg: 'hover:bg-sky-700',
    softBg: 'bg-sky-50',
    text: 'text-sky-700',
    border: 'border-sky-200',
    bar: 'bg-sky-500',
  },
  amber: {
    bg: 'bg-amber-600',
    hoverBg: 'hover:bg-amber-700',
    softBg: 'bg-amber-50',
    text: 'text-amber-700',
    border: 'border-amber-200',
    bar: 'bg-amber-500',
  },
  violet: {
    bg: 'bg-violet-600',
    hoverBg: 'hover:bg-violet-700',
    softBg: 'bg-violet-50',
    text: 'text-violet-700',
    border: 'border-violet-200',
    bar: 'bg-violet-600',
  },
};

export function getColorTheme(color?: string): ColorTheme {
  return COLOR_MAP[color || 'teal'] || COLOR_MAP.teal;
}

export function formatMoney(amount: number, symbol = '$'): string {
  return `${symbol}${Number(amount || 0).toFixed(2)}`;
}

export function formatReward(amount: number, symbol = '$'): string {
  return `${symbol}${Number(amount || 0).toFixed(3).replace(/0$/, '')}`;
}
