import { atlases, sprite } from './raster';

const PEOPLE = [
  ['레아 모레노', 'peopleA', 0], ['엘레나 로시', 'peopleA', 1], ['마테오 비앙키', 'peopleA', 2],
  ['파울라 슈미트', 'peopleA', 3], ['마테오 로시', 'peopleA', 4], ['아미나 하다드', 'peopleA', 5],
  ['클라라 뒤부아', 'peopleA', 6], ['토머스 리', 'peopleA', 7], ['소피아 알메이다', 'peopleA', 8],
  ['니콜라 코스타', 'peopleB', 0], ['하나 오카다', 'peopleB', 1], ['레일라 벤살렘', 'peopleB', 2],
  ['이네스 페레스', 'peopleB', 3], ['나디아 볼코바', 'peopleB', 4], ['에바 린드', 'peopleB', 5],
  ['오스카 베르너', 'peopleB', 6], ['라일라 만수르', 'peopleB', 7], ['에밀 뒤랑', 'peopleB', 8],
  ['이사벨 리마', 'peopleC', 0], ['린 첸', 'peopleC', 1], ['알리시아 바르가스', 'peopleC', 2],
] as const;

export const CHARACTER_NAMES = PEOPLE.map(([name]) => name);

export function characterName(text: string): string | undefined {
  const exact = PEOPLE.find(([name]) => text.includes(name));
  if (exact) return exact[0];
  // Starter plants sometimes abbreviate the owner. Match only the beginning of a title.
  return PEOPLE.find(([name]) => text.startsWith(name.split(' ')[0] + '의 '))?.[0];
}

export function characterPortrait(text: string, size = 80): HTMLElement {
  const name = characterName(text);
  const person = PEOPLE.find(([candidate]) => candidate === name);
  const portrait = person
    ? sprite(atlases[person[1]], person[2], size, person[0] + ' 초상화', 'sa-character')
    : sprite(atlases.peopleC, 3, size, '오차드 씨앗 문장', 'sa-character sa-character--crest');
  portrait.dataset.character = person?.[0] ?? 'orchard';
  return portrait;
}
