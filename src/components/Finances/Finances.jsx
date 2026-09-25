import React, {useState} from "react";
import styles from './Finances.module.scss';
import SearchFilter from "../Common/SearchFilter/SearchFilter";
import TableOld from "../Common/Table/Table_old";
import Filter from "../Common/Filter/Filter";
import PopupCloser from "../Common/PopupCloser/PopupCloser";
import CustomSelect from "../Common/CustomSelect/CustomSelect";
import {useNavigate} from "react-router";
import ArrBack from "../Common/ArrBack/ArrBack";

const columns = [
    { key: "date", title: "Дата", width: '110px' },
    { key: "sum", title: "Сума", width: '110px' },
    {
        key: "view",
        title: "Вид",
        width: '130px',
        render: (value) => (
            <div style={{ color: value === "Надходження" ? "#47C143" : "#F15B5B" }}>
                {value}
            </div>
        )
    },
    { key: "type", title: "Тип", width: '130px' },
    { key: "category", title: "Категорія", width: '110px' },
    { key: "group", title: "Група", width: '110px' },
    { key: "comment", title: "Коментар", width: '240px' },
    { key: "else", title: "Інше", width: '150px' },
    { key: "file", title: "Файл", width: '130px' },
];
const data = [
    {
        date: "08.05.2025",
        sum: "2850 грн",
        view: "Надходження",
        type: 'Фінансова',
        category: 'Текстиль',
        group: 'Група',
        comment: 'Lorem Ipsum - це текст-"риба", що використовується в друкарстві та дизайні. Lorem Ipsum є, фактично, стандартною "рибою" аж з XVI сторіччя, коли невідомий друкар взяв шрифтову гранку та склав на ній підбірку зразків шрифтів. "Риба" не тільки успішно пережила п\'ять століть',
        else: 'Lorem Ipsun dollar',
        file: 'img9800.jpg',
    },
    {
        date: "08.05.2025",
        sum: "2850 грн",
        view: "Витрата",
        type: 'Фінансова',
        category: 'Текстиль',
        group: 'Група',
        comment: 'Lorem Ipsum - це текст-"риба"',
        else: 'Lorem Ipsun dollar',
        file: 'img9800.jpg',
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

const Finances = () => {
    const [isShowFilter, setIsShowFilter] = useState(false);
    const navigate = useNavigate();

    const [filters, setFilters] = useState({
        view: '',
        type: '',
    });

    const onClose = () => setIsShowFilter(false);
    const onOpenFilter = () => setIsShowFilter(true);
    const onAdd = () => navigate('/financesCreate');

    const handleFilterChange = (key) => (event) => {
        setFilters((prev) => ({
            ...prev,
            [key]: event.target.value,
        }));
    };

    return (
        <div className={styles.finances}>
            <ArrBack/>
            <SearchFilter onOpenFilter={onOpenFilter} title={'Фінанси'} isAdd onAdd={onAdd} />
            <div className={styles.sum}>
                <span>Сума заробітку з продаж за день</span>
                <p>82 450 грн</p>
            </div>
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

export default Finances;