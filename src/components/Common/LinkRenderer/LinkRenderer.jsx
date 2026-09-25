import React, { useCallback } from "react";
import LinkIcon from "../../../assets/icons/link.svg";
import CopyIcon from "../../../assets/icons/copy.svg";
import styles from "./LinkRenderer.module.scss";

const LinkRenderer = ({ value, copy = false, className = "" }) => {
  if (!value) return "";

  const raw = String(value).trim();
  const normalized = raw.replace(/\s+/g, "");
  const href = /^(https?:)?\/\//i.test(normalized)
    ? normalized
    : `https://${normalized}`;

  const handleCopy = useCallback(async (e) => {
    e.preventDefault();
    e.stopPropagation();

    try {
      await navigator.clipboard.writeText(raw);
    } catch (error) {
      console.error("Copy failed:", error);
    }
  }, [raw]);

  if (copy) {
    return (
      <button
        type="button"
        title="Скопіювати"
        className={`${styles.copyBtn} ${className}`.trim()}
        onClick={handleCopy}
      >
        <img src={CopyIcon} alt="" />
      </button>
    );
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      title={raw}
      className={`${styles.linkWrap} ${className}`.trim()}
      onClick={(e) => e.stopPropagation()}
    >
      <img src={LinkIcon} alt="" />
    </a>
  );
};

export default LinkRenderer;