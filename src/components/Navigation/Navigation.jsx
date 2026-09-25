import React, { useEffect, useState } from "react";
import styles from './Navigation.module.scss';
import logo from '../../assets/img/logo.jpg';
import user from '../../assets/icons/user2.svg';
import arrIcon2 from "../../assets/icons/arrowDownWhite.svg";
import { Link } from 'react-router-dom';
import { useLocation } from "react-router";
import { useAppDispatch, useAppSelector } from "../../hooks/redux";
import { logout } from "../../api/authApi";
import { getProfile } from "../../store/selectors";

const Navigation = () => {
    const { pathname } = useLocation();
    const dispatch = useAppDispatch();
    const { first_name, last_name, photo, groups } = useAppSelector(getProfile);

    // /* nav for future pages*/
    // const todoNav = [
    //     /*  {src: '/workers-page', name: 'Сторінка робітників'},*/
    //     /*  {src: '/order', name: 'Замовлення'},*/
    //      {src: '/finances', name: 'Фінанси'},
    //      {src: '/bills', name: 'Надходження-витрати (рахунки)'},*/
    // ]

    const getAccordionByPath = (pathname) => {
        const isStorageGroup =
            pathname === '/storage' ||
            pathname === '/arrivalList' ||
            pathname.startsWith('/storage-product') ||
            pathname.startsWith('/newFabric') ||
            pathname.startsWith('/newProduct') ||
            pathname.startsWith('/incomingArrivalFabric') ||
            pathname.startsWith('/incomingArrivalProduct') ||
            pathname.startsWith('/vendorManagement');

        if (isStorageGroup) return 'storage';

        const isProductionGroup =
            pathname.startsWith('/orders') ||
            pathname.startsWith('/order') ||
            pathname === '/optionParts' ||
            pathname.startsWith('/componentTemplates') ||
            pathname.startsWith('/componentTypes') ||
            pathname.startsWith('/kitSizes') ||
            pathname.startsWith('/kitTemplates') ||
            pathname.startsWith('/kitOptions') ||
            pathname.startsWith('/componentOptions');

        if (isProductionGroup) return 'production';

        const isPricingGroup =
            pathname === '/newPrices' ||
            pathname === '/pricelist' ||
            pathname === '/sources';

        if (isPricingGroup) return 'pricing';

        const isAccountingGroup =
            pathname === '/payment-for-orders' ||
            pathname === '/payment-for-vendors' ||
            pathname.startsWith('/new-vendor-payment') ||
            pathname ==='/vendorList' ||
            pathname.startsWith('/privatPaymentInfo') ||
            pathname.startsWith('/payment-for-crm') ||
            pathname.startsWith('/crm-payment-info');


        if (isAccountingGroup) return 'accounting';

        return null;
    };

    const currentPageAccordion = getAccordionByPath(pathname);

    const [openedAccordion, setOpenedAccordion] = useState(null);
    const [closedCurrentAccordion, setClosedCurrentAccordion] = useState(false);

    useEffect(() => {
        setOpenedAccordion(null);
        setClosedCurrentAccordion(false);
    }, [pathname]);

    const handleLogout = () => {
        logout(dispatch);
    };

    const isGroupOpen = (groupId) => {
        if (groupId === currentPageAccordion) {
            return !closedCurrentAccordion || openedAccordion === groupId;
        }

        return openedAccordion === groupId;
    };

    const handleAccordionToggle = (groupId) => {
        if (groupId === currentPageAccordion) {
            if (openedAccordion === groupId) {
                setOpenedAccordion(null);
                setClosedCurrentAccordion(true);
            } else if (closedCurrentAccordion) {
                setClosedCurrentAccordion(false);
            } else {
                setClosedCurrentAccordion(true);
            }
            return;
        }

        setOpenedAccordion(prev => (prev === groupId ? null : groupId));
    };

    const userGroups = Array.isArray(groups) ? groups : [];

    const isCutter = userGroups.includes("Закрійник");
    const isSewer = userGroups.includes("Швачка") || userGroups.includes("Швея");
    const isPacker = userGroups.includes("Пакувальник");

    const isStorageWorker = userGroups.includes("Складовщик");
    const isAccountant = userGroups.includes("Бухгалтер");
    const isManager = userGroups.includes("Менеджер");

    const isProductionWorker = isCutter || isSewer || isPacker;

    const allNavGroups = [
        {
            id: 'storage',
            title: 'Складський облік',
            isOpen: isGroupOpen('storage'),
            toggle: () => handleAccordionToggle('storage'),
            links: [
                { src: '/storage', name: 'Товари' },
                { src: '/arrivalList', name: 'Надходження' },
                { src: '/vendorManagement', name: 'Постачальники'},
            ]
        },
        {
            id: 'production',
            title: 'Виробництво',
            isOpen: isGroupOpen('production'),
            toggle: () => handleAccordionToggle('production'),
            links: [
                { src: '/optionParts', name: 'Шаблони постільної білизни' },
                { src: '/orders', name: 'Замовлення' },
            ]
        },
        {
            id: 'pricing',
            title: 'Ціноутворення для товарів',
            isOpen: isGroupOpen('pricing'),
            toggle: () => handleAccordionToggle('pricing'),
            links: [
                { src: '/newPrices', name: 'Ціни' },
                { src: '/pricelist', name: 'Прайслісти' },
                { src: '/sources', name: 'Джерела' },
            ]
        },
        {
            id: 'accounting',
            title: 'Бухгалтерія',
            isOpen: isGroupOpen('accounting'),
            toggle: () => handleAccordionToggle('accounting'),
            links: [
                { src: '/payment-for-orders', name: 'Оплата замовлень' },
                { src: '/payment-for-vendors', name: 'Взаєморозрахунок з постачальниками' },
                { src: '/payment-for-crm', name: 'CRM платежі' },
            ]
        }
    ];

    const visibleNavGroups = allNavGroups.filter((group) => {
        if (isProductionWorker) {
            return group.id === "production";
        }

        if (isStorageWorker) {
            return group.id === "storage";

            // Якщо все ж таки складовщик має бачити ще й виробництво:
            // return group.id === "storage" || group.id === "production";
        }

        if (isAccountant) {
            return group.id === "pricing" || group.id === "accounting";
        }

        if (isManager) {
            return false;
        }

        return true;
    });

    const isLinkActive = (link) => {
        const isStorageActive =
            link.src === '/storage' &&
            (pathname === '/storage' ||
                pathname.startsWith('/storage-product') ||
                pathname.startsWith('/newFabric') ||
                pathname.startsWith('/newProduct'));

        const isTemplateActive =
            link.src === '/optionParts' &&
            (pathname === '/optionParts' ||
                pathname.startsWith('/componentTemplates') ||
                pathname.startsWith('/componentTypes') ||
                pathname.startsWith('/kitSizes') ||
                pathname.startsWith('/kitTemplates') ||
                pathname.startsWith('/kitOptions') ||
                pathname.startsWith('/componentOptions'));

        const isArrivalActive =
            link.src === '/arrivalList' &&
            (pathname === '/arrivalList' ||
                pathname.startsWith('/incomingArrivalFabric') ||
                pathname.startsWith('/incomingArrivalProduct'));

        const isVendorPaymentActive =
            link.src === '/payment-for-vendors' &&
            (pathname === '/payment-for-vendors' ||
                pathname.startsWith('/new-vendor-payment') || pathname === '/vendorList');

        const isPaymentForOrdersActive =
            link.src === '/payment-for-orders' &&
            (pathname === '/payment-for-orders' ||
                pathname.startsWith('/privatPaymentInfo'));

        const isCRMPaymentActive = link.src === '/payment-for-crm' &&
            (pathname === '/payment-for-crm' ||
                pathname.startsWith('/crm-payment-info'));

        const isOrdersActive =
            link.src === '/orders' &&
            (pathname === '/orders' ||
                pathname === '/order' ||
                pathname.startsWith('/orders/') ||
                pathname.startsWith('/order/'));

        return (
            pathname === link.src ||
            isStorageActive ||
            isTemplateActive ||
            isArrivalActive ||
            isVendorPaymentActive ||isPaymentForOrdersActive || isCRMPaymentActive ||isOrdersActive
        );
    };

    return (
        <div className={styles.navigation}>
            <Link to={'/'}>
                <img
                    className={styles.navigation__logo}
                    src={logo}
                    alt="logo"
                    width={114}
                    height={114}
                />
            </Link>

            <ul className={styles.navigation__list}>
                {visibleNavGroups.map((group, index) => (
                    <li key={index} className={styles.accordionBlock}>
                        <button
                            type="button"
                            onClick={group.toggle}
                            className={styles.accordionHead}
                        >
                            <span>{group.title}</span>
                            <img
                                src={arrIcon2}
                                alt=""
                                className={`${styles.accordionArrow} ${group.isOpen ? styles.accordionArrowOpen : ''}`}
                            />
                        </button>

                        <div className={`${styles.accordionBody} ${group.isOpen ? styles.accordionBodyOpen : ''}`}>
                            {group.links.map((link, linkIndex) => {
                                const isActive = isLinkActive(link);

                                return (
                                    <Link
                                        to={link.src}
                                        key={linkIndex}
                                        className={isActive ? styles.linkActive : styles.link}
                                    >
                                        <span>{link.name}</span>
                                    </Link>
                                );
                            })}
                        </div>
                    </li>
                ))}
            </ul>

            <div className={styles.logout}>
                <a
                    href="https://dev.egodevelopment.pp.ua/"
                    className={'btnDark'}
                    target="_blank"
                    rel="noopener noreferrer"
                >
                    <span>Перейти в CRM</span>
                </a>

                <div className={styles.logout__block}>
                    <div className={styles.logout__row}>
                        <div className={styles.logout__imagePlaceholder}>
                            <img src={photo ? photo : user} alt="" />
                        </div>
                        <p className={styles.logout__name}>
                            {first_name} {last_name}
                        </p>
                    </div>
                    <div>
                        <button className={styles.logout__btn} onClick={handleLogout}>
                            <span>Log out</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Navigation;