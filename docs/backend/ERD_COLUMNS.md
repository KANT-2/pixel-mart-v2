# ERD 컬럼 사전

ERD 그림에 나온 테이블의 모든 컬럼과 제약을 찾아보는 목록입니다. 먼저 [ERD 설명](ERD_DAY1.md)을 읽고, 필요한 테이블만 찾아보세요.

## 표 읽는 법

- 컬럼: 한 행에 저장하는 값의 이름입니다. 예를 들어 `quantity`는 수량입니다.
- INT/INTEGER: 정수입니다. 금액은 소수 없이 원 단위로 저장합니다.
- VARCHAR(n): 최대 n자의 짧은 글, TEXT: 긴 글, BOOLEAN: 예/아니오입니다.
- TIMESTAMPTZ: 시간대가 포함된 시각입니다.
- NULL 허용: 아직 값이 없어도 됩니다. 예를 들어 답변 전의 `answer`는 비어 있습니다.
- PK: 행의 고유 식별값, FK: 다른 테이블을 연결하는 값, UNIQUE/UK: 중복을 허용하지 않는 값입니다.
- ★ 2차: 2차(10/24~) 마이그레이션에서 추가한 컬럼·테이블입니다. 그 외 값은 1차부터 있던 컬럼입니다.

범위: main 92ceef9 · 마이그레이션 head b3f1c2d4e5a6. 실제 DB의 information_schema에서 읽은 값입니다. 그림에 없는 나머지 테이블까지 포함한 전체 스키마는 [SCHEMA.md](SCHEMA.md)를 참고하세요.

## 회원 · 주문 · 문의 (첫 번째 그림)

### users

| 컬럼 | 쉬운 설명 | 타입 | NULL | 키/참조 | 변경 |
|---|---|---|---|---|---|
| id | 이 행을 구분하는 고유 번호 | INTEGER | 불가 | PK | 기존 |
| email | 로그인에 사용하는 이메일 | VARCHAR(320) | 불가 | UNIQUE | 기존 |
| google_sub | 구글이 발급한 계정 식별값 | VARCHAR(255) | 허용 | UNIQUE | 기존 |
| nickname | 화면에 보이는 별명 | VARCHAR(30) | 불가 |  | 기존 |
| avatar_url | 회원 아바타 이미지 | TEXT | 허용 |  | 기존 |
| created_at | 처음 저장한 시각 | TIMESTAMPTZ | 불가 |  | 기존 |
| region_code | 회원이 선택한 지역 코드 | VARCHAR(12) | 허용 | FK → regions.code | 기존 |
| fandom_opt_in | 취향 집계 참여에 동의했는지 | BOOLEAN | 불가 |  | 기존 |
| profile_public | 취향 프로필을 공개하는지 | BOOLEAN | 불가 |  | 기존 |
| map_avatar_opt_in | 지도에 아바타를 표시해도 되는지 | BOOLEAN | 불가 |  | 기존 |
| nickname_public | 별명을 공개해도 되는지 | BOOLEAN | 불가 |  | 기존 |
| map_card_public | 지도 이웃 카드를 공개하는지 | BOOLEAN | 불가 |  | 기존 |
| role | 일반 회원인지 관리자인지 | VARCHAR(20) | 불가 |  | ★ 2차 |
| password_hash | 원문 대신 저장하는 비밀번호 해시 | TEXT | 허용 |  | ★ 2차 |
| suspended | 관리자가 정지한 회원인지 | BOOLEAN | 불가 |  | ★ 2차 |
| deleted_at | 회원 탈퇴 시각 (탈퇴 전에는 없음) | TIMESTAMPTZ | 허용 |  | ★ 2차 |
| featured_badge | 대표로 고른 뱃지 코드 | VARCHAR(30) | 허용 |  | ★ 2차 |

### token_blacklist

