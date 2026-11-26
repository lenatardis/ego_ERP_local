import React, { useState } from 'react';
import { useLocation } from 'react-router-dom';
import styles from './PageGuide.module.scss';
import infoIcon from '../../../assets/icons/info.svg';
import { useAppSelector } from '../../../hooks/redux';
import { getProfile } from '../../../store/selectors';
import { getPageGuide } from './pageGuides';
import { t } from '../../../i18n';

// Demo build (2026-11-26, at the user's request): what this page is for, and what to try behind a toggle.
// Rendered once by Authorized above the routes; the toggle starts closed on every page (not remembered).
const Guide = ({ guide }) => {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <div className={styles.guide}>
            <div className={styles.guide__head}>
                <img src={infoIcon} alt="" className={styles.guide__icon}/>
                <p className={styles.guide__summary}>{guide.summary}</p>
                <button type="button" className={styles.guide__toggle} aria-expanded={isOpen}
                        onClick={() => setIsOpen((v) => !v)}>
                    {t('Що можна спробувати')}
                    <span className={`${styles.guide__arrow} ${isOpen ? styles.guide__arrowOpen : ''}`}>▾</span>
                </button>
            </div>
            {isOpen && (
                <ul className={styles.guide__tips}>
                    {guide.tips.map((tip) => <li key={tip}>{tip}</li>)}
                </ul>
            )}
        </div>
    );
};

const PageGuide = () => {
    const { pathname } = useLocation();
    const { groups } = useAppSelector(getProfile);
    const guide = getPageGuide(pathname, groups);

    return guide ? <Guide key={pathname} guide={guide}/> : null;
};

export default PageGuide;
