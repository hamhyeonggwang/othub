# OT Hub 페이지 빌더 추가 설계

작성: 2026-11-07 · 대상: `project/othub 2` · 상태: 구현 전 설계

## 1. 목적과 첫 출시 범위

OT Hub 운영자가 코드를 수정하지 않고 교육·활동 소개 페이지를 작성하고, 미리 보고, 발행할 수 있게 한다. 첫 출시는 **운영자 전용 페이지 빌더**로 정한다. 일반 회원의 개인 사이트 제작은 운영 경험과 권한 정책을 확인한 다음 확장한다. 기존 16개 공개 콘텐츠와 독립 훈련 HTML은 그대로 제공한다.

첫 출시 기능은 페이지 목록·새 페이지·복제·제목/주소 편집·기본 블록·이미지 업로드·자동 임시저장·기기별 미리보기·발행/게시 중단·공개 URL이다. 삭제는 우선 보관(archive)으로 처리한다. 공동 편집, 사용자별 사이트, 커스텀 도메인, 임의 JavaScript, 결제, 임상 기록은 이 단계에 넣지 않는다.

### 사용 흐름

1. 운영자가 `admin.html`에서 기존 이메일 링크로 로그인한다. 통계 옆의 **페이지 관리**로 이동한다.
2. 페이지를 만들거나 복제해 제목과 고유 주소(slug)를 정한다. 편집 화면에서 블록을 배치하고 텍스트·색상·여백·이미지를 수정한다.
3. 변경 내용은 저장 상태를 표시하며 서버에 임시저장한다. 데스크톱·태블릿·모바일 미리보기를 확인한다.
4. **발행**을 누르면 서버가 권한·내용·이미지 참조를 검사하고 공개 스냅샷을 만든다. `page.html?slug=...`에서 실제 공개 화면을 확인한다.
5. 발행된 페이지는 홈페이지 **전체 콘텐츠**에 나타나고 검색된다. 게시를 중단하면 공개 URL은 더 이상 본문을 제공하지 않는다.

## 2. 현재 코드와 연결 지점

| 현재 위치 | 확인한 동작 | 추가 설계 |
|---|---|---|
| `index.html`, `assets/workspace.js` | 해시 라우팅, 카드·검색·북마크·최근 이용 | 공개 페이지 목록을 비동기로 불러와 기존 카탈로그와 합친다. 초기 정적 콘텐츠는 네트워크 없이 바로 표시한다. |
| `assets/content.js` | 공개 콘텐츠가 고정 배열 `window.OT_CONTENT`에 있음 | 기존 항목은 유지한다. 발행 페이지는 별도 API에서 읽고 `type: 'page'` 카드로 합친다. |
| `admin.html`, `assets/admin.js` | 기존 운영 화면은 통계 전용 | 페이지 관리 링크를 추가하고 `builder.html`에서 편집한다. |
| `assets/services.js`, `assets/auth.js` | Supabase 클라이언트와 이메일 링크 로그인 공유 | 빌더도 같은 세션을 사용한다. 서버 API는 전달받은 JWT를 검증하고 `othub_admins` 소속을 다시 확인한다. |
| `supabase/migrations/202609200001_usage_analytics.sql` | 통계 `content_id`는 `^[a-z][0-9]{1,4}$`만 허용 | 새 페이지에 별도 공개 ID `p1`, `p2`…를 부여해 기존 클릭 계측 형식과 맞춘다. |
| `engagement.js` | 좋아요·댓글은 기존 콘텐츠 ID와 UUID 매핑에 의존 | 첫 출시의 페이지 카드에는 좋아요·댓글 버튼을 표시하지 않는다. 연동은 별도 마이그레이션으로 설계한다. |
| `package.json` | `npm run dev`는 Python 정적 서버 | 편집기만 빌드 도구로 묶어 정적 자산으로 출력한다. 로컬 실행 전에 편집기 빌드가 필요하다. |

별도 시험용 `grapesjs-editor`는 OTwiki 루트에 있다. 해당 코드를 참고하되 OT Hub에 직접 복사해 의존성과 저장 키가 뒤섞이지 않도록 OT Hub 내부에 빌드 소스와 빌드 결과를 둔다.

