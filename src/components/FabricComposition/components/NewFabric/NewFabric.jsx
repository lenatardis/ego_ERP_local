import React, { useState, useEffect, useRef } from "react";
import styles from './NewFabric.module.scss';
import CustomCheckbox from "../../../Common/CustomCheckbox/CustomCheckbox.jsx";
import WhiteCustomSelect from "../../../Common/WhiteCustomSelect/WhiteCustomSelect.jsx";
import InputBox from "../../../Common/InputBox/InputBox.jsx";
import { getAccessToken } from "../../../../api/authStorage.js";
import { fetchFilters, createNewFabric } from "../../../../api/tablesApi.js";
import { useForm, Controller } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as Yup from "yup";
import Preloader from "../../../Common/Preloader/Preloader.jsx";
import { useNavigate } from "react-router-dom";

/* Yup: обов'язкові поля name, type, monoType */
const schema = Yup.object({
    name: Yup.string().trim().max(50, 'До 50 символів').required("Вкажіть назву"),
    type: Yup.number()
        .transform(v => (isNaN(v) ? undefined : v))
        .integer().positive('Оберіть тип').required('Оберіть тип'),
    monoType: Yup.string()
        .oneOf(['A', 'B', 'A,B'], 'Оберіть mono type')
        .required('Оберіть mono type'),
    description: Yup.string().trim().max(1000, 'До 1000 символів').nullable(),
});

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

const NewFabric = ({
    initialName = '',
    onCreated = null,
    popupMode = false,
    alreadyExists = false
}) => {
    const [isLoading, setIsLoading] = useState(false);
    const [typeOptions, setTypeOptions] = useState([]);
    const [typeId, setTypeId] = useState('');
    const [tagsOptions, setTagsOptions] = useState([]);
    const [selectedTagIds, setSelectedTagIds] = useState([]);
    const [monoType, setMonoType] = useState('');
    const [bannerMsg, setBannerMsg] = useState(null);
    const [existingFabricError, setExistingFabricError] = useState(false);

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
            description: '',
            type: '',
            monoType: '',
        },
    });

    useEffect(() => {
        const loadFilters = async () => {
            try {
                setIsLoading(true);
                const token = getAccessToken();
                const resp = await fetchFilters(token);

                if (Array.isArray(resp?.types)) {
                    setTypeOptions(resp.types.map(t => ({
                        name: t.type,
                        value: t.id,
                    })));
                } else {
                    setTypeOptions([]);
                }

                if (Array.isArray(resp?.tags)) {
                    setTagsOptions(
                        resp.tags.map(t => ({
                            name: t.name,
                            value: t.id
                        }))
                    );
                } else {
                    setTagsOptions([]);
                }
            } catch (e) {
                console.error('Error loading types:', e);
                setTypeOptions([]);
                setTagsOptions([]);
            } finally {
                setIsLoading(false);
            }
        };

        loadFilters();
    }, []);

    useEffect(() => {
        reset({
            name: initialName || '',
            description: '',
            type: '',
            monoType: '',
        });
        setTypeId('');
        setSelectedTagIds([]);
        setMonoType('');
        setPhotoError('');

        photoPreviews.forEach(item => URL.revokeObjectURL(item.preview));
        setPhotoFiles([]);
        setPhotoPreviews([]);

        if (fileInputRef.current) fileInputRef.current.value = '';
    }, [initialName, reset]);

    useEffect(() => {
        return () => {
            photoPreviews.forEach(item => URL.revokeObjectURL(item.preview));
        };
    }, [photoPreviews]);

    const typeSelectOptions = typeOptions.map(o => ({
        name: o.name,
        value: String(o.value),
    }));

    const monoTypeOptions = [
        { name: 'A', value: 'A' },
        { name: 'B', value: 'B' },
        { name: 'A, B', value: 'A,B' }
    ];

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

        if (fileInputRef.current) fileInputRef.current.value = '';
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

        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const onRemoveAllPhotos = () => {
        photoPreviews.forEach(item => URL.revokeObjectURL(item.preview));
        setPhotoFiles([]);
        setPhotoPreviews([]);
        setPhotoError('');
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const onSubmit = async (formData) => {
        const name = formData.name.trim();
        const description = formData.description?.trim() || '';
        const type = Number(formData.type);
        const tags = selectedTagIds.map(Number);
        const monoArr = formData.monoType.split(',').map(s => s.trim());

        const fd = new FormData();
        fd.append('name', name);
        if (description) fd.append('description', description);
        fd.append('type', String(type));
        tags.forEach(tid => fd.append('tags', String(tid)));
        fd.append('mono_fabric_type', JSON.stringify(monoArr));
        fd.append('is_available', 'true');

        photoFiles.forEach(file => {
            fd.append('images', file);
        });

        try {
            setBannerMsg(null);
            setExistingFabricError(false);
            setIsLoading(true);
            const token = getAccessToken();
            const createdFabric = await createNewFabric(token, fd);

            const selectedTypeLabel =
                typeOptions.find(opt => Number(opt.value) === type)?.name || '';

            if (onCreated) {
                await onCreated(createdFabric, {
                    name,
                    typeName: selectedTypeLabel,
                    monoTypes: monoArr,
                });
                return;
            }

            navigate('/storage');
        } catch (e) {
            console.error('Error creating new fabric:', e);

            if (e?.code === 'FABRIC_ALREADY_EXISTS') {
                setExistingFabricError(true);
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
            {popupMode && (alreadyExists || existingFabricError)  && (
                <div className={styles.existingFabric}>
                    * Ця тканина вже існує!
                </div>
            )}
            <div className={styles.titleBlock}>
                <h2>{popupMode ? 'Створення нової тканини' : 'Створення нової тканини'}</h2>
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
                    <div className={styles.row}>
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
                                            label="Оберіть тип"
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

                    <textarea
                        placeholder="Опис тканини"
                        className={`${styles.description} ${errors.description ? styles.error : ''}`}
                        {...register('description')}
                        maxLength={1000}
                    />
                    {errors.description && <p className={styles.errorText}>{errors.description.message}</p>}

                    <Controller
                        name="monoType"
                        control={control}
                        render={({ field, fieldState }) => (
                            <>
                                <WhiteCustomSelect
                                    height="36px"
                                    label="Оберіть mono type"
                                    value={field.value}
                                    onChange={(e) => {
                                        field.onChange(e.target.value);
                                        setMonoType(e.target.value);
                                    }}
                                    options={monoTypeOptions}
                                    className={fieldState.error ? styles.error : ''}
                                    error={!!fieldState.error}
                                />
                                {fieldState.error && (
                                    <p className={styles.errorText}>{fieldState.error.message}</p>
                                )}
                            </>
                        )}
                    />

                    <h3>Теги</h3>
                    <div className={styles.checkboxBlock}>
                        {tagsOptions.map(tag => (
                            <CustomCheckbox
                                key={tag.value}
                                name={tag.name}
                                value={tag.value}
                                isChecked={selectedTagIds.includes(tag.value)}
                                isLoading={isLoading}
                                onChange={(checked) => {
                                    setSelectedTagIds(prev =>
                                        checked
                                            ? [...prev, tag.value]
                                            : prev.filter(id => id !== tag.value)
                                    );
                                }}
                            />
                        ))}
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
                                                alt="Фото тканини"
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

export default NewFabric;