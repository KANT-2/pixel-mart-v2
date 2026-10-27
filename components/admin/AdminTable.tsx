import type { ReactNode } from "react"; // 열 안에 뭐든 그릴 수 있게 ReactNode를 쓴다
import EmptyRow from "@/components/admin/EmptyRow"; // 행이 없을 때 보여줄 기본 빈 상태

// 표 한 칸(열)의 모양 — 다른 화면(문의·신고 등)도 이 모양만 맞추면 그대로 쓸 수 있다
export interface AdminTableColumn<T> {
  header: string; // 맨 위 제목 글자
  align?: "left" | "right"; // 글자 정렬 (기본 왼쪽)
  className?: string; // 칸에 더 줄 클래스 (너비 등)
  render: (row: T) => ReactNode; // 이 행에서 이 칸에 무엇을 그릴지
}

interface AdminTableProps<T> {
  columns: AdminTableColumn<T>[]; // 열 목록
  rows: T[]; // 보여줄 행 목록
  rowKey: (row: T) => string | number; // React가 행을 구분할 고유 값
  empty?: ReactNode; // 행이 없을 때 보여줄 내용 (안 넘기면 기본 EmptyRow)
  mobileCards?: boolean; // true면 sm 미만(375px 등)에서 가로 스크롤 표 대신 "제목: 값" 카드로 보여준다
}

// 관리자 화면 공용 표 — 주문 말고 다른 목록(문의·신고 등)도 columns만 바꿔서 그대로 쓸 수 있게 범용으로 만든다
export default function AdminTable<T>({ columns, rows, rowKey, empty, mobileCards = false }: AdminTableProps<T>) {
  const table = (
    <div className="overflow-x-auto"> {/* 좁은 화면에서 표가 넘치면 가로로만 스크롤되게 */}
      <table className="w-full min-w-[640px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-line text-left text-xs text-dim">
            {columns.map((column) => (
              <th key={column.header} className={`px-3 py-2 font-bold ${column.align === "right" ? "text-right" : "text-left"} ${column.className ?? ""}`}>
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0
            ? (empty ?? <EmptyRow colSpan={columns.length} message="표시할 항목이 없어요." />) // 비어 있으면 기본 안내
            : rows.map((row) => (
              <tr key={rowKey(row)} className="border-b border-line/60">
                {columns.map((column) => (
                  <td key={column.header} className={`px-3 py-3 align-middle ${column.align === "right" ? "text-right" : "text-left"} ${column.className ?? ""}`}>
                    {column.render(row)}
                  </td>
                ))}
              </tr>
            ))}
        </tbody>
      </table>
    </div>
  );
  // 빈 상태는 표의 EmptyRow를 그대로 쓰고, 행이 있을 때만 좁은 화면에서 카드로 바꾼다
  if (!mobileCards || rows.length === 0) return table;
  return (
    <>
      <div className="hidden sm:block">{table}</div>
      <ul className="space-y-3 sm:hidden">
        {rows.map((row) => (
          <li key={rowKey(row)} className="pixel-panel p-3">
            <dl className="grid grid-cols-[4.5rem_minmax(0,1fr)] items-center gap-x-3 gap-y-2 text-sm">
              {columns.map((column) => (
                <div key={column.header} className="contents">
                  <dt className="text-xs text-dim">{column.header}</dt>
                  <dd className="min-w-0 break-words">{column.render(row)}</dd>
                </div>
              ))}
            </dl>
          </li>
        ))}
      </ul>
    </>
  );
}
