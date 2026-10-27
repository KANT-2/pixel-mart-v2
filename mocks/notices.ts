// mocks/notices.ts — 공지 API(#95)가 없는 동안 쓰는 가짜 서버.
// 모듈 스코프 배열을 lib/notices.ts(관리자용·손님용 둘 다)가 같이 읽고 써서,
// 관리자가 만들고 숨긴 내용이 같은 브라우저 탭 안에서는 손님 화면에도 바로 반영된다.
// 새로고침하면 초기화된다 — 실제 API가 생기면 이 파일은 통째로 걷어낸다.
import { ApiError } from "@/lib/api";
import type { Notice, NoticeCreateInput, NoticeUpdateInput } from "@/types/notice";

const wait = (ms = 200) => new Promise((resolve) => setTimeout(resolve, ms)); // 진짜 서버처럼 잠깐 기다린다

let notices: Notice[] = [
  { id: 4, title: "[이벤트] 핼러윈 한정 키캡 입고", content: "핼러윈 한정 키캡이 입고됐어요!\n재고가 많지 않으니 서둘러 주세요.", isPinned: true, isPublished: true, createdAt: "2026-10-26T09:00:00Z", updatedAt: "2026-10-26T09:00:00Z" },
  { id: 3, title: "배송 지연 안내 (10/27 ~ 10/29)", content: "물류센터 점검으로 배송이 1~2일 지연될 수 있어요.\n양해 부탁드립니다.", isPinned: true, isPublished: true, createdAt: "2026-10-25T09:00:00Z", updatedAt: "2026-10-25T09:00:00Z" },
  { id: 2, title: "[이벤트] 첫 구매 1,000P 지급", content: "처음 주문하시는 모든 분께 1,000포인트를 드려요.", isPinned: false, isPublished: true, createdAt: "2026-10-20T09:00:00Z", updatedAt: "2026-10-20T09:00:00Z" },
  { id: 1, title: "개인정보처리방침 개정 안내", content: "개인정보처리방침이 일부 개정됩니다.\n자세한 내용은 고객센터로 문의해 주세요.", isPinned: false, isPublished: false, createdAt: "2026-10-12T09:00:00Z", updatedAt: "2026-10-12T09:00:00Z" },
];
let nextId = 5;

function find(id: number): Notice {
  const notice = notices.find((item) => item.id === id);
  if (!notice) throw new ApiError("공지를 찾을 수 없어요.", 404);
  return notice;
}

// ---------- 관리자용 ----------
export async function listAll(): Promise<Notice[]> {
  await wait();
  return [...notices];
}

export async function create(input: NoticeCreateInput): Promise<Notice> {
  await wait();
  const now = new Date().toISOString();
  const notice: Notice = { id: nextId++, ...input, createdAt: now, updatedAt: now };
  notices = [notice, ...notices];
  return notice;
}

export async function update(id: number, changes: NoticeUpdateInput): Promise<Notice> {
  await wait();
  const target = find(id); // 없으면 404
  const updated: Notice = { ...target, ...changes, updatedAt: new Date().toISOString() };
  notices = notices.map((notice) => (notice.id === id ? updated : notice));
  return updated;
}

export async function remove(id: number): Promise<void> {
  await wait();
  find(id); // 없으면 404
  notices = notices.filter((notice) => notice.id !== id);
}

// ---------- 손님용 ----------
export async function listPublished(): Promise<Notice[]> {
  await wait();
  return notices.filter((notice) => notice.isPublished);
}

export async function getPublished(id: number): Promise<Notice> {
  await wait();
  const notice = notices.find((item) => item.id === id && item.isPublished);
  if (!notice) throw new ApiError("공지를 찾을 수 없어요.", 404);
  return notice;
}
