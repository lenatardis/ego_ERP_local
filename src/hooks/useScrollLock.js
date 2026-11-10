import { useEffect } from "react";

// Demo build: the page behind an open panel (filter, mobile menu) doesn't scroll.
// Several panels may lock at once, so the lock is counted; it lives in a class on <html>
// (`scrollLocked` in Base.scss), independent of the popups' inline `body.style.overflow`.
let locks = 0;

const lock = () => {
    const root = document.documentElement;
    if (locks === 0) {
        // keep the scrollbar's space only if the page had a scrollbar, so nothing shifts sideways
        root.classList.toggle("scrollLockedGutter", window.innerWidth > root.clientWidth);
        root.classList.add("scrollLocked");
    }
    locks += 1;
};

const unlock = () => {
    locks = Math.max(0, locks - 1);
    if (locks === 0) {
        document.documentElement.classList.remove("scrollLocked", "scrollLockedGutter");
    }
};

const useScrollLock = (active) => {
    useEffect(() => {
        if (!active) return undefined;
        lock();
        return unlock;
    }, [active]);
};

export default useScrollLock;
