import React from "react";
import styles from './SearchFilter.module.scss';
import Tabs from "../Tabs/Tabs";
import { useLocation } from "react-router";
import Search from "./Search.jsx";

const SearchFilter = ({
    title,
    tabs = null,
    handleChange = null,
    activeTab = null,
    onOpenFilter,
    isAdd = false,
    onAdd = null,
    composition = null,
    onProductNavigate = null,
    onFabricNavigate = null,
    searchValue = null,
    setSearchValue = null,
    onSearch = null,
    onNewFabricArrivalNavigate = null,
    onNewProductArrivalNavigate = null,
    onNewVendorPaymentNavigate = null,
    onVendorBalanceNavigate = null,
    vendor = false,
    hideFilterButton = false
}) => {
    const location = useLocation();

    const showUniversalAddButton = isAdd && typeof onAdd === "function";
    const showArrivalButtons =
        typeof onNewFabricArrivalNavigate === "function" &&
        typeof onNewProductArrivalNavigate === "function";
    const showVendorButtons =
        vendor &&
        typeof onVendorBalanceNavigate === "function" &&
        typeof onNewVendorPaymentNavigate === "function";

    return (
        <div className={styles.searchFilter}>
            <div className={styles.searchFilter__header}>
                <h2 className={styles.searchFilter__title}>{title}</h2>

                {tabs && handleChange && activeTab && (
                    <Tabs
                        tabs={tabs}
                        handleChange={handleChange}
                        activeTab={activeTab}
                    />
                )}
            </div>

            <div className={`${styles.actions} ${composition ? styles.specialAlign : ''}`}>
                <Search
                    searchValue={searchValue}
                    setSearchValue={setSearchValue}
                    onSearch={onSearch}
                />

                {composition && (
                    <>
                        <button
                            type="button"
                            className={location.pathname === '/storage' ? 'btnDark' : 'btnLight'}
                            onClick={onFabricNavigate}
                        >
                            <span>Тканини</span>
                        </button>

                        <button
                            type="button"
                            className={location.pathname === '/storage-product' ? 'btnDark' : 'btnLight'}
                            onClick={onProductNavigate}
                        >
                            <span>Готова продукція</span>
                        </button>
                    </>
                )}

               {!hideFilterButton && (
                    <button
                        type="button"
                        onClick={onOpenFilter}
                        className="btnLight"
                    >
                        <span className={styles.filter}>Фільтр</span>
                    </button>
                )}

                {showUniversalAddButton && (
                    <button
                        type="button"
                        onClick={onAdd}
                        className="btnLight"
                    >
                        <span>Додати +</span>
                    </button>
                )}

                {showArrivalButtons && (
                    <>
                        <button
                            type="button"
                            onClick={onNewFabricArrivalNavigate}
                            className="btnLight"
                        >
                            <span>+Тканини</span>
                        </button>

                        <button
                            type="button"
                            onClick={onNewProductArrivalNavigate}
                            className="btnLight"
                        >
                            <span>+Готова продукція</span>
                        </button>
                    </>
                )}

                {showVendorButtons && (
                    <>
                        <button
                            type="button"
                            onClick={onVendorBalanceNavigate}
                            className="btnLight"
                        >
                            <span>Баланс</span>
                        </button>

                        <button
                            type="button"
                            onClick={onNewVendorPaymentNavigate}
                            className="btnLight"
                        >
                            <span>Додати +</span>
                        </button>
                    </>
                )}
            </div>
        </div>
    );
};

export default SearchFilter;