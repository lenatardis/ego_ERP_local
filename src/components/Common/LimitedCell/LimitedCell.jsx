import React from "react";

const LimitedCell = ({ value, fallback = "-", lineClamp = 2 }) => {
    const text = value === null || value === undefined || String(value).trim() === ""
        ? fallback
        : String(value);

    return (
        <span
            title={text}
            style={{
                display: "-webkit-box",
                maxWidth: "100%",
                WebkitLineClamp: lineClamp,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "normal",
                wordBreak: "break-word",
                overflowWrap: "anywhere",
                lineHeight: "1.35",
            }}
        >
            {text}
        </span>
    );
};

export default LimitedCell;