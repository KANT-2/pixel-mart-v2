import ReturnsScreen from "@/app/admin/returns/ReturnsScreen";

// 관리자만 보는 데이터라 전부 ReturnsScreen(클라이언트)에서 불러온다
export default function AdminReturnsPage() {
  return <ReturnsScreen />;
}
