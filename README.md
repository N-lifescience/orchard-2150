# 씨앗 아틀리에 2150

교배와 선발을 통해 유전 개념을 탐구하는 수업용 게임입니다.

**플레이:** https://n-lifescience.github.io/seed-atelier-2150/

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

`main` 브랜치에 푸시하면 GitHub Actions가 테스트와 빌드를 거쳐 GitHub Pages에 배포합니다. 게임 진행 기록은 플레이한 브라우저의 로컬 저장소에만 저장됩니다.

설계와 수업 관련 설명은 [게임 설계서](docs/GDD.md)와 [UI 명세](docs/UI-SPEC.md)에 있습니다. 라이선스는 [MIT](LICENSE)입니다.