## 3. 화면과 파일 구조

```text
admin.html                    통계 화면에 페이지 관리 진입점
builder.html                  관리자 편집 화면의 정적 셸
page.html                     공개 페이지 뷰어 셸
builder-src/main.js           GrapesJS 초기화, 블록, 저장/발행 명령
builder-src/style.css         편집기 UI
builder-src/vite.config.js    빌드 결과를 assets/builder/에 출력
assets/builder/               배포되는 편집기 JS/CSS (빌드 산출물)
assets/public-pages.js        공개 목록 로딩과 기존 카탈로그 합치기
api/pages.js                  관리자 목록·생성·복제
api/page.js                   관리자 상세·임시저장·보관
api/publish.js                발행·게시 중단
api/page-assets.js            이미지 업로드·목록
api/public-pages.js           공개 메타데이터 목록
api/public-page.js            공개 스냅샷 조회
supabase/migrations/...       페이지·초안·발행·이미지 메타데이터
tests/...                     권한, 저장 충돌, 발행, 공개 화면 회귀 검사
```

`builder.html`은 GrapesJS가 필요할 때만 번들을 로드한다. 기존 홈페이지의 초기 JS 크기와 첫 화면을 편집기 용량으로 늘리지 않는다. `builder.html`과 관리자 API 응답에는 `no-store`, 검색 엔진 차단을 적용한다.

### 편집기 블록

첫 블록: 제목, 본문, 이미지, 버튼/링크, 2열 섹션, 강조 상자, 단계 안내, 영상 링크(외부 페이지로 이동), 구분선. OT Hub의 색상·글꼴·간격 토큰을 기본값으로 준다. 각 블록은 키보드로 편집 가능해야 하며 이미지 대체 텍스트, 제목 계층, 링크 이름을 발행 전 검사한다. 임의 HTML/JS 삽입 블록과 실행형 iframe은 제공하지 않는다.

GrapesJS의 다중 페이지 기능은 첫 출시에서 쓰지 않는다. **OT Hub 페이지 한 건 = GrapesJS 프로젝트 한 건**으로 두어 URL, 발행 상태, 복구를 명확하게 만든다. 이후 사이트 단위 관리가 필요할 때 Pages 모듈을 검토한다.

## 4. 데이터와 저장 계약

| 테이블 | 핵심 필드 | 접근 |
|---|---|---|
| `othub_pages` | `id uuid`, `public_id text unique`, `slug text unique`, `title`, `summary`, `thumbnail_path`, `status`, `owner_id`, `draft_revision`, `created_at`, `updated_at` | 운영자 API만 읽기·쓰기 |
| `othub_page_drafts` | `page_id`, `project_data jsonb`, `revision`, `saved_at` | 운영자 API만 읽기·쓰기 |
| `othub_page_publications` | `page_id`, `html`, `css`, `published_revision`, `published_at` | 공개 API는 `published` 상태만 읽기 |
| `othub_page_assets` | `id`, `page_id`, `storage_path`, `mime_type`, `byte_size`, `created_at` | 운영자 API만 메타데이터 관리 |

모든 새 `public` 테이블에 RLS를 켜고 `anon`/`authenticated`에 직접 테이블 접근을 부여하지 않는다. 서버 API에서 검증한 운영자 요청만 비밀 키로 DB에 접근한다. 브라우저 번들에는 공개 Supabase 키만 둔다. 초안 JSON과 발행 HTML/CSS를 테이블로 분리해 공개 조회가 초안을 반환할 여지를 없앤다. `slug`는 소문자 영문·숫자·하이픈만 허용하고 예약어와 중복을 막는다. `public_id`는 DB 시퀀스로 `p<number>`를 발급하며 기존 통계 정규식이 받는 최대 네 자리 범위 안에서 관리한다. 장기적으로 10,000건을 넘기기 전에 통계 ID 계약을 확장한다. 마이그레이션에는 상태·slug 형식의 `CHECK`, 고유 제약, `owner_id`와 자산 `page_id`의 외래 키 인덱스, 공개 목록용 `(status, updated_at)` 인덱스를 포함한다.

