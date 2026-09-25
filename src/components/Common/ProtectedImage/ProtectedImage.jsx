import React, { useEffect, useRef, useState } from "react";

const ProtectedImage = ({
    src,
    alt,
    token,
    className,
    fallbackClassName,
    fallbackText = "Немає фото",
}) => {
    const [mode, setMode] = useState("src"); // "src" | "blob" | "fallback"
    const [blobUrl, setBlobUrl] = useState("");
    const [isBlobLoading, setIsBlobLoading] = useState(false);

    const objectUrlRef = useRef("");

    useEffect(() => {
        setMode(src ? "src" : "fallback");
        setBlobUrl("");
        setIsBlobLoading(false);

        if (objectUrlRef.current) {
            URL.revokeObjectURL(objectUrlRef.current);
            objectUrlRef.current = "";
        }

        return () => {
            if (objectUrlRef.current) {
                URL.revokeObjectURL(objectUrlRef.current);
                objectUrlRef.current = "";
            }
        };
    }, [src]);

    useEffect(() => {
        let isCancelled = false;

        const loadProtectedImage = async () => {
            if (mode !== "blob" || !src) return;

            try {
                setIsBlobLoading(true);
                setBlobUrl("");

                const response = await fetch(src, {
                    method: "GET",
                    headers: token
                        ? {
                              Authorization: `Bearer ${token}`,
                          }
                        : undefined,
                    credentials: "include",
                });

                if (!response.ok) {
                    throw new Error(`Image load failed: ${response.status}`);
                }

                const blob = await response.blob();

                if (!blob.type.startsWith("image/")) {
                    throw new Error(`Unexpected content type: ${blob.type}`);
                }

                const nextObjectUrl = URL.createObjectURL(blob);

                if (isCancelled) {
                    URL.revokeObjectURL(nextObjectUrl);
                    return;
                }

                if (objectUrlRef.current) {
                    URL.revokeObjectURL(objectUrlRef.current);
                }

                objectUrlRef.current = nextObjectUrl;
                setBlobUrl(nextObjectUrl);
            } catch (error) {
                console.error("Protected image load error:", error);

                if (!isCancelled) {
                    setBlobUrl("");
                    setMode("fallback");
                }
            } finally {
                if (!isCancelled) {
                    setIsBlobLoading(false);
                }
            }
        };

        loadProtectedImage();

        return () => {
            isCancelled = true;
        };
    }, [mode, src, token]);

    if (!src || mode === "fallback") {
        return <div className={fallbackClassName}>{fallbackText}</div>;
    }

    if (mode === "blob") {
        if (isBlobLoading && !blobUrl) {
            return <div className={fallbackClassName}>Завантаження...</div>;
        }

        if (blobUrl) {
            return (
                <img
                    src={blobUrl}
                    alt={alt}
                    className={className}
                    loading="lazy"
                    onError={() => setMode("fallback")}
                />
            );
        }

        return <div className={fallbackClassName}>{fallbackText}</div>;
    }

    return (
        <img
            src={src}
            alt={alt}
            className={className}
            loading="lazy"
            onError={() => {
                if (token) {
                    setMode("blob");
                } else {
                    setMode("fallback");
                }
            }}
        />
    );
};

export default ProtectedImage;