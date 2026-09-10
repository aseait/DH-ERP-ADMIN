import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Select from 'react-select';
import {
  Container,
  Row,
  Col,
  Card,
  CardBody,
  CardHeader,
  Button,
  Form,
  FormGroup,
  Label,
  Input,
  Alert,
  Modal,
  ModalHeader,
  ModalBody,
  ModalFooter,
} from 'reactstrap';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { ThunkDispatch } from 'redux-thunk';
import { AnyAction } from 'redux';

// Thunks: fetch dropdown data + create tickets for each service type
import {
  fetchCities,
  createMarineMainTicket,
  createAirMainTicket,
  createParseMainTicket, // (truck / parse)
} from '../../slices/order/thunk';

import {
  getUserIdFromSession,
  getUserNameFromSession,
  getRestriction,
  canEditLogisticService,
  canEditCbService,
} from '../../helpers/userInformation';
import BreadCrumb from '../../Components/Common/BreadCrumb';
import { useTT } from '../../helpers/useTT';
import {formatCanadianPostcode, formatDeliveryCity, isValidCanadianPostcode} from "../../helpers/helpers";
import { fetchAdminContactsApi } from '../../helpers/api_fetch/order';

// Redux dispatch type for thunk actions
type AppDispatch = ThunkDispatch<any, any, AnyAction>;

// Service tabs user can choose
type ServiceType = 'marine' | 'air' | 'truck';

// Option checkbox values
type OpValue = '1' | '2' | '3';
const DEFAULT_OP: OpValue = '1';

/**
 * Department-based restriction on which service option a user may create.
 * restriction === 1 means no restriction at all (full access).
 * Otherwise: Logistic dept -> Logistic service on Marine, and ONLY the
 * USA-to-CA option on Truck (not Truck's Pickup/Delivery). DH dept ->
 * Customs Brokerage (op1) on Marine/Air/Truck.
 * Air has no department granted access beyond DH's CB option, so a
 * Logistic-dept-only user gets every Air checkbox disabled.
 */
const isOpAllowed = (svc: ServiceType, op: OpValue): boolean => {
  if (getRestriction() === 1) return true;
  if (op === '1') return canEditCbService();
  if (svc === 'air') {
    // Non-CB Air options require the same access as CB (DH dept); Logistic
    // dept has zero Air access at all, CB included.
    if (!canEditCbService()) return false;
    if (op === '2') return false; // Cargo Collection isn't granted to any dept
    return true; // Warehouse — left unrestricted for whoever can reach Air
  }
  if (svc === 'marine') {
    if (op === '2') return canEditLogisticService();
    return true; // Warehouse — left unrestricted
  }
  // truck: only op3 (USA to Canada) is Logistic dept's; op2 (Pickup/Delivery) isn't.
  if (op === '3') return canEditLogisticService();
  return false;
};

/** First option (in 1,2,3 order) the current user may pick for a service, or none if all are blocked. */
const firstAllowedOp = (svc: ServiceType): OpValue[] => {
  const found = (['1', '2', '3'] as OpValue[]).find((op) => isOpAllowed(svc, op));
  return found ? [found] : [];
};

// Form models for each service
type MarineForm = {
  containers: string[];
  destination: string;
  ers: '' | '1' | '0';
  fcl: 'FCL' | 'LCL';
  note: string;
  goWarehouse: '' | '0' | '1' | '2';
  isPickupContainer: '' | '1' | '0';
  rail: '' | 'CN' | 'CP' | 'NA';
  deliveryCity: string;
  postcode: string;
  mbl: string;
  hblList: string[];
};

type AirForm = {
  awb: string;
  shippingUnits: string;
  grossWeight: string;
  chargeableWeight: string;
  finalDestination: string;
  eta: string;
};

type TruckForm = {
  containers: string[];
  usaPort: string;
  ers: '' | '1' | '0';
  dl: string; // destination (Canada)
  note: string;
  fcl: 'FCL' | 'LCL';
  goWarehouse: '' | '0' | '1';
};

type ClientUser = {
  value: string;
  label: string;
};

// Minimal slice state used by this page
type RootOrderState = {
  cities?: any[];
  loadingCities?: boolean;
  creatingMarine?: boolean;
  creatingAir?: boolean;
  creatingParse?: boolean;
};

function serviceToType(ops: OpValue[]) {
  const e = [...ops].sort().join(',');
  switch (e) {
    case '1':
      return 1;
    case '2':
      return 4;
    case '3':
      return 5;
    case '1,2':
      return 2;
    case '1,2,3':
      return 3;
    case '2,3':
      return 6;
    default:
      return 0;
  }
}

// Default initial states for each form
const initialMarine: MarineForm = {
  containers: [''],
  destination: '',
  ers: '',
  fcl: 'FCL',
  note: '',
  goWarehouse: '',
  isPickupContainer: '',
  rail: '',
  deliveryCity: '',
  postcode: '',
  mbl: '',
  hblList: [''],
};

const initialAir: AirForm = {
  awb: '',
  shippingUnits: '',
  grossWeight: '',
  chargeableWeight: '',
  finalDestination: '',
  eta: '',
};

const initialTruck: TruckForm = {
  containers: [''],
  usaPort: 'USA',
  ers: '',
  dl: '',
  note: '',
  fcl: 'FCL',
  goWarehouse: '',
};

