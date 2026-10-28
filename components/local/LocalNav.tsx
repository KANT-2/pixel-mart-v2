"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useLocalProfile } from "@/components/local/LocalProvider";
import PixelIcon from "@/components/PixelIcon";
import LocalActivityMenu from "@/components/local/LocalActivityMenu";

const links: { href: string; label: string; icon?: "gift" }[] = [{ href: "/local", label: "덕력지도" }, { href: "/local/trades", label: "거래·교환" }, { href: "/local/wish-map", label: "위시맵", icon: "gift" as const }]; // 위시맵은 선물 아이콘 (하트는 찜과 헷갈려서)
interface LocalNavLinksProps { pathname?: string; region?: string | null; withActivity?: boolean; }
function LocalNavLinks({ pathname, region, withActivity = false }: LocalNavLinksProps) {
  // 탭은 넘치면 가로로 밀고, "내 활동" 메뉴는 잘리지 않게 스크롤 밖 오른쪽에 둔다
  return <div className="mx-auto flex max-w-6xl items-start gap-1.5 px-4 sm:gap-2 pt-3 md:px-8 md:pt-6"><nav aria-label="PIXEL LOCAL 메뉴" className="flex min-w-0 flex-1 gap-1.5 overflow-x-auto sm:gap-2">
    {links.map((item) => <Link key={item.href} href={`${item.href}${region !== undefined ? `?region=${encodeURIComponent(region ?? "")}` : ""}`}
      aria-current={pathname === item.href || (item.href === "/local/trades" && pathname?.startsWith("/local/trades/")) ? "page" : undefined}
      onFocus={(event) => event.currentTarget.scrollIntoView({ block: "nearest", inline: "nearest" })}
      className="inline-flex shrink-0 items-center rounded-lg border border-line px-2.5 py-3 text-sm sm:px-4 font-semibold text-sub hover:text-ink aria-[current=page]:border-mint/50 aria-[current=page]:bg-panel aria-[current=page]:text-mint focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-mint">{item.icon && <PixelIcon name={item.icon} className="mr-1.5 size-4" />}{item.label}</Link>)}
  </nav>{withActivity && <LocalActivityMenu />}</div>;
}
export function LocalNavFallback() { return <LocalNavLinks />; }
export default function LocalNav() {
  const pathname = usePathname(), params = useSearchParams(), profile = useLocalProfile();
  return <LocalNavLinks pathname={pathname} region={params.has("region") ? params.get("region") : profile.data?.region?.code} withActivity />;
}
