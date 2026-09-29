export const COLORS = {
  bg: '#0a0a0b',
  surface: '#131316',
  surfaceHover: '#1a1a1f',
  border: '#26262e',
  borderLight: '#33333c',
  text: '#f5f5f7',
  textMuted: '#9a9aa5',
  textDim: '#6b6b75',
  primary: '#f5f5f7',
  accent: '#e8c547',
  accentDim: '#b89b30',
  success: '#34d399',
  warning: '#fbbf24',
  error: '#f87171',
};

export function statusColor(status: string): string {
  switch (status) {
    case 'active':
      return COLORS.success;
    case 'pending':
      return COLORS.warning;
    case 'completed':
      return COLORS.textDim;
    case 'paid':
      return COLORS.success;
    case 'ready':
      return COLORS.accent;
    case 'delivered':
      return COLORS.textMuted;
    case 'awaiting_hd':
      return COLORS.warning;
    default:
      return COLORS.textMuted;
  }
}

export function statusLabel(status: string): string {
  const labels: Record<string, string> = {
    pending: 'En attente',
    active: 'Active',
    completed: 'Terminée',
    paid: 'Payé',
    awaiting_hd: 'En attente HD',
    ready: 'Prêt à livrer',
    delivered: 'Livré',
  };
  return labels[status] || status;
}
