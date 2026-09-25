// TabsLinks.jsx
import React, { useMemo, useCallback } from "react";
import { NavLink, useLocation } from "react-router-dom";
import styles from "./TabLinks.module.scss";

const TabsLinks = ({ preventSameRouteNav = true, className = "" }) => {
    const location = useLocation();

    const links = useMemo(
        () => [
            { key: "optionParts", label: "Частини опцій", to: "/optionParts" },
            {
                key: "options",
                label: "Опції",
                to: "/componentOptions", // дефолт
                groupPaths: ["/componentOptions", "/kitOptions"],
            },
            { key: "componentTypes", label: "Типи компонентів", to: "/componentTypes" },
            { key: "componentTemplates", label: "Компоненти", to: "/componentTemplates" },
            { key: "kitSizes", label: "Розміри комплектів", to: "/kitSizes" },
            { key: "kitTemplates", label: "Комплекти", to: "/kitTemplates", end: true }
        ],
        []
    );

    const isInGroup = useCallback((groupPaths, pathname) => {
        if (!Array.isArray(groupPaths) || groupPaths.length === 0) return false;
        return groupPaths.includes(pathname);
    }, []);

    const handleLinkClick = useCallback(
        (link) => (e) => {
            if (!preventSameRouteNav) return;

            const { to, groupPaths } = link;
            const path = location.pathname;

            if (path === to) {
                e.preventDefault();
                e.stopPropagation();
                return;
            }

            if (isInGroup(groupPaths, path)) {
                e.preventDefault();
                e.stopPropagation();
            }
        },
        [preventSameRouteNav, location.pathname, isInGroup]
    );

    return (
        <div className={`${styles.tabs} ${className}`}>
            {links.map((l) => {
                const isOptionsGroupActive =
                    l.key === "options" && isInGroup(l.groupPaths, location.pathname);

                return (
                    <NavLink
                        key={l.key}
                        to={l.to}
                        end={!!l.end}
                        onClick={handleLinkClick(l)}
                        className={({ isActive }) =>
                            `${styles.tabBtn} ${(isActive || isOptionsGroupActive) ? styles.activeTab : ""}`
                        }
                    >
                        <span>{l.label}</span>
                    </NavLink>
                );
            })}
        </div>
    );
};

export default TabsLinks;
