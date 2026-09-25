import React, {useMemo, useRef, useState} from "react";
import {
    FormControl,
    Select,
    MenuItem,
    ListSubheader,
    InputBase,
    IconButton,
} from "@mui/material";
import {styled} from "@mui/material/styles";
import sortOrderIcon from "../../../assets/icons/sort.svg";

const CompactFormControl = styled(FormControl, {
    shouldForwardProp: (prop) => prop !== "height",
})(({height = "36px"}) => ({
    width: "100%",
    backgroundColor: "#FFFFFF",
    borderRadius: "4px",
    height: height,
    justifyContent: "center",
    ".MuiOutlinedInput-root": {
        backgroundColor: "#FFFFFF",
        borderRadius: "4px",
        height: height,
        padding: "0 16px",
        "& fieldset": {
            border: "none",
        },
        "& .MuiSelect-select": {
            padding: 0,
            display: "flex",
            alignItems: "center",
            height: height,
            fontSize: "12px",
            fontFamily: "Inter",
            fontStyle: "normal",
            lineHeight: "16px",
            color: "#201827",
        },
        "& svg": {
            width: "20px",
            height: "20px",
        },
    },
    ".MuiPaper-root": {
        borderRadius: "4px",
    },
}));

const CompactMenuItem = styled(MenuItem)(() => ({
    height: "36px",
    backgroundColor: "#FFFFFF",
    fontSize: "12px",
    fontFamily: "Inter",
    fontStyle: "normal",
    lineHeight: "16px",
    color: "#201827",
    borderTop: "1px solid #E0E0E0",
    "&.Mui-selected": {
        backgroundColor: "#E6D3F3",
    },
    "&.Mui-selected:hover": {
        backgroundColor: "#dcc3f0",
    },
    "&:hover": {
        backgroundColor: "#f9f5fd",
    },
    "& em": {
        fontStyle: "normal",
        color: "#201827",
    },
}));

const SearchRow = styled("div")(() => ({
    display: "flex",
    alignItems: "center",
    padding: "4px 8px 4px 12px",
    backgroundColor: "#FFFFFF",
    borderBottom: "1px solid #E0E0E0",
}));

const SearchInput = styled(InputBase)(() => ({
    flexGrow: 1,
    fontSize: "12px",
    fontFamily: "Inter",
    lineHeight: "16px",
    paddingRight: 8,
    "& input": {
        padding: "6px 0",
    },
}));

const SortIconButton = styled(IconButton)(() => ({
    padding: 4,
    "& img": {
        width: 18,
        height: 18,
    },
}));

// дістаємо перше число на початку рядка, щоб сортувати 15x100, 20x200 тощо
const parseLeadingNumber = (s) => {
    const m = String(s ?? "").match(/^(\d+)/);
    return m ? Number(m[1]) : null;
};

// тільки цифри – для фільтра
const numericOnly = (s) => String(s ?? "").replace(/[^\d]/g, "");

