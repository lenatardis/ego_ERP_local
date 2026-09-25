import React, {createContext, useContext, useMemo, useRef, useState} from 'react';

const UnsavedChangesContext = createContext(null);

/** Провайдер зберігає:
 *  - dirtyCount: кількість змінених осередків/рядків (для UI та guard-логіки)
 *  - setDirtyCount: спосіб оновити dirtyCount із будь-якого екрану
 *  - saveAllRef: ref на функцію збереження (екран, що має "Save All", кладе сюди свою функцію)
 */
export const UnsavedChangesProvider = ({children}) => {
    const [dirtyCount, setDirtyCount] = useState(0);
    const saveAllRef = useRef(null);
    const value = useMemo(() => ({dirtyCount, setDirtyCount, saveAllRef}), [dirtyCount]);
    return (
        <UnsavedChangesContext.Provider value={value}>
            {children}
        </UnsavedChangesContext.Provider>
    );
};

export const useUnsavedCtx = () => {
    const ctx = useContext(UnsavedChangesContext);
    if (!ctx) throw new Error('useUnsavedCtx must be used within UnsavedChangesProvider');
    return ctx;
};
