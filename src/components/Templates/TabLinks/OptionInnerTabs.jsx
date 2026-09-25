// OptionsInnerTabs.jsx
import React, { useMemo } from "react";
import { NavLink, useLocation } from "react-router-dom";
import styles from "./TabLinks.module.scss";

const OptionsInnerTabs = ({ preventSameRouteNav = true, className = "" }) => {
    const location = useLocation();

    const links = useMemo(
        () => [
            { key: "componentOptions", label: "Опції компонентів", to: "/componentOptions", end: true },
            { key: "kitOptions", label: "Опції комплектів", to: "/kitOptions" },
        ],
        []
    );

    const handleLinkClick = (to) => (e) => {
        if (!preventSameRouteNav) return;
        if (location.pathname === to) {
            e.preventDefault();
            e.stopPropagation();
        }
    };

    return (
        <div className={`${styles.tabs} ${className}`}>
            {links.map((l) => (
                <NavLink
                    key={l.key}
                    to={l.to}
                    end={!!l.end}
                    onClick={handleLinkClick(l.to)}
                    className={({ isActive }) =>
                        `${styles.tabBtn} ${isActive ? styles.activeTab : ""}`
                    }
                >
                    <span>{l.label}</span>
                </NavLink>
            ))}
        </div>
    );
};

export default OptionsInnerTabs;
