// Photo skeletons (`.photoSkeleton`, src/Base.scss) shimmer only while a photo loads.
// The animation used to run forever behind loaded photos, so a phone repainted every
// photo on every frame – photos could wobble during a fast horizontal swipe.
// A loaded (or failed) photo gets `data-loaded` and its animation stops; a new `src`
// on the same <img> removes the mark, so the next photo shimmers again while it loads.
const MARK = 'data-loaded';

const isSkeleton = (el) => el instanceof HTMLImageElement && el.classList.contains('photoSkeleton');

const markDone = (event) => {
    if (isSkeleton(event.target)) event.target.setAttribute(MARK, '');
};

export function startPhotoSkeletons() {
    // load / error don't bubble – listen in the capture phase
    document.addEventListener('load', markDone, true);
    document.addEventListener('error', markDone, true);

    new MutationObserver((mutations) => {
        for (const m of mutations) {
            const img = m.target;
            if (!isSkeleton(img) || !img.hasAttribute(MARK)) continue;
            // a cached photo may be complete already, before any load event
            if (!(img.complete && img.naturalWidth)) img.removeAttribute(MARK);
        }
    }).observe(document.documentElement, { subtree: true, attributes: true, attributeFilter: ['src'] });
}
