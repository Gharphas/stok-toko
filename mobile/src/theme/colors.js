// Theme and styling constants for StockMaster Mobile POS
export const Colors = {
  background: '#090d16',       // Deep sleek obsidian
  surface: '#111827',          // Card/panel surface
  surfaceLight: '#1f2937',     // Elevated surface / input
  surfaceLighter: '#374151',   // Borders / hover
  
  primary: '#6366f1',          // Indigo brand
  primaryLight: '#818cf8',
  primaryDark: '#4f46e5',
  primaryMuted: 'rgba(99, 102, 241, 0.15)',

  emerald: '#10b981',          // Success / profit / stock safe
  emeraldLight: '#34d399',
  emeraldMuted: 'rgba(16, 185, 129, 0.15)',

  amber: '#f59e0b',            // Warning / stock running out
  amberLight: '#fbbf24',
  amberMuted: 'rgba(245, 158, 11, 0.15)',

  rose: '#f43f5e',             // Danger / out of stock / delete
  roseLight: '#fb7185',
  roseMuted: 'rgba(244, 63, 94, 0.15)',

  cyan: '#06b6d4',             // Info / sync
  cyanMuted: 'rgba(6, 182, 212, 0.15)',

  textPrimary: '#f8fafc',
  textSecondary: '#cbd5e1',
  textMuted: '#94a3b8',
  textSubtle: '#64748b',

  border: '#1e293b',
  borderLight: '#334155',
  borderFocus: '#6366f1',
};

export const FormatCurrency = (num) => {
  const val = Number(num) || 0;
  return 'Rp ' + val.toLocaleString('id-ID');
};

export const FormatNumber = (num) => {
  const val = Number(num) || 0;
  return val.toLocaleString('id-ID');
};