| 컬럼 | 쉬운 설명 | 타입 | NULL | 키/참조 | 변경 |
|---|---|---|---|---|---|
| id | 이 행을 구분하는 고유 번호 | INTEGER | 불가 | PK | ★ 2차 |
| jti | 로그인 토큰 하나의 고유 식별값 | VARCHAR(255) | 불가 | UNIQUE | ★ 2차 |
| expires_at | 토큰의 사용 기한 | TIMESTAMPTZ | 불가 |  | ★ 2차 |
| created_at | 처음 저장한 시각 | TIMESTAMPTZ | 불가 |  | ★ 2차 |

### products

| 컬럼 | 쉬운 설명 | 타입 | NULL | 키/참조 | 변경 |
|---|---|---|---|---|---|
| id | 이 행을 구분하는 고유 번호 | INTEGER | 불가 | PK | 기존 |
| name | 상품 이름 | VARCHAR(100) | 불가 |  | 기존 |
| price | 현재 판매 가격(원) | INTEGER | 불가 |  | 기존 |
| category_slug | 상품이 속한 분류 코드 | VARCHAR(30) | 불가 | FK → categories.slug | 기존 |
| image_url | 상품 이미지 경로 | VARCHAR(300) | 불가 |  | 기존 |
| description | 상품 설명 | TEXT | 불가 |  | 기존 |
| is_new | 신상품 표시 여부 | BOOLEAN | 불가 |  | 기존 |
| created_at | 처음 저장한 시각 | TIMESTAMPTZ | 불가 |  | 기존 |
| stock | 주문할 수 있는 남은 수량 | INTEGER | 불가 |  | ★ 2차 |
| rarity | 아이템 등급 (common · rare · epic · unique) | VARCHAR(10) | 불가 |  | ★ 2차 |
| is_hidden | 관리자가 숨긴 상품인지 | BOOLEAN | 불가 |  | ★ 2차 |

### cart_items

| 컬럼 | 쉬운 설명 | 타입 | NULL | 키/참조 | 변경 |
|---|---|---|---|---|---|
| user_id | 이 기록의 회원 번호 | INTEGER | 불가 | PK, FK → users.id | 기존 |
| product_id | 이 기록의 상품 번호 | INTEGER | 불가 | PK, FK → products.id | 기존 |
| quantity | 담거나 주문한 수량 | INTEGER | 불가 |  | 기존 |
| added_at | 장바구니에 담은 시각 | TIMESTAMPTZ | 불가 |  | 기존 |

### orders

| 컬럼 | 쉬운 설명 | 타입 | NULL | 키/참조 | 변경 |
|---|---|---|---|---|---|
| id | 이 행을 구분하는 고유 번호 | INTEGER | 불가 | PK | 기존 |
| user_id | 이 기록의 회원 번호 | INTEGER | 불가 | FK → users.id | 기존 |
| status | 현재 처리 상태 | VARCHAR(20) | 불가 |  | 기존 |
| total_price | 주문 총액(원) | INTEGER | 불가 |  | 기존 |
| recipient_name | 받는 사람 이름 | VARCHAR(50) | 불가 |  | 기존 |
| address | 배송 주소 | VARCHAR(200) | 불가 |  | 기존 |
| created_at | 처음 저장한 시각 | TIMESTAMPTZ | 불가 |  | 기존 |
| shipping_fee | 이 주문의 배송비(원) | INTEGER | 불가 |  | ★ 2차 |
| points_used | 이 주문에 쓴 포인트 | INTEGER | 불가 |  | ★ 2차 |
| phone | 받는 사람 휴대폰 번호 | VARCHAR(20) | 불가 |  | ★ 2차 |
| postal_code | 배송지 우편번호 | VARCHAR(10) | 불가 |  | ★ 2차 |
| address_detail | 상세 주소 (동·호수) | VARCHAR(100) | 불가 |  | ★ 2차 |
| delivery_memo | 배송 요청 메모 | VARCHAR(100) | 불가 |  | ★ 2차 |
| payment_method | 가상 결제 수단 | VARCHAR(20) | 불가 |  | ★ 2차 |
| coupon_discount | 쿠폰으로 깎은 금액(원) | INTEGER | 불가 |  | ★ 2차 |
| coupon_name | 쓴 쿠폰 이름 | VARCHAR(50) | 허용 |  | ★ 2차 |
| courier | 택배사 | VARCHAR(20) | 허용 |  | ★ 2차 |
| tracking_number | 운송장 번호 | VARCHAR(30) | 허용 |  | ★ 2차 |
| confirmed_at | 구매 확정 시각 | TIMESTAMPTZ | 허용 |  | ★ 2차 |

