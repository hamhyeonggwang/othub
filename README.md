# OT Hub workspace

기존 16개 공개 콘텐츠와 훈련 페이지를 유지하면서, 공개 서비스 운영을 위한 탐색 화면·운영 분석·업데이트 기록을 분리한 정적 웹 프로젝트입니다. 현재 버전은 **0.2.0 배포 준비**입니다.

## 실행

```sh
npm ci --ignore-scripts
npm run dev
```

`http://127.0.0.1:4173/` → 사용자 화면, `/admin.html` → 관리자 화면.
`ot-hub-preview.html`의 기존 링크는 새 화면으로 이동하며 해시와 쿼리를 유지합니다.

## 파일 구성

- `index.html`, `assets/workspace.{js,css}`: 사용자 화면과 탐색
- `assets/content.js`, `assets/*.svg|jpg|png`: 공개 콘텐츠와 독립 캐시 가능한 썸네일
- `assets/releases.js`: 업데이트 기록과 로드맵, 배포 전 상태 표시
- `assets/services.js`: 로그인 요청 시 로드하는 공용 인증 클라이언트
- `assets/community.js`, `engagement.js`: 기존 Supabase 좋아요·댓글 연결
- `assets/analytics.js`: 선택적 동의 기반 이벤트 수집, 기본 비활성
- `admin.html`, `assets/admin.js`: 관리자 전용 집계 조회
- `supabase/migrations/`: 기존 댓글 DB와 분리된 통계 마이그레이션
- `docs/OPERATIONS.md`: 운영 연결·권한·복구·보관 절차
- `docs/ROADMAP.md`: 정기 업데이트와 공개 SaaS 전환 계획
- `about.html`: 기존 제작자 소개 보존

## 검증

```sh
npm run check
npm run test:db
npx playwright install chromium
npm test  # 별도 터미널에서 npm run dev 실행 필요
```

브라우저 검사는 외부 요청을 차단하거나 가짜 응답으로 대체하므로 실제 운영 DB에 이벤트·댓글을 쓰지 않습니다. DB 검사는 로컬 PGlite의 PostgreSQL 엔진에서 역할·권한·마이그레이션을 실행합니다. 실제 Supabase Auth / PostgREST / 메일 / Vercel 환경 통합 검증은 운영 연결 시 별도로 필요합니다.

## 범위와 상태

기존 훈련 앱의 내부 완료·성공률은 이번 변경에서 계측하지 않습니다. `content_open`은 홈페이지에서 링크를 누른 횟수입니다. 북마크와 최근 기록은 이 기기에만 저장합니다. 통계 화면에는 시드나 임의 이용자 수를 넣지 않으며, 데이터 미연결·권한 없음·0건을 구분합니다.

공개 SaaS 전환에서 결제/구독, 기관별 계정 격리, 임상 기록 저장, 자동 배포, 운영 DB 변경은 아직 포함하지 않았습니다. 해당 기능의 필요 여부와 운영 정책은 로드맵에서 결정합니다.
