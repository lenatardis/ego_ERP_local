import React from "react";
import styles from './ArrBack.module.scss';
import { useNavigate } from "react-router";
import arrIcon from "../../../assets/icons/arrowRight.svg";
import { t } from '../../../i18n';

const ArrBack = () => {
  const navigate = useNavigate();

  const onReturn = () => {
    navigate(-1);
  };

  return (<p className={styles.arrLine}>
    <span className={styles.arrWrap} onClick={() => onReturn()}>
      <img
        src={arrIcon}
        alt=""
        className={styles.arrIcon}
      /><span>{t('Назад')}</span></span>
  </p>)

}

export default ArrBack;