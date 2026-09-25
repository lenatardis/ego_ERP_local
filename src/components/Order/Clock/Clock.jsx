import React, { useEffect, useState } from "react";
import styles from '../Order.module.scss';

const Clock = () => {
    const [time, setTime] = useState(new Date());

    useEffect(() => {
        const interval = setInterval(() => setTime(new Date()), 1000);
        return () => clearInterval(interval);
    }, []);

    const pad = (n) => String(n).padStart(2, '0');

    return (
        <div className={styles.currentTimeRow}>
            <div>
                <div className={styles.timeCell}><span>{pad(time.getHours())}</span></div>
                <p>Годин</p>
            </div>
            <span>&#58;</span>
            <div>
                <div className={styles.timeCell}><span>{pad(time.getMinutes())}</span></div>
                <p>Хвилин</p>
            </div>
            <span>&#58;</span>
            <div>
                <div className={styles.timeCell}><span>{pad(time.getSeconds())}</span></div>
                <p>Секунд</p>
            </div>
        </div>
    );
};

export default Clock;
