# API 목록

> 기준: main (2026-10-28)
> 🔒 = 로그인 필요 (`CurrentUser`, 글쓰기·신청·선물·리뷰·문의·신고는 `ActiveUser`라 정지 계정 403) · ✅ = 구현됨 · 전체 경로는 `/api` 접두사 포함
> 실제 요청/응답 모양은 Swagger가 기준입니다: http://127.0.0.1:8000/api/docs (프론트를 거쳐 http://localhost:3000/api/docs 로도 열림). `/api/docs`·`/api/openapi.json`은 로컬에서는 누구나, 배포(production)에서는 관리자 로그인만 열리고 그 외 404
> 데스크 꾸미기·토너먼트 API는 범위에서 빠져 만들지 않습니다.

## 공통 · 상품
| 메서드 | 경로 | 설명 | 상태 |
| --- | --- | --- | --- |
| GET | /api/health, /api/health/db | 서버·DB 상태 | ✅ |
| POST | /api/auth/dev-login | [로컬 전용] 이메일로 로그인 (새 계정인데 닉네임이 겹치면 409 "이미 사용 중인 닉네임입니다.") | ✅ |
| POST | /api/auth/signup | 이메일·비밀번호 가입 `{email, password(8자 이상), nickname}` → 201 `UserOut` (이메일·닉네임 중복 409) | ✅ |
| POST | /api/auth/token | 이메일 로그인 (OAuth2 form: `username`=이메일, `password`) → `{access_token, token_type: "bearer"}`(OAuth2 표준이라 snake_case) + `pm_session` 쿠키 | ✅ |
| POST | /api/auth/logout | 로그아웃 — 이 토큰을 블랙리스트에 넣고 쿠키 삭제 (이미 만료된 토큰이어도 200) | ✅ |
| POST | /api/auth/password 🔒 | 비밀번호 변경 `{currentPassword, newPassword}` (이메일 가입 계정만, 틀리면 400) | ✅ |
| POST | /api/auth/password-reset | 재설정 링크 요청 `{email}` → `{message, resetUrl}` — 메일은 보내지 않음. 로컬에서만 가입한 이메일이면 `resetUrl`(30분), 배포에서는 안내 문구만 | ✅ |
| POST | /api/auth/password-reset/confirm | 재설정 링크로 새 비밀번호 저장 `{token, newPassword}` (잘못·만료 400) | ✅ |
| GET | /api/auth/me 🔒 | 내 정보 | ✅ |
| GET | /api/auth/providers | 사용 가능한 로그인 방법 `{google, devLogin}` — 구글 키가 있으면 `google: true` (로그인 버튼 활성화용) | ✅ |
| GET | /api/auth/google/login | 구글 로그인 시작 (키 없으면 503) | ✅ |
| GET | /api/auth/google/callback | 구글 로그인 완료 → 기존 회원은 세션 쿠키·메인 이동, **새 사용자는 계정을 만들지 않고** 15분 가입 대기 쿠키(`pm_signup`)·`/signup` 이동 (실패 시 `/?loginError=google`) | ✅ |
| GET | /api/auth/google/signup | 구글 가입 대기 정보 `{email, googleName}` (대기 쿠키 없으면 404) | ✅ |
| POST | /api/auth/google/signup | 구글: 닉네임을 골라 가입 완료 `{nickname}` → 201·세션 쿠키. 겹치면 409 "이미 사용 중인 닉네임입니다." (자동으로 바꾸지 않음), 대기 쿠키 없으면 404 | ✅ |
| PATCH | /api/users/me 🔒 | 닉네임 변경 (앞뒤 공백 제거 후 1~30자, 대소문자 구분 없이 남이 쓰는 닉네임이면 409) | ✅ |
| GET | /api/users/nickname-check?nickname= | 닉네임 사용 가능 여부 `{nickname, available, suggestions}` — 겹치면 지금 쓸 수 있는 추천 3개(예: `슬라임킹0421`, `슬라임킹_1`), 내 닉네임은 available | ✅ |
| POST | /api/users/me/withdraw 🔒 | 회원 탈퇴 `{confirm: "탈퇴"}`(다르면 422) → 토큰 무효·쿠키 삭제. 진행 중 주문이 있으면 400 | ✅ |
| PUT | /api/users/me/avatar 🔒 | 픽셀 아바타 저장 (PNG data URL, 최대 200KB, 아니면 422) | ✅ |
| DELETE | /api/users/me/avatar 🔒 | 아바타 삭제 (기본 슬라임으로) | ✅ |
| GET | /api/avatars/ai | AI 아바타 사용 가능 여부 `{enabled, provider: cloudflare\|null, providerName, maxPhotoSide}` — 동의 문구·사진 축소 크기용 (키 값은 내보내지 않음) | ✅ |
| POST | /api/avatars/ai 🔒 | AI 픽셀 아바타 — `{photo: JPEG/PNG/WebP data URL ≤4MB, subject?: person|other, consent: true}` → `{image}` (person: 머리:몸 1:2 미니미 형식, other: 원래 비율 그대로 · Cloudflare FLUX.2 klein 생성 원본, 저장 안 함, 안전 필터 오탐은 최대 5번 재시도). 동의 없음 422, 키 미설정 503, 인식 실패·안전 차단 422, 외부 오류 502, 사용량 초과(Cloudflare 일일 무료 할당 소진 포함) 429 | ✅ |
| GET | /api/categories | 카테고리 6개 | ✅ |
| GET | /api/rarities?category= | 관리자 지정 등급(`common/rare/epic/unique`)별 공개 상품 개수 — 응답 `{key, label, count}` | ✅ |
| GET | /api/products?category=&q=&minPrice=&maxPrice=&isNew=&rarity=&sort=&page=&size= | 공개 상품 목록 (category·rarity는 쉼표로 여러 개, 없는 등급 422, sort: `id/new/price_asc/price_desc/popular`(찜 많은 순), 응답에 `isWished`·`rarity`·`stock`) | ✅ |
| GET | /api/products/{id} | 공개 상품 상세 (없거나 숨김이면 404, 응답에 `isWished`·`rarity`·`stock`) | ✅ |
| GET · POST · PATCH · DELETE | /api/cart, /api/cart/items, /api/cart/items/{productId} 🔒 | 장바구니 조회(`GET /api/cart`)·담기(`POST /api/cart/items`, 같은 상품은 수량 합산, 최대 99·재고 초과 409)·수량변경·삭제(`PATCH`·`DELETE /api/cart/items/{productId}`) — 전체 응답에 `itemsPrice`·`shippingFee`·`freeShippingLeft`·배송비 포함 `totalPrice` | ✅ |
| GET · PUT · DELETE | /api/wishlist, /api/wishlist/{productId} 🔒 | 찜 목록(Page, 최근 찜한 순)·찜(이미 있으면 그대로)·해제 | ✅ |

