import type { Phenotype } from '../contract/genetics';
import { plantImageUrl } from './plantImages';

export function describePheno(p: Phenotype): string {
  const species = p.species === 'stella' ? '별다래' : '루미';
  const color = p.color === 'ruby' ? '루비' : '골드';
  const mark = p.marked ? p.species === 'stella' ? '은빛 잎' : '별무늬' : p.species === 'stella' ? '초록 잎' : '무늬 없음';
  return species + ' ' + (p.sex === 'M' ? '수그루 꽃' : '열매') + ' · ' + color + ' · ' + mark;
}

export function fruitArt(p: Phenotype, _seed: number, size = 120): HTMLImageElement {
  const img = document.createElement('img');
  img.src = plantImageUrl(p);
  img.alt = describePheno(p);
  img.className = 'sa-fruit';
  img.width = size;
  img.height = size;
  img.decoding = 'async';
  img.draggable = false;
  img.dataset.species = p.species;
  img.dataset.sex = p.sex;
  return img;
}
