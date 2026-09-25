// CustomLoadSelect.jsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FormControl, Select, MenuItem, CircularProgress } from "@mui/material";
import { styled } from "@mui/material/styles";

const StyledFormControl = styled(FormControl)(() => ({
    width: "100%",
    backgroundColor: "#C5A9DE",
    borderRadius: "4px",
    height: "40px",
    justifyContent: "center",
    ".MuiOutlinedInput-root": {
        backgroundColor: "#C5A9DE",
        borderRadius: "4px",
        height: "40px",
        padding: "0 12px",
        "& fieldset": { border: "none" },
        "& .MuiSelect-select": {
            padding: "0",
            display: "flex",
            alignItems: "center",
            height: "40px",
            fontSize: "14px",
            fontFamily: "Inter",
            fontStyle: "normal",
            lineHeight: "16px",
            color: "#201827",
        },
        "& svg": { width: "26px", height: "26px" },
    },
}));

const StyledMenuItem = styled(MenuItem)(() => ({
    height: "40px",
    backgroundColor: "#FFFFFF",
    fontSize: "14px",
    fontFamily: "Inter",
    fontStyle: "normal",
    lineHeight: "16px",
    color: "#201827",
    borderTop: "1px solid #C5A9DE",
    "&.Mui-selected": { backgroundColor: "#E6D3F3" },
    "&.Mui-selected:hover": { backgroundColor: "#dcc3f0" },
    "&:hover": { backgroundColor: "#f1e8fc" },
    "& em": { fontStyle: "normal", color: "#201827" },
}));

/**
 * fetchPage: async ({ page, page_size }) => ({ options: [{value, name}], totalPages })
 */
