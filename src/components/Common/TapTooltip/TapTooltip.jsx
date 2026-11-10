import React, { cloneElement, useState } from "react";
import Tooltip from "@mui/material/Tooltip";
import ClickAwayListener from "@mui/material/ClickAwayListener";

// Demo build: drop-in for MUI's Tooltip on the info icons. With a mouse it is the same hover
// tooltip; on a touch screen (no hover) MUI only opens it on a long press, so there a tap on the
// icon opens / closes it and a tap anywhere else closes it (like the CRM's InfoHint).
const isTouchScreen = () => typeof window !== "undefined" && !!window.matchMedia?.("(hover: none)").matches;

const TapTooltip = ({ children, ...props }) => {
    const [open, setOpen] = useState(false);

    if (!isTouchScreen()) return <Tooltip {...props}>{children}</Tooltip>;

    const close = () => setOpen(false);
    return (
        <ClickAwayListener onClickAway={close}>
            <Tooltip
                {...props}
                followCursor={false}
                // keep the tooltip 8 px off the screen edges
                slotProps={{ popper: { modifiers: [{ name: "preventOverflow", options: { padding: 8 } }] } }}
                open={open}
                onClose={close}
                disableHoverListener
                disableFocusListener
                disableTouchListener
            >
                {cloneElement(children, {
                    onClick: (e) => {
                        children.props.onClick?.(e);
                        setOpen((prev) => !prev);
                    },
                })}
            </Tooltip>
        </ClickAwayListener>
    );
};

export default TapTooltip;