## 주문 · CS · 호환성
| 메서드 | 경로 | 설명 | 상태 |
| --- | --- | --- | --- |
| POST | /api/orders 🔒 | `{recipientName, address, phone?, postalCode?, addressDetail?, deliveryMemo?(≤100자), paymentMethod?: card\|easy_pay\|transfer(기본 card), pointsUsed?: 0 이상, userCouponId?, saveAddress?}`로 장바구니 전체 가상 주문 → 재고 차감·장바구니 비움·쿠폰 사용 처리·첫 구매 1,000P 적립. `saveAddress: true`면 이 배송지를 기본 배송지로 저장. `phone`·`postalCode`는 주문서 화면에선 필수지만 API에선 생략 가능. `totalPrice`는 쿠폰·포인트 적용 후 결제 금액, 응답에 `pointsUsed` 포함 (201, 보유 포인트·주문 금액 초과 400, 빈 장바구니/재고 부족 409) | ✅ |
| GET | /api/orders?status=&q=&page=&size= 🔒 | 내 주문 목록 — 상태 필터, 상품명·주문번호 검색, 페이지네이션 | ✅ |
| GET | /api/orders/{id} 🔒 | 내 주문 상세 + 배송 타임라인 (남의 주문도 404) | ✅ |
| GET | /api/users/me/points 🔒 | 내 구매 포인트 잔액 `{balance}` — PIXEL LOCAL 활동 점수와 별개 | ✅ |
| GET | /api/users/me/points/history?page=&size= 🔒 | 포인트 기록 `Page<{id, orderId, kind, amount, createdAt}>` — `first_purchase` +1,000, `purchase_reward` 구매 확정 적립(결제 금액 1%), `order_spend` 음수, `order_refund` 양수 | ✅ |
| POST | /api/orders/{id}/cancel-requests 🔒 | 취소 신청 (배송 전만) | ✅ |
| POST | /api/orders/{id}/confirm 🔒 | 구매 확정 (배송 완료 주문만) → `{message, reward}` — 결제 금액 1% 적립(`purchase_reward`), 확정 뒤에는 반품·교환 불가 | ✅ |
| POST | /api/orders/{id}/return-requests 🔒 | 반품·교환 신청 `{kind: return\|exchange, reason: 2~200자}` → 201 (배송 완료·구매 확정 전만, 이미 신청했으면 400) | ✅ |
| GET · POST | /api/users/me/addresses 🔒 | 내 배송지 목록(기본 배송지 먼저)·추가 `{label, recipientName, phone, postalCode, address, addressDetail?, isDefault?}` — 최대 10개(초과 400), 첫 배송지는 자동 기본. 둘 다 전체 목록을 돌려줌 | ✅ |
| PUT · DELETE | /api/users/me/addresses/{id} 🔒 | 배송지 수정(기본 지정 포함)·삭제 (기본을 지우면 최근 배송지가 기본, 남의 배송지 404) | ✅ |
| GET · POST | /api/users/me/coupons 🔒 | 내 쿠폰 `{id, name, discountType, discountValue, minOrderPrice, maxDiscount, issuedAt, expiresAt, status: available\|used\|expired, usedOrderId}[]` (쓸 수 있는 것 먼저, 처음 보면 웰컴 쿠폰 지급)·코드 등록 `{code}` → 201 (없는 코드·이미 받은 쿠폰 400) | ✅ |
| POST | /api/dev/cancel-requests/{id}/approve | [로컬 전용] 취소 승인 → 주문 취소 완료·사용 포인트 환급 | ✅ |
| POST | /api/dev/cancel-requests/{id}/reject | [로컬 전용] 취소 거절 → 신청 직전 상태로 복귀 | ✅ |
| POST | /api/dev/orders/{id}/advance | [로컬 전용] 배송 단계 진행 | ✅ |
| GET | /api/products/{id}/reviews | 공개 리뷰 목록 + 리뷰 수·평균 별점 (`is_hidden=true` 제외, 숨긴 상품 404) | ✅ |
| POST | /api/products/{id}/reviews 🔒 | 리뷰 작성 (배송 완료 상품만) | ✅ |
| DELETE | /api/products/{id}/reviews/{reviewId} 🔒 | 내 리뷰 삭제 (남의 리뷰는 404, 삭제 후 다시 작성 가능) | ✅ |
| GET | /api/products/{id}/questions | 공개 상품 문의 목록 (`is_hidden=true` 제외, 비밀글은 내용 가림, 숨긴 상품 404) | ✅ |
| POST | /api/products/{id}/questions 🔒 | 문의 작성 | ✅ |
| DELETE | /api/questions/{id} 🔒 | 내 문의 삭제 (답변 전에만) | ✅ |
| POST | /api/reports 🔒 | 신고하기 `{targetType: trade\|review\|question\|avatar, targetId, reason, memo?(≤200자)}` → 201 `{id}` (avatar의 `targetId`는 사용자 id) | ✅ |
| GET | /api/faqs?category= | FAQ | ✅ |
| GET | /api/notices?page=&size=&pinned= | 게시된 공지 목록 `Page<{id, title, isPinned, createdAt}>` — 고정 글 먼저, 최신순. `pinned`로 고정 여부 필터 | ✅ |
| GET | /api/notices/{id} | 게시된 공지 상세 `{id, title, content, isPinned, createdAt, updatedAt}` — 미게시·없는 글 404 | ✅ |
| GET | /api/keyboards?maker=&q= | 키보드 모델 검색 (Mock) | ✅ |
| GET | /api/compatibility?keyboardId=&productId= | 키캡 호환 결과 (키별 호환/일부/불가) | ✅ |

