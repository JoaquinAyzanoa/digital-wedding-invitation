import type { AnchorHTMLAttributes, ButtonHTMLAttributes } from 'react';
import styles from './Button.module.css';

type Variant = 'primary' | 'outline';
type Size = 'normal' | 'small';

function classes(variant: Variant, size: Size, className?: string) {
  return [
    styles.button,
    variant === 'outline' && styles.outline,
    size === 'small' && styles.small,
    className,
  ]
    .filter(Boolean)
    .join(' ');
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

/** Pill button in the theme's primary color, uppercase and letter-spaced like the reference. */
export function Button({
  variant = 'primary',
  size = 'normal',
  className,
  type = 'button',
  ...props
}: ButtonProps) {
  return <button type={type} className={classes(variant, size, className)} {...props} />;
}

interface ButtonLinkProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  variant?: Variant;
  size?: Size;
  href: string;
}

/** Same look as Button, for navigation (e.g. "Ver ubicación"). External links open in a new tab. */
export function ButtonLink({
  variant = 'primary',
  size = 'normal',
  className,
  href,
  ...props
}: ButtonLinkProps) {
  const external = /^https?:\/\//.test(href);
  return (
    <a
      href={href}
      className={classes(variant, size, className)}
      {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
      {...props}
    />
  );
}
