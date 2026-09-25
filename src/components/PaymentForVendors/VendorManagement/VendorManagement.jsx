import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import pricelistStyles from "../../Pricelist/Pricelist.module.scss";

import SearchFilter from "../../Common/SearchFilter/SearchFilter";
import CentralPopup from "../../Common/CentralPopup/CentralPopup";
import Table from "../../Common/Table/Table";
import TableFixedHeader from "../../Common/Table/TableFixedHeader.jsx";
import InputBox from "../../Common/InputBox/InputBox.jsx";
import Preloader from "../../Common/Preloader/Preloader.jsx";

import { Pagination } from "@mui/material";
import { useStickyXScroll } from "../../../hooks/useStickyXScroll.jsx";
import { getAccessToken } from "../../../api/authStorage.js";
import { fetchVendors, createVendor, editVendor, deleteVendor } from "../../../api/tablesApi.js";

import { useAppDispatch } from "../../../hooks/redux.jsx";
import { setIsActivePopup } from "../../../store/main-slice.js";

import EditIcon from "../../../assets/icons/editIcon.svg";
import BinIcon from "../../../assets/icons/bin.svg";
import ArrBack from "../../Common/ArrBack/ArrBack.jsx";
import OptionLimitLabel from "../../Common/OptionLimitLabel/OptionLimitLabel.jsx";
import LimitedCell from "../../Common/LimitedCell/LimitedCell.jsx";

const ITEMS_PER_PAGE = 25;
const MAX_VENDOR_FULL_NAME_LENGTH = 60;
const MAX_VENDOR_EMAIL_LENGTH = 50;
const MAX_VENDOR_PHONE_LENGTH = 20;

const mapVendorToRow = (item) => ({
  id: item?.id ?? "",
  full_name: item?.full_name ?? "",
  email: item?.email ?? "",
  phone: item?.phone ?? "",
  dept: item?.dept ?? null,
  created: item?.created ?? "",
  modified: item?.modified ?? "",
  deleted_at: item?.deleted_at ?? null,
});

const ActionButtons = ({ row, onEdit, onDelete }) => {
  const btnStyle = {
    width: "22px",
    height: "22px",
    minWidth: "22px",
    border: "none",
    background: "#D9D1E0",
    borderRadius: "4px",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    padding: 0,
  };

  const wrapStyle = {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    columnGap: "20px",
    width: "100%",
    gap: "10px",
  };

  const iconStyle = {
    display: "block",
    width: "16px",
    height: "16px",
  };

  return (
    <div style={wrapStyle}>
      <button
        type="button"
        style={btnStyle}
        title="Редагувати"
        onClick={() => onEdit(row)}
      >
        <img src={EditIcon} alt="Редагувати" style={iconStyle} />
      </button>

      <button
        type="button"
        style={btnStyle}
        title="Видалити"
        onClick={() => onDelete(row)}
      >
        <img src={BinIcon} alt="Видалити" style={iconStyle} />
      </button>
    </div>
  );
};

const normalizePhoneValue = (value) => {
  const input = String(value || "");
  let result = "";

  for (let i = 0; i < input.length; i += 1) {
    const char = input[i];

    if (char >= "0" && char <= "9") {
      result += char;
      continue;
    }

    if (char === "+" && result.length === 0) {
      result += "+";
    }
  }

  return result;
};

