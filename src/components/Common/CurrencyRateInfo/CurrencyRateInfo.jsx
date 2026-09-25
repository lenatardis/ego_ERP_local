import React from "react";
import styles from "./CurrencyRateInfo.module.scss";

const CurrencyRateInfo = ({ buyRate, saleRate }) => {
  return (
    <div className={styles.rateInfo}>
      <span>Поточний курс $ в грн:</span>
      <div className={styles.rateColumn}>
        <span className={styles.rateInfoItem}>
          <span>Купівля:</span>
          <span className={styles.rateInfoValue}>
            {buyRate != null ? buyRate.toFixed(2) : "—"}
          </span>
        </span>

        <span className={styles.rateInfoItem}>
          <span>Продаж:</span>
          <span className={styles.rateInfoValue}>
            {saleRate != null ? saleRate.toFixed(2) : "—"}
          </span>
        </span>
      </div>
    </div>
  );
};

export default CurrencyRateInfo;