GrapesJS 복원 원본은 `editor.getProjectData()`의 JSON이다. `editor.loadProjectData()`로 다시 연다. HTML/CSS만 저장하면 컴포넌트 정보와 편집 상태가 손실될 수 있으므로 발행본은 별도 스냅샷으로 보관한다. 자동 저장은 변경 후 약 2초 지연하고 서버가 반환한 `revision`을 다음 저장 요청에 포함한다. 서버는 예상 revision이 다르면 `409 Conflict`를 반환하고 **서버본 보기 / 내 변경 복사 / 다시 불러오기**를 보여 준다. 저장 성공 전에는 “저장됨”으로 표시하지 않는다.

이미지는 Supabase Storage의 전용 버킷에 `pages/{page_id}/{asset_id}` 경로로 저장한다. 첫 출시에는 PNG/JPEG/WebP, 파일당 2MB 이하만 받으며 MIME과 실제 파일 형식, 총량, 이미지 크기를 서버에서 검사한다. SVG와 실행 가능한 파일은 받지 않는다. 게시 중단·페이지 보관 시 파일을 즉시 삭제하지 않고 참조 및 복구 기간을 확인한 후 정리한다.

## 5. API와 권한

| 요청 | 응답/동작 |
|---|---|
| `GET /api/pages` | 운영자 페이지 목록, 상태·수정일 |
| `POST /api/pages` | 운영자 새 페이지 또는 복제; 서버에서 ID·slug 확인 |
| `GET /api/page?id=...` | 운영자 메타데이터와 초안 JSON |
| `PATCH /api/page?id=...` | 초안 JSON·메타데이터 저장; revision 비교 후 새 revision 반환 |
| `POST /api/publish` | `{pageId, revision, html, css}` 검증 후 발행 스냅샷 교체 |
| `POST /api/publish?action=unpublish` | 발행 상태 해제; 공개 목록·본문에서 제외 |
| `POST /api/page-assets` | 운영자 이미지 업로드, 안전한 저장 경로/URL 반환 |
| `GET /api/public-pages` | 공개 카드용 `public_id`, `slug`, 제목, 요약, 썸네일만 반환 |
| `GET /api/public-page?slug=...` | 발행된 HTML/CSS/제목만 반환, 미발행·없는 주소는 404 |

운영자 API는 요청마다 `Authorization: Bearer <access_token>`을 받아 Supabase Auth의 사용자 확인을 수행하고, `othub_admins.user_id`에 있는지 서버에서 조회한다. 일반 로그인 회원과 비회원은 조회·쓰기 모두 403/401이다. 권한은 이메일 주소나 브라우저의 `user_metadata`로 판단하지 않는다. API는 JSON 크기·본문 길이·이미지 크기 제한, 요청 속도 제한, Origin 확인을 둔다. 서비스 역할 키는 서버 환경 변수에만 둔다.

### 공개 출력 경계

편집기에서 보내는 HTML/CSS는 신뢰하지 않는다. 발행 API가 허용된 태그·속성·URL 프로토콜·CSS 속성만 남기고 크기를 제한한다. `<script>`, 이벤트 핸들러, 폼, 임의 iframe, CSS `@import`, 외부 `url()`은 금지한다. 공개 화면은 `page.html`의 sandboxed iframe으로 출력한다. 허용하는 sandbox 값은 외부 링크용 `allow-popups allow-popups-to-escape-sandbox`뿐이며, 모든 링크는 새 탭으로 열고 `rel="noopener noreferrer"`를 붙인다. `allow-scripts`와 `allow-same-origin`은 부여하지 않는다. 본문 안의 링크는 `https:` 또는 허용된 OT Hub 경로만 연다. 이 구조에서는 편집 페이지 내용이 홈페이지의 로그인 상태나 저장 공간에 접근하지 못한다. 장기적으로 검색 노출과 독립 URL이 필요하면 별도 공개 도메인과 서버 렌더링을 검토한다.