const CustomLoadSelect = ({
                              value,
                              onChange,
                              label,
                              fetchPage,
                              pageSize = 25,
                              prependOptions = [],
                              menuMaxHeight = 340,
                              prefetchMinItems = 0, // <- нове: скільки елементів підтягнути одразу при відкритті
                          }) => {
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(false);

    // refs для синхронного контролю пагінації (щоб цикли працювали стабільно)
    const pageRef = useRef(0); // 0 = ще не вантажили
    const totalPagesRef = useRef(null); // null = невідомо
    const itemsRef = useRef([]);
    const isFetchingRef = useRef(false);
    const ensuredValueRef = useRef(null);

    const mergedOptions = useMemo(() => {
        const map = new Map();
        for (const o of [...prependOptions, ...items]) {
            const k = String(o?.value ?? "");
            if (!map.has(k)) map.set(k, o);
        }
        return Array.from(map.values());
    }, [prependOptions, items]);

    const findOptionByValue = useCallback(
        (val) => {
            const str = String(val ?? "");
            // prependOptions + itemsRef (щоб працювало ще до setState)
            for (const o of prependOptions) {
                if (String(o?.value ?? "") === str) return o;
            }
            for (const o of itemsRef.current) {
                if (String(o?.value ?? "") === str) return o;
            }
            return null;
        },
        [prependOptions]
    );

    const hasMore = useCallback(() => {
        if (totalPagesRef.current == null) return true;
        return pageRef.current < totalPagesRef.current;
    }, []);

    const commitItems = useCallback(() => {
        setItems([...itemsRef.current]);
    }, []);

    const loadPage = useCallback(
        async (nextPage, { reset = false } = {}) => {
            if (isFetchingRef.current) return;

            if (reset) {
                pageRef.current = 0;
                totalPagesRef.current = null;
                itemsRef.current = [];
                setItems([]);
            } else {
                if (!hasMore()) return;
            }

            isFetchingRef.current = true;
            setLoading(true);

            try {
                const res = await fetchPage({ page: nextPage, page_size: pageSize });
                const nextOptions = Array.isArray(res?.options) ? res.options : [];
                const nextTotal = Number(res?.totalPages);

                // merge/dedup
                const map = new Map(itemsRef.current.map((x) => [String(x.value), x]));
                for (const o of nextOptions) {
                    map.set(String(o.value), o);
                }
                itemsRef.current = Array.from(map.values());

                pageRef.current = nextPage;
                if (Number.isFinite(nextTotal) && nextTotal > 0) {
                    totalPagesRef.current = nextTotal;
                }

                commitItems();
            } catch (e) {
                console.error("CustomLoadSelect: loadPage failed", e);
            } finally {
                setLoading(false);
                isFetchingRef.current = false;
            }
        },
        [fetchPage, pageSize, hasMore, commitItems]
    );

    const prefetch = useCallback(async () => {
        const min = Number(prefetchMinItems) || 0;
        if (min <= 0) return;

        // гарантуємо першу сторінку
        if (pageRef.current === 0) {
            await loadPage(1, { reset: true });
        }

        // догружаємо поки не наберемо min (без prependOptions)
        while (itemsRef.current.length < min && hasMore()) {
            await loadPage(pageRef.current + 1);
        }
    }, [prefetchMinItems, loadPage, hasMore]);

    const ensureSelectedVisible = useCallback(async () => {
        const v = value;
        if (v == null || String(v) === "") return;

        const key = String(v);
        if (ensuredValueRef.current === key) return; // вже пробували
        if (findOptionByValue(key)) return; // вже є

        ensuredValueRef.current = key;

        // Мінімум: підтягнути prefetchMinItems (щоб одразу було хоч щось)
        await prefetch();

        // Якщо value досі не знайдено — догружаємо сторінки, доки не знайдемо або не закінчаться
        let safety = 0;
        while (!findOptionByValue(key) && hasMore() && safety < 200) {
            safety += 1;
            await loadPage(pageRef.current + 1);
        }
    }, [value, findOptionByValue, prefetch, hasMore, loadPage]);

    const handleOpen = useCallback(async () => {
        // перше відкриття — тягнемо сторінку 1 і робимо prefetch
        if (pageRef.current === 0 && itemsRef.current.length === 0) {
            await loadPage(1, { reset: true });
        }
        await prefetch();
    }, [loadPage, prefetch]);

    const handleScroll = useCallback(
        (e) => {
            if (loading) return;
            if (!hasMore()) return;

            const el = e.currentTarget; // MenuList (ul)
            const nearBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 16;

            if (nearBottom) {
                loadPage(pageRef.current + 1);
            }
        },
        [loading, hasMore, loadPage]
    );

    // Щоб в EDIT одразу показувало назву (а не id) навіть до відкриття
    useEffect(() => {
        ensureSelectedVisible();
    }, [ensureSelectedVisible]);

    const renderValue = useCallback(
        (selected) => {
            const selectedStr = String(selected ?? "");
            const opt = mergedOptions.find((o) => String(o.value ?? "") === selectedStr);

            if (selectedStr === "" && !opt) {
                return <em style={{ fontStyle: "normal" }}>{label}</em>;
            }

            return opt?.name ?? selectedStr;
        },
        [mergedOptions, label]
    );

    return (
        <StyledFormControl>
            <Select
                value={value}
                onChange={onChange}
                displayEmpty
                renderValue={renderValue}
                onOpen={handleOpen}
                inputProps={{ "aria-label": label }}
                MenuProps={{
                    PaperProps: {
                        sx: {
                            maxHeight: `${menuMaxHeight}px`,
                            overflow: "hidden",
                            "& .MuiMenu-list": {
                                display: "block",
                                rowGap: 0,
                                gap: 0,
                                paddingTop: 0,
                                paddingBottom: 0,
                            },
                        },
                    },
                    MenuListProps: {
                        onScroll: handleScroll,
                        sx: {
                            maxHeight: `${menuMaxHeight}px`,
                            overflowY: "auto",
                            paddingTop: 0,
                            paddingBottom: 0,
                            display: "block",
                            rowGap: 0,
                            gap: 0,
                        },
                    },
                }}
            >
                {mergedOptions.map((option) => (
                    <StyledMenuItem key={`${String(option.value)}-${option.name}`} value={option.value}>
                        {option.name}
                    </StyledMenuItem>
                ))}

                {loading && (
                    <StyledMenuItem disabled value="__loading__">
            <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <CircularProgress size={16} />
              Завантаження…
            </span>
                    </StyledMenuItem>
                )}
            </Select>
        </StyledFormControl>
    );
};

export default CustomLoadSelect;