### order_items

| 컬럼 | 쉬운 설명 | 타입 | NULL | 키/참조 | 변경 |
|---|---|---|---|---|---|
| id | 이 행을 구분하는 고유 번호 | INTEGER | 불가 | PK | 기존 |
| order_id | 이 기록이 연결된 주문 번호 | INTEGER | 불가 | FK → orders.id | 기존 |
| product_id | 이 기록의 상품 번호 | INTEGER | 불가 | FK → products.id | 기존 |
| quantity | 담거나 주문한 수량 | INTEGER | 불가 |  | 기존 |
| unit_price | 주문할 때의 상품 1개 가격(원) | INTEGER | 불가 |  | 기존 |

### order_status_history

| 컬럼 | 쉬운 설명 | 타입 | NULL | 키/참조 | 변경 |
|---|---|---|---|---|---|
| id | 이 행을 구분하는 고유 번호 | INTEGER | 불가 | PK | 기존 |
| order_id | 이 기록이 연결된 주문 번호 | INTEGER | 불가 | FK → orders.id | 기존 |
| status | 현재 처리 상태 | VARCHAR(20) | 불가 |  | 기존 |
| changed_at | 배송 상태를 기록한 시각 | TIMESTAMPTZ | 불가 |  | 기존 |

### cancel_requests

| 컬럼 | 쉬운 설명 | 타입 | NULL | 키/참조 | 변경 |
|---|---|---|---|---|---|
| id | 이 행을 구분하는 고유 번호 | INTEGER | 불가 | PK | 기존 |
| order_id | 이 기록이 연결된 주문 번호 | INTEGER | 불가 | FK → orders.id | 기존 |
| reason | 주문 취소를 요청한 이유 | VARCHAR(200) | 불가 |  | 기존 |
| status | 현재 처리 상태 | VARCHAR(20) | 불가 |  | 기존 |
| created_at | 처음 저장한 시각 | TIMESTAMPTZ | 불가 |  | 기존 |

### product_questions

| 컬럼 | 쉬운 설명 | 타입 | NULL | 키/참조 | 변경 |
|---|---|---|---|---|---|
| id | 이 행을 구분하는 고유 번호 | INTEGER | 불가 | PK | 기존 |
| product_id | 이 기록의 상품 번호 | INTEGER | 불가 | FK → products.id | 기존 |
| user_id | 이 기록의 회원 번호 | INTEGER | 불가 | FK → users.id | 기존 |
| title | 문의 또는 알림 제목 | VARCHAR(100) | 불가 |  | 기존 |
| content | 문의 내용 | VARCHAR(500) | 불가 |  | 기존 |
| is_secret | 비밀 문의인지 | BOOLEAN | 불가 |  | 기존 |
| answer | 관리자가 남긴 답변 | TEXT | 허용 |  | 기존 |
| answered_at | 답변한 시각 | TIMESTAMPTZ | 허용 |  | 기존 |
| created_at | 처음 저장한 시각 | TIMESTAMPTZ | 불가 |  | 기존 |
| is_hidden | 관리자가 숨긴 문의인지 | BOOLEAN | 불가 |  | ★ 2차 |

### notifications

