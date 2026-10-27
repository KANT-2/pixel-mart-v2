import type { Metadata } from "next";
import LegalDocument, { type LegalSection } from "@/components/help/LegalDocument";

export const metadata: Metadata = {
  title: "개인정보처리방침 | PIXEL MART",
  description: "PIXEL MART가 모으는 정보와 쓰는 곳, 보관 기간, 외부 서비스(구글 로그인 · AI 아바타) 안내",
};

const SECTIONS: LegalSection[] = [
  {
    title: "모으는 정보",
    items: [
      "가입: 이메일, 닉네임, 비밀번호(복원할 수 없는 해시로만 저장).",
      "구글 로그인: 구글이 알려 주는 이메일·이름(닉네임을 정할 때만 사용).",
      "주문: 받는 사람 이름, 연락처, 배송지 주소.",
      "선택: 아바타 이미지, PIXEL LOCAL 지역(동 단위)·관심사, 거래글.",
    ],
  },
  {
    title: "쓰는 곳",
    items: [
      "로그인 확인, 주문 처리와 배송 단계 안내, 상품 문의 답변 알림, 고객 문의 응대에만 써요.",
      "다른 회원에게는 닉네임·아바타처럼 본인이 공개한 정보만 보여요. 비밀 문의 내용은 작성자와 관리자만 봐요.",
      "PIXEL LOCAL의 지역별 관심 상품은 개인을 알 수 없게 익명으로 모아서 보여 줘요.",
    ],
  },
  {
    title: "로그인 정보(쿠키)",
    items: [
      "로그인하면 브라우저에 로그인 쿠키(pm_session)가 저장되고, 최대 7일 동안 유지돼요.",
      "로그아웃하면 쿠키를 지우고, 그 로그인 정보는 서버에서도 바로 쓸 수 없게 막아요.",
      "최근 본 아이템은 서버가 아니라 내 브라우저에만 저장돼요.",
    ],
  },
  {
    title: "외부 서비스",
    items: [
      "구글 로그인을 고르면 구글을 통해 로그인해요.",
      "AI 픽셀 아바타는 사진 전송에 동의한 경우에만 사진을 Cloudflare Workers AI로 한 번 보내 픽셀아트를 만들고, 원본 사진은 저장하지 않아요.",
    ],
  },
  {
    title: "보관과 삭제",
    items: [
      "회원 정보는 계정이 있는 동안 보관해요.",
      "주문·문의 기록은 거래 확인을 위해 보관하며, 답변이 달린 문의는 대화 기록으로 남아요.",
      "삭제를 원하면 고객센터로 알려 주세요.",
    ],
  },
  {
    title: "내 정보 확인과 수정",
    items: ["마이페이지에서 닉네임·아바타와 주문 내역을 확인하고 바꿀 수 있어요."],
  },
];

export default function PrivacyPage() {
  return <LegalDocument kicker="PRIVACY" title="개인정보처리방침" intro="PIXEL MART가 어떤 정보를 왜 모으고 어떻게 다루는지 알려 드려요."
    updated="2026.10.27" sections={SECTIONS} other={{ href: "/terms", label: "이용약관" }} />;
}
