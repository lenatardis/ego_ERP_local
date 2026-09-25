import React, {useEffect, useState} from "react";
import styles from './ArrivalList.module.scss';
import {getAccessToken} from "../../api/authStorage.js";
import {fetchAllArrivals} from "../../api/tablesApi.js";
import {Pagination} from '@mui/material';
import {useNavigate} from "react-router"; // залишаю як у тебе
import Preloader from "../Common/Preloader/Preloader.jsx";
import ArrBack from "../Common/ArrBack/ArrBack.jsx";

const ArrivalList = () => {
    const [arrivalList, setArrivalList] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(0);

    // all | fabric | product
    const [filterType, setFilterType] = useState('all');

    const navigate = useNavigate();

    const getReceiverFullName = (receiver) => {
        if (!receiver) return '-';

        const fullName = [receiver.first_name, receiver.last_name]
            .filter(Boolean)
            .join(' ')
            .trim();

        return fullName || `Користувач ${receiver.id}`;
    };

    const fetchArrivals = async (pageToLoad, typeFilter = filterType) => {
        try {
            setIsLoading(true);
            const token = getAccessToken();

            const params = { page: pageToLoad };

            if (typeFilter === 'fabric') {
                params.with_fabric_rolls = true;
            } else if (typeFilter === 'product') {
                params.with_warehouse_item_units = true;
            }
            // для 'all' жодних додаткових параметрів не додаємо

            const data = await fetchAllArrivals(token, params);
            console.log(data);

            if (data?.fabric_arrivals) {
                setArrivalList(data.fabric_arrivals);
                setTotalPages(data?.total_pages || 0);
            } else {
                setArrivalList([]);
                setTotalPages(0);
            }
        } catch (e) {
            console.log(e);
            setArrivalList([]);
            setTotalPages(0);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchArrivals(1, 'all');
    }, []);

    const pageNavigate = (id, type) => {
        if (type === 'fabric') {
            navigate(`/incomingArrivalFabric/${id}/`);
        } else if (type === 'product') {
            navigate(`/incomingArrivalProduct/${id}/`);
        }
    };

    const readNavigate = (id, type) => {
        if (type === 'fabric') {
            navigate(`/incomingArrivalFabric/${id}/read`);
        } else if (type === 'product') {
            navigate(`/incomingArrivalProduct/${id}/read`);
        }
    };

    const handlePaginationChange = (event, value) => {
        if (page !== value) {
            setPage(value);
            window.scrollTo({top: 0, behavior: 'auto'});
            fetchArrivals(value, filterType);
        }
    };

    const navigateFabricArrival = () => navigate('/incomingArrivalFabric');
    const navigateProductArrival = () => navigate('/incomingArrivalProduct');

    const handleFilterClick = (type) => {
        setFilterType(type);
        setPage(1);
        window.scrollTo({top: 0, behavior: 'auto'});
        fetchArrivals(1, type);
    };

    return (
        <div className={styles.arrivalList}>
            <ArrBack/>
            <h2>Список надходжень</h2>
            <div className={styles.arrivalList__wrap}>

                {/* верхній ряд — створення нових надходжень */}
                <div className={styles.navBtnRow}>
                    <button onClick={navigateFabricArrival} className={`btnLight`}>
                        <span>+Тканини</span>
                    </button>
                    <button onClick={navigateProductArrival} className={`btnLight`}>
                        <span>+Готова продукція</span>
                    </button>
                </div>

                {/* 2-й ряд — таби-фільтри, притиснуті до лівого краю */}
                <div
                    className={styles.navBtnRow}
                    style={{justifyContent: 'flex-start'}}
                >
                    <button
                        type="button"
                        className={filterType === 'all' ? 'btnDark' : 'btnLight'}
                        onClick={() => handleFilterClick('all')}
                    >
                        <span>Всі надходження</span>
                    </button>

                    <button
                        type="button"
                        className={filterType === 'fabric' ? 'btnDark' : 'btnLight'}
                        onClick={() => handleFilterClick('fabric')}
                    >
                        <span>Надходження тканин</span>
                    </button>

                    <button
                        type="button"
                        className={filterType === 'product' ? 'btnDark' : 'btnLight'}
                        onClick={() => handleFilterClick('product')}
                    >
                        <span>Надходження товарів</span>
                    </button>
                </div>

                {
                    arrivalList?.length > 0 ? (
                        arrivalList.map((el, index) => {
                            const type =
                                el?.warehouse_item_units?.length
                                    ? 'product'
                                    : el?.fabric_rolls?.length
                                        ? 'fabric'
                                        : null;

                            return (
                                <div className={styles.arrivalList__item} key={index}>
                                    <div className={styles.infoBlock}>
                                        <div className={styles.infoCol}>
                                            <span className={styles.infoTitle}>Найменування</span>
                                            <p>
                                                Надходження{" "}
                                                {type === 'product'
                                                    ? 'товарів'
                                                    : type === 'fabric'
                                                        ? 'тканин'
                                                        : ''}
                                                {" "}№ {el?.id}
                                            </p>
                                        </div>

                                        <div className={styles.infoCol}>
                                            <span className={styles.infoTitle}>№</span>
                                            <p>{el?.document_num || '-'}</p>
                                        </div>

                                        <div className={styles.infoCol}>
                                            <span className={styles.infoTitle}>Хто приймав</span>
                                            <p>{getReceiverFullName(el?.receiver)}</p>
                                        </div>

                                        <div className={styles.infoCol}>
                                            <span className={styles.infoTitle}>Постачальник</span>
                                            <p>{el?.vendor?.full_name || '-'}</p>
                                        </div>

                                        <div className={styles.infoCol}>
                                            <span className={styles.infoTitle}>Сума, грн</span>
                                            <p>{el?.uah_amount ?? '-'}</p>
                                        </div>

                                        <div className={styles.infoCol}>
                                            <span className={styles.infoTitle}>Сума, $</span>
                                            <p>{el?.usd_amount ?? '-'}</p>
                                        </div>

                                        <div className={styles.infoCol}>
                                            <span className={styles.infoTitle}>Дата надходження</span>
                                            <p>{el?.arrival_date || '-'}</p>
                                        </div>
                                    </div>

                                    <div className={styles.actionBlock}>
                                        <button
                                            type="button"
                                            className={'btnLight'}
                                            onClick={() => type && readNavigate(el?.id, type)}
                                        >
                                            <span>Перегляд</span>
                                        </button>
                                        <button
                                            type="button"
                                            className={'btnDark'}
                                            onClick={() => type && pageNavigate(el?.id, type)}
                                        >
                                            <span>Редагувати</span>
                                        </button>
                                    </div>
                                </div>
);
                        })

                    ) : (
                        !isLoading && <p>Надходжень поки немає</p>
                    )
                }
            </div>

            {totalPages > 1 && (
                <Pagination
                    count={totalPages}
                    page={page}
                    siblingCount={1}
                    boundaryCount={1}
                    hidePrevButton
                    hideNextButton
                    onChange={handlePaginationChange}
                />
            )}
            {isLoading && <Preloader/>}
        </div>
    );
};

export default ArrivalList;
