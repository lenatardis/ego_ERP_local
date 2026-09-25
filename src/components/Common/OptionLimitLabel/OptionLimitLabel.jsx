import React from "react";
import { Tooltip } from "@mui/material";
import InfoIcon from "../../../assets/icons/info.svg";

const OptionLimitLabel = ({ text, maxLength = 100 }) => (
    <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
        {text}
        <Tooltip title={`Не більше ${maxLength} символів`} arrow placement="top">
            <img
                src={InfoIcon}
                alt="Інфо"
                style={{
                    width: "16px",
                    height: "16px",
                    cursor: "pointer",
                    display: "block",
                }}
            />
        </Tooltip>
    </span>
);

export default OptionLimitLabel;