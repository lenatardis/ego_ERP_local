import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import styles from "./PaymentForCRM.module.scss";
import pricelistStyles from "../Pricelist/Pricelist.module.scss";

import SearchFilter from "../Common/SearchFilter/SearchFilter";
import Filter from "../Common/Filter/Filter";
import PopupCloser from "../Common/PopupCloser/PopupCloser";
import Table from "../Common/Table/Table";
import TableFixedHeader from "../Common/Table/TableFixedHeader.jsx";
import InputBox from "../Common/InputBox/InputBox.jsx";
import NewCustomSelect from "../Common/NewCustomSelect/NewCustomSelect.jsx";
import CentralPopup from "../Common/CentralPopup/CentralPopup";
import Preloader from "../Common/Preloader/Preloader.jsx";

import { Pagination, Tooltip } from "@mui/material";
import { useNavigate } from "react-router";
import { useStickyXScroll } from "../../hooks/useStickyXScroll.jsx";

import { getAccessToken } from "../../api/authStorage.js";
import {
  fetchCRMPayments,
  editCRMPayment,
} from "../../api/tablesApi.js";

import DocumentIcon from "../../assets/icons/document.svg";
import InfoIcon from "../../assets/icons/info.svg";
import ArrBack from "../Common/ArrBack/ArrBack.jsx";

const ITEMS_PER_PAGE = 25;

const TYPE_MAP = {
  ONLINE: "Онлайн",
  IBAN: "IBAN",
  TAX: "Накладений платіж",
};

const METHOD_MAP = {
  FULL: "Повна оплата",
  PREPAYMENT: "Передплата",
  POSTPAID: "Післяплата",
};

const STATUS_MAP = {
  PAY_WAIT: "Очікує оплати",
  PAID: "Оплачено",
  NOT_PAID: "Не оплачено",
  REFUND: "Повернення",
};

const APPROVED_MAP = {
  IN_PROC: "На розгляді",
  APPROVED: "Підтверджено",
  DECLINED: "Відхилено",
};

const typeOptions = [
  { value: "", name: "Усі" },
  { value: "ONLINE", name: "Онлайн" },
  { value: "IBAN", name: "IBAN" },
  { value: "TAX", name: "Накладений платіж" },
];

const methodOptions = [
  { value: "", name: "Усі" },
  { value: "FULL", name: "Повна оплата" },
  { value: "PREPAYMENT", name: "Передплата" },
  { value: "POSTPAID", name: "Післяплата" },
];

const statusOptions = [
  { value: "", name: "Усі" },
  { value: "PAY_WAIT", name: "Очікує оплати" },
  { value: "PAID", name: "Оплачено" },
  { value: "NOT_PAID", name: "Не оплачено" },
  { value: "REFUND", name: "Повернення" },
];

const receiptApprovedOptions = [
  { value: "", name: "Усі" },
  { value: "APPROVED", name: "Підтверджено" },
  { value: "DECLINED", name: "Відхилено" },
  { value: "IN_PROC", name: "На розгляді" },
];

const linkedOptions = [
  { value: "", name: "Усі" },
  { value: "true", name: "Так" },
  { value: "false", name: "Ні" },
];

const formatMoney = (value) => {
  if (value === undefined || value === null || value === "") return "";
  const num = Number(value);
  return Number.isNaN(num) ? value : num.toLocaleString("uk-UA");
};

