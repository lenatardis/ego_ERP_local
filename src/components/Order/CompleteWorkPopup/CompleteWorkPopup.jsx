import React from "react";
import CentralPopup from "../../Common/CentralPopup/CentralPopup";
import { t } from '../../../i18n';

const CompleteWorkPopup = ({
    onClose,
    onConfirm,
    isSubmitting = false,
    title = t('Завершення роботи'),
    text,
    blockerText = "",
    confirmText = t('Так'),
    cancelText = t('Ні'),
}) => {
    return (
        <CentralPopup
            title={title}
            onClose={onClose}
        >
            <div
                style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    rowGap: "16px",
                    textAlign: "center",
                }}
            >
                {blockerText ? (
                    <>
                        <h3 style={{ paddingBottom: 0 }}>
                            {t('Роботу ще не можна завершити')}
                        </h3>

                        <p>{blockerText}</p>

                        <button
                            type="button"
                            className="btnDark"
                            style={{ width: "200px" }}
                            onClick={onClose}
                        >
                            <span>{t('Зрозуміло')}</span>
                        </button>
                    </>
                ) : (
                    <>
                        <h3 style={{ paddingBottom: 0 }}>
                            {t('Ви дійсно бажаєте завершити роботу?')}
                        </h3>

                        <p>{text}</p>

                        <button
                            type="button"
                            className="btnDark"
                            style={{ width: "200px" }}
                            onClick={onConfirm}
                            disabled={isSubmitting}
                        >
                            <span>{isSubmitting ? t('Завершення...') : confirmText}</span>
                        </button>

                        <button
                            type="button"
                            className="btnLight"
                            style={{ width: "200px" }}
                            onClick={onClose}
                            disabled={isSubmitting}
                        >
                            <span>{cancelText}</span>
                        </button>
                    </>
                )}
            </div>
        </CentralPopup>
    );
};

export default CompleteWorkPopup;