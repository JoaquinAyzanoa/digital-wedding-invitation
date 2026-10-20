import type { AnchorHTMLAttributes, ButtonHTMLAttributes } from 'react';
import styles from './Button.module.css';

type Variant = 'primary' | 'outline';

function classes(variant: Variant, className?: string) {
  return [styles.button, variant === 'outline' && styles.outline, className]
    .filter(Boolean)
    .join(' ');
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

/** Pill button in the theme's primary color, uppercase and letter-spaced like the reference. */
export function Button({ variant = 'primary', className, type = 'button', ...props }: ButtonProps) {
  return <button type={type} className={classes(variant, className)} {...props} />;
}

interface ButtonLinkProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  variant?: Variant;
  href: string;
}

/** Same look as Button, for navigation (e.g. "Ver ubicación"). External links open in a new tab. */
export function ButtonLink({ variant = 'primary', className, href, ...props }: ButtonLinkProps) {
  const external = /^https?:\/\//.test(href);
  return (
    <a
      href={href}
      className={classes(variant, className)}
      {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
      {...props}
    />
  );
}
