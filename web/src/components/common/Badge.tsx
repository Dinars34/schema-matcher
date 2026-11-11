interface BadgeProps {
  label: string;
  variant?: 'success' | 'warning' | 'error' | 'neutral' | 'running';
}

export function Badge({ label, variant = 'neutral' }: BadgeProps) {
  let variantClass = '';
  if (variant === 'success') variantClass = 'a';
  if (variant === 'warning') variantClass = 'w';
  if (variant === 'error') variantClass = 'e';
  if (variant === 'running') variantClass = 'r';

  return <span className={`c ${variantClass}`}>{label}</span>;
}