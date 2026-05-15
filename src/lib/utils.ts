import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(dateStr: string) {
  if (!dateStr) return '—';
  const [y, m, d] = dateStr.split('-');
  const months = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  return `${parseInt(d)} ${months[parseInt(m) - 1]} ${y}`;
}

export function formatCurrency(amount: number) {
  if (!amount || amount <= 0) return '—';
  return new Intl.NumberFormat('es-HN', {
    style: 'currency',
    currency: 'LPS',
    minimumFractionDigits: 2
  }).format(amount).replace('LPS', 'L');
}
