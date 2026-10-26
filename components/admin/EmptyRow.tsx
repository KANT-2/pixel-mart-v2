interface EmptyRowAction {
  label: string; // 버튼 글자 (예: "필터 초기화")
  onClick: () => void; // 눌렀을 때 할 일
}

interface EmptyRowProps {
  colSpan: number; // 표의 전체 열 수만큼 칸을 합쳐야 가운데 정렬이 된다
  message: string; // 보여줄 안내 문구
  action?: EmptyRowAction; // 선택적 버튼 (없으면 문구만)
}

// 표 안에 들어가는 공용 빈 상태 한 줄 — AdminTable이 rows가 없을 때 기본으로 쓰고, 다른 화면도 직접 가져다 쓸 수 있다
export default function EmptyRow({ colSpan, message, action }: EmptyRowProps) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-3 py-12 text-center">
        <p className="text-sm text-sub">{message}</p>
        {action && (
          <button type="button" onClick={action.onClick} className="btn-pixel mt-4 min-h-11 px-4 text-sm font-bold">
            {action.label}
          </button>
        )}
      </td>
    </tr>
  );
}
