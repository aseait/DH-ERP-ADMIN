import React, {
    forwardRef,
    useCallback,
    useEffect,
    useImperativeHandle,
    useMemo,
    useState,
} from 'react';
import {Button, Input, Spinner} from 'reactstrap';
import {useDispatch, useSelector} from 'react-redux';
import {AnyAction} from 'redux';
import {ThunkDispatch} from 'redux-thunk';

import {fetchImporterNames, uploadPoaFiles} from '../../../slices/file/thunk';
import {createImporterApi} from '../../../helpers/api_fetch/poa';
import {useTT} from '../../../helpers/useTT';

type AppDispatch = ThunkDispatch<any, any, AnyAction>;

export type AddPoaRef = {
  submitPoa: () => Promise<string>;
  hasPoa: () => boolean;
};

export type AddPoaProps = {
    userId: string | number;
    onSelect?: (name: string) => void;
    disabled?: boolean;
};

const AddPoa = forwardRef<AddPoaRef, AddPoaProps>(({userId, onSelect, disabled}, ref) => {
    const {tt} = useTT();
    const dispatch = useDispatch<AppDispatch>();

    const root = useSelector((s: any) => s || {});
    const filesState = root.File ?? {};

    const loadingImporterNames = !!filesState.loadingImporterNames;
    const uploadingPoa = !!filesState.uploadingPoa;

    const importerRows = useMemo(() => {
        const raw = filesState.importerNames ?? [];
        return Array.isArray(raw) ? raw : [];
    }, [filesState.importerNames]);

    const importerNames = useMemo(() => {
        return importerRows.map((x: any) => x?.Name ?? x?.name ?? '').filter(Boolean);
    }, [importerRows]);

    const [selectedName, setSelectedName] = useState('');
    const [poaName, setPoaName] = useState('');
    const [picked, setPicked] = useState<File[]>([]);

    useEffect(() => {
        if (!userId) return;
        dispatch(fetchImporterNames({user_id: userId, status: 0}));
    }, [dispatch, userId]);

    const onChoose = useCallback(
        (v: string) => {
            setSelectedName(v);
            onSelect?.(v);
        },
        [onSelect]
    );

    const onPick = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        setPicked(Array.from(e.target.files || []));
    }, []);

    const refreshImporterNames = useCallback(async () => {
        if (!userId) return;
        await dispatch(fetchImporterNames({user_id: userId, status: 0}));
    }, [dispatch, userId]);

    const submitPoa = useCallback(async () => {
        if (!userId) return '';

        const cleanName = poaName.trim();

        // If user did not upload new POA, just return selected importer
        if (!cleanName || !picked.length) {
            return selectedName || '';
        }

        const exists = importerNames.some(
            (name: string) => String(name || '').trim().toLowerCase() === cleanName.toLowerCase()
        );

        if (exists) {
          throw new Error(tt('addPoa.poaExists'));
        }

        const { importer_id: importerId } = await createImporterApi({ user_id: userId, name: cleanName });

        await dispatch(
            uploadPoaFiles({
                files: picked,
                user_ids: new Array(picked.length).fill(userId),
                poa_names: new Array(picked.length).fill(cleanName),
                statuses: new Array(picked.length).fill(0),
                importer_ids: new Array(picked.length).fill(importerId),
                doc_types: new Array(picked.length).fill('POA'),
            })
        );

        await refreshImporterNames();

        onChoose(cleanName);
        setPicked([]);
        setPoaName('');

        return cleanName;
    }, [
        dispatch,
        userId,
        poaName,
        picked,
        refreshImporterNames,
        onChoose,
        selectedName,
        importerNames,
        tt,
    ]);

  const hasPoa = useCallback(() => {
    const hasSelectedExisting = !!String(selectedName || '').trim();
    const hasNewUpload = !!String(poaName || '').trim() && picked.length > 0;

    return hasSelectedExisting || hasNewUpload;
  }, [selectedName, poaName, picked]);

  useImperativeHandle(ref, () => ({
    submitPoa,
    hasPoa,
  }));

    return (
        <div className="mb-3">
            <div style={{fontWeight: 700}} className="mb-2">
                {tt('addPoa.title')} <span className="text-danger">*</span>
            </div>

            <div className="d-flex gap-2 align-items-center mb-2">
                <Input
                    type="select"
                    value={selectedName}
                    disabled={disabled || loadingImporterNames}
                    onChange={(e) => onChoose(e.target.value)}
                >
                    <option value="" disabled>
                        {loadingImporterNames ? tt('common.loading') : tt('addPoa.selectPlaceholder')}
                    </option>

                    {importerNames.map((n: string) => (
                        <option key={n} value={n}>
                            {n}
                        </option>
                    ))}
                </Input>

                {loadingImporterNames ? <Spinner size="sm"/> : null}
            </div>

            <div className="border rounded p-2">
                <div className="text-muted mb-2" style={{fontSize: 12}}>
                    {tt('addPoa.uploadHint')}
                </div>

                <div className="d-flex gap-2 mb-2">
                    <Input
                        placeholder={tt('addPoa.poaNamePlaceholder')}
                        value={poaName}
                        disabled={disabled || uploadingPoa}
                        onChange={(e) => setPoaName(e.target.value)}
                    />
                </div>

                <div className="d-flex gap-2 align-items-center">
                    <Input
                        type="file"
                        multiple
                        onChange={onPick}
                        disabled={disabled || uploadingPoa}
                    />

                    <Button
                        color="secondary"
                        type="button"
                        outline
                        disabled
                    >
                        {picked.length
                            ? `${picked.length} ${tt('addPoa.actions.fileSelected')}`
                            : tt('addPoa.actions.upload')}
                    </Button>
                </div>
            </div>
        </div>
    );
});

AddPoa.displayName = 'AddPoa';

export default AddPoa;