| 컬럼 | 쉬운 설명 | 타입 | NULL | 키/참조 | 변경 |
|---|---|---|---|---|---|
| id | 이 행을 구분하는 고유 번호 | INTEGER | 불가 | PK | 기존 |
| user_id | 이 기록의 회원 번호 | INTEGER | 불가 | FK → users.id | 기존 |
| kind | 알림의 종류 | VARCHAR(20) | 불가 |  | 기존 |
| title | 문의 또는 알림 제목 | VARCHAR(80) | 불가 |  | 기존 |
| body | 알림 내용 | VARCHAR(200) | 불가 |  | 기존 |
| href | 알림을 누르면 이동할 경로 | VARCHAR(200) | 허용 |  | 기존 |
| ref_key | 같은 일을 중복 알림으로 보내지 않기 위한 값 | VARCHAR(120) | 불가 |  | 기존 |
| created_at | 처음 저장한 시각 | TIMESTAMPTZ | 불가 |  | 기존 |
| read_at | 알림을 읽은 시각 | TIMESTAMPTZ | 허용 |  | 기존 |

## 추가 퀘스트 (두 번째 그림)

### notices

| 컬럼 | 쉬운 설명 | 타입 | NULL | 키/참조 | 변경 |
|---|---|---|---|---|---|
| id | 이 행을 구분하는 고유 번호 | INTEGER | 불가 | PK | ★ 2차 |
| title | 공지 제목 | VARCHAR(100) | 불가 |  | ★ 2차 |
| content | 공지 내용 | TEXT | 불가 |  | ★ 2차 |
| is_pinned | 맨 위 고정인지 | BOOLEAN | 불가 |  | ★ 2차 |
| is_published | 손님 화면에 게시했는지 | BOOLEAN | 불가 |  | ★ 2차 |
| created_by | 작성한 관리자 | INTEGER | 허용 | FK → users.id | ★ 2차 |
| created_at | 처음 저장한 시각 | TIMESTAMPTZ | 불가 |  | ★ 2차 |
| updated_at | 마지막으로 고친 시각 | TIMESTAMPTZ | 불가 |  | ★ 2차 |

### reports

| 컬럼 | 쉬운 설명 | 타입 | NULL | 키/참조 | 변경 |
|---|---|---|---|---|---|
| id | 이 행을 구분하는 고유 번호 | INTEGER | 불가 | PK | ★ 2차 |
| reporter_id | 신고한 회원 | INTEGER | 불가 | FK → users.id | ★ 2차 |
| target_type | 신고 대상 종류 (trade · review · question) | VARCHAR(20) | 불가 |  | ★ 2차 |
| target_id | 신고 대상 번호 | INTEGER | 불가 |  | ★ 2차 |
| reason | 신고 사유 코드 | VARCHAR(20) | 불가 |  | ★ 2차 |
| memo | 신고 메모 | VARCHAR(200) | 불가 |  | ★ 2차 |
| status | 현재 처리 상태 | VARCHAR(20) | 불가 |  | ★ 2차 |
| created_at | 처음 저장한 시각 | TIMESTAMPTZ | 불가 |  | ★ 2차 |
| resolved_at | 처리한 시각 | TIMESTAMPTZ | 허용 |  | ★ 2차 |
| resolved_by | 처리한 관리자 | INTEGER | 허용 | FK → users.id | ★ 2차 |

### badge_defs

| 컬럼 | 쉬운 설명 | 타입 | NULL | 키/참조 | 변경 |
|---|---|---|---|---|---|
| code | 뱃지 코드 (행을 구분) | VARCHAR(30) | 불가 | PK | ★ 2차 |
| name | 뱃지 이름 | VARCHAR(20) | 불가 |  | ★ 2차 |
| description | 뱃지 설명 | VARCHAR(60) | 불가 |  | ★ 2차 |
| image | 뱃지 그림 경로 | VARCHAR(300) | 불가 |  | ★ 2차 |
| rank | 도감에서의 순서 | INTEGER | 불가 |  | ★ 2차 |
| is_active | 지금 줄 수 있는 뱃지인지 | BOOLEAN | 불가 |  | ★ 2차 |
| created_by | 뱃지를 만든 관리자 | INTEGER | 허용 | FK → users.id | ★ 2차 |
| created_at | 처음 저장한 시각 | TIMESTAMPTZ | 불가 |  | ★ 2차 |

