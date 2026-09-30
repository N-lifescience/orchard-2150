# 작업 계약서 (2026-09-30) — 협의 대상이 아니다

여러 에이전트가 동시에 이 저장소를 만든다. **담당 폴더 밖 파일은 만들지도 고치지도 않는다.**
맞물리는 규약은 전부 `src/contract/*.ts` 에 있다. 계약 파일은 오케스트레이터만 고친다.
설계는 `docs/GDD.md`. 계약과 설계가 어긋나 보이면 **계약이 우선**이고, 보고에 적는다.

## 담당

| 담당 | 폴더 | 산출물 |
|---|---|---|
| 유전 엔진 | `src/genetics/**`, `tests/genetics*.test.ts` | `src/genetics/index.ts` 가 `GeneticsApi` 전부 export |
| 게임 규칙 | `src/game/**`, `tests/game*.test.ts` | `src/game/index.ts` 가 `GameContent` 전부 export (`createGame`, 콘텐츠 표) |
| 그림 | `src/art/**`, `gallery.html`, `src/gallery.ts` | `src/art/index.ts` 가 `ArtApi` 전부 export, `src/art/art.css` |
| 소리 | `src/audio/**`, `audio-test.html`, `src/audio-test.ts` | `src/audio/index.ts` 가 `audio: AudioApi` export (`src/contract/audio.ts`) |
| 화면 | `src/ui/**`, `src/main.ts`, `index.html`, `src/styles/**`, `public/**`, `tests/ui*.test.ts` | 실제 게임 화면 (`docs/UI-SPEC.md`) |
| 오케스트레이터 | `src/contract/**`, `docs/**`, 설정 파일 | 계약·설계·통합 검증 |

## 공통 규칙

- TypeScript strict. `npm run typecheck` 가 **자기 폴더에서** 에러 0이어야 끝.
- **innerHTML·outerHTML·insertAdjacentHTML 금지.** 요소는 `document.createElement`/`createElementNS` 로만.
- 무작위는 전부 `Rng`(시드 난수)로. `Math.random` 금지(재현성 — 버그 재현과 테스트 때문).
- 외부 네트워크 호출 금지. 학생 개인정보 수집 없음. 저장은 localStorage 만(게임 규칙 담당).
- 한국어 문구는 해요체, 짧게. 교과 용어는 교과서 표기(대립유전자, 동형접합, 이형접합, 표현형, 유전자형,
  상염색체, 성염색체, 배수체, 비분리, 전사, 번역, 코돈, 종결 코돈, 유전자 변형 생물체(LMO)).
- 게임 설정(虛)과 실제 과학(原作)을 섞어 쓰지 않는다. 가상의 것은 가상이라고 적는다.
- 끝나면 보고: 만든 파일 목록, 테스트 결과(숫자), 계약에서 애매했던 점과 어떻게 해석했는지.
