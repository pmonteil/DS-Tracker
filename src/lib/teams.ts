export const TEAMS = [
  { value: 'modelo_office', label: 'Modelo Office', color: '#3B82F6' },
  { value: 'modelo_legal', label: 'Modelo Legal', color: '#8B5CF6' },
  { value: 'modelo_insight', label: 'Modelo Insight/InTouch', color: '#06B6D4' },
  { value: 'cadastre', label: 'Cadastre', color: '#F59E0B' },
  { value: 'marketing', label: 'Marketing', color: '#EC4899' },
  { value: 'direction', label: 'Direction', color: '#10B981' },
  { value: 'autre', label: 'Autre', color: '#6B7280' },
] as const;

export type TeamValue = (typeof TEAMS)[number]['value'];

export function getTeamByValue(value: string) {
  return TEAMS.find((t) => t.value === value) ?? TEAMS[TEAMS.length - 1];
}