## 관리자 공지 · FAQ 관리
| 메서드 | 경로 | 설명 | 상태 |
| --- | --- | --- | --- |
| GET | /api/admin/notices?page=&size= 🔒 | 관리자 공지 목록 (미게시 포함, 고정 글 먼저) `Page<{id, title, content, isPinned, isPublished, createdAt, updatedAt}>` | ✅ |
| POST | /api/admin/notices 🔒 | 공지 생성 `{title, content, isPinned?, isPublished?}` — 기본 미게시, 제목 1~100자·내용 1~5,000자 | ✅ |
| PATCH | /api/admin/notices/{id} 🔒 | 공지 제목·내용·고정·게시 상태 일부 수정 (내리면 공개 상세 404) | ✅ |
| DELETE | /api/admin/notices/{id} 🔒 | 공지 삭제 → `{message}` | ✅ |
| GET | /api/admin/faqs 🔒 | 관리자 FAQ 목록 `{id, category, question, answer, sortOrder}[]` — 카테고리·순서대로 | ✅ |
| POST | /api/admin/faqs 🔒 | FAQ 생성 `{category, question, answer, sortOrder?}` — 카테고리 1~30자·질문 1~200자·답변 1~2,000자 | ✅ |
| PATCH | /api/admin/faqs/{id} 🔒 | FAQ 일부 수정·순서 변경 | ✅ |
| DELETE | /api/admin/faqs/{id} 🔒 | FAQ 삭제 → `{message}` | ✅ |