const formatDateTime = (value) => {
  if (!value) return "";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString("uk-UA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const TooltipDateCell = ({ value, tooltip }) => {
  if (!value) return null;

  const displayValue = formatDateTime(value);

  return (
    <div className={styles.tooltipCell}>
      <span>{displayValue}</span>
      <Tooltip title={tooltip} arrow placement="top">
        <img src={InfoIcon} className={styles.infoIcon} alt="Інфо" />
      </Tooltip>
    </div>
  );
};

const ApprovedBadge = ({ value }) => {
  if (!value) return null;

  const cls =
    value === "APPROVED"
      ? styles.approved
      : value === "DECLINED"
        ? styles.declined
        : value === "IN_PROC"
          ? styles.inProc
          : "";

  return (
    <span className={`${styles.approvedBadge} ${cls}`}>
      {APPROVED_MAP[value] || value}
    </span>
  );
};

const ActionButtons = ({ row, onView, onConfirm }) => {
  const isAlreadyProcessed =
    row?.customer_receipt_approved === "APPROVED" ||
    row?.customer_receipt_approved === "DECLINED";

  const btnStyle = {
    width: "20px",
    height: "20px",
    minWidth: "20px",
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
    gap: "10px",
    width: "100%",
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
        title="Переглянути"
        onClick={() => onView(row)}
      >
        <img src={DocumentIcon} alt="Переглянути" style={iconStyle} />
      </button>

      <button
        type="button"
        className={`btnDark ${styles.btnConfirm}`}
        onClick={() => onConfirm(row)}
        disabled={isAlreadyProcessed}
        title={
          isAlreadyProcessed
            ? "Платіж вже був оброблений бухгалтером"
            : "Підтвердити платіж"
        }
      >
        <span>Підтвердити платіж</span>
      </button>
    </div>
  );
};

const mapBackendItemToRow = (item) => ({
  id: item?.id ?? "",
  type: item?.type ?? "",
  method: item?.method ?? "",
  status: item?.status ?? "",
  prepayment_amount: item?.prepayment_amount ?? "",
  prepayment_datetime: item?.prepayment_datetime ?? "",
  paid_datetime: item?.paid_datetime ?? "",
  order: item?.order ?? "",
  customer_receipt_approved: item?.customer_receipt_approved ?? "",
});

const PaymentForCRM = () => {
  const navigate = useNavigate();
  const scrollRef = useRef(null);

  const { mainRef, StickyBar, recalcX } = useStickyXScroll({
    offsetBottom: 0,
    trackHeight: 16,
    zIndex: 60,
  });

  const [rows, setRows] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isShowFilter, setIsShowFilter] = useState(false);

  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);

  const [showConfirmPopup, setShowConfirmPopup] = useState(false);
  const [selectedRow, setSelectedRow] = useState(null);

  const [filterParams, setFilterParams] = useState({
    page: 1,
    page_size: ITEMS_PER_PAGE,
    search: null,
    type: "",
    method: "",
    status: "",
    receipt_approved: "",
    paid_date: "",
    is_linked: "",
  });

  const onOpenFilter = () => setIsShowFilter(true);
  const onCloseFilter = () => setIsShowFilter(false);

  const fetchCRMPaymentsList = useCallback(async (params) => {
    try {
      setIsLoading(true);

      const token = getAccessToken();
      const response = await fetchCRMPayments(token, params);

      const list = Array.isArray(response?.results) ? response.results : [];
      const totalCount = Number(response?.count) || 0;
      const total = Math.ceil(totalCount / ITEMS_PER_PAGE) || 0;
      const current = Number(params?.page) || 1;

      setRows(list.map(mapBackendItemToRow));
      setTotalPages(total);
      setPage(current);
    } catch (error) {
      console.error("Error loading CRM payments:", error);
      setRows([]);
      setTotalPages(0);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCRMPaymentsList(filterParams);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (isShowFilter) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }

    return () => {
      document.body.style.overflow = "";
    };
  }, [isShowFilter]);

  const onSendFilters = (nextParams) => {
    const next = {
      ...nextParams,
      page: 1,
      page_size: ITEMS_PER_PAGE,
    };

    setFilterParams(next);
    setPage(1);
    fetchCRMPaymentsList(next);
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
    fetchCRMPaymentsList(next);
  };

  const resetAllFilters = useCallback(() => {
    const defaults = {
      page: 1,
      page_size: ITEMS_PER_PAGE,
      search: null,
      type: "",
      method: "",
      status: "",
      receipt_approved: "",
      paid_date: "",
      is_linked: "",
    };

    setFilterParams(defaults);
    setPage(1);
    fetchCRMPaymentsList(defaults);
  }, [fetchCRMPaymentsList]);

  const onView = (row) => {
    if (!row?.id) return;
    navigate(`/crm-payment-info/${row.id}`);
  };

  const onConfirm = (row) => {
    const isAlreadyProcessed =
      row?.customer_receipt_approved === "APPROVED" ||
      row?.customer_receipt_approved === "DECLINED";

    if (isAlreadyProcessed) return;

    setSelectedRow(row);
    setShowConfirmPopup(true);
  };

  const closeConfirmPopup = () => {
    setSelectedRow(null);
    setShowConfirmPopup(false);
  };

  const handleChangeApproveStatus = async (statusValue) => {
    const isAlreadyProcessed =
      selectedRow?.customer_receipt_approved === "APPROVED" ||
      selectedRow?.customer_receipt_approved === "DECLINED";

    if (!selectedRow?.id || isAlreadyProcessed) {
      closeConfirmPopup();
      return;
    }

    try {
      setIsLoading(true);

      const token = getAccessToken();

      await editCRMPayment(token, selectedRow.id, {
        customer_receipt_approved: statusValue,
      });

      closeConfirmPopup();
      await fetchCRMPaymentsList(filterParams);
    } catch (error) {
      console.error("Error editing CRM payment:", error);
      closeConfirmPopup();
    } finally {
      setIsLoading(false);
    }
  };

  const columns = useMemo(() => [
    {
      key: "type",
      title: "Тип",
      width: "0.58fr",
      render: (val) => TYPE_MAP[val] || val || "",
    },
    {
      key: "method",
      title: "Метод",
      width: "0.78fr",
      render: (val) => METHOD_MAP[val] || val || "",
    },
    {
      key: "status",
      title: "Статус",
      width: "0.78fr",
      render: (val) => STATUS_MAP[val] || val || "",
    },
    {
      key: "prepayment_amount",
      title: "Сума",
      width: "0.72fr",
      render: (val) => formatMoney(val),
    },
    {
      key: "prepayment_datetime",
      title: "Орієнтовна дата сплати",
      width: "1.08fr",
      render: (val) => (
        <TooltipDateCell
          value={val}
          tooltip="Менеджер вказує дату, коли клієнт орієнтовно зробить оплату"
        />
      ),
    },
    {
      key: "paid_datetime",
      title: "Дата оплати",
      width: "0.96fr",
      render: (val) => (
        <TooltipDateCell
          value={val}
          tooltip="Дата і час, коли клієнт зробив оплату"
        />
      ),
    },
    {
      key: "order",
      title: "№ замовлення",
      width: "0.62fr",
      render: (val) => val || "",
    },
    {
      key: "customer_receipt_approved",
      title: "Підтверджено бухгалтером",
      width: "0.92fr",
      render: (val) => <ApprovedBadge value={val} />,
    },
    {
      key: "actions",
      title: "Дії",
      width: "1.3fr",
      render: (val, row) => (
        <ActionButtons
          row={row}
          onView={onView}
          onConfirm={onConfirm}
        />
      ),
    },
  ], []);

  const minWidthPx =
    75 +   // Тип
    95 +   // Метод
    95 +   // Статус
    85 +   // Сума
    155 +  // Орієнтовна дата сплати
    140 +  // Дата оплати
    85 +   // № замовлення
    145 +  // Підтверджено бухгалтером
    210;   // Дії

  const scrollWrapStyle = { overflowX: "auto", paddingBottom: 8 };
  const innerStyle = { minWidth: `${minWidthPx}px` };

  useEffect(() => {
    recalcX();
  }, [rows.length, recalcX]);

  useEffect(() => {
    recalcX();
  }, [minWidthPx, recalcX]);

  return (
    <div className={styles.payments}>
      <ArrBack/>
      <SearchFilter
        onOpenFilter={onOpenFilter}
        title={"CRM платежі"}
        searchValue={filterParams.search}
        setSearchValue={(value) =>
          setFilterParams((prev) => ({ ...prev, search: value }))
        }
        onSearch={() => onSendFilters(filterParams)}
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
        style={scrollWrapStyle}
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
        <div style={innerStyle}>
          <Table
            columns={columns}
            data={rows}
            centered
            zeroPdTable
            hideHeader
          />
        </div>
      </div>

      <StickyBar />

      <Filter isShow={isShowFilter} deleteFilters={resetAllFilters}>
        <NewCustomSelect
          label="Тип"
          value={filterParams.type}
          onChange={(e) => {
            const next = { ...filterParams, type: e.target.value };
            onSendFilters(next);
          }}
          options={typeOptions}
        />

        <NewCustomSelect
          label="Метод"
          value={filterParams.method}
          onChange={(e) => {
            const next = { ...filterParams, method: e.target.value };
            onSendFilters(next);
          }}
          options={methodOptions}
        />

        <NewCustomSelect
          label="Статус"
          value={filterParams.status}
          onChange={(e) => {
            const next = { ...filterParams, status: e.target.value };
            onSendFilters(next);
          }}
          options={statusOptions}
        />

        <NewCustomSelect
          label="Підтвердження чека"
          value={filterParams.receipt_approved}
          onChange={(e) => {
            const next = {
              ...filterParams,
              receipt_approved: e.target.value,
            };
            onSendFilters(next);
          }}
          options={receiptApprovedOptions}
        />

        <InputBox
          label="Дата оплати"
          name="paid_date"
          type="date"
          errors={{}}
          options={{
            value: filterParams.paid_date || "",
            onChange: (e) => {
              const next = {
                ...filterParams,
                paid_date: e.target.value || "",
              };
              onSendFilters(next);
            },
          }}
        />

        <NewCustomSelect
          label="Прив'язано"
          value={filterParams.is_linked}
          onChange={(e) => {
            const next = { ...filterParams, is_linked: e.target.value };
            onSendFilters(next);
          }}
          options={linkedOptions}
        />
      </Filter>

      <PopupCloser isShow={isShowFilter} onClose={onCloseFilter} />

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

      {showConfirmPopup && selectedRow && (
        <CentralPopup
          title={"Підтвердження CRM платежу"}
          onClose={closeConfirmPopup}
        >
          <div className={styles.confirmPopupContent}>
            <p>
              Перевірте дані платежу #{selectedRow.id} CRM замовлення #{selectedRow.order} перед підтвердженням.
            </p>

            <p>
              Підтвердження означає, що платіж дійсно був здійснений.
              <br />
              Відхилення означає, що платіж потребує додаткової перевірки або не відповідає дійсності.
            </p>

            <p>
              Якщо ви не впевнені, закрийте це вікно — жодних змін не буде внесено.
            </p>

            <div className={styles.confirmPopupActions}>
              <button
                type="button"
                className={styles.btnGreen}
                onClick={() => handleChangeApproveStatus("APPROVED")}
              >
                <span>Підтвердити</span>
              </button>

              <button
                type="button"
                className={styles.btnRed}
                onClick={() => handleChangeApproveStatus("DECLINED")}
              >
                <span>Відхилити</span>
              </button>
            </div>
            <p className={styles.confirmPopupWarning}>
              <strong>
                Увага! Після підтвердження або відхилення платіж не підлягає повторній обробці.
              </strong>
            </p>
          </div>
        </CentralPopup>
      )}

      {isLoading && <Preloader />}
    </div>
  );
};

export default PaymentForCRM;