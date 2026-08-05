# Supabase 설정 (OT Hub 좋아요 · 댓글)

> **참고**: 현재 실제로 연결된 프로젝트(`hamhyeonggwang's Project`)는 이미 `othub_likes`/`othub_comments`/`othub_content_items` 스키마가 배포되어 있어 아래 `schema.sql`을 다시 적용하지 않았습니다. 콘텐츠 id는 `othub_content_items.id`(UUID)를 기준으로 하며, `engagement.js`의 `CONTENT_ID_MAP`이 이 저장소의 로컬 콘텐츠 id(`g6` 등)를 해당 UUID로 매핑합니다. 이 스키마는 좋아요·댓글 모두 로그인 회원만 가능하며, **비회원 좋아요는 지원하지 않습니다** (아래 5장 이후 내용은 최초 설계안 기준이라 실제 동작과 다를 수 있습니다).

## 1. 프로젝트 생성

[Supabase](https://supabase.com)에서 새 프로젝트를 만듭니다.

## 2. SQL 적용

SQL Editor에서 `schema.sql` 전체를 실행합니다.

## 3. 인증 (댓글용)

- **Authentication → URL configuration**
  - **Site URL**: 배포 주소 (예: `https://othub.vercel.app`)
  - **Redirect URLs**에 동일 주소와 로컬 테스트용 `http://localhost:5500` 등을 추가합니다.
- **Authentication → Providers → Email** 을 켜면 이메일 OTP(매직 링크)로 로그인할 수 있습니다.

## 4. 프론트 설정

저장소 루트에 `supabase-config.js`가 있습니다. 비어 있으면 좋아요·댓글 UI는 동작하지 않습니다.

```bash
cp supabase-config.example.js supabase-config.js
```

`url`, `anonKey`를 프로젝트 API 설정에 맞게 수정합니다. **Service Role 키는 넣지 마세요.**

## 5. 콘텐츠 ID

랜딩 **인기 콘텐츠** 카드는 데이터의 `id` 필드(`g1`, `v1`, `n1`, `w5` 등)를 `content_id`로 사용합니다. 같은 ID로 좋아요·댓글이 묶입니다.

## 동작 요약

| 기능     | 비회원 | 회원 |
|----------|--------|------|
| 좋아요   | 가능 (브라우저별 익명 ID) | 가능 (계정당 1회) |
| 댓글 읽기 | 가능 | 가능 |
| 댓글 쓰기 | 불가 | 이메일 로그인 후 가능 |
