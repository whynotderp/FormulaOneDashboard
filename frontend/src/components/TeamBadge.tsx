const TEAM_COLORS: Record<string, string> = {
  'Red Bull': '#3671C6',
  'Ferrari': '#E8002D',
  'McLaren': '#FF8000',
  'Mercedes': '#27F4D2',
  'Aston Martin': '#229971',
  'Alpine': '#FF87BC',
  'Williams': '#64C4FF',
  'Racing Bulls': '#6692FF',
  'Haas': '#B6BABD',
  'Sauber': '#52E252',
};

export function TeamBadge({ team, className = '' }: { team: string; className?: string }) {
  const color = TEAM_COLORS[team] || '#888';
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium ${className}`}>
      <span className="inline-block w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
      {team}
    </span>
  );
}

export function getTeamColor(team: string): string {
  return TEAM_COLORS[team] || '#888';
}
