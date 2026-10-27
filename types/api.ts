import type { Product } from "@/types/product";
import type { Rarity } from "@/utils/gameItem";

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  size: number;
  totalPages: number;
}

export interface ApiProduct extends Product {
  categorySlug: string;
  isNew: boolean;
  /** 남은 재고 — 서버 응답에만 있고, 정적 대체 데이터에는 없음 (#104) */
  stock?: number;
  /** 아이템 등급 — 서버 값(관리자가 정함). 없으면 가격으로 계산 (#105) */
  rarity?: Rarity;
}

export interface ApiCategory {
  slug: string;
  name: string;
  description: string;
}

export interface ApiUser {
  id: number;
  email: string;
  nickname: string;
  avatarUrl: string | null;
  createdAt: string;
  // 관리자 화면 문지기용 — 인증 API(#14) 머지 전엔 서버가 안 보낼 수 있어요
  role?: "user" | "admin";
  /** 관리자가 이용을 정지한 계정 — 구경은 되고 글쓰기·리뷰·선물·교환 신청은 막힘 (#88) */
  suspended?: boolean;
  /** 이메일 가입 계정 — 비밀번호 변경 화면을 보여 준다 (구글 가입자는 false) */
  hasPassword?: boolean;
}

export interface ApiCartItem {
  product: ApiProduct;
  quantity: number;
  subtotal: number;
  addedAt: string;
}

export interface ApiCart {
  items: ApiCartItem[];
  totalQuantity: number;
  itemsPrice: number;
  shippingFee: number;
  freeShippingLeft: number;
  totalPrice: number;
}

export interface ApiWishlistItem {
  product: ApiProduct;
  createdAt: string;
}

export interface ApiFaq {
  id: number;
  category: string;
  question: string;
  answer: string;
}

export interface ApiOrderItem {
  product: ApiProduct;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}

export interface ApiOrder {
  id: number;
  status: string;
  statusLabel: string;
  itemsPrice: number;
  shippingFee: number;
  pointsUsed: number; // 이 주문에 쓴 구매 포인트 (totalPrice는 포인트를 뺀 금액)
  totalPrice: number;
  recipientName: string;
  address: string;
  // 배송지 · 결제 (예전 주문은 빈 값)
  phone: string;
  postalCode: string;
  addressDetail: string;
  deliveryMemo: string;
  paymentMethod: string;
  paymentLabel: string;
  couponDiscount: number;
  couponName: string | null;
  /** 관리자가 상품 준비중부터 넣는 택배사 · 운송장 */
  courier: string | null;
  courierLabel: string | null;
  trackingNumber: string | null;
  confirmedAt: string | null;
  returnRequest: ApiReturnRequest | null;
  createdAt: string;
  items: ApiOrderItem[];
}

/** 배송 완료 뒤 반품·교환 신청 (가장 최근 것) */
export interface ApiReturnRequest {
  id: number;
  kind: "return" | "exchange";
  reason: string;
  status: "requested" | "approved" | "rejected";
  createdAt: string;
}

/** 내 배송지 — 기본 배송지는 하나 */
export interface ApiAddress {
  id: number;
  label: string;
  recipientName: string;
  phone: string;
  postalCode: string;
  address: string;
  addressDetail: string;
  isDefault: boolean;
  createdAt: string;
}

/** 내 쿠폰 */
export interface ApiUserCoupon {
  id: number;
  name: string;
  discountType: "amount" | "percent";
  discountValue: number;
  minOrderPrice: number;
  maxDiscount: number | null;
  issuedAt: string;
  expiresAt: string;
  status: "available" | "used" | "expired";
  usedOrderId: number | null;
}

export interface ApiOrderTimelineEntry {
  status: string;
  label: string;
  changedAt: string;
}

export interface ApiOrderDetail extends ApiOrder {
  timeline: ApiOrderTimelineEntry[];
}

/** 구매 포인트 (#97) — 첫 구매 보너스 · 주문에 사용 · 취소로 돌려받음 */
export interface ApiPointBalance { balance: number; }
export type PointKind = "first_purchase" | "order_spend" | "order_refund";
export interface ApiPointTransaction { id: number; orderId: number; kind: PointKind | string; amount: number; createdAt: string; }

export interface ApiOrderSummary {
  id: number;
  status: string;
  statusLabel: string;
  totalPrice: number;
  createdAt: string;
  title: string;
  imageUrl: string;
  itemCount: number;
}

export interface ApiCancelRequest {
  id: number;
  orderId: number;
  reason: string;
  status: string;
  statusLabel: string;
  createdAt: string;
}

export interface ApiReview {
  id: number;
  productId: number;
  rating: number;
  content: string;
  nickname: string;
  imageUrls?: string[]; // 포토 리뷰 (최대 3장)
  createdAt: string;
  isMine: boolean;
}

