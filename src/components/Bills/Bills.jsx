import React, {useState} from "react";
import SearchFilter from "../Common/SearchFilter/SearchFilter";
import TableOld from "../Common/Table/Table_old";
import Filter from "../Common/Filter/Filter";
import CustomSelect from "../Common/CustomSelect/CustomSelect";
import PopupCloser from "../Common/PopupCloser/PopupCloser";
import ArrBack from "../Common/ArrBack/ArrBack";

const columns = [
    { key: "date", title: "Дата", width: '90px' },
    { key: "id", title: "ID платежу", width: '90px' },
    { key: "linkOrder", title: "Посилання на рахунок замовлення", width: '150px' },
    { key: "cashRegister", title: "Каса", width: '80px' },
    { key: "category", title: "Категорія", width: '90px' },
    { key: "type", title: "Тип валюти", width: '90px' },
    { key: "currency", title: "Валюта", width: '90px' },
    { key: "sum", title: "Сума", width: '90px' },
    { key: "counterAgent", title: "Контрагент", width: '100px' },
    { key: "appointment", title: "Призначення", width: '100px' },
    { key: "linkCheck", title: "Посилання на чек", width: '150px' },
    { key: "comment", title: "Коментар", width: '150px' },
];
const data = [
    {
        date: "08.05.2025",
        id: "08294213",
        linkOrder: "https //7342341241...",
        cashRegister: 'Каса 14',
        category: 'Текстиль',
        type: 'Готівка',
        currency: 'Грн',
        sum: 12500,
        counterAgent: 'Ткачук А.',
        appointment: 'Lorem ipsun dollar',
        linkCheck: "https //7342341241...",
        comment: 'Lorem Ipsum - це текст-"риба", що використовується в друкарстві та дизайні. ',
    },
    {
        date: "08.05.2025",
        id: "08294213",
        linkOrder: "https //7342341241...",
        cashRegister: 'Каса 14',
        category: 'Текстиль',
        type: 'Готівка',
        currency: 'Грн',
        sum: 12500,
        counterAgent: 'Ткачук А.',
        appointment: 'Lorem ipsun dollar',
        linkCheck: "https //7342341241...",
        comment: 'Lorem Ipsum - це текст-"риба", що використовується в друкарстві та дизайні. ',
    },
];

const view = [
    {name: 'Фінансова', value: 'Financial'},
    {name: 'Інвестиційна', value: 'Investment'},
    {name: 'Операційна', value: 'Operating'},
]
const type = [
    {name: 'Витрата', value: 'Cost'},
    {name: 'Надходження', value: 'Incoming'},
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
            <h2>Надходження-витрати (рахунки)</h2>
            <SearchFilter onOpenFilter={onOpenFilter} title={'Надходження-витрати (рахунки)'} />
            <TableOld columns={columns} data={data} />
            <Filter isShow={isShowFilter}>
                <CustomSelect
                    label="Вид надходження"
                    value={filters.view}
                    onChange={handleFilterChange('view')}
                    options={view}
                />
                <CustomSelect
                    label="Тип операції"
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