관리자 API는 비로그인 401, 일반 회원 404입니다. 기존 공개 `GET /api/faqs?category=`의 응답 형식은 유지합니다.

## 관리자 상품 관리
| 메서드 | 경로 | 설명 | 상태 |
| --- | --- | --- | --- |
| GET | /api/admin/products?q=&category=&rarity=&hidden=&soldOut=&page= 🔒 | 숨김·품절을 포함한 관리자 상품 목록 | ✅ |
| POST | /api/admin/products 🔒 | 상품 등록 (`/images/...` 내부 이미지 경로만 허용) | ✅ |
| PATCH | /api/admin/products/{id} 🔒 | 상품 정보·등급·숨김·재고 조정 (`stock`: 입고 수량 추가, `stockSet`: 절대 재고 0~9,999 설정, 동시 입력 422) | ✅ |

## 관리자
모두 `AdminUser` — 비로그인 401, 관리자가 아니면 404(관리자 화면이 있다는 것도 숨김). 목록은 `Page<T>`(`page`, `size` 최대 60).

| 메서드 | 경로 | 설명 | 상태 |
| --- | --- | --- | --- |
| GET | /api/admin/summary 🔒 | 대시보드 `{ordersToday, preparingOrders, pendingCancelRequests, unansweredQuestions, orderStatusCounts, lowStockProducts}` (재고 10개 이하·숨김 제외·최대 20개) | ✅ |
| GET | /api/admin/users?q=&role=&suspended=&page=&size= 🔒 | 회원 목록 (닉네임·이메일 검색, `role: user\|admin`, 정지 여부 필터). 탈퇴 계정은 이메일 대신 "탈퇴한 계정", `orderCount`·`reportCount` 포함 | ✅ |
| PATCH | /api/admin/users/{id} 🔒 | 회원 정지·해제 `{suspended, memo?}` — 정지 계정은 로그인·구경만 되고 쓰기 기능은 403 | ✅ |
| POST | /api/admin/users/{id}/avatar-reset 🔒 | 아바타를 기본으로 초기화 `{memo?}` → 본인에게 `avatar_reset` 알림 | ✅ |
| GET | /api/admin/orders?status=&q=&page=&size= 🔒 | 주문 목록 (상태 필터, 주문번호·닉네임·이메일 검색) | ✅ |
| GET | /api/admin/orders/export.csv?status=&q= 🔒 | 주문 CSV 내려받기 (필터는 목록과 같음) | ✅ |
| GET | /api/admin/orders/{id} 🔒 | 주문 상세 | ✅ |
| POST | /api/admin/orders/{id}/advance 🔒 | 배송 단계 진행 (더 못 넘기면 409) — 구매자 `order_{status}` 알림은 응답 뒤 BackgroundTasks로 | ✅ |
| PUT | /api/admin/orders/{id}/tracking 🔒 | 택배사·운송장 입력 `{courier: cj\|post\|hanjin\|lotte\|logen, trackingNumber: 숫자 9~14자리}` (상품 준비중·배송중·배송 완료만) | ✅ |
| GET | /api/admin/cancel-requests?status=&page=&size= 🔒 | 취소 요청 목록 | ✅ |
| POST | /api/admin/cancel-requests/{id}/approve · /reject 🔒 | 취소 승인(주문 취소·사용 포인트 환급)·거절 → 구매자 `cancel_*` 알림 | ✅ |
| GET | /api/admin/return-requests?status=&page=&size= 🔒 | 반품·교환 신청 목록 (`status: requested\|approved\|rejected`) | ✅ |
| POST | /api/admin/return-requests/{id}/approve · /reject 🔒 | 반품·교환 승인(반품은 반품 완료, 교환은 상품 준비중으로 재배송)·거절(배송 완료로) → `return_{status}` 알림 | ✅ |
| GET | /api/admin/questions?answered=&q=&page=&size= 🔒 | 문의 목록 (답변 여부 필터, 상품 이름·제목 검색, 비밀글 내용도 보임) | ✅ |
| PATCH · DELETE | /api/admin/questions/{id} 🔒 | 문의 숨김·다시 보이기 / 삭제(답변이 있어도) | ✅ |
| POST · DELETE | /api/admin/questions/{id}/answer 🔒 | 답변 `{answer: 1~500자}`(한 번만, 작성자에게 `question_answered` 알림) / 답변 삭제(답변 대기로 돌아감) | ✅ |
| GET | /api/admin/reviews?hidden=&rating=&photo=&q=&page=&size= 🔒 | 리뷰 목록 (숨김·별점·사진 필터, 상품 이름·내용·닉네임·이메일 검색) | ✅ |
| PATCH | /api/admin/reviews/{id} 🔒 | 리뷰 숨김·다시 보이기 `{hidden: true\|false}` → 숨기면 `review_hidden` 알림 | ✅ |
| GET | /api/admin/reports?status=&targetType=&page=&size= 🔒 | 신고함 — 대상별로 묶어 신고 많은 순 (`status: open(기본)\|resolved\|dismissed`) | ✅ |
| POST | /api/admin/reports/{id}/resolve 🔒 | 신고 처리 `{action: hide\|dismiss}` — 같은 대상의 열린 신고를 함께 닫고 신고자에게 `report_done` 알림, 숨기면 작성자에게도 `report_hidden` | ✅ |
| GET | /api/admin/trades?status=&kind=&q=&page=&size= 🔒 | 거래글 목록 (샘플 제외, `status: open\|done\|hidden`, `kind: have\|want\|sell`, 물건 이름·내용·닉네임·이메일 검색) | ✅ |
| PATCH | /api/admin/trades/{id} 🔒 | 거래글 숨김·다시 보이기 `{status: open\|hidden, memo?}` → 숨기면 `trade_hidden` 알림 | ✅ |
| GET · POST | /api/admin/badges 🔒 | 뱃지 목록 `{auto, event}`(받은 사람 수 포함)·이벤트 뱃지 만들기 `{name ≤20자, description ≤60자, image, isActive?}` → 201 | ✅ |
| PATCH · DELETE | /api/admin/badges/{code} 🔒 | 이벤트 뱃지 고치기 / 삭제(받은 기록도 함께) — 자동 뱃지는 400 | ✅ |
| POST | /api/admin/badges/{code}/grant 🔒 | 이벤트 뱃지 주기 `{userIds(최대 50명), memo?}` → `{granted, skipped}` | ✅ |
| GET | /api/admin/badges/{code}/holders 🔒 | 뱃지 받은 사람 `Page<{userId, nickname, earnedAt, grantedByNickname, memo}>` | ✅ |
| DELETE | /api/admin/badges/{code}/holders/{userId} 🔒 | 이벤트 뱃지 회수 | ✅ |
| GET | /api/admin/badge-images 🔒 | 이벤트 뱃지로 고를 수 있는 그림 경로 목록 | ✅ |

