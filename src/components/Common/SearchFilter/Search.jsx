import React, {useEffect, useRef} from "react";
import styles from './SearchFilter.module.scss';
import { t } from '../../../i18n';

const Search = ({searchValue, setSearchValue, onSearch}) => {
    const timeout = useRef(null);

    useEffect(() => {
        if (searchValue !== null) {
            clearTimeout(timeout.current);

            timeout.current = setTimeout(() => {
                onSearch()
            }, 500);
            return () => {
                clearTimeout(timeout.current);
            };
        }
    }, [searchValue]);
    return (
        <div className={styles.searchWrap}>
            <input type="search" placeholder={t('Пошук')} value={searchValue || ''}
                   onChange={(e) => setSearchValue(e.target.value)}/>
        </div>
    )
}

export default Search;