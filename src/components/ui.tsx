import type { ReactNode } from 'react';

export function StatusBadge({ status, label }: { status: string; label: string }) {
  const colors: Record<string, string> = {
    active: '#34d399',
    pending: '#fbbf24',
    completed: '#6b6b75',
    paid: '#34d399',
    awaiting_hd: '#fbbf24',
    ready: '#e8c547',
    delivered: '#6b6b75',
  };
  const color = colors[status] || '#9a9aa5';
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium"
      style={{ background: `${color}1a`, color }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />
      {label}
    </span>
  );
}

export function Button({
  children,
  onClick,
  variant = 'primary',
  size = 'md',
  disabled,
  className = '',
  type = 'button',
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  className?: string;
  type?: 'button' | 'submit';
}) {
  const variants: Record<string, string> = {
    primary: 'bg-[#f5f5f7] text-[#0a0a0b] hover:bg-white',
    secondary: 'bg-[#1a1a1f] text-[#f5f5f7] hover:bg-[#26262e] border border-[#33333c]',
    ghost: 'bg-transparent text-[#9a9aa5] hover:bg-[#1a1a1f] hover:text-[#f5f5f7]',
    danger: 'bg-[#f87171]/10 text-[#f87171] hover:bg-[#f87171]/20 border border-[#f87171]/30',
  };
  const sizes: Record<string, string> = {
    sm: 'px-3 py-1.5 text-xs rounded-lg',
    md: 'px-4 py-2.5 text-sm rounded-xl',
    lg: 'px-6 py-3.5 text-base rounded-xl',
  };
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`transition-smooth font-medium ${variants[variant]} ${sizes[size]} ${className}`}
    >
      {children}
    </button>
  );
}

export function Modal({
  open,
  onClose,
  title,
  children,
  maxWidth = 'max-w-lg',
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  maxWidth?: string;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 animate-fade-in" onClick={onClose} />
      <div
        className={`relative w-full ${maxWidth} rounded-2xl border border-[#26262e] bg-[#131316] p-6 animate-scale-in`}
      >
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button
            onClick={onClose}
            className="text-[#6b6b75] hover:text-[#f5f5f7] transition-smooth"
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Input({
  value,
  onChange,
  placeholder,
  type = 'text',
  label,
  step,
  min,
  className = '',
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  label?: string;
  step?: string;
  min?: string;
  className?: string;
}) {
  return (
    <div className={className}>
      {label && <label className="mb-1.5 block text-sm font-medium text-[#9a9aa5]">{label}</label>}
      <input
        type={type}
        value={value}
        step={step}
        min={min}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl border border-[#33333c] bg-[#0a0a0b] px-4 py-2.5 text-sm text-[#f5f5f7] placeholder:text-[#6b6b75] outline-none transition-smooth focus:border-[#e8c547]/50"
      />
    </div>
  );
}

export function EmptyState({ icon, title, subtitle }: { icon: ReactNode; title: string; subtitle: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="mb-4 text-[#6b6b75]">{icon}</div>
      <p className="text-base font-medium text-[#9a9aa5]">{title}</p>
      <p className="mt-1 text-sm text-[#6b6b75]">{subtitle}</p>
    </div>
  );
}