### user_badges

| 컬럼 | 쉬운 설명 | 타입 | NULL | 키/참조 | 변경 |
|---|---|---|---|---|---|
| id | 이 행을 구분하는 고유 번호 | INTEGER | 불가 | PK | ★ 2차 |
| user_id | 이 기록의 회원 번호 | INTEGER | 불가 | FK → users.id | ★ 2차 |
| code | 받은 뱃지 코드 (기본 뱃지 또는 badge_defs.code) | VARCHAR(30) | 불가 |  | ★ 2차 |
| earned_at | 받은 시각 | TIMESTAMPTZ | 불가 |  | ★ 2차 |
| granted_by | 직접 준 관리자 (자동 획득이면 없음) | INTEGER | 허용 | FK → users.id | ★ 2차 |
| memo | 관리자가 준 이유 | VARCHAR(200) | 허용 |  | ★ 2차 |

### point_transactions

| 컬럼 | 쉬운 설명 | 타입 | NULL | 키/참조 | 변경 |
|---|---|---|---|---|---|
| id | 이 행을 구분하는 고유 번호 | INTEGER | 불가 | PK | ★ 2차 |
| user_id | 이 기록의 회원 번호 | INTEGER | 불가 | FK → users.id | ★ 2차 |
| order_id | 이 기록이 연결된 주문 번호 | INTEGER | 불가 | FK → orders.id | ★ 2차 |
| kind | 적립 · 사용 · 환급 종류 | VARCHAR(20) | 불가 |  | ★ 2차 |
| amount | 포인트 증감 (0이 아님) | INTEGER | 불가 |  | ★ 2차 |
| created_at | 처음 저장한 시각 | TIMESTAMPTZ | 불가 |  | ★ 2차 |

### coupons

| 컬럼 | 쉬운 설명 | 타입 | NULL | 키/참조 | 변경 |
|---|---|---|---|---|---|
| id | 이 행을 구분하는 고유 번호 | INTEGER | 불가 | PK | ★ 2차 |
| code | 입력해서 받는 쿠폰 코드 | VARCHAR(30) | 허용 | UNIQUE | ★ 2차 |
| name | 쿠폰 이름 | VARCHAR(50) | 불가 |  | ★ 2차 |
| discount_type | 정액(amount) · 정률(percent) | VARCHAR(10) | 불가 |  | ★ 2차 |
| discount_value | 할인 값 (원 또는 %) | INTEGER | 불가 |  | ★ 2차 |
| min_order_price | 쓸 수 있는 최소 주문 금액 | INTEGER | 불가 |  | ★ 2차 |
| max_discount | 최대 할인 금액 (정률 쿠폰) | INTEGER | 허용 |  | ★ 2차 |
| valid_days | 받은 뒤 쓸 수 있는 일수 | INTEGER | 불가 |  | ★ 2차 |
| auto_issue | 자동 지급 조건 (예: 가입 축하) | VARCHAR(20) | 허용 |  | ★ 2차 |
| is_active | 지금 지급하는 쿠폰인지 | BOOLEAN | 불가 |  | ★ 2차 |

### user_coupons

| 컬럼 | 쉬운 설명 | 타입 | NULL | 키/참조 | 변경 |
|---|---|---|---|---|---|
| id | 이 행을 구분하는 고유 번호 | INTEGER | 불가 | PK | ★ 2차 |
| user_id | 이 기록의 회원 번호 | INTEGER | 불가 | FK → users.id | ★ 2차 |
| coupon_id | 받은 쿠폰 종류 | INTEGER | 불가 | FK → coupons.id | ★ 2차 |
| issued_at | 받은 시각 | TIMESTAMPTZ | 불가 |  | ★ 2차 |
| expires_at | 쓸 수 있는 기한 | TIMESTAMPTZ | 불가 |  | ★ 2차 |
| used_order_id | 쓴 주문 (안 썼으면 없음) | INTEGER | 허용 | FK → orders.id | ★ 2차 |
| used_at | 쓴 시각 | TIMESTAMPTZ | 허용 |  | ★ 2차 |

