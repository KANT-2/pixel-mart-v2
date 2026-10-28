# ERD 컬럼 사전

ERD 그림에 생략한 컬럼까지 찾아볼 수 있는 상세 목록입니다. 먼저 [ERD 설명](ERD_DAY1.md)을 읽고, 필요한 테이블만 찾아보세요.

## 표 읽는 법

- 컬럼: 한 행에 저장하는 값의 이름입니다. 예를 들어 `quantity`는 수량입니다.
- INT/INTEGER: 정수입니다. 금액은 소수 없이 원 단위로 저장합니다.
- VARCHAR(n): 최대 n자의 짧은 글, TEXT: 긴 글, BOOLEAN: 예/아니오입니다.
- TIMESTAMPTZ: 시간대가 포함된 시각입니다.
- NULL 허용: 아직 값이 없어도 됩니다. 예를 들어 답변 전의 `answer`는 비어 있습니다.
- PK: 행의 고유 식별값, FK: 다른 테이블을 연결하는 값, UNIQUE/UK: 중복을 허용하지 않는 값입니다.
- 신규: #5에서 추가하는 컬럼입니다. 그 외 값은 이미 있던 컬럼입니다.

범위: main e5ee85c + #5 revision d6cb42e32a1b. #5는 병합됐습니다. 이 문서는 1일차 기준 스냅샷이며, 현재 전체 스키마는 [SCHEMA.md](SCHEMA.md)를 참고하세요.

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
| role | 일반 회원인지 관리자인지 | VARCHAR(20) | 불가 |  | ★ 신규 |
| password_hash | 원문 대신 저장하는 비밀번호 해시 | TEXT | 허용 |  | ★ 신규 |

### token_blacklist

| 컬럼 | 쉬운 설명 | 타입 | NULL | 키/참조 | 변경 |
|---|---|---|---|---|---|
| id | 이 행을 구분하는 고유 번호 | INTEGER | 불가 | PK | ★ 신규 |
| jti | 로그인 토큰 하나의 고유 식별값 | VARCHAR(255) | 불가 | UNIQUE | ★ 신규 |
| expires_at | 토큰의 사용 기한 | TIMESTAMPTZ | 불가 |  | ★ 신규 |
| created_at | 처음 저장한 시각 | TIMESTAMPTZ | 불가 |  | ★ 신규 |

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
| stock | 주문할 수 있는 남은 수량 | INTEGER | 불가 |  | ★ 신규 |

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
| shipping_fee | 이 주문의 배송비(원) | INTEGER | 불가 |  | ★ 신규 |

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

## 복합 키와 제약

- cart_items: PK(user_id, product_id), quantity 1~99.
- order_items: quantity 1~99.
- notifications: UNIQUE(user_id, kind, ref_key).
- users: email·google_sub UNIQUE, lower(nickname) 유일 인덱스.
- 재고가 0보다 작아지지 않게 막는 처리는 #8에서 연결합니다. 이번 DB 변경에는 재고 수량을 검사하는 CHECK 제약을 추가하지 않았습니다.