## PIXEL LOCAL
| 메서드 | 경로 | 설명 | 상태 |
| --- | --- | --- | --- |
| GET | /api/regions?parent= | 지역 목록 (parent 없으면 시, 있으면 그 아래 구·생활권). `fullName` 예: 성남시 분당구 판교 | ✅ |
| GET · PUT | /api/users/me/local 🔒 | 내 지역·취향·집계 참여(`fandomOptIn`)·취향 공개(`profilePublic`)·지도 아바타 표시(`mapAvatarOptIn`)·닉네임 공개(`nicknamePublic`)·이웃 카드 공개(`mapCardPublic`) 조회·설정 (PUT은 전체 교체, 없는 지역·취향 422) | ✅ |
| GET | /api/interests?type=&q= | 취향 태그 검색 — 지금은 **작품(`work`)만** 운영 (애니 5장르·게임 5장르 × 5개 = 50개 + 대표 작품을 고르기 어려운 비주류 장르 태그 레트로 RPG·픽셀 게임·던전 크롤러 = 53개, `seed/interests.json`). type 값 `character/style/product_type`도 받지만 결과는 비어 있음 | ✅ |
| GET | /api/local/fandom?region=&interest=&type=&period=&limit= | 덕력지도 집계 — 집계 참여자 수(중복 제거, 테스트 계정 제외), 하위 지역 합산, 0명만 `count: null, belowThreshold: true`, 사용자 목록 없음, 샘플은 `isSample: true`, period `30d/90d/all` | ✅ |
| GET | /api/local/fandom/ranking?region=&type=&period=&limit= | 지역 인기 취향 순위 (1명 이상, `rank`·`isSample`) | ✅ |
| GET · POST | /api/local/trades?region=&kind=&q=&productId=&interestId=&nickname= 🔒(POST) | 거래(`sell`)·교환(`have/want`) 글 (Prototype). 목록은 진행 중 글, 상위 지역은 하위 포함, 작성자 정보는 닉네임 공개 동의자의 글에만 `author {nickname, avatarUrl}`(그 외·샘플 null), `nickname`은 동의자 글만 부분 검색(종류는 `kind`로), `q`는 물건 이름·연결 상품 이름·설명 부분 검색(1~40자), `kind`는 여러 번 넘기면 OR(거래·교환 탭은 `kind=have&kind=sell`, 위시 `want`는 위시맵 탭), 샘플은 `isSample`, 시연용 데모 이웃 글은 `isDemo`. POST는 내 지역으로 작성 — 지역 미설정 400, have·sell 상태 미선택·연락처/정확한 장소 422, 같은 물건 진행 중 글 400 | ✅ |
| GET | /api/local/trades/mine 🔒 | 내 글 (완료·숨김 포함) | ✅ |
| GET | /api/local/trades/{id} | 거래글 하나 (진행 중이거나 내 글, 그 외 404) | ✅ |
| GET | /api/local/wish-wants?codes=a,b | 위시맵 지역 블록별 진행 중 WANT 수·핀 이미지(최대 4, 하위 지역 포함), 없는 지역 404, 최대 40개 | ✅ |
| PATCH | /api/local/trades/{id} 🔒 | 내 글 상태 `done`/`hidden` (남의 글 404) | ✅ |
| DELETE | /api/local/trades/{id} 🔒 | 내 글 삭제 — 교환 진행 중·완료 기록이 있으면 400(대신 숨기기), 관리자가 숨긴 글 403, 남의 글 404. 대기 중인 신청은 `cancelled`로 정리하고 상대에게 `trade_cancelled` 알림 | ✅ |
| GET | /api/local/trades/matches 🔒 | 내 WANT ↔ 같은 구 이웃의 HAVE·SELL (같은 상품·취향·물건 이름), `proximity: same_zone/same_district`, 맞교환 `mutual` 우선 | ✅ |
| POST | /api/local/trade-requests 🔒 | 이웃의 거래글에 교환 신청 `{postId, offerPostId?}` → 201 `TradeRequestOut {id, status, createdAt, decidedAt, receivedByMe, receivedByThem, post, offerPost, isMine, requester}` (`post`·`offerPost`는 거래글과 같은 모양, `requester`는 닉네임 공개 동의자만 `{nickname, avatarUrl}`, 아니면 null). 없음·숨김 404, 내 글·샘플·마감 글·이미 대기 중인 신청 400. **이웃의 HAVE·WANT 글에는 `offerPostId`(내 진행 중인 HAVE 글) 필수**, 판매(SELL) 글은 없이 구매 신청 가능. 남의 글·WANT 글을 보내면 400 | ✅ |
| GET | /api/local/trade-requests?box=received\|sent 🔒 | 받은(내 글에 온)/보낸 교환 신청 (모든 상태, 최신순). `status`: `pending`(신청) → `accepted`(교환 진행 중) → `completed`(두 사람 모두 받음), 또는 `declined/cancelled`. `receivedByMe`·`receivedByThem`: 교환 진행 중 각자 받았다고 눌렀는지 | ✅ |
| POST | /api/local/trade-requests/{id}/accept 🔒 | 받은 신청 수락 → `accepted`(교환 진행 시작) — 내 글·함께 보낸 글(진행 중이면) `done`, 같은 글의 다른 대기 신청은 자동 `declined`. **점수는 아직 없음** (완료 때). 남의 신청 404, 이미 처리 400 | ✅ |
| POST | /api/local/trade-requests/{id}/received 🔒 | 교환 진행 중 "물건을 받았어요" (글 주인·신청한 사람만, 그 외 404). 한 사람만 누르면 상대에게 `trade_received` 알림, **두 사람 모두 누르면 `completed`** + 두 사람 모두 거래 완료 활동 점수·`trade_completed` 알림. 진행 중이 아니면·이미 눌렀으면 400. 실제 주고받는 방식(택배 주소·직거래 장소)은 아직 없음 | ✅ |
| POST | /api/local/trade-requests/{id}/not-received 🔒 | 교환 진행 중 "아직 못 받았어요" → 상대에게 `trade_not_received` 알림. 하루 한 번(초과 429), 진행 중이 아니거나 이미 받았다고 눌렀으면 400, 당사자가 아니면 404 | ✅ |
| POST | /api/local/trade-requests/{id}/decline 🔒 | 받은 신청 거절 (글 주인만, 남의 신청 404, 이미 처리 400) | ✅ |
| POST | /api/local/trade-requests/{id}/cancel 🔒 | 보낸 신청 취소 (신청한 사람만, 남의 신청 404, 이미 처리 400) | ✅ |
| GET | /api/local/map-avatars?region=&interest= | 덕력지도 아바타 핀 — 보고 있는 지역의 하위 지역(생활권이면 자기 자신)별 `mapAvatarOptIn` 동의자 수와 구매 금액 상위 최대 10개 아바타(PNG data URL, null=기본 슬라임, 같은 금액은 무작위, 0번이 1위). 동의자가 없으면 덕력지도 샘플 인원만큼 샘플 캐릭터로 채우고 `isSample: true`, 샘플도 없으면 `count: null, belowThreshold: true, avatars: []`, id·닉네임 없음, 테스트 계정 제외 · `cards`: avatars와 같은 순서의 이웃 카드 `{nickname, hearts 0~99, lv 1~10, level, coinBand, interests, wantCount, isMe, badge, badgeCount}` — 카드 공개 동의자만(아니면 null), 닉네임·취향·WANT 수는 각 공개 동의 시에만, 점수·금액·id 없음 · 실제 이웃이 샘플 인원보다 적으면 실제 이웃을 앞에 두고 남는 자리를 샘플 캐릭터로 채움(카드 `isSample`) · 내 캐릭터는 카드 공개를 안 켜도 나에게만 내 카드(`isMe`, `isPublic: false`) | ✅ |
| GET | /api/local/buyer-ranking?region=&interest= | 지역 구매 순위 TOP 10 — 아바타 표시 동의자를 구매 금액(취소 제외) 순으로 `{regionCode, belowThreshold, isSample, items: [{rank, avatarUrl, nickname}]}`. **금액은 내보내지 않음**, `nickname`은 닉네임 공개 동의자만(아니면 null), 동의자가 없으면 `items: []`, 동의자가 적으면 지도와 같은 샘플 캐릭터(`isSample`). 없는 지역·취향 404, region 없음 422 | ✅ |
| GET | /api/users/me/activity 🔒 | 내 활동 점수 `{score, hearts, lv, level, nextHeartAt, coins, coinBand, recent}` — 하트(지역 커뮤니티 참여도: 프로필 완성 +5·첫 WANT +10 한 번, 거래·교환 완료 +20·선물 완료(받았을 때) +10 하루 3건까지, 같은 글·선물은 한 번), 코인 = 완료한 교환·거래 수. 하트 1·2·3개 = 30·65·90점, 그 뒤 30점마다 하나씩 최대 99개 (시범 기준) | ✅ |
| GET | /api/users/me/badges 🔒 | 내 뱃지 도감 `{earnedCount, total, featured, items: [{code, icon, image, name, description, earned, kind: auto\|event, earnedAt, isNew, isWeekly, progress: {current, goal}\|null, grantedMemo}]}` (`image`: 16×16 픽셀 아이콘 `/images/badges/<code>.png`). 자동 뱃지는 주문·리뷰·활동 점수·거래·선물 기록으로 판정해 처음 받을 때 `user_badges`에 받은 시점을 저장(주간 `top_buyer`만 매주 다시 계산, 저장 안 함), 관리자 이벤트 뱃지 정의는 `badge_defs`. 받은 지 7일 안은 `isNew`. 이웃 카드 `badge`는 대표 뱃지(고르지 않았으면 받은 뱃지 중 가장 받기 어려운 것), `badgeCount`는 받은 수 | ✅ |
| PATCH | /api/users/me/featured-badge 🔒 | 대표 뱃지 고르기 `{code \| null}` (null이면 자동) → 도감 전체. 받은 뱃지만 가능 | ✅ |
| GET | /api/local/wish-map?region=&limit= | 지역 인기 찜 상품 순위 (집계 참여자만, 하위 지역 합산, 1명 이상). 실제 찜이 없는 칸은 샘플로 채우고 `isSample: true` | ✅ |
| POST | /api/gifts 🔒 | WANT 글 이웃에게 선물(데모 결제) `{tradePostId, productId, quantity 1~9, message ≤100}` → 201. **글에 연결된 상품만**(`productId`가 글의 상품과 다르거나 상품 없는 글이면 400), HAVE·SELL·내 글·샘플 400, 없음·숨김 404, 연락처 메시지 422. 상대는 항상 "이웃 플레이어" | ✅ |
| GET | /api/gifts?box=received\|sent 🔒 | 받은/보낸 선물함 (최신순, 닉네임·주소 없음, `orderId`는 받은 사람만) | ✅ |
| POST | /api/gifts/{id}/accept 🔒 | 받은 선물 받기 `{recipientName, address}` → 받는 사람의 주문 생성(배송 흐름), 남의 선물 404, 이미 처리 400 | ✅ |
| POST | /api/gifts/{id}/decline 🔒 | 받은 선물 거절 → 보낸 사람에게 "거절 · 환불" | ✅ |

