import type { DiffItem } from './types';

/**
 * Toujours afficher les screenshots pour les composants ajoutés, supprimés ou modifiés.
 * On ne masque les screenshots que si le changement est purement un renommage de propriétés
 * sans impact visuel (pas de variantes ajoutées/supprimées).
 */
export function shouldShowComponentScreenshots(item: DiffItem): boolean {
  if (item.category !== 'component') return true;
  if (item.change_type === 'added' || item.change_type === 'removed') return true;
  return true;
}