const VendorManagement = () => {
  const dispatch = useAppDispatch();
  const scrollRef = useRef(null);

  const { mainRef, StickyBar, recalcX } = useStickyXScroll({
    offsetBottom: 0,
    trackHeight: 16,
    zIndex: 60,
  });

  const [rows, setRows] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);

  const [filterParams, setFilterParams] = useState({
    page: 1,
    page_size: ITEMS_PER_PAGE,
    search: null,
    uah_dept_min: null,
    uah_dept_max: null,
    usd_dept_min: null,
    usd_dept_max: null,
  });

  const [isCreatePopupOpen, setIsCreatePopupOpen] = useState(false);
  const [isEditPopupOpen, setIsEditPopupOpen] = useState(false);
  const [isDeletePopupOpen, setIsDeletePopupOpen] = useState(false);

  const [selectedRow, setSelectedRow] = useState(null);

  const [createForm, setCreateForm] = useState({
    full_name: "",
    email: "",
    phone: "",
  });
  const [createErrors, setCreateErrors] = useState({});

  const [editForm, setEditForm] = useState({
    full_name: "",
    email: "",
    phone: "",
  });
  const [editErrors, setEditErrors] = useState({});

  const fetchVendorsList = useCallback(async (params) => {
    try {
      setIsLoading(true);

      const token = getAccessToken();
      const response = await fetchVendors(token, params);

      const list = Array.isArray(response?.vendors) ? response.vendors : [];
      const total = Number(response?.total_pages) || 0;
      const current = Number(response?.current_page) || 1;

      setRows(list.map(mapVendorToRow));
      setTotalPages(total);
      setPage(current);
    } catch (error) {
      console.error("Error loading vendors:", error);
      setRows([]);
      setTotalPages(0);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchVendorsList(filterParams);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onSendFilters = (nextParams) => {
    const next = {
      ...nextParams,
      page: 1,
      page_size: ITEMS_PER_PAGE,
    };

    setFilterParams(next);
    setPage(1);
    fetchVendorsList(next);
  };

  const handlePaginationChange = (event, value) => {
    if (page === value) return;

    const next = {
      ...filterParams,
      page: value,
      page_size: ITEMS_PER_PAGE,
    };

    setFilterParams(next);
    setPage(value);
    window.scrollTo({ top: 0, behavior: "auto" });
    fetchVendorsList(next);
  };

  const openCreatePopup = () => {
    setCreateForm({
      full_name: "",
      email: "",
      phone: "",
    });
    setCreateErrors({});
    setIsEditPopupOpen(false);
    setIsDeletePopupOpen(false);
    setIsCreatePopupOpen(true);
    dispatch(setIsActivePopup(true));
  };

  const closeCreatePopup = () => {
    setIsCreatePopupOpen(false);
    setCreateForm({
      full_name: "",
      email: "",
      phone: "",
    });
    setCreateErrors({});
    dispatch(setIsActivePopup(false));
  };

  const openEditPopup = (row) => {
    setSelectedRow(row);
    setEditForm({
      full_name: row?.full_name || "",
      email: row?.email || "",
      phone: row?.phone || "",
    });
    setEditErrors({});
    setIsCreatePopupOpen(false);
    setIsDeletePopupOpen(false);
    setIsEditPopupOpen(true);
    dispatch(setIsActivePopup(true));
  };

  const closeEditPopup = () => {
    setIsEditPopupOpen(false);
    setSelectedRow(null);
    setEditForm({
      full_name: "",
      email: "",
      phone: "",
    });
    setEditErrors({});
    dispatch(setIsActivePopup(false));
  };

  const openDeletePopup = (row) => {
    setSelectedRow(row);
    setIsCreatePopupOpen(false);
    setIsEditPopupOpen(false);
    setIsDeletePopupOpen(true);
    dispatch(setIsActivePopup(true));
  };

  const closeDeletePopup = () => {
    setIsDeletePopupOpen(false);
    setSelectedRow(null);
    dispatch(setIsActivePopup(false));
  };

  const clearCreateError = (key) => {
    setCreateErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const clearEditError = (key) => {
    setEditErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const validateVendorForm = (form, mode = "create") => {
    const errors = {};
    const fullName = form.full_name?.trim() || "";
    const email = form.email?.trim() || "";
    const phone = form.phone?.trim() || "";

    if (!fullName) {
      errors[`${mode}FullName`] = { message: "Вкажіть ПІБ постачальника" };
    }
    if (fullName.length > MAX_VENDOR_FULL_NAME_LENGTH) {
      errors[`${mode}FullName`] = { message: "ПІБ має бути не більше 60 символів" };
    }

    if (!phone) {
      errors[`${mode}Phone`] = { message: "Вкажіть телефон" };
    }

    if (phone.length > MAX_VENDOR_PHONE_LENGTH) {
      errors[`${mode}Phone`] = { message: "Телефон має бути не більше 20 символів" };
    }

    if (email.length > MAX_VENDOR_EMAIL_LENGTH) {
      errors[`${mode}Email`] = { message: "Пошта має бути не більше 50 символів" };
    }

    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors[`${mode}Email`] = { message: "Вкажіть коректну пошту" };
    }

    return errors;
  };

  const handleCreateVendor = async () => {
    const errors = validateVendorForm(createForm, "create");

    if (Object.keys(errors).length > 0) {
      setCreateErrors(errors);
      return;
    }

    try {
      setIsLoading(true);

      const token = getAccessToken();
      const payload = {
        full_name: createForm.full_name.trim(),
        email: createForm.email.trim() || "",
        phone: createForm.phone.trim(),
      };

      await createVendor(token, payload);

      closeCreatePopup();

      const next = {
        ...filterParams,
        page: 1,
        page_size: ITEMS_PER_PAGE,
      };

      setFilterParams(next);
      setPage(1);
      await fetchVendorsList(next);
    } catch (error) {
      console.error("Error creating vendor:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEditVendor = async () => {
    if (!selectedRow?.id) {
      closeEditPopup();
      return;
    }

    const errors = validateVendorForm(editForm, "edit");

    if (Object.keys(errors).length > 0) {
      setEditErrors(errors);
      return;
    }

    try {
      setIsLoading(true);

      const token = getAccessToken();
      const payload = {
        full_name: editForm.full_name.trim(),
        email: editForm.email.trim() || "",
        phone: editForm.phone.trim(),
      };

      await editVendor(token, selectedRow.id, payload);

      closeEditPopup();
      await fetchVendorsList(filterParams);
    } catch (error) {
      console.error("Error editing vendor:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteVendor = async () => {
    if (!selectedRow?.id) {
      closeDeletePopup();
      return;
    }

    try {
      setIsLoading(true);

      const token = getAccessToken();
      await deleteVendor(token, selectedRow.id);

      closeDeletePopup();

      const shouldGoPrevPage = rows.length === 1 && page > 1;
      const nextPage = shouldGoPrevPage ? page - 1 : page;

      const next = {
        ...filterParams,
        page: nextPage,
        page_size: ITEMS_PER_PAGE,
      };

      setFilterParams(next);
      setPage(nextPage);
      await fetchVendorsList(next);
    } catch (error) {
      console.error("Error deleting vendor:", error);
      closeDeletePopup();
    } finally {
      setIsLoading(false);
    }
  };

  const columns = useMemo(() => [
    {
      key: "full_name",
      title: "ПІБ",
      width: "1.4fr",
      render: (val) => <LimitedCell value={val} />,
    },
    {
      key: "email",
      title: "Пошта",
      width: "1.3fr",
      render: (val) => <LimitedCell value={val} />,
    },
    {
      key: "phone",
      title: "Телефон",
      width: "1fr",
      render: (val) => <LimitedCell value={val} />,
    },
    {
      key: "actions",
      title: "Дії",
      width: "0.8fr",
      render: (_, row) => (
        <ActionButtons
          row={row}
          onEdit={openEditPopup}
          onDelete={openDeletePopup}
        />
      ),
    },
  ], [rows]);

  const minWidthPx =
    280 + // ПІБ
    240 + // Пошта
    180 + // Телефон
    140;  // Дії

  useEffect(() => {
    recalcX();
  }, [rows.length, recalcX]);

  useEffect(() => {
    recalcX();
  }, [minWidthPx, recalcX]);

  return (
    <div>
      <ArrBack />
      <SearchFilter
        onOpenFilter={() => { }}
        title="Постачальники"
        searchValue={filterParams.search}
        setSearchValue={(value) =>
          setFilterParams((prev) => ({ ...prev, search: value }))
        }
        onSearch={() => onSendFilters(filterParams)}
        isAdd
        onAdd={openCreatePopup}
        hideFilterButton
      />

      <TableFixedHeader
        columns={columns}
        subtitle={null}
        equalColumns={false}
        centered
        scrollContainerRef={scrollRef}
        minWidth={minWidthPx}
        stickyTop={0}
        stickyZIndex={8}
      />

      <div
        style={{ overflowX: "auto", paddingBottom: 8 }}
        ref={(el) => {
          if (typeof mainRef === "function") {
            mainRef(el);
          } else if (mainRef && "current" in mainRef) {
            mainRef.current = el;
          }
          scrollRef.current = el;
        }}
        className={pricelistStyles.xScrollHide}
      >
        <div style={{ minWidth: `${minWidthPx}px` }}>
          <Table
            columns={columns}
            data={rows}
            centered
            hideHeader
          />
        </div>
      </div>

      <StickyBar />

      {totalPages > 1 && (
        <Pagination
          count={totalPages}
          page={page}
          siblingCount={1}
          boundaryCount={1}
          hidePrevButton
          hideNextButton
          onChange={handlePaginationChange}
        />
      )}

      {isCreatePopupOpen && (
        <CentralPopup
          title="Додавання постачальника"
          onClose={closeCreatePopup}
        >
          <div style={{ display: "flex", flexDirection: "column", rowGap: "16px" }}>
            <InputBox
              errors={createErrors}
              name="createFullName"
              label={<OptionLimitLabel text="ПІБ" maxLength={MAX_VENDOR_FULL_NAME_LENGTH} />}
              placeholder="Введіть ПІБ постачальника"
              options={{
                value: createForm.full_name,
                maxLength: MAX_VENDOR_FULL_NAME_LENGTH,
                onChange: (e) => {
                  const value = e.target.value.slice(0, MAX_VENDOR_FULL_NAME_LENGTH);
                  setCreateForm((prev) => ({ ...prev, full_name: value }));
                  clearCreateError("createFullName");
                },
              }}
            />

            <InputBox
              errors={createErrors}
              name="createEmail"
              label={<OptionLimitLabel text="Пошта" maxLength={MAX_VENDOR_EMAIL_LENGTH} />}
              placeholder="Введіть пошту"
              options={{
                value: createForm.email,
                maxLength: MAX_VENDOR_EMAIL_LENGTH,
                onChange: (e) => {
                  const value = e.target.value.slice(0, MAX_VENDOR_EMAIL_LENGTH);
                  setCreateForm((prev) => ({ ...prev, email: value }));
                  clearCreateError("createEmail");
                },
              }}
            />

            <InputBox
              errors={createErrors}
              name="createPhone"
              label={<OptionLimitLabel text="Телефон" maxLength={MAX_VENDOR_PHONE_LENGTH} />}
              placeholder="Введіть телефон"
              options={{
                value: createForm.phone,
                maxLength: MAX_VENDOR_PHONE_LENGTH,
                onChange: (e) => {
                  const value = normalizePhoneValue(e.target.value).slice(0, MAX_VENDOR_PHONE_LENGTH);
                  setCreateForm((prev) => ({ ...prev, phone: value }));
                  clearCreateError("createPhone");
                },
              }}
            />
            <button
              type="button"
              className="btnDark"
              onClick={handleCreateVendor}
            >
              <span>Додати</span>
            </button>
          </div>
        </CentralPopup>
      )}

      {isEditPopupOpen && (
        <CentralPopup
          title="Редагування постачальника"
          onClose={closeEditPopup}
        >
          <div style={{ display: "flex", flexDirection: "column", rowGap: "16px" }}>
            <InputBox
              errors={editErrors}
              name="editFullName"
              label={<OptionLimitLabel text="ПІБ" maxLength={MAX_VENDOR_FULL_NAME_LENGTH} />}
              placeholder="Введіть ПІБ постачальника"
              options={{
                value: editForm.full_name,
                maxLength: MAX_VENDOR_FULL_NAME_LENGTH,
                onChange: (e) => {
                  const value = e.target.value.slice(0, MAX_VENDOR_FULL_NAME_LENGTH);
                  setEditForm((prev) => ({ ...prev, full_name: value }));
                  clearEditError("editFullName");
                },
              }}
            />

            <InputBox
              errors={editErrors}
              name="editEmail"
              label={<OptionLimitLabel text="Пошта" maxLength={MAX_VENDOR_EMAIL_LENGTH} />}
              placeholder="Введіть пошту"
              options={{
                value: editForm.email,
                maxLength: MAX_VENDOR_EMAIL_LENGTH,
                onChange: (e) => {
                  const value = e.target.value.slice(0, MAX_VENDOR_EMAIL_LENGTH);
                  setEditForm((prev) => ({ ...prev, email: value }));
                  clearEditError("editEmail");
                },
              }}
            />

            <InputBox
              errors={editErrors}
              name="editPhone"
              label={<OptionLimitLabel text="Телефон" maxLength={MAX_VENDOR_PHONE_LENGTH} />}
              placeholder="Введіть телефон"
              options={{
                value: editForm.phone,
                maxLength: MAX_VENDOR_PHONE_LENGTH,
                onChange: (e) => {
                  const value = normalizePhoneValue(e.target.value).slice(0, MAX_VENDOR_PHONE_LENGTH);
                  setEditForm((prev) => ({ ...prev, phone: value }));
                  clearEditError("editPhone");
                },
              }}
            />

            <button
              type="button"
              className="btnDark"
              onClick={handleEditVendor}
            >
              <span>Редагувати</span>
            </button>
          </div>
        </CentralPopup>
      )}

      {isDeletePopupOpen && (
        <CentralPopup
          title="Видалення постачальника"
          onClose={closeDeletePopup}
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
            <h3 style={{ paddingBottom: 0 }}>
              Ви дійсно бажаєте видалити постачальника?
            </h3>

            <button
              type="button"
              className="btnDark"
              style={{ width: "200px" }}
              onClick={handleDeleteVendor}
            >
              <span>Видалити</span>
            </button>

            <button
              type="button"
              className="btnLight"
              style={{ width: "200px" }}
              onClick={closeDeletePopup}
            >
              <span>Скасувати</span>
            </button>
          </div>
        </CentralPopup>
      )}

      {isLoading && <Preloader />}
    </div>
  );
};

export default VendorManagement;