## 알림 (앱 안 알림 종)
| 메서드 | 경로 | 설명 | 상태 |
| --- | --- | --- | --- |
| GET | /api/notifications?limit= 🔒 | 내 알림 최신순 `{items: [{id, kind, title, body, href, createdAt, read}], unread}` — `limit` 1~50(기본 30, 범위 밖 422), `href`는 프론트 내부 경로(없으면 null), `unread`는 안 읽은 전체 수 | ✅ |
| GET | /api/notifications/unread-count 🔒 | 안 읽은 알림 수 `{unread}` (약 30초마다 폴링용) | ✅ |
| POST | /api/notifications/read 🔒 | 읽음 처리 `{ids: [int] \| null}` — ids가 null·생략이면 안 읽은 알림 전부, 남의 알림 id는 무시 → `{unread}` | ✅ |

`kind` 와 이동 경로: `trade_request`·`trade_accepted`·`trade_declined`·`trade_cancelled`·`trade_received`·`trade_not_received`·`trade_completed` → `/local/trades/mine#trade-requests` · `trade_hidden`(관리자가 내 글 숨김) → `/local/trades/mine` · `order_placed` → `/mypage/orders/{id}` (일반 주문만, 선물로 생긴 주문은 제외) · `order_{status}`(관리자 배송 단계 진행)·`cancel_approved`·`cancel_rejected`·`return_{status}`(반품·교환 승인/거절) → `/mypage/orders/{id}` · `review_hidden`·`question_answered` → `/products/{id}` · `report_hidden`(신고로 내 글이 숨겨짐)·`report_done`(신고자에게 처리 완료, 이동 경로 없음) · `avatar_reset` → `/mypage/avatar` · `gift_received`·`gift_sent`·`gift_accepted`·`gift_declined` → `/mypage/gifts` · `points`·`heart_up`·`badge` → `/mypage/quests`. 같은 일(`kind` + 내부 키)은 한 번만 쌓이고(뱃지는 평생 한 번), 금액·연락처는 넣지 않는다. 샘플 작성자에게는 보내지 않고 데모 이웃에게는 보낸다. `python -m scripts.seed_demo`는 알림이 없는 데모 이웃에게 예시 알림 2~3개를 넣는다.
