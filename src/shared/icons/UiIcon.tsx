import type { ReactNode, SVGProps } from 'react';

// Interface glyphs on a 24×24 grid (player, copy, menus). Content icons live in Icon.tsx.
const PATHS = {
  play: (
    <path
      d="M8 5.5v13a1 1 0 0 0 1.5.86l10.4-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z"
      fill="currentColor"
      stroke="none"
    />
  ),
  pause: (
    <>
      <rect x="6.5" y="5" width="4" height="14" rx="1" fill="currentColor" stroke="none" />
      <rect x="13.5" y="5" width="4" height="14" rx="1" fill="currentColor" stroke="none" />
    </>
  ),
  prev: (
    <>
      <path d="M18 6v12l-9-6z" fill="currentColor" />
      <path d="M6 5v14" />
    </>
  ),
  next: (
    <>
      <path d="M6 6v12l9-6z" fill="currentColor" />
      <path d="M18 5v14" />
    </>
  ),
  shuffle: (
    <path d="M3 7h3.5c4 0 6 10 10 10H20M3 17h3.5c1.6 0 2.8-1.5 3.8-3.4M13.7 10.4C14.7 8.5 15.9 7 17.5 7H20M18 4.5 20.5 7 18 9.5M18 14.5l2.5 2.5-2.5 2.5" />
  ),
  repeat: <path d="M4 11V9a3 3 0 0 1 3-3h12M16 3l3 3-3 3M20 13v2a3 3 0 0 1-3 3H5M8 21l-3-3 3-3" />,
  volume: (
    <path d="M4 9.5v5h3.5L12 18V6L7.5 9.5zM15.5 9a4.2 4.2 0 0 1 0 6M18 6.5a7.8 7.8 0 0 1 0 11" />
  ),
  mute: <path d="M4 9.5v5h3.5L12 18V6L7.5 9.5zM16 9.5l5 5M21 9.5l-5 5" />,
  copy: (
    <>
      <rect x="8.5" y="8.5" width="11" height="11" rx="2" />
      <path d="M15.5 8.5V6.5a2 2 0 0 0-2-2h-7a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h2" />
    </>
  ),
  check: <path d="M5 12.5 10 17.5 19 7" />,
  close: <path d="M6 6l12 12M18 6 6 18" />,
  external: (
    <path d="M14 4h6v6M20 4l-9 9M18 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4" />
  ),
  download: <path d="M12 4v11M7.5 10.5 12 15l4.5-4.5M5 19h14" />,
} satisfies Record<string, ReactNode>;

export type UiIconName = keyof typeof PATHS;

interface UiIconProps extends Omit<SVGProps<SVGSVGElement>, 'name'> {
  name: UiIconName;
  size?: number;
}

export function UiIcon({ name, size = 24, ...props }: UiIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      {PATHS[name]}
    </svg>
  );
}
