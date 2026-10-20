import type { ReactNode, SVGProps } from 'react';
import type { IconKey } from '@/shared/schemas/content';

// Line icons on a 48×48 grid, drawn with `currentColor` so they follow the theme.
const PATHS: Record<IconKey, ReactNode> = {
  church: (
    <>
      <path d="M24 3v8M20.5 6.5h7" />
      <path d="M13 21 24 11l11 10" />
      <path d="M15.5 19v23h17V19" />
      <circle cx="24" cy="24" r="2.5" />
      <path d="M21 42v-6a3 3 0 0 1 6 0v6" />
      <path d="M15.5 28 9 32v10h6.5M32.5 28l6.5 4v10h-6.5" />
      <path d="M6 42h36" />
    </>
  ),
  arch: (
    <>
      <path d="M11 42V22a13 13 0 0 1 26 0v20" />
      <path d="M24 13.5c-1.6-2.4-5-1.4-4.2 1.4.5 1.8 4.2 4.1 4.2 4.1s3.7-2.3 4.2-4.1c.8-2.8-2.6-3.8-4.2-1.4z" />
      <circle cx="12" cy="20" r="2.2" />
      <circle cx="36" cy="20" r="2.2" />
      <circle cx="11" cy="26" r="1.6" />
      <circle cx="37" cy="26" r="1.6" />
      <path d="M17 33h14M24 33v9M20.5 42h7" />
      <path d="M21 33a3 3 0 0 1 6 0" />
    </>
  ),
  couple: (
    <>
      <circle cx="17" cy="9.5" r="3.5" />
      <path d="M13.8 8.2C10 11.5 8.5 19 7.5 26" />
      <path d="M14 16.5h6l7 25.5H7z" />
      <path d="M15 22.5h4" />
      <circle cx="31.5" cy="9" r="3.5" />
      <path d="M27.5 16h8l1.5 14h-11z" />
      <path d="M29 30v12M34.5 30v12" />
      <path d="M31.5 16v5M30.3 17.5h2.4" />
      <path d="M20.5 23.5c2 .5 4 .3 6.5-1" />
    </>
  ),
  rings: (
    <>
      <circle cx="19" cy="29" r="10" />
      <circle cx="30" cy="29" r="10" />
      <path d="M15.5 14.5 17.5 11h3l2 3.5L19 19z" />
      <path d="M15.5 14.5h7" />
    </>
  ),
  glasses: (
    <>
      <g transform="rotate(-14 17 40)">
        <path d="M13 8h8l-.8 12.4a3.2 3.2 0 0 1-6.4 0z" />
        <path d="M13.4 14h7.2" />
        <path d="M17 23.6V40M13 40h8" />
      </g>
      <g transform="rotate(14 31 40)">
        <path d="M27 8h8l-.8 12.4a3.2 3.2 0 0 1-6.4 0z" />
        <path d="M27.4 14h7.2" />
        <path d="M31 23.6V40M27 40h8" />
      </g>
      <path d="M24 2v4M19.5 3.5 21 6.5M28.5 3.5 27 6.5" />
    </>
  ),
  plate: (
    <>
      <circle cx="24" cy="24" r="12" />
      <circle cx="24" cy="24" r="8" />
      <path d="M24 22.2c-1-1.5-3.4-.9-2.9 1 .3 1.3 2.9 2.8 2.9 2.8s2.6-1.5 2.9-2.8c.5-1.9-1.9-2.5-2.9-1z" />
      <path d="M6 8v8a2.5 2.5 0 0 0 5 0V8M8.5 8v32" />
      <path d="M40 8c3.5 2.5 3.5 11 0 15v17" />
    </>
  ),
  confetti: (
    <>
      <path d="M8 42 15 22l11 11z" />
      <path d="M12.5 31.5 16.5 35.5M10.5 37l2 2" />
      <path d="M20 18c1.5-3.5 5-4 5.5-8" />
      <path d="M29 23c3.5-1.5 7.5.5 10-2.5" />
      <path d="M25 15l2-6M33 16l5-4M33 28l6 1.5" />
      <circle cx="31" cy="8" r="1" />
      <circle cx="40" cy="22" r="1" />
      <circle cx="21" cy="9" r="1" />
      <path d="M38 5v4M36 7h4" />
    </>
  ),
  gift: (
    <>
      <path d="M10 22h28v19H10z" />
      <path d="M8 16h32v6H8z" />
      <path d="M24 16v25" />
      <path d="M24 16c-2.5-5.5-10-7-10-2.5 0 2.8 5 2.5 10 2.5z" />
      <path d="M24 16c2.5-5.5 10-7 10-2.5 0 2.8-5 2.5-10 2.5z" />
    </>
  ),
  album: (
    <>
      <path d="M13 6h25v36H13a4 4 0 0 1-4-4V10a4 4 0 0 1 4-4z" />
      <path d="M14 6v32M9 38a4 4 0 0 1 4-4h25" />
      <rect x="19" y="16" width="14" height="10" rx="2" />
      <path d="M23 16l1.2-2h3.6l1.2 2" />
      <circle cx="26" cy="21" r="2.6" />
    </>
  ),
  camera: (
    <>
      <rect x="6" y="14" width="36" height="25" rx="4" />
      <path d="M16 14l2.5-4.5h11L32 14" />
      <circle cx="24" cy="26.5" r="7" />
      <circle cx="35.5" cy="19.5" r="1" />
    </>
  ),
  calendar: (
    <>
      <rect x="8" y="11" width="32" height="30" rx="3" />
      <path d="M8 18h32" />
      <path d="M16 7v7M24 7v7M32 7v7" />
      <path d="M24 27c-1.9-2.8-6.3-1.8-5.5 1.9.6 2.4 5.5 5.3 5.5 5.3s4.9-2.9 5.5-5.3c.8-3.7-3.6-4.7-5.5-1.9z" />
    </>
  ),
  dress: (
    <>
      <path d="M20 5l1.5 9.5M28 5l-1.5 9.5" />
      <path d="M21.5 14.5c1.5 1 3.5 1 5 0L28 21H20z" />
      <path d="M20 21 10 42h28L28 21" />
      <path d="M19 29l-2 13M29 29l2 13M24 22v20" />
    </>
  ),
  suit: (
    <>
      <path d="M17 6h14l7 4v32H10V10z" />
      <path d="M17 6l4.5 19L24 14l2.5 11L31 6" />
      <path d="M21 10l3 2 3-2v4l-3-2-3 2z" />
      <path d="M24 28v14" />
      <circle cx="24" cy="31" r=".8" />
      <circle cx="24" cy="36" r=".8" />
    </>
  ),
  heart: <path d="M24 40S8 30.5 8 19a8.5 8.5 0 0 1 16-4 8.5 8.5 0 0 1 16 4C40 30.5 24 40 24 40z" />,
  infinity: (
    <path d="M24 24c-4-5-7.5-8-11.5-8a8 8 0 0 0 0 16c4 0 7.5-3 11.5-8s7.5-8 11.5-8a8 8 0 0 1 0 16c-4 0-7.5-3-11.5-8z" />
  ),
  location: (
    <>
      <path d="M24 43S12 31.5 12 20a12 12 0 0 1 24 0c0 11.5-12 23-12 23z" />
      <circle cx="24" cy="20" r="4.5" />
    </>
  ),
  music: (
    <>
      <path d="M18 35V11l20-4v24" />
      <path d="M18 17l20-4" />
      <circle cx="13.5" cy="35" r="4.5" />
      <circle cx="33.5" cy="31" r="4.5" />
    </>
  ),
};

interface IconProps extends Omit<SVGProps<SVGSVGElement>, 'name'> {
  name: IconKey;
  size?: number | string;
  /** Accessible label. Without it the icon is decorative and hidden from screen readers. */
  label?: string;
}

export function Icon({ name, size = 48, label, strokeWidth = 1.5, ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 48 48"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
      {...props}
    >
      {PATHS[name]}
    </svg>
  );
}
