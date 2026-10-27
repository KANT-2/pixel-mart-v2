import type { Metadata } from "next";
import PageHeader from "@/components/PageHeader";
import BadgeBook from "@/components/profile/BadgeBook";
import QuestActivity from "@/components/quests/QuestActivity";
import TutorialQuestList from "@/components/quests/TutorialQuestList";

export const metadata: Metadata = { title: "퀘스트 · 뱃지 | PIXEL MART" };

// 퀘스트를 깨면 뱃지를 받으니 한 화면에 — 마이페이지는 메뉴만 남긴다
export default function QuestsPage() {
  return <section className="mx-auto max-w-5xl px-4 py-10 md:px-8 md:py-14">
    <PageHeader back={{ href: "/mypage", label: "마이페이지" }} kicker="PIXEL QUEST" title="퀘스트 · 뱃지"
      description="퀘스트를 깨면 뱃지와 적립금을 받아요. 받은 뱃지 하나를 대표로 골라 이웃 카드에 보여 줄 수 있어요." />
    <TutorialQuestList />
    <QuestActivity />
    <div className="mt-8"><BadgeBook /></div>
  </section>;
}
