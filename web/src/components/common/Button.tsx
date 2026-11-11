interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger';
  size?: 'normal' | 'sm';
}

export function Button({
  children,
  variant = 'secondary',
  size = 'normal',
  className = '',
  ...props
}: ButtonProps) {
  let variantClass = '';
  if (variant === 'primary') variantClass = 'p';
  
  const sizeClass = size === 'sm' ? 'sm' : '';

  return (
    <button
      className={`btn ${variantClass} ${sizeClass} ${className}`.trim()}
      {...props}
    >
      {children}
    </button>
  );
}