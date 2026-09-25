// guards/useUnsavedChangesGuard.js
import { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useUnsavedCtx } from './UnsavedChangesContext';

/**
 * ⚙️ Поведінка:
 * - beforeunload (закриття вкладки / перезавантаження): системний нативний діалог браузера.
 * - Внутрішні посилання та Back/Forward: нативний window.confirm з 2 кнопками (ОК/Скасувати).
 * - ЖОДНИХ автозбережень: користувач сам зберігає вручну.
 *
 * Якщо дуже потрібно примусово викликати системний beforeunload навіть при кліку по внутрішньому лінку,
 * постав HARD_LEAVE_ON_LINK = true — тоді навігація піде через window.location.href (повний reload).
 */
const HARD_LEAVE_ON_LINK = false;

/** Нативний confirm з двома кнопками. Повертає true → «піти без збереження», false → «скасувати». */
function askUserConfirm(count) {
    return window.confirm(
        `Ви внесли зміни у ${count} запис(ах).\n` +
        `Якщо ви перейдете на іншу сторінку без збереження, вони будуть втрачені.`
    );
}

/* ── простий блокуючий оверлей (щоб було видно, що відбувається навігація) ── */
function showBlockingOverlay(text = 'Переходимо…') {
    const id = '__unsaved_guard_overlay__';
    if (document.getElementById(id)) return () => {};
    const el = document.createElement('div');
    el.id = id;
    Object.assign(el.style, {
        position: 'fixed', inset: '0', background: 'rgba(255,255,255,0.6)',
        display: 'grid', placeItems: 'center', zIndex: 99999, backdropFilter: 'blur(2px)',
        fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Arial', color: '#222',
        fontSize: '16px'
    });
    const box = document.createElement('div');
    Object.assign(box.style, {
        padding: '16px 20px', borderRadius: '12px', border: '1px solid #dcd7e6',
        background: '#fff', boxShadow: '0 8px 28px rgba(0,0,0,0.12)', display: 'flex', gap: '10px', alignItems: 'center'
    });
    const spinner = document.createElement('div');
    Object.assign(spinner.style, {
        width: '16px', height: '16px', borderRadius: '50%',
        border: '2px solid #ddd', borderTopColor: '#573971', animation: 'spin 1s linear infinite'
    });
    const style = document.createElement('style');
    style.textContent = '@keyframes spin{to{transform:rotate(360deg)}}';
    const label = document.createElement('span'); label.textContent = text;
    box.appendChild(spinner); box.appendChild(label);
    el.appendChild(style); el.appendChild(box);
    document.body.appendChild(el);
    return () => { try { document.body.removeChild(el); } catch {} };
}

export function useUnsavedChangesGuard() {
    const { dirtyCount, setDirtyCount } = useUnsavedCtx();
    const shouldBlock = dirtyCount > 0;

    const navigate = useNavigate();
    const location = useLocation();

    // один «буферний» запис в history (щоб перехоплювати Back/Forward)
    const sentinelAddedRef = useRef(false);
    // тимчасове вимкнення перехоплення під час наших власних переходів
    const guardDisabledRef = useRef(false);
    // щоб не показувати діалог двічі
    const promptingRef = useRef(false);

    /** 1) Захист від закриття/перезавантаження (нативний системний діалог) */
    useEffect(() => {
        if (!shouldBlock) return;
        const onBeforeUnload = (e) => { e.preventDefault(); e.returnValue = ''; };
        window.addEventListener('beforeunload', onBeforeUnload);
        return () => window.removeEventListener('beforeunload', onBeforeUnload);
    }, [shouldBlock]);

    /** допоміжне: поставити «буфер» у history (один раз) */
    const pushSentinel = () => {
        if (sentinelAddedRef.current) return;
        try {
            window.history.pushState({ __unsaved_buffer__: true, t: Date.now() }, '', window.location.href);
            sentinelAddedRef.current = true;
        } catch {}
    };

    /** 2) Перехоплення внутрішніх <a>/<Link> — нативний confirm (без автозбереження) */
    useEffect(() => {
        if (!shouldBlock) return;

        const onClick = (e) => {
            if (guardDisabledRef.current) return;

            // шукаємо найближчий <a href>
            const a = e.target?.closest?.('a[href]');
            if (!a) return;

            const href = a.getAttribute('href') || '';
            // зовнішні посилання та target=_blank не чіпаємо
            const isExternal = /^https?:\/\//i.test(href) || a.target === '_blank';
            if (isExternal) return;

            // React Router Link зазвичай рендерить <a href="..."> — перехоплюємо
            e.preventDefault();
            if (promptingRef.current) return;
            promptingRef.current = true;

            const ok = askUserConfirm(dirtyCount); // true → піти без збереження
            if (!ok) { // Скасувати
                promptingRef.current = false;
                return;
            }

            guardDisabledRef.current = true;
            const hide = showBlockingOverlay('Переходимо…');
            try {
                setDirtyCount(0);
                if (HARD_LEAVE_ON_LINK) {
                    // повний reload → системний beforeunload спрацює як при звичайному виході
                    window.location.href = href;
                } else {
                    // SPA-навігація (без reload)
                    navigate(href);
                }
            } finally {
                setTimeout(() => { guardDisabledRef.current = false; }, 0);
                hide();
                promptingRef.current = false;
            }
        };

        document.addEventListener('click', onClick, true);
        return () => document.removeEventListener('click', onClick, true);
    }, [shouldBlock, dirtyCount, navigate, setDirtyCount]);

    /** 3) Back/Forward: “push once → repush → confirm → (за потреби) real back” */
    useEffect(() => {
        if (shouldBlock) {
            pushSentinel();
        } else {
            sentinelAddedRef.current = false;
        }

        const onPopState = () => {
            if (guardDisabledRef.current) return;
            if (!shouldBlock) return;

            // миттєво відновлюємо буфер (скасовуємо цей Back)
            pushSentinel();

            if (promptingRef.current) return;
            promptingRef.current = true;

            setTimeout(() => {
                const ok = askUserConfirm(dirtyCount);
                if (!ok) { // залишаємося
                    promptingRef.current = false;
                    return;
                }

                guardDisabledRef.current = true;
                const hide = showBlockingOverlay('Переходимо…');
                try {
                    setDirtyCount(0);
                    sentinelAddedRef.current = false;
                    window.history.back(); // тепер реальний крок назад
                } finally {
                    setTimeout(() => { guardDisabledRef.current = false; }, 0);
                    hide();
                    promptingRef.current = false;
                }
            }, 0);
        };

        window.addEventListener('popstate', onPopState);
        return () => {
            window.removeEventListener('popstate', onPopState);
        };
    }, [shouldBlock, dirtyCount, setDirtyCount, location.key]);
}
