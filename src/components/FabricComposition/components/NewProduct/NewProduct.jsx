import React, { useState, useEffect, useRef } from "react";
import styles from '../NewFabric/NewFabric.module.scss';
import WhiteCustomSelect from "../../../Common/WhiteCustomSelect/WhiteCustomSelect.jsx";
import InputBox from "../../../Common/InputBox/InputBox.jsx";
import { getAccessToken } from "../../../../api/authStorage.js";
import { fetchProductProperties, createNewProduct } from "../../../../api/tablesApi.js";
import { useForm, Controller } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as Yup from "yup";
import Preloader from "../../../Common/Preloader/Preloader.jsx";
import { useNavigate } from "react-router-dom";

/* Yup: обов'язкові поля name, type */
const schema = Yup.object({
    name: Yup.string().trim().max(50, 'До 50 символів').required("Вкажіть назву"),
    type: Yup.number()
        .transform(v => (isNaN(v) ? undefined : v))
        .integer().positive('Оберіть тип').required('Оберіть категорію')
});

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

const NewProduct = ({
    initialName = '',
    onCreated = null,
    popupMode = false,
    alreadyExists = false
}) => {
    const [isLoading, setIsLoading] = useState(false);
    const [categoryOptions, setCategoryOptions] = useState([]);
    const [typeId, setTypeId] = useState('');
    const [bannerMsg, setBannerMsg] = useState(null);
    const [existingProductError, setExistingProductError] = useState(false);

    const [photoFiles, setPhotoFiles] = useState([]);
    const [photoPreviews, setPhotoPreviews] = useState([]);
    const [photoError, setPhotoError] = useState('');

    const fileInputRef = useRef(null);
    const navigate = useNavigate();

    const {
        register,
        handleSubmit,
        control,
        formState: { errors },
        reset,
    } = useForm({
        resolver: yupResolver(schema),
        mode: 'onChange',
        reValidateMode: 'onChange',
        defaultValues: {
            name: initialName || '',
            type: ''
        },
    });

    useEffect(() => {
        const loadCategories = async () => {
            try {
                setIsLoading(true);
                const token = getAccessToken();
                const resp = await fetchProductProperties(token);

                if (Array.isArray(resp?.categories)) {
                    setCategoryOptions(resp.categories.map(t => ({
                        name: t.name,
                        value: t.id,
                    })));
                } else {
                    setCategoryOptions([]);
                }
            } catch (e) {
                console.error('Error loading types:', e);
                setCategoryOptions([]);
            } finally {
                setIsLoading(false);
            }
        };

        loadCategories();
    }, []);

    const typeSelectOptions = categoryOptions.map(o => ({
        name: o.name,
        value: String(o.value),
    }));

    useEffect(() => {
        reset({
            name: initialName || '',
            type: ''
        });
        setTypeId('');
        setPhotoError('');

        photoPreviews.forEach(item => URL.revokeObjectURL(item.preview));
        setPhotoFiles([]);
        setPhotoPreviews([]);

        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    }, [initialName, reset]);

    useEffect(() => {
        return () => {
            photoPreviews.forEach(item => URL.revokeObjectURL(item.preview));
        };
    }, [photoPreviews]);

    const onAddPhotoClick = () => {
        fileInputRef.current?.click();
    };

    const onFileChange = (e) => {
        const files = Array.from(e.target.files || []);
        if (!files.length) return;

        setPhotoError('');

        const validFiles = [];
        const rejectedNames = [];

        files.forEach((file) => {
            if (file.size > MAX_FILE_SIZE) {
                rejectedNames.push(file.name);
                return;
            }

            validFiles.push(file);
        });

        if (rejectedNames.length) {
            setPhotoError(`Ці файли перевищують 10 МБ: ${rejectedNames.join(', ')}`);
        }

        if (!validFiles.length) {
            if (fileInputRef.current) fileInputRef.current.value = '';
            return;
        }

        const existingKeys = new Set(
            photoFiles.map(file => `${file.name}_${file.size}_${file.lastModified}`)
        );

        const uniqueFiles = validFiles.filter(
            file => !existingKeys.has(`${file.name}_${file.size}_${file.lastModified}`)
        );

        if (!uniqueFiles.length) {
            if (fileInputRef.current) fileInputRef.current.value = '';
            return;
        }

        const newPreviewItems = uniqueFiles.map((file) => ({
            id: `${file.name}_${file.size}_${file.lastModified}_${Math.random().toString(36).slice(2)}`,
            file,
            preview: URL.createObjectURL(file),
        }));

        setPhotoFiles(prev => [...prev, ...uniqueFiles]);
        setPhotoPreviews(prev => [...prev, ...newPreviewItems]);

        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const onRemovePhoto = (id) => {
        const previewItem = photoPreviews.find(item => item.id === id);
        if (!previewItem) return;

        URL.revokeObjectURL(previewItem.preview);

        setPhotoPreviews(prev => prev.filter(item => item.id !== id));
        setPhotoFiles(prev =>
            prev.filter(file => !(
                file.name === previewItem.file.name &&
                file.size === previewItem.file.size &&
                file.lastModified === previewItem.file.lastModified
            ))
        );

        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const onRemoveAllPhotos = () => {
        photoPreviews.forEach(item => URL.revokeObjectURL(item.preview));
        setPhotoFiles([]);
        setPhotoPreviews([]);
        setPhotoError('');

        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const onSubmit = async (formData) => {
        const name = formData.name.trim();
        const category = Number(formData.type);

        const fd = new FormData();
        fd.append('name', name);
        fd.append('category', String(category));

        photoFiles.forEach(file => {
            fd.append('images', file);
        });

        try {
            setBannerMsg(null);
            setExistingProductError(false);
            setIsLoading(true);

            const token = getAccessToken();
            const createdProduct = await createNewProduct(token, fd);

            const selectedCategoryLabel =
                categoryOptions.find(opt => Number(opt.value) === category)?.name || '';

            if (onCreated) {
                await onCreated(createdProduct, {
                    name,
                    categoryName: selectedCategoryLabel,
                });
                return;
            }

            navigate('/storage');
        } catch (e) {
            console.error('Error creating new product:', e);

            if (e?.code === 'PRODUCT_ALREADY_EXISTS') {
                setExistingProductError(true);
            } else {
                setBannerMsg('Вибачте, здається, щось пішло не так. Повторіть, будь ласка, спробу пізніше.');
            }
        } finally {
            setIsLoading(false);
        }
    };

    const formSubmit = handleSubmit(onSubmit);
    const WrapperTag = popupMode ? 'div' : 'form';

    return (
        <WrapperTag
            className={styles.newFabric}
            {...(!popupMode ? { onSubmit: formSubmit, autoComplete: "off" } : {})}
        >
            {!popupMode && <ArrBack/>}
            {popupMode && (alreadyExists || existingProductError) && (
                <div className={styles.existingFabric}>
                    * Цей товар вже існує!
                </div>
            )}

            <div className={styles.titleBlock}>
                <h2>{popupMode ? 'Створення нового товару' : 'Створення нового товару'}</h2>
                <button
                    type={popupMode ? "button" : "submit"}
                    className={'btnDark'}
                    disabled={isLoading || alreadyExists}
                    onClick={popupMode ? formSubmit : undefined}
                >
                    <span>Зберегти</span>
                </button>
            </div>

            {bannerMsg && <div className={styles.bannerError}>{bannerMsg}</div>}

            <div className={styles.createBlock}>
                <div className={styles.column}>
                    <InputBox
                        errors={errors}
                        name="name"
                        placeholder="Ім'я"
                        type="text"
                        options={{ ...register('name') }}
                    />

                    <div className={styles.selectWrap}>
                        <Controller
                            name="type"
                            control={control}
                            render={({ field, fieldState }) => (
                                <>
                                    <WhiteCustomSelect
                                        height="36px"
                                        label="Оберіть категорію"
                                        value={field.value}
                                        onChange={(e) => {
                                            field.onChange(e.target.value);
                                            setTypeId(e.target.value);
                                        }}
                                        options={typeSelectOptions}
                                        disabled={isLoading || typeSelectOptions.length <= 1}
                                        className={fieldState.error ? styles.error : ''}
                                        error={!!fieldState.error}
                                    />
                                    {fieldState.error && (
                                        <p className={styles.errorText}>{fieldState.error.message}</p>
                                    )}
                                </>
                            )}
                        />
                    </div>
                </div>

                <div className={`${styles.column} ${styles.photoColumn}`}>
                    <div className={styles.photoSection}>
                        {!!photoPreviews.length && (
                            <div className={styles.photoBlock}>
                                <div className={styles.photoGrid}>
                                    {photoPreviews.map((item) => (
                                        <div key={item.id} className={styles.photoItem}>
                                            <button
                                                type="button"
                                                className={styles.removePhotoBtn}
                                                onClick={() => onRemovePhoto(item.id)}
                                                aria-label="Видалити фото"
                                                title="Видалити фото"
                                            >
                                                ×
                                            </button>
                                            <img
                                                src={item.preview}
                                                className={styles.photo}
                                                alt="Фото продукту"
                                            />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {photoError && <p className={styles.errorText}>{photoError}</p>}

                        <div className={styles.photoBtnBlock}>
                            <div className={styles.uploadBlock}>
                                <div className={styles.uploadWrap}>
                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        accept="image/*"
                                        multiple
                                        className={styles.uploadInput}
                                        onChange={onFileChange}
                                        hidden
                                    />
                                    <button
                                        className="btnDark"
                                        type="button"
                                        onClick={onAddPhotoClick}
                                        disabled={isLoading}
                                    >
                                        <span>Додати фото</span>
                                    </button>
                                </div>

                                <p className={styles.uploadHint}>* Можна обрати декілька файлів</p>
                                <p className={styles.uploadHint}>* Максимум 10 МБ на 1 файл</p>
                            </div>

                            <button
                                className="btnDark"
                                type="button"
                                onClick={onRemoveAllPhotos}
                                disabled={!photoPreviews.length}
                            >
                                <span>Видалити всі фото</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {isLoading && <Preloader />}
        </WrapperTag>
    );
};

export default NewProduct;