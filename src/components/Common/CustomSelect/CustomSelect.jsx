import React from "react";
import { FormControl, Select, MenuItem } from "@mui/material";
import { styled } from "@mui/material/styles";

const StyledFormControl = styled(FormControl)(() => ({
    width: '100%',
    backgroundColor: '#C5A9DE',
    borderRadius: '4px',
    height: '40px',
    justifyContent: 'center',
    '.MuiOutlinedInput-root': {
        backgroundColor: '#C5A9DE',
        borderRadius: '4px',
        height: '40px',
        padding: '0 12px',
        '& fieldset': {
            border: 'none',
        },
        '& .MuiSelect-select': {
            padding: '0',
            display: 'flex',
            alignItems: 'center',
            height: '40px',
            fontSize: '14px',
            fontFamily: 'Inter',
            fontStyle: 'normal',
            lineHeight: '16px',
            color: '#201827',
        },
        '& svg': {
            width: '26px',
            height: '26px',
        }
    },
    '.MuiPaper-root': {
        borderRadius: '4px',
    }
}));

const StyledMenuItem = styled(MenuItem)(() => ({
    height: '40px',
    backgroundColor: '#FFFFFF',
    fontSize: '14px',
    fontFamily: 'Inter',
    fontStyle: 'normal',
    lineHeight: '16px',
    color: '#201827',
    borderTop: '1px solid #C5A9DE',
    '&.Mui-selected': {
        backgroundColor: '#E6D3F3',
    },
    '&.Mui-selected:hover': {
        backgroundColor: '#dcc3f0'
    },
    '&:hover': {
        backgroundColor: '#f1e8fc',
    },
    '& em': {
        fontStyle: 'normal',
        color: '#201827',
    }
}));

const CustomSelect = ({ value, onChange, options, label }) => {
    return (
        <div>
            <StyledFormControl>
                <Select
                    value={value}
                    onChange={onChange}
                    displayEmpty
                    inputProps={{ 'aria-label': label }}
                    MenuProps={{
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
                    }}
                >
                    <StyledMenuItem disabled value="">
                        <em style={{fontStyle: 'normal',}}>{label}</em>
                    </StyledMenuItem>
                    {options.map((option) => (
                        <StyledMenuItem key={option.value} value={option.value}>
                            {option.name}
                        </StyledMenuItem>
                    ))}
                </Select>
            </StyledFormControl>
        </div>
    );
};

export default CustomSelect;
