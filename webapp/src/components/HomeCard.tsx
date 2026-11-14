// Lichte kaart van het thuisscherm: "Hervat laatste werk" en "Agenda".
import type { ReactNode } from 'react';
import { Chevron } from './icons';

type Props = { icon: ReactNode; caption?: string; title: string; lines: string[]; href: string };

export function HomeCard({ icon, caption, title, lines, href }: Props) {
  return (
    <a className="r360-card" href={href} data-router-link>
      <span className="r360-card__icon">{icon}</span>
      <div className="r360-card__text">
        {caption && <div className="r360-card__caption">{caption}</div>}
        <div className="r360-card__title">{title}</div>
        {lines.map(line => <div key={line} className="r360-card__line">{line}</div>)}
      </div>
      <Chevron className="r360-card__chevron" />
    </a>
  );
}