const CreateOrder: React.FC = () => {
  const { tt } = useTT();

  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();

  // current admin id and name from session
  const userId = getUserIdFromSession();
  const creatorName = getUserNameFromSession();

  // get state safely even if slice name differs (Order vs order)
  const orderState: RootOrderState = useSelector((s: any) => s?.Order ?? s?.order ?? {}) ?? {};

  const cities = orderState.cities ?? [];
  const loadingCities = !!orderState.loadingCities;
  const creatingMarine = !!orderState.creatingMarine;
  const creatingAir = !!orderState.creatingAir;
  const creatingParse = !!orderState.creatingParse;

  // disable UI while creating any ticket
  const isCreating = creatingMarine || creatingAir || creatingParse;

  // Stepper: step1 = pick service, step2 = fill form
  const [step, setStep] = useState<1 | 2>(1);

  // active service tab
  const [service, setService] = useState<ServiceType>('marine');

  // error alert message
  const [error, setError] = useState('');
  const errorRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (error) errorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [error]);

  /**
   * Keep ops (checkbox selections) per service.
   * So user can switch service and retain previous selections.
   */
  const [opsByService, setOpsByService] = useState<Record<ServiceType, OpValue[]>>({
    marine: firstAllowedOp('marine'),
    air: firstAllowedOp('air'),
    truck: firstAllowedOp('truck'),
  });

  // ops currently active for the selected service
  const activeOps = opsByService[service];

  // individual forms per service (kept separately so switching service doesn't lose state)
  const [marine, setMarine] = useState<MarineForm>(initialMarine);
  const [air, setAir] = useState<AirForm>(initialAir);
  const [truck, setTruck] = useState<TruckForm>(initialTruck);

  const [duplicateModalOpen, setDuplicateModalOpen] = useState(false);
  const [duplicateText, setDuplicateText] = useState('');
  const [pendingMarinePayload, setPendingMarinePayload] = useState<any | null>(null);

  // client user picker
  const [clientList, setClientList] = useState<ClientUser[]>([]);
  const [clientUserId, setClientUserId] = useState('');


  const confirmDuplicateMarineCreate = useCallback(async () => {
    if (!pendingMarinePayload) {
      setDuplicateModalOpen(false);
      return;
    }

    try {
      const retryRes: any = await dispatch(
          createMarineMainTicket({
            ...pendingMarinePayload,
            force_create_duplicate: 1,
          }) as any
      );

      const retryMainId = retryRes?.main_id;

      setDuplicateModalOpen(false);
      setPendingMarinePayload(null);
      setDuplicateText('');

      navigate(
          `/order/create/haiyun?value=${encodeURIComponent(activeOps.join(','))}` +
          `&main_id=${encodeURIComponent(retryMainId)}` +
          `&cb_marine_id=${encodeURIComponent(retryRes?.cb_marine_id ?? '')}` +
          `&logistic_marine_id=${encodeURIComponent(retryRes?.logistic_marine_id ?? '')}` +
          `&wms_marine_id=${encodeURIComponent(retryRes?.wms_marine_id ?? '')}` +
          `&client_user_id=${encodeURIComponent(clientUserId)}`
      );
    } catch (retryErr: any) {
      setDuplicateModalOpen(false);
      setPendingMarinePayload(null);
      setDuplicateText('');
      setError(
          retryErr?.response?.data?.message ||
          retryErr?.message ||
          (typeof retryErr === 'string' ? retryErr : '') ||
          tt('createOrder.errors.failedCreate')
      );
    }
  }, [pendingMarinePayload, dispatch, navigate, activeOps, tt]);

  // page title
  useEffect(() => {
    document.title = tt('createOrder.pageTitle');
  }, [tt]);

  // load city list + client user list once at mount
  useEffect(() => {
    dispatch(fetchCities());
  }, [dispatch]);

  useEffect(() => {
    fetchAdminContactsApi('', 999)
      .then((res: any) => {
        const arr = Array.isArray(res?.data) ? res.data : [];
        setClientList(
          arr.map((x: any) => ({
            value: String(x.id ?? ''),
            label: x.Account_Name?.name || 'No Name',
          })).filter((x: ClientUser) => x.value)
        );
      })
      .catch(() => {});
  }, []);

  /**
   * Normalize city list into a string array.
   * Supports backend returning array of strings OR array of objects.
   */
  const cityOptions = useMemo(() => {
    const arr = Array.isArray(cities) ? cities : [];
    return arr
      .map((x: any) => {
        if (typeof x === 'string') return x;
        return x?.city ?? x?.City ?? x?.Name ?? x?.name ?? '';
      })
      .filter(Boolean);
  }, [cities]);

  // Only show "Go Warehouse" dropdown for Marine when op2 or op3 is selected.
  // const showMarineGoWarehouse = useMemo(() => {
  //   return service === 'marine' && (activeOps.includes('2') || activeOps.includes('3'));
  // }, [service, activeOps]);

  const showMarineRail = useMemo(() => {
    return service === 'marine' && (activeOps.includes('1') || activeOps.includes('2'));
  }, [service, activeOps]);

  const showMarineLogisticFields = useMemo(() => {
    return service === 'marine' && activeOps.includes('2');
  }, [service, activeOps]);

  const showMbl = useMemo(() => {
    return service === 'marine' && activeOps.includes('2');
  }, [service, activeOps]);

  const showTruckGoWarehouse = useMemo(() => {
    return service === 'truck' && (activeOps.includes('2') || activeOps.includes('3'));
  }, [service, activeOps]);

  // HBL list helpers
  const addHbl = useCallback(() => {
    setMarine((p) => ({ ...p, hblList: [...p.hblList, ''] }));
  }, []);

  const removeHbl = useCallback((idx: number) => {
    setMarine((p) => ({
      ...p,
      hblList: p.hblList.length <= 1 ? p.hblList : p.hblList.filter((_, i) => i !== idx),
    }));
  }, []);

  const updateHbl = useCallback((idx: number, val: string) => {
    setMarine((p) => {
      const next = [...p.hblList];
      next[idx] = val;
      return { ...p, hblList: next };
    });
  }, []);

  // choose service card
  const pickService = useCallback((s: ServiceType) => {
    setError('');
    setService(s);
  }, []);

  /**
   * toggle checkbox option for the current service
   * ensures at least one op remains selected
   */
  const toggleOp = useCallback(
    (op: OpValue) => {
      if (!isOpAllowed(service, op)) return;
      setError('');
      setOpsByService((prev) => {
        const cur = prev[service] ?? [];
        const next = cur.includes(op) ? cur.filter((x) => x !== op) : [...cur, op];
        return { ...prev, [service]: next };
      });
    },
    [service]
  );

  // add container line (marine/truck only)
  const addContainer = useCallback(() => {
    setError('');
    if (service === 'marine') setMarine((p) => ({ ...p, containers: [...p.containers, ''] }));
    if (service === 'truck') setTruck((p) => ({ ...p, containers: [...p.containers, ''] }));
  }, [service]);

  // remove container line (keep at least 1)
  const removeContainer = useCallback(
    (idx: number) => {
      setError('');
      if (service === 'marine') {
        setMarine((p) => ({
          ...p,
          containers:
            p.containers.length <= 1 ? p.containers : p.containers.filter((_, i) => i !== idx),
        }));
      }
      if (service === 'truck') {
        setTruck((p) => ({
          ...p,
          containers:
            p.containers.length <= 1 ? p.containers : p.containers.filter((_, i) => i !== idx),
        }));
      }
    },
    [service]
  );

  // update container value + normalize to uppercase
  const updateContainer = useCallback(
    (idx: number, val: string) => {
      setError('');
      const v = val.toUpperCase();
      if (service === 'marine') {
        setMarine((p) => {
          const next = [...p.containers];
          next[idx] = v;
          return { ...p, containers: next };
        });
      }
      if (service === 'truck') {
        setTruck((p) => {
          const next = [...p.containers];
          next[idx] = v;
          return { ...p, containers: next };
        });
      }
    },
    [service]
  );

  // Validate form values before submit.
  const validate = useCallback((): string => {
    if (!clientUserId) return tt('createOrder.errors.missingUserId') || 'Please select a client';
    if (!activeOps.length) return tt('createOrder.errors.pickAtLeastOneOption');
    if (activeOps.some((op) => !isOpAllowed(service, op))) {
      return tt('createOrder.errors.noPermissionForService') ||
        'You do not have permission to create this service.';
    }

    // container number and AWB format validation
    const containerPattern = /^[A-Z]{4}\d{7}$/;
    const awbPattern = /^\d{3}-\d{8}$/;

    if (service === 'marine') {
      const cleaned = marine.containers.map((x) => x.trim()).filter(Boolean);
      if (!cleaned.length) return tt('createOrder.errors.marine.needContainer');
      for (const c of cleaned) {
        if (!containerPattern.test(c)) return tt('createOrder.errors.marine.badContainer', { c });
      }
      if (!marine.destination.trim()) return tt('createOrder.errors.marine.needDestination');

      if (showMbl) {
        if (!marine.mbl.trim()) return 'MBL is required';
        const hblFilled = marine.hblList.map((h) => h.trim()).filter(Boolean);
        if (!hblFilled.length) return 'At least one HBL is required';
      }

      if (showMarineLogisticFields && !marine.goWarehouse)
        return tt('createOrder.errors.marine.needGoWarehouse');

      if (showMarineLogisticFields && marine.isPickupContainer === '')
        return tt('createOrder.errors.marine.needPickupContainer');

      if (showMarineLogisticFields && marine.goWarehouse === '1') {
        if (!marine.deliveryCity.trim()) return tt('createOrder.errors.marine.needDeliveryCityThirdParty');
        if (!marine.postcode.trim()) return tt('createOrder.errors.marine.needPostcodeThirdParty');
      }

      if (marine.postcode.trim() && !isValidCanadianPostcode(marine.postcode)) {
        return tt('createOrder.errors.marine.badCanadianPostcode');
      }

      return '';
    }

    if (service === 'air') {
      if (!air.awb.trim()) return tt('createOrder.errors.air.needAwb');
      if (!awbPattern.test(air.awb.trim()))
        return tt('createOrder.errors.air.badAwbExample', { example: '784-03190564' });
      if (!air.shippingUnits.trim()) return tt('createOrder.errors.air.needShippingUnits');
      if (!air.grossWeight.trim()) return tt('createOrder.errors.air.needGrossWeight');
      if (!air.chargeableWeight.trim()) return tt('createOrder.errors.air.needChargeableWeight');
      if (!air.finalDestination.trim()) return tt('createOrder.errors.air.needDestination');
      return '';
    }

    // truck validation
    const cleaned = truck.containers.map((x) => x.trim()).filter(Boolean);
    if (!cleaned.length) return tt('createOrder.errors.truck.needContainer');
    if (!truck.usaPort.trim()) return tt('createOrder.errors.truck.needUsaPort');
    if (!truck.dl.trim()) return tt('createOrder.errors.truck.needDl');
    if (showTruckGoWarehouse && !truck.goWarehouse) return tt('createOrder.errors.marine.needGoWarehouse') || 'Please select warehouse option';
    return '';
  }, [clientUserId, activeOps, service, marine, air, truck, showMarineLogisticFields, showMbl, showTruckGoWarehouse, tt]);

  // Build API payload matching backend fields per service type.
  const buildPayload = useCallback(() => {
    if (service === 'marine') {
      const payload: any = {
        user_id: clientUserId,
        service: serviceToType(activeOps),
        destination: marine.destination,
        container_numbers: marine.containers.map((x) => x.trim()).filter(Boolean),
        ers_status: marine.ers,
        fcl: marine.fcl === 'FCL' ? '1' : '0',
        go_warehouse: marine.goWarehouse || null,
        is_pickup_container: marine.isPickupContainer || null,
        note: marine.note,
        rail: marine.rail || null,
        delivery_city: showMarineLogisticFields
            ? formatDeliveryCity(marine.deliveryCity) || null
            : null,
        postcode: showMarineLogisticFields
            ? formatCanadianPostcode(marine.postcode) || null
            : null,
        creator_name: creatorName || null,
      };
      if (showMbl) {
        payload.mbl = marine.mbl.trim();
        payload.hbl = marine.hblList.map((h) => h.trim()).filter(Boolean);
      }
      return payload;
    }

    if (service === 'air') {
      return {
        user_id: clientUserId,
        service: serviceToType(activeOps),
        awb: air.awb.trim(),
        destination: air.finalDestination,
        shipping_units: Number(air.shippingUnits),
        gross_weight: Number(air.grossWeight),
        chargeable_weight: Number(air.chargeableWeight),
        eta: air.eta,
        creator_name: creatorName || null,
      };
    }

    // truck (parse) payload
    return {
      user_id: clientUserId,
      service: serviceToType(activeOps),
      container_numbers: truck.containers.map((x) => x.trim()).filter(Boolean),
      destination_us: truck.usaPort,
      destination_ca: truck.dl,
      ers_status: truck.ers,
      fcl: truck.fcl === 'FCL' ? '1' : '0',
      note: truck.note,
      go_warehouse: showTruckGoWarehouse ? truck.goWarehouse || null : null,
      creator_name: creatorName || null,
    };
  }, [service, activeOps, clientUserId, creatorName, marine, air, truck, showMarineLogisticFields, showMbl, showTruckGoWarehouse]);

  // submit handler:
  const onSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      const msg = validate();
      if (msg) return setError(msg);

      setError('');

      try {
        const payload: any = buildPayload();

        if (service === 'marine') {
          try {
            const res: any = await dispatch(createMarineMainTicket(payload) as any);
            const mainId = res?.main_id;

            navigate(
                `/order/create/haiyun?value=${encodeURIComponent(activeOps.join(','))}` +
                `&main_id=${encodeURIComponent(mainId)}` +
                `&cb_marine_id=${encodeURIComponent(res?.cb_marine_id ?? '')}` +
                `&logistic_marine_id=${encodeURIComponent(res?.logistic_marine_id ?? '')}` +
                `&wms_marine_id=${encodeURIComponent(res?.wms_marine_id ?? '')}` +
                `&containers=${encodeURIComponent((payload.container_numbers as string[] ?? []).join(','))}` +
                `&client_user_id=${encodeURIComponent(clientUserId)}`
            );
          } catch (err: any) {
            const status = err?.status;
            const rawMsg =
                err?.message ||
                (typeof err === 'string' ? err : '') ||
                tt('createOrder.errors.failedCreate');

            const isDuplicate =
                status === 409 && err?.code === 'CONTAINER_ALREADY_EXISTS';

            if (isDuplicate) {
              let dupList: string[] = Array.isArray(err?.duplicates) ? err.duplicates : [];
              if (!dupList.length && Array.isArray(err?.duplicate_details)) {
                const seen = new Set<string>();
                (err.duplicate_details as any[]).forEach((d: any) => {
                  if (d.container_number) seen.add(String(d.container_number));
                });
                seen.forEach((c) => dupList.push(c));
              }
              const dupText = dupList.join(', ');

              setPendingMarinePayload(payload);
              setDuplicateText(
                  tt('createOrder.step1.containerExistsConfirm', {
                    containers: dupText || '-',
                  })
              );
              setDuplicateModalOpen(true);
              return;
            }

            setError(rawMsg);
          }

          return;
        }

        if (service === 'air') {
          const res: any = await dispatch(createAirMainTicket(payload));
          navigate(
            `/order/create/kongyun?value=${encodeURIComponent(activeOps.join(','))}` +
              `&cb_air_id=${encodeURIComponent(res?.cb_air_id ?? '')}` +
              `&logistic_air_id=${encodeURIComponent(res?.logistic_air_id ?? '')}` +
              `&wms_air_id=${encodeURIComponent(res?.wms_air_id ?? '')}` +
              `&client_user_id=${encodeURIComponent(clientUserId)}`
          );
          return;
        }

        // truck
        const res: any = await dispatch(createParseMainTicket(payload));
        navigate(
          `/order/create/truck?value=${encodeURIComponent(activeOps.join(','))}` +
            `&truck_cb_id=${encodeURIComponent(res?.truck_cb_id ?? '')}` +
            `&truck_logistic_id=${encodeURIComponent(res?.truck_logistic_id ?? '')}` +
            `&truck_us_ca_id=${encodeURIComponent(res?.truck_us_ca_id ?? '')}` +
            `&client_user_id=${encodeURIComponent(clientUserId)}`
        );
      } catch (err: any) {
        setError(typeof err === 'string' ? err : (err?.message || tt('createOrder.errors.failedCreate')));
      }
    },
    [validate, buildPayload, service, dispatch, navigate, activeOps, clientUserId, tt]
  );

  // go to step2
  const onNext = useCallback(() => {
    setError('');
    setStep(2);
  }, []);

  // back to step1
  const onBack = useCallback(() => {
    setError('');
    setStep(1);
  }, []);

  return (
    <div className="page-content">
      <Container fluid>
        {/* breadcrumb header */}
        <BreadCrumb title={tt('createOrder.title')} pageTitle={tt('createOrder.breadcrumb')} />

        <div className="create-order-page">
          <Row className="justify-content-center">
            <Col xl={10} xxl={9}>
              <Card className="co-shell">
                {/* Step header + stepper */}
                <Modal
                    isOpen={duplicateModalOpen}
                    toggle={() => {
                      setDuplicateModalOpen(false);
                      setPendingMarinePayload(null);
                      setDuplicateText('');
                    }}
                    centered
                >
                  <ModalHeader
                      toggle={() => {
                        setDuplicateModalOpen(false);
                        setPendingMarinePayload(null);
                        setDuplicateText('');
                      }}
                  >
                    {tt('common.warning')}
                  </ModalHeader>

                  <ModalBody>
                    {duplicateText}
                  </ModalBody>

                  <ModalFooter>
                    <Button
                        color="secondary"
                        outline
                        onClick={() => {
                          setDuplicateModalOpen(false);
                          setPendingMarinePayload(null);
                          setDuplicateText('');
                        }}
                    >
                      {tt('common.no')}
                    </Button>

                    <Button color="primary" onClick={confirmDuplicateMarineCreate}>
                      {tt('common.yes')}
                    </Button>
                  </ModalFooter>
                </Modal>

                <CardHeader className="co-shell-header">
                  <div className="co-shell-title">
                    {step === 1 ? tt('createOrder.step1.header') : tt('createOrder.step2.header')}
                    <div className="co-shell-subtitle">
                      {step === 1
                        ? tt('createOrder.step1.subheader')
                        : tt('createOrder.step2.subheader')}
                    </div>
                  </div>

                  <div className="co-stepper" aria-label={tt('createOrder.aria.steps')}>
                    <div className={`co-step ${step === 1 ? 'is-active' : 'is-done'}`}>
                      <div className="co-step-dot">{step === 1 ? '1' : '✓'}</div>
                      <div className="co-step-text">
                        <div className="co-step-name">{tt('createOrder.stepper.step1.name')}</div>
                        <div className="co-step-meta">{tt('createOrder.stepper.step1.meta')}</div>
                      </div>
                    </div>

                    <div className={`co-step-line ${step === 2 ? 'is-active' : ''}`} />

                    <div className={`co-step ${step === 2 ? 'is-active' : ''}`}>
                      <div className="co-step-dot">2</div>
                      <div className="co-step-text">
                        <div className="co-step-name">{tt('createOrder.stepper.step2.name')}</div>
                        <div className="co-step-meta">{tt('createOrder.stepper.step2.meta')}</div>
                      </div>
                    </div>
                  </div>
                </CardHeader>

                <CardBody className="co-shell-body">
                  {/* error alert */}
                  {error ? (
                    <div ref={errorRef}>
                      <Alert color="danger" className="mb-3">
                        {error}
                      </Alert>
                    </div>
                  ) : null}

                  {/* STEP 1: choose service */}
                  {step === 1 ? (
                    <div className="co-step1">
                      <div className="co-step1-head">
                        <div className="co-step1-h1">{tt('createOrder.step1.chooseService')}</div>
                        <div className="co-step1-sub">
                          {tt('createOrder.step1.chooseServiceHint')}
                        </div>
                      </div>

                      <div className="co-service-grid">
                        <button
                          type="button"
                          className={`co-service-card ${service === 'marine' ? 'is-active' : ''}`}
                          onClick={() => pickService('marine')}
                        >
                          <div className="co-service-top">
                            <div className="co-service-icon">🚢</div>
                            <div className="co-service-name">
                              {tt('createOrder.services.marine')}
                            </div>
                          </div>
                          <div className="co-service-desc">
                            {tt('createOrder.services.marineDesc')}
                          </div>
                          <div className="co-service-foot">
                            {tt('createOrder.services.marineFoot')}
                          </div>
                        </button>

                        <button
                          type="button"
                          className={`co-service-card ${service === 'air' ? 'is-active' : ''}`}
                          onClick={() => pickService('air')}
                        >
                          <div className="co-service-top">
                            <div className="co-service-icon">✈️</div>
                            <div className="co-service-name">{tt('createOrder.services.air')}</div>
                          </div>
                          <div className="co-service-desc">
                            {tt('createOrder.services.airDesc')}
                          </div>
                          <div className="co-service-foot">
                            {tt('createOrder.services.airFoot')}
                          </div>
                        </button>

                        <button
                          type="button"
                          className={`co-service-card ${service === 'truck' ? 'is-active' : ''}`}
                          onClick={() => pickService('truck')}
                        >
                          <div className="co-service-top">
                            <div className="co-service-icon">🚚</div>
                            <div className="co-service-name">
                              {tt('createOrder.services.truck')}
                            </div>
                          </div>
                          <div className="co-service-desc">
                            {tt('createOrder.services.truckDesc')}
                          </div>
                          <div className="co-service-foot">
                            {tt('createOrder.services.truckFoot')}
                          </div>
                        </button>
                      </div>

                      <div className="co-step1-actions">
                        <div className="co-step1-hint">
                          {loadingCities
                            ? tt('createOrder.loadingDestinations')
                            : tt('createOrder.ready')}
                        </div>
                        <Button color="primary" onClick={onNext}>
                          {tt('createOrder.actions.next')}
                        </Button>
                      </div>
                    </div>
                  ) : null}

                  {/* STEP 2: options + form */}
                  {step === 2 ? (
                    <div className="co-step2">
                      {/* top bar */}
                      <div className="co-step2-topbar">
                        <div className="co-step2-service">
                          <span className="co-pill">{service.toUpperCase()}</span>
                          <span className="co-muted">{tt('createOrder.step2.completeBelow')}</span>
                        </div>

                        <div className="co-step2-actions">
                          <Button color="secondary" outline onClick={onBack} disabled={isCreating}>
                            {tt('createOrder.actions.back')}
                          </Button>
                        </div>
                      </div>

                      {/* client user picker */}
                      <FormGroup className="mb-3">
                        <Label className="co-label">
                          {tt('createOrder.common.selectClient') || 'Client'} <span style={{ color: 'red' }}>*</span>
                        </Label>
                        <Select
                          options={clientList}
                          value={clientList.find((o) => o.value === clientUserId) ?? null}
                          onChange={(opt: { value: string; label: string } | null) => setClientUserId(opt ? opt.value : '')}
                          placeholder={tt('createOrder.common.selectClientPlaceholder') || 'Select a client...'}
                          isClearable
                          isSearchable
                          isDisabled={isCreating}
                          classNamePrefix="rs"
                        />
                      </FormGroup>

                      {/* options checkboxes */}
                      <div className="co-options">
                        <div className="co-options-title">{tt('createOrder.options.title')}</div>
                        <div className="co-options-row">
                          {(service === 'marine' || service === 'air' || service === 'truck') && (
                            <>
                              <label className="co-check">
                                <input
                                  type="checkbox"
                                  checked={activeOps.includes('1')}
                                  onChange={() => toggleOp('1')}
                                  disabled={isCreating || !isOpAllowed(service, '1')}
                                />
                                <span>{tt('createOrder.options.op1')}</span>
                              </label>

                              <label className="co-check">
                                <input
                                  type="checkbox"
                                  checked={activeOps.includes('2')}
                                  onChange={() => toggleOp('2')}
                                  disabled={isCreating || !isOpAllowed(service, '2')}
                                />
                                <span>
                                  {service === 'marine'
                                    ? tt('createOrder.options.marine.op2')
                                    : service === 'air'
                                      ? tt('createOrder.options.air.op2')
                                      : tt('createOrder.options.truck.op2')}
                                </span>
                              </label>

                              <label className="co-check">
                                <input
                                  type="checkbox"
                                  checked={activeOps.includes('3')}
                                  onChange={() => toggleOp('3')}
                                  disabled={isCreating || !isOpAllowed(service, '3')}
                                />
                                <span>
                                  {service === 'marine'
                                    ? tt('createOrder.options.marine.op3')
                                    : service === 'air'
                                      ? tt('createOrder.options.air.op3')
                                      : tt('createOrder.options.truck.op3')}
                                </span>
                              </label>
                            </>
                          )}
                        </div>
                        {!activeOps.length && (
                          <Alert color="warning" className="mt-2 mb-0">
                            {tt('createOrder.errors.noPermissionForService') ||
                              'You do not have permission to create this service.'}
                          </Alert>
                        )}
                      </div>

                      {/* form submit */}
                      <Form onSubmit={onSubmit}>
                        {/* MARINE FORM */}
                        {service === 'marine' ? (
                          <>
                            <div className="co-section-title">{tt('createOrder.marine.title')}</div>

                            <FormGroup>
                              <Label className="co-label">
                                {tt('createOrder.marine.containerNumbers')}
                              </Label>

                              {marine.containers.map((v, idx) => (
                                <div className="co-line" key={idx}>
                                  <Input
                                    value={v}
                                    placeholder={tt('createOrder.marine.containerPlaceholder')}
                                    onChange={(e) => updateContainer(idx, e.target.value)}
                                    disabled={isCreating}
                                  />
                                  <Button
                                    color="secondary"
                                    outline
                                    type="button"
                                    onClick={() => removeContainer(idx)}
                                    disabled={isCreating || marine.containers.length <= 1}
                                  >
                                    {tt('createOrder.actions.remove')}
                                  </Button>
                                </div>
                              ))}

                              <Button
                                color="primary"
                                outline
                                type="button"
                                onClick={addContainer}
                                disabled={isCreating}
                              >
                                {tt('createOrder.actions.addContainer')}
                              </Button>
                            </FormGroup>

                            <Row className="g-3">
                              <Col md={6}>
                                <FormGroup>
                                  <Label className="co-label">
                                    {tt('createOrder.common.finalDestination')}
                                  </Label>

                                  {cityOptions.length ? (
                                    <Input
                                      type="select"
                                      value={marine.destination}
                                      onChange={(e) =>
                                        setMarine((p) => ({ ...p, destination: e.target.value }))
                                      }
                                      disabled={isCreating}
                                    >
                                      <option value="" disabled hidden>
                                        {tt('createOrder.common.selectDestination')}
                                      </option>
                                      {cityOptions.map((c: string) => (
                                        <option key={c} value={c}>
                                          {c}
                                        </option>
                                      ))}
                                    </Input>
                                  ) : (
                                    <Input
                                      value={marine.destination}
                                      onChange={(e) =>
                                        setMarine((p) => ({ ...p, destination: e.target.value }))
                                      }
                                      disabled={isCreating}
                                    />
                                  )}
                                </FormGroup>
                              </Col>

                              <Col md={6}>
                                <FormGroup>
                                  <Label className="co-label">
                                    {tt('createOrder.common.ersOptional')}
                                  </Label>
                                  <Input
                                    type="select"
                                    value={marine.ers}
                                    onChange={(e) =>
                                      setMarine((p) => ({ ...p, ers: e.target.value as any }))
                                    }
                                    disabled={isCreating}
                                  >
                                    <option value="" disabled hidden>
                                      {tt('createOrder.common.select')}
                                    </option>
                                    <option value="1">{tt('common.yes')}</option>
                                    <option value="0">{tt('common.no')}</option>
                                  </Input>
                                </FormGroup>
                              </Col>

                              <Col md={6}>
                                <FormGroup>
                                  <Label className="co-label">
                                    {tt('createOrder.common.fclLcl')}
                                  </Label>
                                  <Input
                                    type="select"
                                    value={marine.fcl}
                                    onChange={(e) =>
                                      setMarine((p) => ({ ...p, fcl: e.target.value as any }))
                                    }
                                    disabled={isCreating}
                                  >
                                    <option value="FCL">{tt('common.fcl')}</option>
                                    <option value="LCL">{tt('common.lcl')}</option>
                                  </Input>
                                </FormGroup>
                              </Col>

                              {showMbl ? (
                                <>
                                  <Col md={6}>
                                    <FormGroup>
                                      <Label className="co-label">MBL <span style={{ color: 'red' }}>*</span></Label>
                                      <Input
                                        value={marine.mbl}
                                        placeholder="MBL"
                                        onChange={(e) => setMarine((p) => ({ ...p, mbl: e.target.value }))}
                                        disabled={isCreating}
                                      />
                                    </FormGroup>
                                  </Col>

                                  <Col md={12}>
                                    <FormGroup>
                                      <Label className="co-label">HBL <span style={{ color: 'red' }}>*</span></Label>
                                      {marine.hblList.map((v, idx) => (
                                        <div className="co-line" key={idx} style={{ marginBottom: 6 }}>
                                          <Input
                                            value={v}
                                            placeholder="HBL"
                                            onChange={(e) => updateHbl(idx, e.target.value)}
                                            disabled={isCreating}
                                          />
                                          <Button
                                            color="secondary"
                                            outline
                                            type="button"
                                            onClick={() => removeHbl(idx)}
                                            disabled={isCreating || marine.hblList.length <= 1}
                                          >
                                            {tt('createOrder.actions.remove') || 'Remove'}
                                          </Button>
                                        </div>
                                      ))}
                                      <Button
                                        color="primary"
                                        outline
                                        type="button"
                                        onClick={addHbl}
                                        disabled={isCreating}
                                      >
                                        + HBL
                                      </Button>
                                    </FormGroup>
                                  </Col>
                                </>
                              ) : null}

                              {showMarineRail ? (
                                <Col md={6}>
                                  <FormGroup>
                                    <Label className="co-label">
                                      {tt('orderList.columns.rail') || 'Rail'}
                                    </Label>
                                    <Input
                                      type="select"
                                      value={marine.rail}
                                      onChange={(e) =>
                                        setMarine((p) => ({ ...p, rail: e.target.value as any }))
                                      }
                                      disabled={isCreating}
                                    >
                                      <option value="" disabled hidden>
                                        {tt('createOrder.common.select')}
                                      </option>
                                      <option value="CN">CN</option>
                                      <option value="CP">CP</option>
                                      <option value="NA">NA</option>
                                    </Input>
                                  </FormGroup>
                                </Col>
                              ) : null}

                              {/* go warehouse only when needed */}
                              {showMarineLogisticFields ? (
                                <>
                                  <Col md={6}>
                                    <FormGroup>
                                      <Label className="co-label">
                                        {tt('createOrder.marine.goWarehouse')}
                                      </Label>
                                      <Input
                                        type="select"
                                        value={marine.goWarehouse}
                                        onChange={(e) =>
                                          setMarine((p) => ({
                                            ...p,
                                            goWarehouse: e.target.value as any,
                                          }))
                                        }
                                        disabled={isCreating}
                                      >
                                        <option value="" disabled hidden>
                                          {tt('createOrder.common.select')}
                                        </option>
                                        <option value="0">DH Warehouse</option>
                                        <option value="1">Third Party</option>
                                        <option value="2">D/O</option>
                                      </Input>
                                    </FormGroup>
                                  </Col>

                                  <Col md={6}>
                                    <FormGroup>
                                      <Label className="co-label">
                                        {tt('createOrder.common.deliveryCity')}
                                        {marine.goWarehouse === '1' ? ' *' : ''}
                                      </Label>
                                      <Input
                                          value={marine.deliveryCity}
                                          onChange={(e) =>
                                              setMarine((p) => ({ ...p, deliveryCity: e.target.value }))
                                          }
                                          disabled={isCreating}
                                          placeholder="Delivery City"
                                      />
                                    </FormGroup>
                                  </Col>

                                  <Col md={6}>
                                    <FormGroup>
                                      <Label className="co-label">
                                        {tt('createOrder.common.postcode')}
                                        {marine.goWarehouse === '1' ? ' *' : ''}
                                      </Label>
                                      <Input
                                          value={marine.postcode}
                                          onChange={(e) =>
                                              setMarine((p) => ({ ...p, postcode: e.target.value }))
                                          }
                                          disabled={isCreating}
                                          placeholder="Postcode"
                                      />
                                    </FormGroup>
                                  </Col>

                                  <Col md={6}>
                                    <FormGroup>
                                      <Label className="co-label">
                                        {tt('createOrder.marine.whetherNeedPickUp')}
                                      </Label>
                                      <Input
                                        type="select"
                                        value={marine.isPickupContainer}
                                        onChange={(e) =>
                                          setMarine((p) => ({
                                            ...p,
                                            isPickupContainer: e.target.value as any,
                                          }))
                                        }
                                        disabled={isCreating}
                                      >
                                        <option value="" disabled hidden>
                                          {tt('createOrder.common.select')}
                                        </option>
                                        <option value="1">{tt('common.yes')}</option>
                                        <option value="0">{tt('common.no')}</option>
                                      </Input>
                                    </FormGroup>
                                  </Col>
                                </>
                              ) : null}
                            </Row>

                            <FormGroup>
                              <Label className="co-label">
                                {tt('createOrder.common.noteOptional')}
                              </Label>
                              <Input
                                type="textarea"
                                rows={4}
                                value={marine.note}
                                onChange={(e) => setMarine((p) => ({ ...p, note: e.target.value }))}
                                disabled={isCreating}
                              />
                            </FormGroup>
                          </>
                        ) : null}

                        {/* AIR FORM */}
                        {service === 'air' ? (
                          <>
                            <div className="co-section-title">{tt('createOrder.air.title')}</div>

                            <Row className="g-3">
                              <Col md={6}>
                                <FormGroup>
                                  <Label className="co-label">{tt('createOrder.air.awb')}</Label>
                                  <Input
                                    value={air.awb}
                                    placeholder={tt('createOrder.air.awbPlaceholder')}
                                    onChange={(e) => setAir((p) => ({ ...p, awb: e.target.value }))}
                                    disabled={isCreating}
                                  />
                                </FormGroup>
                              </Col>

                              <Col md={6}>
                                <FormGroup>
                                  <Label className="co-label">
                                    {tt('createOrder.air.etaOptional')}
                                  </Label>
                                  <Input
                                    type="date"
                                    value={air.eta}
                                    onChange={(e) => setAir((p) => ({ ...p, eta: e.target.value }))}
                                    disabled={isCreating}
                                  />
                                </FormGroup>
                              </Col>

                              <Col md={4}>
                                <FormGroup>
                                  <Label className="co-label">
                                    {tt('createOrder.air.shippingUnits')}
                                  </Label>
                                  <Input
                                    value={air.shippingUnits}
                                    onChange={(e) =>
                                      setAir((p) => ({ ...p, shippingUnits: e.target.value }))
                                    }
                                    disabled={isCreating}
                                  />
                                </FormGroup>
                              </Col>

                              <Col md={4}>
                                <FormGroup>
                                  <Label className="co-label">
                                    {tt('createOrder.air.grossWeight')}
                                  </Label>
                                  <Input
                                    value={air.grossWeight}
                                    onChange={(e) =>
                                      setAir((p) => ({ ...p, grossWeight: e.target.value }))
                                    }
                                    disabled={isCreating}
                                  />
                                </FormGroup>
                              </Col>

                              <Col md={4}>
                                <FormGroup>
                                  <Label className="co-label">
                                    {tt('createOrder.air.chargeableWeight')}
                                  </Label>
                                  <Input
                                    value={air.chargeableWeight}
                                    onChange={(e) =>
                                      setAir((p) => ({ ...p, chargeableWeight: e.target.value }))
                                    }
                                    disabled={isCreating}
                                  />
                                </FormGroup>
                              </Col>

                              <Col md={12}>
                                <FormGroup>
                                  <Label className="co-label">
                                    {tt('createOrder.common.finalDestination')}
                                  </Label>
                                  {cityOptions.length ? (
                                    <Input
                                      type="select"
                                      value={air.finalDestination}
                                      onChange={(e) =>
                                        setAir((p) => ({ ...p, finalDestination: e.target.value }))
                                      }
                                      disabled={isCreating}
                                    >
                                      <option value="" disabled hidden>
                                        {tt('createOrder.common.selectDestination')}
                                      </option>
                                      {cityOptions.map((c: string) => (
                                        <option key={c} value={c}>
                                          {c}
                                        </option>
                                      ))}
                                    </Input>
                                  ) : (
                                    <Input
                                      value={air.finalDestination}
                                      onChange={(e) =>
                                        setAir((p) => ({ ...p, finalDestination: e.target.value }))
                                      }
                                      disabled={isCreating}
                                    />
                                  )}
                                </FormGroup>
                              </Col>
                            </Row>
                          </>
                        ) : null}

                        {/* TRUCK FORM */}
                        {service === 'truck' ? (
                          <>
                            <div className="co-section-title">{tt('createOrder.truck.title')}</div>

                            <FormGroup>
                              <Label className="co-label">
                                {tt('createOrder.truck.container')}
                              </Label>

                              {truck.containers.map((v, idx) => (
                                <div className="co-line" key={idx}>
                                  <Input
                                    value={v}
                                    placeholder={tt('createOrder.truck.containerPlaceholder')}
                                    onChange={(e) => updateContainer(idx, e.target.value)}
                                    disabled={isCreating}
                                  />
                                  <Button
                                    color="secondary"
                                    outline
                                    type="button"
                                    onClick={() => removeContainer(idx)}
                                    disabled={isCreating || truck.containers.length <= 1}
                                  >
                                    {tt('createOrder.actions.remove')}
                                  </Button>
                                </div>
                              ))}

                              <Button
                                color="primary"
                                outline
                                type="button"
                                onClick={addContainer}
                                disabled={isCreating}
                              >
                                {tt('createOrder.actions.addContainer')}
                              </Button>
                            </FormGroup>

                            <Row className="g-3">
                              <Col md={6}>
                                <FormGroup>
                                  <Label className="co-label">
                                    {tt('createOrder.truck.destinationCanada')}
                                  </Label>
                                  <Input
                                    type="select"
                                    value={truck.dl}
                                    onChange={(e) =>
                                      setTruck((p) => ({ ...p, dl: e.target.value }))
                                    }
                                    disabled={isCreating}
                                  >
                                    <option value="" disabled hidden>
                                      {tt('createOrder.common.selectDestination')}
                                    </option>
                                    {cityOptions.map((c: string) => (
                                      <option key={c} value={c}>
                                        {c}
                                      </option>
                                    ))}
                                  </Input>
                                </FormGroup>
                              </Col>

                              <Col md={6}>
                                <FormGroup>
                                  <Label className="co-label">
                                    {tt('createOrder.truck.departure')}
                                  </Label>
                                  <Input
                                    type="select"
                                    value={truck.usaPort}
                                    onChange={(e) =>
                                      setTruck((p) => ({ ...p, usaPort: e.target.value }))
                                    }
                                    disabled={isCreating}
                                  >
                                    <option value="USA">USA</option>
                                    <option value="Canada">Canada</option>
                                  </Input>
                                </FormGroup>
                              </Col>

                              <Col md={6}>
                                <FormGroup>
                                  <Label className="co-label">
                                    {tt('createOrder.common.ersOptional')}
                                  </Label>
                                  <Input
                                    type="select"
                                    value={truck.ers}
                                    onChange={(e) =>
                                      setTruck((p) => ({ ...p, ers: e.target.value as any }))
                                    }
                                    disabled={isCreating}
                                  >
                                    <option value="" disabled hidden>
                                      {tt('createOrder.common.select')}
                                    </option>
                                    <option value="1">{tt('common.yes')}</option>
                                    <option value="0">{tt('common.no')}</option>
                                  </Input>
                                </FormGroup>
                              </Col>

                              <Col md={6}>
                                <FormGroup>
                                  <Label className="co-label">
                                    {tt('createOrder.common.fclLcl')}
                                  </Label>
                                  <Input
                                    type="select"
                                    value={truck.fcl}
                                    onChange={(e) =>
                                      setTruck((p) => ({ ...p, fcl: e.target.value as any }))
                                    }
                                    disabled={isCreating}
                                  >
                                    <option value="FCL">{tt('common.fcl')}</option>
                                    <option value="LCL">{tt('common.lcl')}</option>
                                  </Input>
                                </FormGroup>
                              </Col>
                            </Row>

                            {showTruckGoWarehouse ? (
                              <FormGroup>
                                <Label className="co-label">
                                  {tt('createOrder.marine.goWarehouse') || 'Whether in Warehouse'} <span style={{ color: 'red' }}>*</span>
                                </Label>
                                <Input
                                  type="select"
                                  value={truck.goWarehouse}
                                  onChange={(e) => setTruck((p) => ({ ...p, goWarehouse: e.target.value as any }))}
                                  disabled={isCreating}
                                >
                                  <option value="" disabled hidden>
                                    {tt('createOrder.common.select')}
                                  </option>
                                  <option value="1">{tt('common.yes')}</option>
                                  <option value="0">{tt('common.no')}</option>
                                </Input>
                              </FormGroup>
                            ) : null}

                            <FormGroup>
                              <Label className="co-label">
                                {tt('createOrder.common.noteOptional')}
                              </Label>
                              <Input
                                type="textarea"
                                rows={4}
                                value={truck.note}
                                onChange={(e) => setTruck((p) => ({ ...p, note: e.target.value }))}
                                disabled={isCreating}
                              />
                            </FormGroup>
                          </>
                        ) : null}

                        {/* submit button */}
                        <div className="co-actions">
                          <Button color="primary" type="submit" disabled={isCreating}>
                            {isCreating
                              ? tt('createOrder.actions.creating')
                              : tt('createOrder.actions.createGoUpload')}
                          </Button>
                        </div>
                      </Form>
                    </div>
                  ) : null}
                </CardBody>
              </Card>
            </Col>
          </Row>
        </div>
      </Container>
    </div>
  );
};

export default CreateOrder;