/** 상품 문의 한 개 — 비밀글을 볼 권한이 없으면 서버가 제목·내용·닉네임·답변을 null로 보낸다 */
export interface ApiQuestion {
  id: number;
  productId: number;
  title: string | null;
  content: string | null;
  nickname: string | null;
  isSecret: boolean;
  hidden: boolean;
  answered: boolean;
  answer: string | null;
  answeredAt: string | null;
  createdAt: string;
  isMine: boolean;
}

export interface ApiReviewPage extends Page<ApiReview> {
  averageRating: number | null;
}

export type RegionLevel = "sido" | "sigungu" | "zone";
export type InterestType = "work" | "character" | "style" | "product_type";
export type FandomPeriod = "30d" | "90d" | "all";

export interface ApiRegion {
  code: string;
  level: RegionLevel;
  parentCode: string | null;
  name: string;
  fullName: string;
}

export interface ApiInterest {
  id: number;
  type: InterestType;
  name: string;
  parentId: number | null;
}

export interface ApiLocalProfile {
  region: ApiRegion | null;
  interests: ApiInterest[];
  fandomOptIn: boolean;
  profilePublic: boolean;
  mapAvatarOptIn: boolean;
  nicknamePublic?: boolean;
  mapCardPublic?: boolean;
}

export interface LocalProfileInput {
  regionCode: string | null;
  interestIds: number[];
  fandomOptIn: boolean;
  profilePublic: boolean;
  mapAvatarOptIn?: boolean;
  nicknamePublic?: boolean;
  mapCardPublic?: boolean;
}

/** 활동 뱃지 — 기록으로 계산 (받은 날짜는 없음) */
export interface ApiBadge {
  code: string;
  /** 글자 아이콘 (그림을 못 불러올 때) */
  icon: string;
  /** 16×16 픽셀 아이콘 경로 (public/images/badges) */
  image: string;
  name: string;
  description: string;
}

/** 도감 한 칸 — 받은 여부 · 진행도 · 표시 (#91) */
export interface ApiBadgeBookItem extends ApiBadge {
  earned: boolean;
  kind?: "auto" | "event";
  earnedAt?: string | null;
  /** 받은 지 7일 안 됨 */
  isNew?: boolean;
  /** 동네 큰손 — 매주 월요일에 다시 정해요 */
  isWeekly?: boolean;
  /** 진행 막대 (한 번에 받는 뱃지는 null) */
  progress?: { current: number; goal: number } | null;
  grantedMemo?: string | null;
}

/** 내 뱃지 도감 */
export interface ApiBadgeBook {
  earnedCount: number;
  total: number;
  /** 대표 뱃지 코드 — 고른 것, 없으면 가장 받기 어려운 것 */
  featured?: string | null;
  items: ApiBadgeBookItem[];
}

/** 지도 캐릭터의 이웃 카드 — 카드 공개 동의자만 (사용자 id·정확한 점수·금액·위치 없음) */
export interface ApiMapCard {
  /** 닉네임 공개 동의자만 */
  nickname: string | null;
  /** 지역 커뮤니티 참여도 0~99 (하트 아이콘 + "×N") */
  hearts: number;
  /** 레벨 1~10 — 하트 1·4·9·16…개마다 1씩 */
  lv: number;
  level: string;
  /** 완료한 교환·거래 구간 (예: "교환 5회+") */
  coinBand: string | null;
  interests: string[];
  wantCount: number;
  isMe: boolean;
  /** 이웃에게도 보이는 카드인지 (내 카드는 공개 전에도 나에게만 보임) */
  isPublic?: boolean;
  /** 샘플 캐릭터의 카드 */
  isSample?: boolean;
  /** 대표 뱃지 — 내가 고른 것, 없으면 받은 뱃지 중 가장 받기 어려운 것 */
  badge?: ApiBadge | null;
  /** 받은 뱃지 수 */
  badgeCount?: number;
}

/** 내 활동 점수 — 나에게만 정확한 값 */
export interface ApiMyActivity {
  score: number;
  hearts: number;
  lv: number;
  level: string;
  nextHeartAt: number | null;
  coins: number;
  coinBand: string | null;
  recent: { label: string; points: number; createdAt: string }[];
}

/** 덕력지도 아바타 핀 — 동의한 이웃의 아바타만 (id·닉네임 없음) */
export interface ApiMapAvatars {
  regionCode: string;
  regionName: string;
  count: number | null;
  belowThreshold: boolean;
  /** 구매 금액 상위 최대 10명 (0번이 1위) */
  avatars: (string | null)[];
  /** 동의자가 적은 지역을 샘플 캐릭터로 채운 블록 */
  isSample: boolean;
  /** avatars와 같은 순서의 이웃 카드 — 카드를 공개하지 않은 이웃은 null */
  cards?: (ApiMapCard | null)[];
}

