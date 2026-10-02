import { JOKERS, REAGENTS } from '../game/content';
import { atlases, sprite } from './raster';

// Keep picture positions tied to stable IDs when content tables are reordered.
export const JOKER_ICON_IDS: string[] = ['shears', 'rubyLover', 'goldCollector', 'patternArtisan', 'refractometer', 'purebredCert', 'heterosis', 'hideAndSeek', 'selfingMaster', 'breedingLog', 'mendelGlasses', 'punnettNote', 'beeSwarm', 'seedVault', 'pollenTrader', 'xHeir', 'colchicineNotes', 'karyoScope', 'scissorRack', 'jellyfishGene', 'climateHouse', 'grandpaNotes', 'tissueLab'];
export const REAGENT_ICON_IDS: string[] = ['genetest', 'colchicine', 'scissors', 'vector', 'tissue', 'fertilizer', 'brush'];

export function jokerIcon(id: string, size = 64): HTMLElement {
  const index = JOKER_ICON_IDS.indexOf(id);
  const def = JOKERS.find((def) => def.id === id);
  const icon = sprite(atlases.jokers, index < 0 ? 23 : index, size, def?.name ?? '육종 도구', 'sa-icon sa-icon--joker');
  icon.dataset.icon = def?.id ?? '_default';
  return icon;
}

export function reagentIcon(id: string, size = 64): HTMLElement {
  const index = REAGENT_ICON_IDS.indexOf(id);
  const def = REAGENTS.find((def) => def.id === id);
  const icon = sprite(atlases.reagents, index < 0 ? 7 : index, size, def?.name ?? '연구 도구', 'sa-icon sa-icon--reagent');
  icon.dataset.icon = def?.id ?? '_default';
  return icon;
}