### shipping_addresses

| 컬럼 | 쉬운 설명 | 타입 | NULL | 키/참조 | 변경 |
|---|---|---|---|---|---|
| id | 이 행을 구분하는 고유 번호 | INTEGER | 불가 | PK | ★ 2차 |
| user_id | 이 기록의 회원 번호 | INTEGER | 불가 | FK → users.id | ★ 2차 |
| label | 배송지 이름 (집 · 회사 등) | VARCHAR(20) | 불가 |  | ★ 2차 |
| recipient_name | 받는 사람 이름 | VARCHAR(50) | 불가 |  | ★ 2차 |
| phone | 받는 사람 휴대폰 번호 | VARCHAR(20) | 불가 |  | ★ 2차 |
| postal_code | 우편번호 | VARCHAR(10) | 불가 |  | ★ 2차 |
| address | 배송 주소 | VARCHAR(200) | 불가 |  | ★ 2차 |
| address_detail | 상세 주소 | VARCHAR(100) | 불가 |  | ★ 2차 |
| is_default | 기본 배송지인지 | BOOLEAN | 불가 |  | ★ 2차 |
| created_at | 처음 저장한 시각 | TIMESTAMPTZ | 불가 |  | ★ 2차 |

### return_requests

| 컬럼 | 쉬운 설명 | 타입 | NULL | 키/참조 | 변경 |
|---|---|---|---|---|---|
| id | 이 행을 구분하는 고유 번호 | INTEGER | 불가 | PK | ★ 2차 |
| order_id | 이 기록이 연결된 주문 번호 | INTEGER | 불가 | FK → orders.id | ★ 2차 |
| kind | 반품(return) · 교환(exchange) | VARCHAR(10) | 불가 |  | ★ 2차 |
| reason | 요청 이유 | VARCHAR(200) | 불가 |  | ★ 2차 |
| status | 현재 처리 상태 | VARCHAR(20) | 불가 |  | ★ 2차 |
| created_at | 처음 저장한 시각 | TIMESTAMPTZ | 불가 |  | ★ 2차 |
| resolved_at | 처리한 시각 | TIMESTAMPTZ | 허용 |  | ★ 2차 |

## 복합 키와 제약

- cart_items: PK(user_id, product_id), quantity 1~99.
- order_items: quantity 1~99.
- notifications: UNIQUE(user_id, kind, ref_key).
- users: email·google_sub UNIQUE, lower(nickname) 유일 인덱스.
- user_badges: UNIQUE(user_id, code) — 같은 뱃지는 한 번만.
- reports: reason · status · target_type은 정해진 값만(CHECK), 열린(open) 신고는 (reporter_id, target_type, target_id)당 하나(부분 유일 인덱스).
- point_transactions: amount ≠ 0, UNIQUE(user_id, kind, order_id), 첫 구매 적립(first_purchase)은 회원당 하나(부분 유일 인덱스).
- coupons: discount_type은 amount · percent, discount_value > 0, code UNIQUE.
- user_coupons: UNIQUE(user_id, coupon_id) — 같은 쿠폰은 한 번만 받음.
- shipping_addresses: 기본 배송지(is_default)는 회원당 하나(부분 유일 인덱스).
- return_requests: kind는 return · exchange, status는 정해진 값만(CHECK).
- 재고가 0보다 작아지지 않게 막는 처리는 주문 코드의 조건부 차감(`stock >= 수량`)으로 합니다. DB에 재고 CHECK 제약은 없습니다.