export interface ApiFandom {
  regionCode: string;
  regionName: string;
  interestId: number;
  interest: string;
  interestType: InterestType;
  count: number | null;
  belowThreshold: boolean;
  isSample: boolean;
}

/** 지역 구매 순위 한 줄 — 금액은 비공개, 닉네임은 공개 동의자만 */
export interface ApiBuyerRank {
  rank: number;
  avatarUrl: string | null;
  nickname: string | null;
}

export interface ApiBuyerRanking {
  regionCode: string;
  belowThreshold: boolean;
  isSample: boolean;
  items: ApiBuyerRank[];
}

export interface ApiFandomRank {
  rank: number;
  interestId: number;
  interest: string;
  interestType: InterestType;
  count: number;
  isSample: boolean;
}

export type TradeKind = "have" | "want" | "sell";
export type TradeCondition = "new" | "like_new" | "used";
export type TradeMethod = "direct" | "delivery" | "both";
export type TradeStatus = "open" | "done" | "hidden";
export type TradeProximity = "same_zone" | "same_district";

export interface TradeInput {
  kind: TradeKind;
  itemName: string;
  productId: number | null;
  interestId: number | null;
  condition: TradeCondition | null;
  price: number | null;
  tradeMethod: TradeMethod;
  content: string;
}

export interface ApiTradePost {
  id: number;
  kind: TradeKind;
  status: TradeStatus;
  itemName: string;
  condition: TradeCondition | null;
  price: number | null;
  tradeMethod: TradeMethod;
  content: string;
  product: ApiProduct | null;
  interest: ApiInterest | null;
  regionCode: string;
  regionName: string;
  isMine: boolean;
  isSample: boolean;
  /** 시연용 데모 이웃의 글 (실제 계정이라 선물 가능) */
  isDemo?: boolean;
  createdAt: string;
  /** 위시맵 닉네임 공개에 동의한 사람의 WANT 글에만 (그 외 null) */
  author?: { nickname: string; avatarUrl: string | null } | null;
  /** 관리자가 운영 정책으로 숨긴 글 — 작성자도 상태를 바꿀 수 없음 */
  hiddenByAdmin?: boolean;
}

/** pending 신청 → accepted 교환 진행 중 → completed 두 사람 모두 받음 (또는 declined·cancelled) */
export type TradeRequestStatus = "pending" | "accepted" | "declined" | "cancelled" | "completed";

/** 유저 간 교환 신청 — post는 받는 사람의 글, offerPost는 신청한 사람이 함께 보낸 내 글 */
export interface ApiTradeRequest {
  id: number;
  status: TradeRequestStatus;
  createdAt: string;
  decidedAt: string | null;
  /** 교환 진행 중 내가 / 상대가 물건을 받았다고 눌렀는지 */
  receivedByMe: boolean;
  receivedByThem: boolean;
  post: ApiTradePost;
  offerPost: ApiTradePost | null;
  /** 내가 보낸 신청이면 true */
  isMine: boolean;
  /** 신청한 사람 — 닉네임 공개 동의자만 */
  requester: { nickname: string; avatarUrl: string | null } | null;
}

export interface ApiTradeMatch {
  want: ApiTradePost;
  offer: ApiTradePost;
  proximity: TradeProximity;
  mutual: boolean;
}

/** 위시맵 지역 블록 하나의 진행 중 WANT 글 수 (하위 지역 포함) */
export interface ApiWishWants { regionCode: string; count: number; images: (string | null)[]; sample: boolean; }

export interface ApiWishMapItem { rank: number; product: ApiProduct; count: number; isSample?: boolean; }

/** 동네 선물 — 상대는 항상 "이웃 플레이어" (닉네임·주소 없음) */
export interface ApiGift {
  id: number;
  box: "sent" | "received";
  status: "pending" | "accepted" | "declined";
  statusLabel: string;
  product: ApiProduct;
  quantity: number;
  totalPrice: number;
  message: string;
  counterpart: string;
  orderId: number | null;
  createdAt: string;
}

/** 닉네임 중복 확인 — 겹치면 지금 쓸 수 있는 추천 닉네임 (최대 3개) */
export interface ApiNicknameCheck { nickname: string; available: boolean; suggestions: string[]; }

/** 구글 확인은 끝났고 닉네임만 고르면 되는 가입 대기 상태 */
export interface ApiSignupPending { email: string; googleName: string; }

/** AI 픽셀 아바타 설정 — 동의 문구의 제공자 이름, 보내기 전 사진 긴 변 */
export interface ApiAiAvatarStatus { enabled: boolean; provider: "cloudflare" | null; providerName: string | null; maxPhotoSide: number; }

/** 알림 — 교환 신청·주문·선물·활동 점수·하트·뱃지 */
export interface ApiNotification {
  id: number;
  kind: string;
  title: string;
  body: string;
  /** 누르면 이동할 사이트 안 경로 */
  href: string | null;
  createdAt: string;
  read: boolean;
}
