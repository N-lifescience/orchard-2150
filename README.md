# ORCHARD 2150

오차드 2150은 교배로 작물을 만들고 주문을 완수하는 유전 학습 게임입니다. 부모를 고르면 자손 52개가 만들어집니다. **목표 점수와 약속한 형질·수량을 모두 납품**해야 계약을 완료합니다. 다음 교배에 쓸 포기를 선발하며 마지막 시즌까지 진행하세요.

처음에는 **수업 모드**를 권합니다. 실패한 원인을 확인하고 같은 계약을 다시 준비할 수 있습니다. **도전 모드**에서는 실패하면 연대기가 끝납니다. 전체 8시즌, 빠른 4시즌, 특정 개념을 다루는 2시즌 단원 게임을 고를 수 있습니다.

**플레이:** https://n-lifescience.github.io/orchard-2150/

## 로컬 실행

```sh
npm ci
npm run dev
```

화면에 표시된 로컬 주소를 브라우저에서 엽니다.

## 검증

```sh
npm test
npm run typecheck
npm run build
```

`main` 브랜치에 푸시하면 GitHub Actions가 테스트와 빌드를 거쳐 GitHub Pages에 배포합니다. 진행 기록은 플레이한 브라우저에 저장됩니다.

설계와 수업 관련 설명은 [게임 설계서](docs/GDD.md), [UI 명세](docs/UI-SPEC.md), [학습 설계 검토](docs/LEARNING-REVIEW.md)에 있습니다. 라이선스는 [MIT](LICENSE)입니다.
