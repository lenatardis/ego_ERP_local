import React, {useState} from "react";
import SearchFilter from "../Common/SearchFilter/SearchFilter";
import TableOld from "../Common/Table/Table_old";
import Filter from "../Common/Filter/Filter";
import CustomSelect from "../Common/CustomSelect/CustomSelect";
import PopupCloser from "../Common/PopupCloser/PopupCloser";
import ArrBack from "../Common/ArrBack/ArrBack";
import { t } from '../../i18n';

const columns = [
    { key: "date", title: t('Дата'), width: '90px' },
    { key: "id", title: t('ID платежу'), width: '90px' },
    { key: "linkOrder", title: t('Посилання на рахунок замовлення'), width: '150px' },
    { key: "cashRegister", title: t('Каса'), width: '80px' },
    { key: "category", title: t('Категорія'), width: '90px' },
    { key: "type", title: t('Тип валюти'), width: '90px' },
    { key: "currency", title: t('Валюта'), width: '90px' },
    { key: "sum", title: t('Сума'), width: '90px' },
    { key: "counterAgent", title: t('Контрагент'), width: '100px' },
    { key: "appointment", title: t('Призначення'), width: '100px' },
    { key: "linkCheck", title: t('Посилання на чек'), width: '150px' },
    { key: "comment", title: t('Коментар'), width: '150px' },
];
const data = [
    {
        date: "08.05.2025",
        id: "08294213",
        linkOrder: "https //7342341241...",
        cashRegister: t('Каса 14'),
        category: t('Текстиль'),
        type: t('Готівка'),
        currency: t('Грн'),
        sum: 12500,
        counterAgent: t('Ткачук А.'),
        appointment: 'Lorem ipsun dollar',
        linkCheck: "https //7342341241...",
        comment: t('Lorem Ipsum - це текст-"риба", що використовується в друкарстві та дизайні. '),
    },
    {
        date: "08.05.2025",
        id: "08294213",
        linkOrder: "https //7342341241...",
        cashRegister: t('Каса 14'),
        category: t('Текстиль'),
        type: t('Готівка'),
        currency: t('Грн'),
        sum: 12500,
        counterAgent: t('Ткачук А.'),
        appointment: 'Lorem ipsun dollar',
        linkCheck: "https //7342341241...",
        comment: t('Lorem Ipsum - це текст-"риба", що використовується в друкарстві та дизайні. '),
    },
];

const view = [
    {name: t('Фінансова'), value: 'Financial'},
    {name: t('Інвестиційна'), value: 'Investment'},
    {name: t('Операційна'), value: 'Operating'},
]
const type = [
    {name: t('Витрата'), value: 'Cost'},
    {name: t('Надходження'), value: 'Incoming'},
]

const Bills = () => {
    const [isShowFilter, setIsShowFilter] = useState(false);

    const [filters, setFilters] = useState({
        view: '',
        type: '',
    });

    const onClose = () => setIsShowFilter(false);
    const onOpenFilter = () => setIsShowFilter(true);

    const handleFilterChange = (key) => (event) => {
        setFilters((prev) => ({
            ...prev,
            [key]: event.target.value,
        }));
    };

    return (
        <div>
            <ArrBack/>
            <h2>{t('Надходження-витрати (рахунки)')}</h2>
            <SearchFilter onOpenFilter={onOpenFilter} title={t('Надходження-витрати (рахунки)')} />
            <TableOld columns={columns} data={data} />
            <Filter isShow={isShowFilter} onClose={onClose}>
                <CustomSelect
                    label={t('Вид надходження')}
                    value={filters.view}
                    onChange={handleFilterChange('view')}
                    options={view}
                />
                <CustomSelect
                    label={t('Тип операції')}
                    value={filters.type}
                    onChange={handleFilterChange('type')}
                    options={type}
                />
            </Filter>
            <PopupCloser isShow={isShowFilter} onClose={onClose} />
        </div>
    )
}

export default Bills;