## 6. 홈페이지 통합

`assets/public-pages.js`가 공개 목록을 요청한다. 실패해도 기존 정적 콘텐츠 탐색은 정상 동작해야 한다. 성공 시 페이지를 `{ id: 'p1', type: 'page', title, img, url: 'page.html?slug=...', ch: 'OT Hub' }` 형태로 변환해 카탈로그·검색·북마크·최근 이용에 합친다. 새 카드 유형의 라벨은 **교육 페이지**로 표시하고 좋아요·댓글 버튼은 생략한다. 목록 로딩 완료 후 현재 화면과 검색 결과를 다시 그리되 검색창 입력·스크롤·포커스가 불필요하게 초기화되지 않게 한다. 게시 중단된 ID가 북마크에 남아 있으면 목록에는 표시하지 않고 기존 저장 데이터는 보존한다.

공개 페이지 조회와 목록에는 짧은 캐시를 쓰고, 발행/게시 중단 후 캐시를 무효화하거나 캐시 만료를 기다리는 시간을 운영 화면에 명시한다. 발행 완료 메시지는 실제 공개 API가 새 revision을 제공하는지 확인한 뒤 표시한다.

## 7. 구현 순서와 완료 기준

1. **기반:** OT Hub 안에 GrapesJS 빌드 구성을 추가하고 `builder.html`을 띄운다. 기존 `npm run dev`, `npm run check`, 브라우저 검사를 통과한다.
2. **초안:** 페이지 테이블·운영자 API·자동 저장·복제·충돌 복구를 구현한다. 새로고침/재로그인 후에도 동일한 편집 상태가 복원된다.
3. **자산과 발행:** 이미지 업로드, 출력 검증, 공개 뷰어, 발행/게시 중단을 구현한다. 허용되지 않은 HTML/URL/파일은 서버가 거절한다.
4. **홈페이지 연결:** 발행 페이지가 카탈로그·검색·북마크에 표시된다. 공개 목록 API 실패 시 기존 16개 항목이 계속 동작한다.
5. **운영 검증:** 로컬 DB에서 비회원·일반 회원·관리자 권한을 시험하고, 스테이징에서 실제 이메일 로그인·이미지·발행/게시 중단·모바일·키보드 동작을 확인한다. 운영 DB 마이그레이션과 배포는 이 검증 뒤에 수행한다.

핵심 인수 기준: 비회원은 편집 API에 접근할 수 없고, 일반 회원도 운영자 권한을 얻지 않는다. 두 탭에서 같은 페이지를 수정하면 조용히 덮어쓰지 않는다. 발행 전 초안은 공개 API에 나오지 않는다. 게시 중단 후 URL이 본문을 반환하지 않는다. 기존 홈페이지와 훈련 링크가 회귀하지 않는다.

## 8. 구현 전에 확정할 제품 결정

- 첫 출시는 운영자만 작성하는 모델로 설계했다. 일반 회원이 자기 사이트를 만들게 할 경우 소유권·콘텐츠 신고·저장 용량·별도 게시 도메인·유료 정책이 추가된다.
- 공개 URL은 첫 출시에서 `page.html?slug=...`를 사용한다. 검색 엔진 최적화나 공유 카드가 중요하면 공개 경로와 서버 렌더링을 앞당긴다.
- 사용자 제공 이미지와 페이지의 보관·삭제 기간, 저작권/신고 절차는 운영 정책에서 확정해야 한다.

## 참고 문서

- GrapesJS [Storage Manager](https://grapesjs.com/docs/modules/Storage.html), [Asset Manager](https://grapesjs.com/docs/modules/Assets.html), [Pages](https://grapesjs.com/docs/modules/Pages.html)
- Supabase [Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security), [Storage Access Control](https://supabase.com/docs/guides/storage/security/access-control)
- Supabase [공개 테이블의 Data API 노출 변경](https://supabase.com/changelog?types=breaking-change): 새 테이블의 API 접근은 배포 환경에서 명시적 권한과 RLS를 함께 검증해야 한다.
