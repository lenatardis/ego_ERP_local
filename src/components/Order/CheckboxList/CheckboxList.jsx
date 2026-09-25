import React from "react";
import styles from './CheckboxList.module.scss';

const CheckboxList = ({array, selectedItems, setSelectedItems}) => {

    const handleChange = (item) => {
        if (selectedItems.some((el) => el.id === item.id)) {
            setSelectedItems(selectedItems.filter((el) => el.id !== item.id));
        } else {
            setSelectedItems([...selectedItems, item]);
        }
    };

    return (
        <div className={styles.chooseList}>
            {array.map((item) => (
                <div key={item.id} className={`${styles.customCheckbox}`}>
                    <input
                        type="checkbox"
                        onChange={() => handleChange(item)}
                        checked={selectedItems.some((el) => el.id === item.id)}
                    />
                    <span/>
                    <p>{item.name}</p>
                </div>
            ))}
        </div>
    );
};

export default CheckboxList;
