// Donkerblauwe tegel van het thuisscherm (HomeActionTile in de iOS-app).
import type { ReactNode } from 'react';
import { Chevron } from './icons';

type Props = { title: string; subtitle: string; icon: ReactNode; href: string };

export function HomeTile({ title, subtitle, icon, href }: Props) {
  return (
    <a className="r360-tile" href={href} data-router-link>
      <div className="r360-tile__top">
        <span className="r360-tile__icon">{icon}</span>
        <Chevron className="r360-tile__chevron" />
      </div>
      <div className="r360-tile__text">
        <div className="r360-tile__title">{title}</div>
        <div className="r360-tile__subtitle">{subtitle}</div>
      </div>
    </a>
  );
}