const NewCustomSelect = ({
                             value,
                             onChange,
                             options,
                             label,
                             height = "36px",
                             error,
                             disabled,
                             numeric = false,
                             greyPlaceholder = false,
                             menuLeftAlign = false,
                             ...rest
                         }) => {
    const [search, setSearch] = useState("");
    const [sortAsc, setSortAsc] = useState(true);
    const searchInputRef = useRef(null);

    const handleToggleSort = () => setSortAsc((prev) => !prev);

    const sortedOptions = useMemo(() => {
        const arr = Array.isArray(options) ? [...options] : [];

        arr.sort((a, b) => {
            const aName = a?.name ?? "";
            const bName = b?.name ?? "";

            const aNum = parseLeadingNumber(aName);
            const bNum = parseLeadingNumber(bName);

            if (aNum != null && bNum != null && aNum !== bNum) {
                return sortAsc ? aNum - bNum : bNum - aNum;
            }

            const aLabel = String(aName).toLowerCase();
            const bLabel = String(bName).toLowerCase();
            const cmp = aLabel.localeCompare(bLabel, "uk");
            return sortAsc ? cmp : -cmp;
        });

        return arr;
    }, [options, sortAsc]);

    const visibleOptions = useMemo(() => {
        const term = search.trim();
        if (!term) return sortedOptions;

        if (numeric) {
            const termNumeric = numericOnly(term);
            if (!termNumeric) return sortedOptions;

            return sortedOptions.filter((o) => {
                const optNumeric = numericOnly(o?.name);
                return optNumeric.includes(termNumeric);
            });
        }

        // текстовий пошук для звичайних селектів
        const termLower = term.toLowerCase();
        return sortedOptions.filter((o) =>
            String(o?.name ?? "").toLowerCase().includes(termLower)
        );
    }, [sortedOptions, search, numeric]);

    const handleInternalChange = (event) => {
        onChange?.(event); // контракт зберігаємо
    };

    const handleOpen = () => {
        setSearch("");
        setTimeout(() => {
            searchInputRef.current?.focus();
        }, 0);
    };

    const handleSearchChange = (e) => {
        const raw = e.target.value;

        if (numeric) {

            const cleaned = raw.replace(/[^0-9xXхХ.,]/g, "");
            setSearch(cleaned);
        } else {
            setSearch(raw);
        }
    };

    const menuProps = {
        PaperProps: {
            sx: {
                "& .MuiMenu-list": {
                    display: "block",
                    rowGap: 0,
                    gap: 0,
                    paddingTop: 0,
                    paddingBottom: 0,
                    marginTop: 0,
                },
            },
        },
        MenuListProps: {
            autoFocusItem: false,
            sx: {
                display: "block",
                rowGap: 0,
                gap: 0,
                paddingTop: 0,
                paddingBottom: 0,
            },
        },
        ...(menuLeftAlign
            ? {
                anchorOrigin: {
                    vertical: "bottom",
                    horizontal: "left",
                },
                transformOrigin: {
                    vertical: "top",
                    horizontal: "left",
                },
            }
            : {}),
    };

    return (
        <CompactFormControl
            height={height}
            disabled={disabled}
            error={!!error}
            {...rest}
        >
            <Select
                value={value}
                onChange={handleInternalChange}
                displayEmpty
                onOpen={handleOpen}
                renderValue={(selected) => {
                    if (selected === "" || selected == null) {
                        const placeholderColor = greyPlaceholder
                            ? "#888888"
                            : "#201827";

                        return (
                            <span
                                style={{
                                    color: placeholderColor,
                                    fontSize: 12,
                                }}
                            >
                {label}
            </span>
                        );
                    }
                    const found = options?.find(
                        (o) => String(o.value) === String(selected)
                    );
                    return (
                        <span style={{fontSize: 12}}>
            {found?.name ?? ""}
        </span>
                    );
                }}

              MenuProps={menuProps}
            >
                {/* шапка з інпутом пошуку та іконкою сортування */}
                <ListSubheader disableSticky>
                    <SearchRow>
                        <SearchInput
                            inputRef={searchInputRef}
                            placeholder="Пошук..."
                            value={search}
                            onChange={handleSearchChange}
                            onKeyDown={(e) => {
                                // в будь-якому випадку не віддаємо подію наверх до Select
                                e.stopPropagation();

                                const controlKeys = [
                                    "Backspace",
                                    "Delete",
                                    "ArrowLeft",
                                    "ArrowRight",
                                    "ArrowUp",
                                    "ArrowDown",
                                    "Home",
                                    "End",
                                    "Tab",
                                ];

                                // службові клавіші + Ctrl/Cmd-комбінації – дозволяємо
                                if (controlKeys.includes(e.key) || e.ctrlKey || e.metaKey) {
                                    return;
                                }

                                // Escape – можна залишити дефолтним (закриє меню)
                                if (e.key === "Escape") {
                                    return;
                                }

                                // Enter – теж не блокуємо (вибір айтема)
                                if (e.key === "Enter") {
                                    return;
                                }

                                if (numeric) {
                                    // numeric-режим: блокуємо все, що не цифри/x/х/.,, як і раніше
                                    if (e.key.length === 1 && !/[0-9xXхХ.,]/.test(e.key)) {
                                        e.preventDefault();
                                    }
                                } else {
                                    // НЕ numeric: нічого не блокуємо, будь-які символи можна вводити
                                    return;
                                }
                            }}

                            inputProps={{
                                inputMode: numeric ? "numeric" : "text",
                            }}
                        />
                        <SortIconButton
                            type="button"
                            tabIndex={-1}
                            onClick={handleToggleSort}
                            aria-label="Змінити порядок сортування"
                        >
                            <img src={sortOrderIcon} alt=""/>
                        </SortIconButton>
                    </SearchRow>
                </ListSubheader>

                {visibleOptions.length === 0 && (
                    <CompactMenuItem disabled value="">
                        <em>Нічого не знайдено</em>
                    </CompactMenuItem>
                )}

                {visibleOptions.map((option) => (
                    <CompactMenuItem key={option.value} value={option.value}>
                        {option.name}
                    </CompactMenuItem>
                ))}
            </Select>
        </CompactFormControl>
    );
};

export default NewCustomSelect;
