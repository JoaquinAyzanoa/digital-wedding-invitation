import type { AnchorHTMLAttributes, ButtonHTMLAttributes } from 'react';
import styles from './Btn.module.css';

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost';
type Size = 'md' | 'sm';

function classes(variant: Variant, size: Size, className?: string) {
  return [styles.btn, styles[variant], size === 'sm' && styles.sm, className]
    .filter(Boolean)
    .join(' ');
}

interface BtnProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

/** Admin button: compact and sans-serif (the invitation uses the decorative Button). */
export function Btn({
  variant = 'primary',
  size = 'md',
  className,
  type = 'button',
  ...props
}: BtnProps) {
  return <button type={type} className={classes(variant, size, className)} {...props} />;
}

interface BtnLinkProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  variant?: Variant;
  size?: Size;
  href: string;
}

export function BtnLink({ variant = 'secondary', size = 'md', className, ...props }: BtnLinkProps) {
  return <a className={classes(variant, size, className)} {...props} />;
}
