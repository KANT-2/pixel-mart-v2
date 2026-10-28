import type { ApiReview } from "@/types/api";
import type { ReactNode } from "react";
import { formatDate } from "@/utils/formatDate";

interface ReviewEntriesProps { items: ApiReview[]; actions?: (review: ApiReview) => ReactNode; }

export default function ReviewEntries({ items, actions }: ReviewEntriesProps) {
  return <ul aria-label="상품 리뷰 목록" className="divide-y divide-line pixel-panel px-5 sm:px-6">
    {items.map((review) => <li key={review.id} className="min-w-0 py-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p aria-label={`별점 5점 만점에 ${review.rating}점`} className="font-pixel text-lg text-lime"><span aria-hidden="true">{"★".repeat(review.rating)}<span className="text-dim">{"☆".repeat(5 - review.rating)}</span></span></p>
        <time dateTime={review.createdAt} className="text-xs text-dim">{formatDate(review.createdAt)}</time>
      </div>
      <p className="mt-3 break-words text-sm font-bold">{review.nickname}</p>
      <p className="mt-3 whitespace-pre-line break-words text-sm leading-relaxed text-sub">{review.content}</p>
      {review.imageUrls && review.imageUrls.length > 0 && <ul aria-label="리뷰 사진" className="mt-3 flex flex-wrap gap-2">
        {review.imageUrls.map((url, index) => <li key={index}>
          {/* eslint-disable-next-line @next/next/no-img-element -- 리뷰 사진은 서버가 준 작은 data URL */}
          <img src={url} alt={`${review.nickname}님의 리뷰 사진 ${index + 1}`} loading="lazy" className="size-24 rounded-lg border border-line object-cover sm:size-32" />
        </li>)}
      </ul>}
      {review.reply && <div className="mt-4 border-l-2 border-mint bg-panel-2 p-4">
        <p className="mb-2 text-xs font-bold text-mint">판매자 답글{review.repliedAt && <time dateTime={review.repliedAt} className="ml-2 font-normal text-dim">{formatDate(review.repliedAt)}</time>}</p>
        <p className="whitespace-pre-line break-words text-sm leading-relaxed text-sub">{review.reply}</p>
      </div>}
      {actions?.(review)}
    </li>)}
  </ul>;
}
