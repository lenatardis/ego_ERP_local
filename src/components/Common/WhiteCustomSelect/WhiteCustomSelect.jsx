import React from "react";
import { FormControl, Select, MenuItem } from "@mui/material";
import { styled } from "@mui/material/styles";

const CompactFormControl = styled(FormControl, {
    shouldForwardProp: (prop) => prop !== 'height'
})(({ height = '36px' }) => ({
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: '4px',
    height: height,
    justifyContent: 'center',
    '.MuiOutlinedInput-root': {
        backgroundColor: '#FFFFFF',
        borderRadius: '4px',
        height: height,
        padding: '0 16px',
        '& fieldset': {
            border: 'none',
        },
        '& .MuiSelect-select': {
            padding: 0,
            display: 'flex',
            alignItems: 'center',
            height: height,
            fontSize: '12px',
            fontFamily: 'Inter',
            fontStyle: 'normal',
            lineHeight: '16px',
            color: '#201827',
        },
        '& svg': {
            width: '20px',
            height: '20px',
        }
    },
    '.MuiPaper-root': {
        borderRadius: '4px',
    }
}));

const CompactMenuItem = styled(MenuItem)(() => ({
    height: '36px',
    backgroundColor: '#FFFFFF',
    fontSize: '12px',
    fontFamily: 'Inter',
    fontStyle: 'normal',
    lineHeight: '16px',
    color: '#201827',
    borderTop: '1px solid #E0E0E0',
    '&.Mui-selected': {
        backgroundColor: '#E6D3F3',
    },
    '&.Mui-selected:hover': {
        backgroundColor: '#dcc3f0'
    },
    '&:hover': {
        backgroundColor: '#f9f5fd',
    },
    '& em': {
        fontStyle: 'normal',
        color: '#201827',
    }
}));

const WhiteCustomSelect = ({ value, onChange, options, label, height = '36px', error, disabled = false, menuLeftAlign = false}) => {

    const menuProps = {
    PaperProps: {
        sx: {
            '& ul': {
                paddingTop: 0,
                paddingBottom: 0,
                rowGap: 0,
                marginTop: 0,
            },
        },
    },
    ...(menuLeftAlign ? {
        anchorOrigin: {
            vertical: 'bottom',
            horizontal: 'left',
        },
        transformOrigin: {
            vertical: 'top',
            horizontal: 'left',
        },
    } : {}),
};

    return (
        <CompactFormControl height={height} disabled={disabled}>
            <Select
                value={value}
                onChange={onChange}
                displayEmpty
                inputProps={{ 'aria-label': label }}
                disabled={disabled}
                MenuProps={menuProps}
                error={error}
            >
                <CompactMenuItem disabled value="">
                    <em style={{fontStyle: 'normal',}}>{label}</em>
                </CompactMenuItem>
                {options.map((option) => (
                    <CompactMenuItem key={option.value} value={option.value}>
                        {option.name}
                    </CompactMenuItem>
                ))}
            </Select>
        </CompactFormControl>
    );
}

export default WhiteCustomSelect;