import React from "react";
import Tooltip from "../TapTooltip/TapTooltip";
import InfoIcon from "../../../assets/icons/info.svg";
import { t } from '../../../i18n';

const OptionLimitLabel = ({ text, maxLength = 100 }) => (
    <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
        {text}
        <Tooltip title={t('Не більше {{maxLength}} символів', {maxLength})} arrow placement="top">
            <img
                src={InfoIcon}
                alt={t('Інфо')}
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