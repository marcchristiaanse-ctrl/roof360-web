// Gevulde iconen die lijken op de Apple-iconen (SF Symbols) uit de iOS-app.
// Apple-iconen zelf mogen niet op een website, daarom deze eigen tekeningen.
import type { SVGProps } from 'react';

type P = SVGProps<SVGSVGElement>;
const base = { viewBox: '0 0 24 24', width: 28, height: 28, 'aria-hidden': true } as const;
const cut = 'var(--r360-deep-navy)';

export const IconPlusSquare = (p: P) => (
  <svg {...base} {...p}><rect x="2" y="2" width="20" height="20" rx="4.5" fill="currentColor" />
    <path d="M12 7v10M7 12h10" stroke={cut} strokeWidth="2.6" strokeLinecap="round" /></svg>
);
export const IconFolder = (p: P) => (
  <svg {...base} {...p}><path fill="currentColor" d="M2 6.5A2.5 2.5 0 0 1 4.5 4h4.2c.7 0 1.3.3 1.8.8L12 6.5h7.5A2.5 2.5 0 0 1 22 9v8.5a2.5 2.5 0 0 1-2.5 2.5h-15A2.5 2.5 0 0 1 2 17.5z" />
    <path d="M2 9.2h20" stroke={cut} strokeWidth="1.2" /></svg>
);
const windows = (x: number, y: number, cols: number, rows: number) =>
  Array.from({ length: cols * rows }, (_, i) => (
    <rect key={i} x={x + (i % cols) * 3.2} y={y + Math.floor(i / cols) * 3.4} width="1.8" height="1.8" rx=".4" fill={cut} />
  ));
export const IconBuildings = (p: P) => (
  <svg {...base} {...p}><rect x="2" y="2" width="12" height="20" rx="2" fill="currentColor" />
    <rect x="15.5" y="8" width="6.5" height="14" rx="1.8" fill="currentColor" />
    {windows(4.3, 5, 3, 4)}<rect x="6.6" y="18" width="2.8" height="4" fill={cut} />
    <rect x="17.8" y="11" width="1.8" height="1.8" rx=".4" fill={cut} /><rect x="17.8" y="14.4" width="1.8" height="1.8" rx=".4" fill={cut} /></svg>
);
export const IconBuilding = (p: P) => (
  <svg {...base} {...p}><rect x="6" y="2" width="12" height="20" rx="2" fill="currentColor" />
    {windows(8.3, 5, 3, 4)}<rect x="10.6" y="18" width="2.8" height="4" fill={cut} /></svg>
);
export const IconCamera = (p: P) => (
  <svg {...base} {...p}><path fill="currentColor" d="M8.3 4.5 7.2 6.5H4.5A2.5 2.5 0 0 0 2 9v8.5A2.5 2.5 0 0 0 4.5 20h15a2.5 2.5 0 0 0 2.5-2.5V9a2.5 2.5 0 0 0-2.5-2.5h-2.7l-1.1-2z" />
    <circle cx="12" cy="13" r="4.4" fill={cut} /><circle cx="12" cy="13" r="2.8" fill="currentColor" /></svg>
);
export const IconPersonCircle = (p: P) => (
  <svg {...base} {...p} fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" />
    <circle cx="12" cy="9.5" r="3.4" fill="currentColor" stroke="none" />
    <path d="M5.4 19.2c1.4-2.6 3.8-4 6.6-4s5.2 1.4 6.6 4" fill="currentColor" stroke="none" /></svg>
);
export const IconResume = (p: P) => (
  <svg {...base} {...p}><circle cx="12" cy="12" r="10" fill="currentColor" />
    <g transform="translate(6.4 6.4) scale(.47)" fill="none" stroke={cut} strokeWidth="4.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" /><path d="M21 3v5h-5" /></g></svg>
);
export const IconCalendarClock = (p: P) => (
  <svg {...base} {...p}><path fill="currentColor" d="M2 7a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3v4.5a6.5 6.5 0 0 0-8.4 8.5H5a3 3 0 0 1-3-3z" />
    <path d="M2 8.5h18" stroke={cut} strokeWidth="1.2" />
    {[0, 1, 2, 3].map(c => [0, 1].map(r => <rect key={`${c}${r}`} x={4.5 + c * 3.2} y={11 + r * 3} width="1.8" height="1.6" rx=".4" fill={cut} />))}
    <circle cx="17.5" cy="17.5" r="5" fill="currentColor" />
    <path d="M17.5 15v2.7l1.8 1.1" fill="none" stroke={cut} strokeWidth="1.6" strokeLinecap="round" /></svg>
);
export const Chevron = (p: P) => (
  <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden {...p}><path d="m9 5 7 7-7 7" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /></svg>
);
