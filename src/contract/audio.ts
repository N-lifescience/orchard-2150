// ─────────────────────────────────────────────────────────────
// 계약서: 소리 (src/audio/** 가 구현한다) — 협의 대상 아님
// 구현은 src/audio/index.ts 에서 `export const audio: AudioApi` 하나.
// 외부 음원 파일 없이 WebAudio 합성만. 첫 사용자 입력 전에는 소리 안 남(unlock 필요).
// ─────────────────────────────────────────────────────────────

export type Sfx =
  | 'deal'        // 카드 한 장 들어옴 (짧은 종이 스침)
  | 'select'      // 카드 고름
  | 'deselect'
  | 'hover'       // 아주 작게
  | 'play'        // 출하 버튼
  | 'discard'     // 솎아내기(가위질)
  | 'chip'        // 카드가 칩을 더할 때 — step 번호로 음이 한 칸씩 올라감
  | 'mult'        // 배수 더하기 (따뜻한 벨)
  | 'xmult'       // 배수 곱하기 (더 큰 벨 + 반짝)
  | 'jokerTrigger'
  | 'scoreTally'  // 최종 점수 합산 시작
  | 'fire'        // 목표 돌파 (불꽃)
  | 'coin'        // 돈 받기
  | 'buy'
  | 'sell'
  | 'reroll'
  | 'packOpen'
  | 'cross'       // 교배 (꽃가루 반짝)
  | 'discovery'   // 개념 카드 발견 (맑은 차임)
  | 'bossReveal'  // 보스 등장 (낮은 드론)
  | 'gameOver'
  | 'victory'
  | 'error'       // 안 되는 행동
  | 'edit';       // 편집 작업대에서 염기 바꿈 (디지털 틱)

export interface AudioApi {
  /** 첫 클릭/키 입력 때 호출 (AudioContext 시작) */
  unlock(): void;
  play(s: Sfx, opts?: { step?: number; intensity?: number }): void;
  /** 배경음: 계절(앤티)마다 다른 앰비언트 패드. boss=true 면 긴장감. null 이면 끔 */
  music(state: { ante: number; boss: boolean; scene: 'title' | 'run' | 'shop' | 'end' } | null): void;
  setVolume(master: number, music: number, sfx: number): void; // 0..1
  setMuted(m: boolean): void;
  readonly muted: boolean;
}
