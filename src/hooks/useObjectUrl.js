import { useEffect, useState } from "react";

export const useObjectUrl = (file) => {
    const [url, setUrl] = useState("");

    useEffect(() => {
        if (!(file instanceof File)) {
            setUrl("");
            return;
        }

        const objectUrl = URL.createObjectURL(file);
        setUrl(objectUrl);

        return () => {
            URL.revokeObjectURL(objectUrl);
        };
    }, [file]);

    return url;
};
