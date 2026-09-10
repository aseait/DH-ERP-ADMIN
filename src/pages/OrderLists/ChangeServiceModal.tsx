// src/pages/OrderLists/ChangeServiceModel.tsx
import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { Modal, Button, Alert, FormGroup, Label, Input } from 'reactstrap';
import { useDispatch, useSelector } from 'react-redux';
import type { AnyAction } from 'redux';
import type { ThunkDispatch } from 'redux-thunk';
import { toast } from 'react-toastify';

import Spinners from '../../Components/Common/NewSpinner';
import { getUserIdFromSession } from '../../helpers/userInformation';

import { submitChangeService } from '../../slices/changeService/thunk';
import type { ChangeServicePayload } from '../../slices/changeService/thunk';

type AppDispatch = ThunkDispatch<any, any, AnyAction>;

type Props = {
  isOpen: boolean;
  toggle: () => void;
  tt: (key: string, options?: any) => string;
  row: any | null;
  onSubmitted?: () => void;
};

type ActionType = 'add' | 'delete';

const ChangeServiceModel: React.FC<Props> = ({ isOpen, toggle, tt, row, onSubmitted }) => {
  const dispatch = useDispatch<AppDispatch>();

  const { submitting, error } = useSelector(
      (s: any) => s.ChangeService || { submitting: false, error: null }
  );

  const userId = useMemo(() => getUserIdFromSession(), []);

  const [actionType, setActionType] = useState<ActionType | ''>('');
  const [serviceList, setServiceList] = useState<string[]>([]);
  const [additionalInfo, setAdditionalInfo] = useState<string>('');

  const derived = useMemo(() => {
    const firstCbMarine = row?.cb_marine?.[0];
    const firstLogMarine = row?.logistic_marine?.[0];
    const firstWmsMarine = row?.wms_marine?.[0];

    const firstCbAir = row?.cb_air?.[0];
    const firstLogAir = row?.logistic_air?.[0];
    const firstWmsAir = row?.wms_air?.[0];

    const firstTruckCb = row?.truck_cb?.[0];
    const firstTruckLog = row?.truck_logistic?.[0];
    const firstTruckUsCa = row?.truck_us_to_ca?.[0];

    const guessContainer =
        firstCbMarine?.container_number ||
        firstLogMarine?.container_number ||
        firstWmsMarine?.container_number ||
        firstTruckCb?.container_number ||
        firstTruckLog?.container_number ||
        firstTruckUsCa?.container_number ||
        '';

    const guessAwb = firstCbAir?.awb || firstLogAir?.awb || firstWmsAir?.awb || '';

    const type: '1' | '2' | '3' =
        row?.cb_marine_id || row?.logistic_marine_id || row?.wms_marine_id
            ? '1'
            : row?.cb_air_id || row?.logistic_air_id || row?.wms_air_id
                ? '2'
                : '3';

    const hasCustoms = Boolean(row?.cb_marine_id || row?.cb_air_id || row?.truck_cb_id);
    const hasPickup = Boolean(
        row?.logistic_marine_id || row?.logistic_air_id || row?.truck_logistic_id
    );
    const hasWarehouse = Boolean(row?.wms_marine_id || row?.wms_air_id || row?.truck_us_ca_id);

    return {
      type,
      guessContainer: String(guessContainer || '').trim().toUpperCase(),
      guessAwb: String(guessAwb || '').trim().toUpperCase(),

      hasCustoms,
      hasPickup,
      hasWarehouse,

      cb_marine_id: row?.cb_marine_id ?? firstCbMarine?.cb_marine_id ?? null,
      logistic_marine_id: row?.logistic_marine_id ?? firstLogMarine?.logistic_marine_id ?? null,
      wms_marine_id: row?.wms_marine_id ?? firstWmsMarine?.wms_marine_id ?? null,

      cb_air_id: row?.cb_air_id ?? firstCbAir?.cb_air_id ?? null,
      logistic_air_id: row?.logistic_air_id ?? firstLogAir?.logistic_air_id ?? null,
      wms_air_id: row?.wms_air_id ?? firstWmsAir?.wms_air_id ?? null,

      truck_cb_id: row?.truck_cb_id ?? firstTruckCb?.truck_cb_id ?? null,
      truck_logistic_id: row?.truck_logistic_id ?? firstTruckLog?.truck_logistic_id ?? null,
      truck_us_ca_id: row?.truck_us_ca_id ?? firstTruckUsCa?.truck_us_ca_id ?? null,
    };
  }, [row]);

  const serviceOptions = useMemo(() => {
    if (derived.type === '1') {
      return [
        { key: 'cb_marine', labelKey: 'changeService.services.customs' },
        { key: 'logistic_marine', labelKey: 'changeService.services.pickupMarine' },
        { key: 'wms_marine', labelKey: 'changeService.services.warehouse' },
      ];
    }

    if (derived.type === '2') {
      return [
        { key: 'cb_air', labelKey: 'changeService.services.customs' },
        { key: 'logistic_air', labelKey: 'changeService.services.cargo' },
        { key: 'wms_air', labelKey: 'changeService.services.warehouse' },
      ];
    }

    return [
      { key: 'truck_cb', labelKey: 'changeService.services.customs' },
      { key: 'truck_logistic', labelKey: 'changeService.services.pickupMarine' },
      { key: 'truck_us_to_ca', labelKey: 'changeService.services.warehouse' },
    ];
  }, [derived.type]);

  const isDisabled = useCallback(
      (serviceKey: string) => {
        if (!actionType) return false;

        const exists =
            serviceKey === 'cb_marine' || serviceKey === 'cb_air' || serviceKey === 'truck_cb'
                ? derived.hasCustoms
                : serviceKey === 'logistic_marine' ||
                serviceKey === 'logistic_air' ||
                serviceKey === 'truck_logistic'
                    ? derived.hasPickup
                    : derived.hasWarehouse;

        return actionType === 'add' ? exists : !exists;
      },
      [actionType, derived.hasCustoms, derived.hasPickup, derived.hasWarehouse]
  );

  const toggleService = useCallback((value: string, disabled: boolean) => {
    if (disabled) return;
    setServiceList((prev) =>
        prev.includes(value) ? prev.filter((x) => x !== value) : [...prev, value]
    );
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    setActionType('');
    setServiceList([]);
    setAdditionalInfo('');
  }, [isOpen]);

  useEffect(() => {
    if (!actionType) return;

    setServiceList((prev) => {
      const valid = new Set<string>();
      for (const opt of serviceOptions) {
        if (!isDisabled(opt.key)) valid.add(opt.key);
      }
      return prev.filter((v) => valid.has(v));
    });
  }, [actionType, isDisabled, serviceOptions]);

  const canSubmit = useMemo(() => {
    return Boolean(actionType) && serviceList.length > 0;
  }, [actionType, serviceList]);

  const buildServiceDetails = useCallback(
      (service: string) => {
        const note = additionalInfo.trim();

        if (service === 'cb_air' || service === 'logistic_air' || service === 'wms_air') {
          return derived.guessAwb ? { awb: derived.guessAwb, note } : { note };
        }

        return note ? { note } : {};
      },
      [additionalInfo, derived.guessAwb]
  );

  const buildContainerDetails = useCallback(
      (service: string) => {
        const needsContainer =
            service === 'cb_marine' ||
            service === 'logistic_marine' ||
            service === 'wms_marine' ||
            service === 'truck_cb' ||
            service === 'truck_logistic' ||
            service === 'truck_us_to_ca';

        if (!needsContainer) return [];

        return derived.guessContainer
            ? [{ container_number: derived.guessContainer }]
            : [];
      },
      [derived.guessContainer]
  );

  const handleSubmit = useCallback(async () => {
    if (!row || !actionType || serviceList.length === 0) return;

    try {
      for (const service of serviceList) {
        const payload: ChangeServicePayload = {
          main_id: row.main_id,
          user_id: userId,
          service,
          action: actionType,
          serviceDetails: buildServiceDetails(service),
          containerDetails: buildContainerDetails(service),
          additional_information: additionalInfo.trim() || null,
        };

        const res: any = await dispatch(submitChangeService(payload));

        if (res?.message) {
          if (res?.statusChangedTo === 10) {
            toast.info(res.message, { autoClose: 3500 });
          } else {
            toast.success(res.message, { autoClose: 2500 });
          }
        }
      }

      toggle();
      onSubmitted?.();
    } catch {
      // thunk already sets redux error
    }
  }, [
    row,
    userId,
    actionType,
    serviceList,
    additionalInfo,
    buildServiceDetails,
    buildContainerDetails,
    dispatch,
    toggle,
    onSubmitted,
  ]);

  return (
      <Modal
          isOpen={isOpen}
          toggle={toggle}
          size="lg"
          centered
          className="change-service-modal"
          contentClassName="p-0"
      >
        <div className="cs-modal">
          <div className="cs-header">
            <div>
              <div className="cs-title">{tt('changeService.title')}</div>
              <div className="cs-subtitle">
                {tt('changeService.orderNo')}: <span className="cs-mono">{row?.main_id ?? '-'}</span>
              </div>
            </div>

            <button type="button" className="cs-close" onClick={toggle} aria-label="close">
              ×
            </button>
          </div>

          <div className="cs-body">
            <div className="cs-panel">
              {submitting && (
                  <div className="mb-2">
                    <Spinners size="sm" />
                  </div>
              )}

              {error && (
                  <Alert color="danger" className="mb-3">
                    {String(error)}
                  </Alert>
              )}

              <FormGroup className="mb-3">
                <Label className="cs-field-label">
                  {tt('changeService.action.label')}
                  <span className="cs-required">*</span>
                </Label>
                <Input
                    type="select"
                    className="cs-select"
                    value={actionType}
                    onChange={(e) => setActionType(e.target.value as ActionType | '')}
                >
                  <option value="">{tt('changeService.action.placeholder')}</option>
                  <option value="add">{tt('changeService.action.add')}</option>
                  <option value="delete">{tt('changeService.action.cancel')}</option>
                </Input>
              </FormGroup>

              <div className="cs-section-title">{tt('changeService.services.title')}</div>
              <div className="cs-section-hint">{tt('changeService.services.hint')}</div>

              <div className="cs-services-grid">
                {serviceOptions.map((opt) => {
                  const disabled = isDisabled(opt.key);
                  const active = serviceList.includes(opt.key);

                  return (
                      <button
                          key={opt.key}
                          type="button"
                          className={`cs-service-card ${active ? 'is-active' : ''} ${
                              disabled ? 'is-disabled' : ''
                          }`}
                          onClick={() => toggleService(opt.key, disabled)}
                          disabled={disabled}
                      >
                        <span className="cs-service-card__check" aria-hidden />
                        <div className="cs-service-card__content">
                          <div className="cs-service-card__title">{tt(opt.labelKey)}</div>
                        </div>
                      </button>
                  );
                })}
              </div>

              <div className="mt-3">
                <Label className="cs-field-label">{tt('changeService.note.label')}</Label>
                <Input
                    type="textarea"
                    className="cs-textarea"
                    value={additionalInfo}
                    onChange={(e) => setAdditionalInfo(e.target.value)}
                    placeholder={tt('changeService.note.placeholder')}
                />
              </div>

              {!canSubmit && <div className="cs-error">{tt('changeService.errors.required')}</div>}
            </div>
          </div>

          <div className="cs-footer">
            <Button color="light" className="cs-btn" onClick={toggle} disabled={submitting}>
              {tt('changeService.actions.close')}
            </Button>

            <Button
                color="primary"
                className="cs-btn cs-btn--primary"
                onClick={handleSubmit}
                disabled={!canSubmit || submitting}
            >
              {submitting
                  ? tt('changeService.actions.submitting')
                  : tt('changeService.actions.submit')}
            </Button>
          </div>
        </div>
      </Modal>
  );
};

export default ChangeServiceModel;