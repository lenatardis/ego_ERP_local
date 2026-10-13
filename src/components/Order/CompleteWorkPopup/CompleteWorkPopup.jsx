import React from "react";
import CentralPopup from "../../Common/CentralPopup/CentralPopup";

const CompleteWorkPopup = ({
    onClose,
    onConfirm,
    isSubmitting = false,
    title = "Завершення роботи",
    text,
    blockerText = "",
    confirmText = "Так",
    cancelText = "Ні",
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
                            Роботу ще не можна завершити
                        </h3>

                        <p>{blockerText}</p>

                        <button
                            type="button"
                            className="btnDark"
                            style={{ width: "200px" }}
                            onClick={onClose}
                        >
                            <span>Зрозуміло</span>
                        </button>
                    </>
                ) : (
                    <>
                        <h3 style={{ paddingBottom: 0 }}>
                            Ви дійсно бажаєте завершити роботу?
                        </h3>

                        <p>{text}</p>

                        <button
                            type="button"
                            className="btnDark"
                            style={{ width: "200px" }}
                            onClick={onConfirm}
                            disabled={isSubmitting}
                        >
                            <span>{isSubmitting ? "Завершення..." : confirmText}</span>
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