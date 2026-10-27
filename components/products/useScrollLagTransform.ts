"use client";

import { useEffect } from "react";

/**
 * 스크롤할 때 약간 늦게 따라오는(렉그/스프링) 느낌 — position: fixed는 항상 같은 자리라 정적으로 보여서,
 * 실제로 움직이진 않지만 스크롤 방향과 반대로 살짝 처졌다가 제자리로 돌아오는 느낌을 transform으로 흉내낸다.
 * React state를 매 프레임 바꾸면 렌더가 너무 잦아지므로, ref가 가리키는 DOM에 직접 translateY만 적용한다.
 * prefers-reduced-motion이면 아예 움직이지 않는다.
 */
export function useScrollLagTransform(ref: React.RefObject<HTMLElement | null>, strength = 0.12) {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const el = ref.current;
    let target = window.scrollY;
    let current = window.scrollY;
    let raf = 0;

    const onScroll = () => { target = window.scrollY; };
    const tick = () => {
      current += (target - current) * strength;
      const lag = target - current;
      if (el) el.style.transform = Math.abs(lag) < 0.05 ? "" : `translateY(${lag}px)`;
      raf = requestAnimationFrame(tick);
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    raf = requestAnimationFrame(tick);
    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(raf);
      if (el) el.style.transform = "";
    };
  }, [ref, strength]);
}
