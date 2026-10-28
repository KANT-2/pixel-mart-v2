# 백엔드 아키텍처와 설계 결정

## 1. 전체 구조
```
브라우저 ──▶ Next.js (localhost:3000)
              ├─ 화면 (app/, components/)
              └─ /api/* ──rewrites──▶ FastAPI (127.0.0.1:8000) ──▶ PostgreSQL
```
- 브라우저는 **항상 3000번만** 봅니다. `/api/*`는 Next.js가 FastAPI로 넘깁니다.
- 그래서 **CORS 설정이나 쿠키 도메인 문제 없이** 로그인 쿠키가 자동으로 오갑니다.
- 기술: FastAPI · SQLAlchemy 2 (async) · asyncpg · Alembic · Pydantic v2 · PyJWT · Authlib · bcrypt

### 코드 구조 — `backend/app/` + `backend/src/` 공존
- 1차 기능(쇼핑 · PIXEL LOCAL · 아바타 등)은 `backend/app/`(routers · services · models · schemas)에 그대로 있고, 2차 기능은 `backend/src/<기능>/`에 **4계층**(presentation · application · domain · infrastructure)으로 만듭니다.
- 앱 조립은 `src/main.py` 한 곳(기존 라우터 + 새 라우터). `app/deps.py`·`app/core/db.py`는 `src/common/auth.py`·`src/database.py`를 다시 내보내기만 해서, 기존 API도 같은 로그인 확인(블랙리스트 포함)을 씁니다.
- 관리자 API는 `AdminUser` 의존성으로 막고, 관리자가 아니면 403 대신 **404**로 숨깁니다.
- 자세한 비교·구조도는 [README 5장](../../README.md#5-기존-app-vs-이번-src) · [6장](../../README.md#6-4계층-구조도--요청-흐름).

### 배포
- 프론트는 **Vercel**, API · PostgreSQL은 **Render**. Vercel의 `/api/*`가 rewrites로 Render API에 전달돼 로컬과 같은 구조(브라우저는 프론트 주소만 봄)입니다.
- `ENV=production`이면 개발용 로그인 · `/api/dev/...`는 404, API 문서는 관리자만. 설정은 [README 7장 배포](../../README.md#배포--58).

## 2. 로그인 (구글 · 이메일·비밀번호 + 로컬 개발용 이메일 로그인)
**FastAPI가 로그인을 직접 처리**하고, 로그인 결과는 **httpOnly 쿠키(`pm_session`, JWT)**로 유지합니다.

```
[구글로 로그인] 클릭
→ GET /api/auth/google/login          (FastAPI → 구글 로그인 화면으로 이동)
→ 구글 → GET /api/auth/google/callback (FastAPI가 사용자 확인 — 기존 회원은 로그인, 새 사용자는 /signup에서 닉네임을 고른 뒤 POST /api/auth/google/signup으로 users 저장)
→ pm_session 쿠키 설정 → 프론트 메인으로 이동
→ 이후 모든 /api 요청에 쿠키 자동 포함 → CurrentUser로 사용자 확인
```
- NextAuth를 쓰지 않는 이유: NextAuth 세션 토큰은 암호화돼 있어 FastAPI가 읽을 수 없고, 구글 토큰을 넘기면 1시간 뒤 만료 처리가 필요합니다. **로그인을 한 곳(FastAPI)에서만 관리**하면 단순합니다.
- 구글 콘솔 리디렉션 URI: `http://localhost:3000/api/auth/google/callback` (3000번 = 프록시 경유)
- **이메일·비밀번호**: `POST /api/auth/signup`(`{email, password, nickname}`, 비밀번호는 **bcrypt 해시**로만 저장) → `POST /api/auth/token`(OAuth2 form)으로 로그인하면 JWT를 **Bearer 토큰 + `pm_session` 쿠키**로 함께 돌려줍니다. 요청은 `Authorization: Bearer`를 먼저, 없으면 쿠키를 확인합니다.
- **로그아웃**: JWT의 고유번호(`jti`)를 `token_blacklist`에 만료 시각까지 보관 → 같은 토큰은 401.
- **비밀번호 변경·재설정**: `POST /api/auth/password`(지금 비밀번호 확인), `POST /api/auth/password-reset` → `/confirm`. **메일은 보내지 않습니다** — 로컬은 재설정 링크를 응답·화면에 바로 보여 주고, 배포에서는 "메일을 보내지 않아요" 안내만.
- 자세한 흐름·규칙은 [README 9장 가입 · 로그인 · 로그아웃](../../README.md#-가입--로그인--로그아웃-채희주).
- **`POST /api/auth/dev-login`**: 구글 로그인 완성 전에도 모두가 "로그인 필요" 기능을 개발할 수 있게 하는 **로컬 전용** 임시 로그인. `ENV=local`일 때만 동작.

## 3. 데이터 원칙
- **상품은 DB가 원본**이 됩니다. 시드는 프론트 `data/*.ts` → `backend/seed/*.json` → `scripts/seed.py`.
  - 프론트는 `/api/products`를 쓰고, 백엔드가 꺼졌을 때만 `data/products.ts`로 폴백합니다.
- 금액은 **원 단위 정수**, 시간은 **timezone 있는 UTC** (`DateTime(timezone=True)`)
- 삭제가 필요한 사용자 데이터(리뷰, 거래글)는 상태값(`status`)으로 숨김 처리 우선

## 4. 기능별 설계 결정

### 4-1. 픽셀 아바타
- **픽셀 캔버스**(브라우저에서 직접 그림)와 **AI 픽셀 아바타**(Cloudflare Workers AI, 동의 필수) 두 가지 — 결과는 브라우저에서 픽셀 격자로 정리해 PNG로 만듭니다.
- 기본(픽셀 캔버스)은 사진을 쓰지 않습니다. **AI 픽셀 아바타**를 고르고 동의한 경우에만 사진을 서버를 거쳐 AI 제공자로 한 번 보내며, 사진·생성 원본은 **저장·로그하지 않습니다** (`docs/AVATAR_POLICY.md`).
- 서버에는 결과 PNG(수 KB)만 `users.avatar_url`에 data URL로 저장 → `PUT /api/users/me/avatar`.
- 로그인 상태면 메인 배너의 슬라임 자리에 아바타 표시.

### 4-2. Compatibility Preview (키캡 호환)
- `keyboards`(Mock 모델 데이터)와 `keycap_specs`(상품별 프로파일·사이즈)를 비교해 키별 결과를 돌려줍니다.
- 미리착샷은 프론트에서 키보드 배열 이미지 위에 키캡 이미지를 겹치는 방식 (서버는 결과 데이터만).

### 4-3. PIXEL LOCAL (덕력지도 · 거래 · Wish Map)
> 기준 문서: `docs/PIXEL_LOCAL_POLICY.md`, `docs/DUKRYEOK_MAP_POLICY.md` (확정). 아래는 그중 백엔드·화면 설계에 영향을 주는 규칙입니다.

**위치**
- **GPS·주소·건물·실시간 위치는 저장하지 않습니다.** 사용자가 **지역(시 › 구 › 동·생활권 Zone)** 을 직접 선택합니다. 그래서 PostGIS 없이 일반 PostgreSQL로 충분합니다.
- 정책의 "약 2km 이내 교환 가능"은 거리 계산(GPS)이 필요하므로 이번 범위에서는 **"같은 구 / 같은 생활권"** 으로 표시합니다.

**취향 프로필과 공개 범위**
- 취향은 사용자가 직접 선택: **캐릭터 · 작품/게임 · 스타일(Retro, Cute, Neon …) · 관심 상품 종류**. 작품·캐릭터는 **텍스트 태그만**(공식 이미지·로고 X).
- 공개 가능: 선택한 작품·캐릭터, 교환 희망 상품 / **항상 비공개**: 구매 금액, 장바구니, 정확한 위치, 검색 기록.
- 지역 집계 참여는 목적을 안내하고 사용자가 켜고 끌 수 있게(`fandom_opt_in`).

**덕력지도 (개인이 아니라 집단을 보여 준다)**
- 집계는 **사용자 수 기준(중복 제거)** — 같은 사람이 50번 클릭해도 1명.
- **최소 인원 제한 없음** — 1명부터 숫자를 보여 주고, 0명만 "아직 없음". (5명 미만 비공개 정책은 팀 결정으로 삭제)
- 숫자를 눌러도 **사용자 목록·이름·위치는 절대 보여 주지 않고**, 관련 상품 · 교환 게시물 · 위시맵으로 연결.
- 상위 지역은 하위 지역 합산(판교 → 분당구 → 성남시). 집계 기간은 최근 30일/90일/전체 선택 가능(기본 전체).
- 테스트 계정·비정상 반복 활동은 집계에서 제외.

**거래 · 교환**
- 거래글 노출 정보: 상품명, 상태, 희망 가격, 희망 지역, 사진(상품 이미지 참조), 거래 방식. **연락처·정확한 장소 기재 금지**.
- HAVE/WANT 매칭은 **"HAVE/WANT 일치 + 같은 지역"** 까지만 구현(거리·신뢰도·시간은 향후).
- **교환 신청**(`trade_requests`): 이웃 글에 내 글을 붙여 신청 → 글 주인이 수락/거절 → 양쪽이 "받았어요" → 완료. 완료되면 두 사람 모두 활동 점수.
- **선물**(`gifts`): 위시(WANT) 글에 사이트 상품을 가상 결제로 보냄 → 받는 사람이 받기(주문 생성)/거절.
- **신고·제재는 구현됨**: 신고(`reports`) → 관리자 신고함 처리, 관리자 거래글 숨김(`hidden_by_admin`), 사용자 정지(`users.suspended`).
- 채팅, 실거래, 공동구매는 향후 범위.

**Cold Start · 빈 화면**
- 초기 Mock 데이터는 API 응답에 `isSample: true`. **화면에는 "샘플·예시" 라벨을 표시하지 않고**(팀 결정), 샘플 글에는 선물·교환 신청이 안 되게만 막습니다.
- 데이터가 없을 때 "사용자가 없습니다"로 끝내지 않고 다음 행동 제공: 상위 지역에서 보기, 관련 상품, 내 취향 등록, 관심 지역 등록.

### 4-4. 주문 (가상 결제)
- "구매하기" → 장바구니 상품으로 **가상 주문** 생성 (실제 결제수단 입력 없음, 상태 `paid`로 시작). 첫 직접 구매는 구매 포인트 1,000P를 한 번 적립하고, 다음 주문에서 사용할 수 있습니다.
- 구매 포인트는 `point_transactions`에 적립·사용·취소 환급을 기록하며, PIXEL LOCAL의 `activity_points`와 별개입니다.
- 배송 상태는 시간이 지나면 자동으로 진행된 것처럼 계산하거나, 로컬 전용 `POST /api/dev/orders/{id}/advance`로 다음 단계로 넘깁니다.
- 리뷰는 **배송 완료된 주문의 상품만** 작성 가능.

### 4-5. 활동 점수 · 하트 · 뱃지
- 활동(프로필 완성, 첫 WANT, 거래·교환 완료, 선물 등)마다 `activity_points`에 기록 — 같은 일은 한 번, 반복 활동은 하루 상한 (`services/activity.py`).
- 점수 합계 → 하트 수·레벨(LV.1~10)·코인 구간을 계산해서 보여 줍니다 (마이페이지 퀘스트, 이웃 카드).
- 뱃지는 주문·리뷰·활동 점수·거래·선물 기록으로 19종 조건을 확인하고, 얻은 뱃지는 `user_badges`에 저장합니다 (`services/badges.py`). 관리자가 `badge_defs`로 **이벤트 뱃지**를 만들어 지급할 수 있고, 사용자는 **대표 뱃지**(`users.featured_badge`, `PATCH /api/users/me/featured-badge`)를 고를 수 있습니다.

### 4-6. 알림
- `services/notifications.py`의 `notify()` 한 곳으로만 쌓습니다 — 교환 신청·수락·거절, 주문 완료, 선물 도착·보냄·수락·거절, 활동 점수, 하트 증가, 뱃지 획득.
- 같은 일은 `(user, kind, ref_key)` 유니크로 한 번만. `href`는 프론트 내부 경로만.
- 프론트는 헤더 알림 종에서 30초마다 안 읽은 수를 확인합니다 (실시간 아님).
