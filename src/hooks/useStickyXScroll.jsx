import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export function useStickyXScroll({
                                     offsetBottom = 0,
                                     trackHeight  = 14,
                                     zIndex       = 60,
                                 } = {}) {
    const mainElRef  = useRef(null);
    const ghostElRef = useRef(null);

    const [sizes, setSizes] = useState({ scrollWidth: 0, clientWidth: 0 });

    // запобігаємо фідбек-лупу між скролами
    const syncingRef = useRef(false);

    // RAF-фолбек: примусова синхронізація під час drag/взаємодії
    const rafIdRef = useRef(0);
    const forceSyncLoop = useCallback(() => {
        cancelAnimationFrame(rafIdRef.current);
        const tick = () => {
            const main = mainElRef.current;
            const ghost = ghostElRef.current;
            if (!main || !ghost) return;
            if (!syncingRef.current) {
                syncingRef.current = true;
                main.scrollLeft = ghost.scrollLeft;
                syncingRef.current = false;
            }
            rafIdRef.current = requestAnimationFrame(tick);
        };
        rafIdRef.current = requestAnimationFrame(tick);
    }, []);
    const stopForceSync = useCallback(() => {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = 0;
    }, []);

    const readSizes = useCallback(() => {
        const el = mainElRef.current;
        if (!el) return;
        requestAnimationFrame(() => {
            setSizes(prev => {
                const next = { scrollWidth: el.scrollWidth, clientWidth: el.clientWidth };
                return (next.scrollWidth === prev.scrollWidth && next.clientWidth === prev.clientWidth)
                    ? prev : next;
            });
        });
    }, []);

    const recalcX = useCallback(() => {
        readSizes();
    }, [readSizes]);

    const handleMainScroll = useCallback(() => {
        const main  = mainElRef.current;
        const ghost = ghostElRef.current;
        if (!main || !ghost) return;
        if (syncingRef.current) return;
        syncingRef.current = true;
        ghost.scrollLeft = main.scrollLeft;
        syncingRef.current = false;
    }, []);

    const handleGhostScroll = useCallback(() => {
        const main  = mainElRef.current;
        const ghost = ghostElRef.current;
        if (!main || !ghost) return;
        if (syncingRef.current) return;
        syncingRef.current = true;
        main.scrollLeft = ghost.scrollLeft;
        syncingRef.current = false;
    }, []);

    // вертикальне колесо → горизонтальний скрол (Firefox/Win)
    const handleGhostWheel = useCallback((e) => {
        const ghost = ghostElRef.current;
        if (!ghost) return;
        const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
        if (delta !== 0) {
            e.preventDefault();                // потрібен {passive:false}
            ghost.scrollLeft += delta;
            handleGhostScroll();               // ручна синхронізація
        }
    }, [handleGhostScroll]);

    // callback-ref для основного скролера
    const mainRef = useCallback((el) => {
        if (mainElRef.current === el) return;
        if (mainElRef.current) {
            mainElRef.current.removeEventListener("scroll", handleMainScroll);
        }
        mainElRef.current = el;
        if (el) {
            // критично: саме цей елемент має мати overflow-x:auto
            el.addEventListener("scroll", handleMainScroll, { passive: true });
            readSizes();
        }
    }, [handleMainScroll, readSizes]);

    // RO + resize (тепер ще й за контентом спостерігаємо)
    useEffect(() => {
        const el = mainElRef.current;
        if (!el) return;

        readSizes();

        const roMain = new ResizeObserver(readSizes);
        roMain.observe(el);

        let roContent;
        const content = el.firstElementChild;
        if (content) {
            roContent = new ResizeObserver(readSizes);
            roContent.observe(content);
        }

        window.addEventListener("resize", readSizes);

        return () => {
            roMain.disconnect();
            if (roContent) roContent.disconnect();
            window.removeEventListener("resize", readSizes);
        };
    }, [readSizes]);

    // слухачі для ghost + drag/hover RAF fallback
    useEffect(() => {
        const main  = mainElRef.current;
        const ghost = ghostElRef.current;
        if (!main || !ghost) return;

        ghost.scrollLeft = main.scrollLeft;

        const start = () => forceSyncLoop();
        const end   = () => stopForceSync();

        ghost.addEventListener("scroll",  handleGhostScroll, { passive: true });
        ghost.addEventListener("wheel",   handleGhostWheel,  { passive: false });
        ghost.addEventListener("pointerdown", start);
        ghost.addEventListener("pointerenter", start);
        ghost.addEventListener("pointerup",    end);
        ghost.addEventListener("pointerleave", end);
        window.addEventListener("blur", end);

        return () => {
            ghost.removeEventListener("scroll",  handleGhostScroll);
            ghost.removeEventListener("wheel",   handleGhostWheel);
            ghost.removeEventListener("pointerdown", start);
            ghost.removeEventListener("pointerenter", start);
            ghost.removeEventListener("pointerup",    end);
            ghost.removeEventListener("pointerleave", end);
            window.removeEventListener("blur", end);
            stopForceSync();
        };
    }, [sizes.scrollWidth, sizes.clientWidth, handleGhostScroll, handleGhostWheel, forceSyncLoop, stopForceSync]);

    // якщо змінився offsetBottom (з’явилась/зникла плашка) — ресинхронізуємо негайно
    useEffect(() => {
        const main  = mainElRef.current;
        const ghost = ghostElRef.current;
        if (main && ghost) {
            ghost.scrollLeft = main.scrollLeft;
        }
        readSizes();
    }, [offsetBottom, readSizes]);

    const stickyWrapStyle = useMemo(() => ({
        position: "sticky",
        bottom: offsetBottom,
        zIndex,
        height: trackHeight,
        background: "transparent",
        pointerEvents: "auto",
    }), [offsetBottom, trackHeight, zIndex]);

    const ghostStyle = useMemo(() => ({
        height: "100%",
        overflowX: "auto",
        overflowY: "hidden",
        scrollbarGutter: "stable both-edges",
        overscrollBehaviorX: "contain",
    }), []);

    const StickyBar = useCallback(() => {
        const { scrollWidth, clientWidth } = sizes;
        const show = scrollWidth > clientWidth && clientWidth > 0;
        if (!show) return null;
        return (
            <div style={stickyWrapStyle} aria-hidden>
                <div ref={ghostElRef} style={ghostStyle}>
                    <div style={{ width: scrollWidth, height: 1 }} />
                </div>
            </div>
        );
    }, [sizes, stickyWrapStyle, ghostStyle]);

    return { mainRef, StickyBar, recalcX };
}
