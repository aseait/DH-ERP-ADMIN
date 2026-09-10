import React, { useState, useEffect, useCallback, useRef } from 'react';
import Select from 'react-select';
import AsyncSelect from 'react-select/async';
import AsyncCreatableSelect from 'react-select/async-creatable';
import {
  Container, Card, CardBody, CardHeader, Button, Input, Label, FormGroup,
  Row, Col, Spinner, Alert, Table, Modal, ModalHeader, ModalBody, ModalFooter,
} from 'reactstrap';
import BreadCrumb from '../../Components/Common/BreadCrumb';
import SelectDestination from '../../Components/Common/SelectDestination';
import { buildApiUrl } from '../../helpers/apiBase';
import { GET_CLIENT_USER_LIST, INSERT_SALES_QUOTE } from '../../helpers/url_helper';
import { useTT } from '../../helpers/useTT';
import {
  ProvinceOption, AreaOption, FsaOption,
  postalCodeOptions, loadProvinceOptions, makeAreaLoader, makeFsaLoader,
} from '../../helpers/postalCode';

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatCanadianPostcode(v: string): string {
  const s = v.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (s.length >= 6) return `${s.slice(0, 3)} ${s.slice(3, 6)}`;
  return s;
}

function isValidCanadianPostcode(v: string): boolean {
  return /^[A-Z]\d[A-Z] \d[A-Z]\d$/.test(v.trim().toUpperCase());
}

function formatDeliveryCity(v: string): string {
  return v.trim().replace(/\b\w/g, c => c.toUpperCase());
}

const MAX_FSA_SUGGESTIONS = 8;

function buildAdditionalInformation(unit: string, freeAmount: string): string {
  if (!freeAmount) return '';
  if (unit === '/Day') return `${freeAmount} ${Number(freeAmount) === 1 ? 'day' : 'days'} free`;
  if (unit === '/Hour') return `after ${freeAmount} ${Number(freeAmount) === 1 ? 'hour' : 'hours'} free`;
  return '';
}

function escapeHtml(v: any): string {
  return String(v ?? '')
    .replaceAll('&', '&amp;').replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;');
}

// ── Catalogue ─────────────────────────────────────────────────────────────────

type ServiceItem = {
  code: string; en: string; zh: string; cat: string; unit?: string; defaultFreeAmount?: string;
};

const ITEMS: ServiceItem[] = [
  { code: 'BrokerageFee', en: 'Brokerage Fee', zh: '报关费', cat: 'brokerage' },
  { code: 'LineCharge', en: 'Line Charge', zh: '海关条目费（HS CODE超过5条收取）', cat: 'brokerage' },
  { code: 'DutyGSTAdmin', en: 'Duty/GST Admin Fee', zh: '税金代付费', cat: 'brokerage' },
  { code: 'DutyGSTAdvance', en: 'Duty/GST Advance Payment', zh: '关税代缴', cat: 'brokerage' },
  { code: 'Emanifest', en: 'Emanifest Fee', zh: '电子载货舱单（申报给CBSA）', cat: 'brokerage' },
  { code: 'ISF5_10', en: 'ISF-5 / ISF-10', zh: '美国过境进口申报费', cat: 'brokerage' },
  { code: 'ExamHandle', en: 'Exam Handling Fee', zh: '查验操作费', cat: 'brokerage' },
  { code: 'BondAgent', en: 'Bond Agent Fee', zh: 'Bond代理购买费', cat: 'brokerage' },
  { code: 'BrokerAppFee', en: 'Brokerage Application Fee', zh: '代理申请费（NRI/CFIA）', cat: 'brokerage' },
  { code: 'TitleFee', en: 'Title Fee', zh: '清关主体使用费', cat: 'brokerage' },
  { code: 'HandlingFee', en: 'Handling Fee', zh: '跟货操作费', cat: 'logistics' },
  { code: 'PCAdminFee', en: 'PC Admin Fee', zh: '第三方账单代付费', cat: 'logistics' },
  { code: 'LogisticsApp', en: 'Logistics Application Fee', zh: '物流代理申请费（ERS）', cat: 'logistics' },
  { code: 'OceanFee', en: 'Ocean Fee', zh: '海运费', cat: 'logistics' },
  { code: 'DrayageFee', en: 'Drayage Fee', zh: '提柜费', cat: 'logistics' },
  { code: 'PrePull', en: 'Pre-pull', zh: '预提/预拉', cat: 'logistics', unit: '/Trip' },
  { code: 'StorageFee', en: 'Yard Storage', zh: '堆场存柜费', cat: 'logistics', unit: '/Day', defaultFreeAmount: '2' },
  { code: 'ChassisRental', en: 'Chassis Rental', zh: '车架租赁', cat: 'logistics', unit: '/Day', defaultFreeAmount: '2' },
  { code: 'LiveUnloadWaiting', en: 'Live-unload Waiting Time', zh: '现场卸货等时费', cat: 'logistics', unit: '/Hour', defaultFreeAmount: '1' },
  { code: 'TerminalWaiting', en: 'Terminal Waiting Time', zh: '码头等时费', cat: 'logistics', unit: '/Hour', defaultFreeAmount: '1' },
  { code: 'DGSurcharge', en: 'DG Surcharge', zh: '危险品附加费', cat: 'logistics' },
  { code: 'DGLabelRemove', en: 'DG Label Remove', zh: '危险品标签移除费', cat: 'logistics' },
  { code: 'ExtraStopSOC', en: 'Extra Stop/SOC', zh: '额外停靠/SOC', cat: 'logistics' },
  { code: 'DropOff', en: 'Drop Off', zh: '还柜/Drop off', cat: 'logistics' },
  { code: 'OtherLocalTrucking', en: 'Other Local Trucking', zh: '其他本地拖车费', cat: 'logistics' },
  { code: 'TruckLoading', en: 'Trucking and Loading', zh: '提货/派送费（第三方）', cat: 'logistics' },
  { code: 'ChassisYard', en: 'Chassis Rental/Yard Storage', zh: '卡车公司车架费/存柜费', cat: 'logistics' },
  { code: 'LiftOnOff', en: 'Lift On/Lift Off', zh: '起重机上/下架费', cat: 'logistics' },
  { code: 'DrayDeadRun', en: 'Drayage Dead Run', zh: '提/还柜空跑费', cat: 'logistics' },
  { code: 'DeStuff', en: 'De-stuff Fee', zh: '卸柜费', cat: 'warehouse' },
  { code: 'SortingFee', en: 'Sorting Fee', zh: '理货费', cat: 'warehouse' },
  { code: 'PalletWrap', en: 'Palletize and Wrapping Fee', zh: '打板缠膜费', cat: 'warehouse' },
  { code: 'Labelling', en: 'Labelling Fee', zh: '贴标/换标费', cat: 'warehouse' },
  { code: 'InLoading', en: 'In Loading Fee', zh: '入库费（散货/退货收取）', cat: 'warehouse' },
  { code: 'AMZAppt', en: 'Amazon Appointment Fee', zh: '亚马逊派送预约费', cat: 'warehouse' },
  { code: 'FBAActive', en: 'FBA Active', zh: 'FBA激活费', cat: 'warehouse' },
  { code: 'DeliveryAMZ', en: 'Delivery to Amazon Fee', zh: '亚马逊派送费', cat: 'warehouse' },
  { code: 'DeliveryFee', en: 'Delivery Fee', zh: '私人地址派送费', cat: 'warehouse' },
  { code: 'HandlingOut', en: 'Handling out', zh: '出库费（自提）', cat: 'warehouse' },
  { code: 'DelivWait', en: 'Delivery Waiting Time', zh: '亚马逊送仓等时费', cat: 'warehouse' },
  { code: 'DelivDead', en: 'Delivery Dead Run Fee', zh: '派送空跑费', cat: 'warehouse' },
  { code: 'WHStorage', en: 'Warehouse Storage Fee', zh: '货物仓储费', cat: 'warehouse' },
  { code: 'FCLAllIn', en: 'FCL ALL-IN Service', zh: '整柜一口价服务费', cat: 'warehouse' },
  { code: 'USCAFTLAll', en: 'US to CA FTL ALL-IN', zh: '美转加整柜(车)一口价服务费', cat: 'warehouse' },
  { code: 'WHOther', en: 'Warehouse Other Service', zh: '库内其它服务费', cat: 'warehouse' },
];

const CATEGORIES = [
  { key: 'brokerage', label: '清关服务费 (Brokerage)' },
  { key: 'logistics', label: '物流服务费 (Logistics)' },
  { key: 'warehouse', label: '海外仓服务费 (Warehouse)' },
];

const CB_DEFAULT_LINES = [
  { serviceCode: 'BrokerageFee',   details: '',           fee: 75,  unit: '', freeAmount: '', additional_information: '' },
  { serviceCode: 'DutyGSTAdvance', details: '',           fee: 35,  unit: '', freeAmount: '', additional_information: '' },
  { serviceCode: 'LineCharge',     details: '海关条目超5条', fee: 2,  unit: '', freeAmount: '', additional_information: '/条，超5条收取' },
  { serviceCode: 'ExamHandle',     details: '如需处理查验', fee: 200, unit: '', freeAmount: '', additional_information: '' },
];

const FCL_DEFAULT_LINES: { serviceCode: string; category?: string; details: string; fee: number; unit: string; freeAmount: string; additional_information: string }[] = [
  { serviceCode: 'PrePull', details: '', fee: 150, unit: '/Trip', freeAmount: '', additional_information: '' },
  { serviceCode: 'StorageFee',       details: 'Yard storage', fee: 50, unit: '/Day',  freeAmount: '2', additional_information: '2 days free' },
  { serviceCode: 'ChassisRental',    details: 'Chassis',      fee: 50, unit: '/Day',  freeAmount: '2', additional_information: '2 days free' },
  { serviceCode: 'LiveUnloadWaiting',details: '', fee: 60, unit: '/Hour', freeAmount: '1', additional_information: 'after 1 hour free' },
  { serviceCode: 'DGSurcharge',      details: 'DG surcharge',    fee: 150, unit: '', freeAmount: '', additional_information: '' },
  { serviceCode: 'DGLabelRemove',    details: 'DG label remove', fee: 75,  unit: '', freeAmount: '', additional_information: '' },
  { serviceCode: 'ExtraStopSOC',     details: 'Extra Stop/SOC',  fee: 0,   unit: '', freeAmount: '', additional_information: '单独询价' },
  { serviceCode: 'DropOff',          details: 'Drop off',         fee: 0,   unit: '', freeAmount: '', additional_information: '单独询价' },
  { serviceCode: 'OtherLocalTrucking', details: '带货/短驳',     fee: 0,   unit: '', freeAmount: '', additional_information: '自行加价' },
];

function findItem(code: string) { return ITEMS.find(x => x.code === code); }

function formatServiceDisplay(code: string): string {
  const item = findItem(code);
  if (!item) return code;
  return item.unit ? `${item.en} | ${item.zh} (${item.unit})` : `${item.en} | ${item.zh}`;
}

function categoryLabel(key: string): string {
  return CATEGORIES.find(c => c.key === key)?.label || key;
}

// ── Types ─────────────────────────────────────────────────────────────────────

type Line = {
  _id: number;
  category: string;
  serviceCode: string;
  details: string;
  fee: number | string;
  currency: 0 | 1;
  address: string;
  pod: string;
  delivery_city: string;
  postcode: string;
  dock: '0' | '1';
  unit: string;
  freeAmount: string;
  additional_information: string;
  logistics_type: string;
};

let _idCtr = 0;

// ── Component ─────────────────────────────────────────────────────────────────

const CreateQuote: React.FC = () => {
  const { tt } = useTT();

  const authUser: any = (() => {
    try { return JSON.parse(sessionStorage.getItem('authUser') || '{}'); } catch { return {}; }
  })();
  const salesId = Number(authUser?.user_id ?? authUser?.id ?? 0);
  const canSubmitRole = [1, 6, 7].includes(Number(authUser?.restriction));

  const [customers, setCustomers] = useState<{ user_id: string; user_name: string }[]>([]);
  const [loadingCustomers, setLoadingCustomers] = useState(false);

  // Header
  const [userId, setUserId] = useState('');
  const [currency, setCurrency] = useState<'0' | '1'>('0');

  // Draft line fields
  const [draftCategory, setDraftCategory] = useState('');
  const [draftLogisticsType, setDraftLogisticsType] = useState('');
  const [draftServiceCode, setDraftServiceCode] = useState('');
  const [draftDetails, setDraftDetails] = useState('');
  const [draftFee, setDraftFee] = useState('');
  const [draftUnit, setDraftUnit] = useState('');
  const [draftFreeAmount, setDraftFreeAmount] = useState('');
  const [draftAdditionalInfo, setDraftAdditionalInfo] = useState('');
  const [draftAddress, setDraftAddress] = useState('');
  const [draftPod, setDraftPod] = useState('');
  const [draftProvince, setDraftProvince] = useState<ProvinceOption | null>(null);
  const [draftDeliveryCity, setDraftDeliveryCity] = useState('');
  const [draftPostcode, setDraftPostcode] = useState('');
  const [fsaSuggestions, setFsaSuggestions] = useState<FsaOption[]>([]);
  const [draftDock, setDraftDock] = useState<'0' | '1'>('0');

  // City/postcode stay fully free-typed (getNewOptionData / no isValidNewOption
  // restriction) since the postal-code table doesn't cover every city/FSA.
  const loadAreaOptions = React.useMemo(
    () => makeAreaLoader(draftProvince?.province_code || ''),
    [draftProvince?.province_code]
  );
  const loadFsaOptions = React.useMemo(
    () => makeFsaLoader(draftProvince?.province_code || '', draftDeliveryCity.trim()),
    [draftProvince?.province_code, draftDeliveryCity]
  );

  const onDraftProvinceChange = (opt: ProvinceOption | null) => {
    setDraftProvince(opt);
    setFsaSuggestions([]);
  };

  const onDraftAreaChange = (opt: AreaOption | null) => {
    const city = opt ? formatDeliveryCity(opt.area_name) : '';
    setDraftDeliveryCity(city);
    setFsaSuggestions([]);
    if (!city) return;
    // Fetch directly with the just-picked city instead of the memoized
    // loadFsaOptions, which still reflects the pre-update draftDeliveryCity
    // during this same event (state updates haven't re-rendered yet) —
    // using the stale closure here caused cleared cities to still show
    // FSA suggestions for whatever city was previously selected.
    makeFsaLoader(draftProvince?.province_code || '', city)('').then(setFsaSuggestions);
  };

  const lastLookupFsaRef = useRef<string>('');

  const applyFsaSuggestion = (fsaOpt: FsaOption) => {
    setDraftPostcode(prev => {
      const rest = prev.replace(/[^A-Z0-9]/gi, '').toUpperCase().slice(3);
      return formatCanadianPostcode(`${fsaOpt.fsa}${rest}`);
    });
  };

  const onPostcodeInputChange = (v: string) => {
    const formatted = formatCanadianPostcode(v);
    setDraftPostcode(formatted);
    loadFsaOptions(v).then(setFsaSuggestions);

    // Once the first three characters form a complete FSA, auto-fill
    // province/city from the postal code — same lookup Canada Post uses.
    const fsa = formatted.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 3);
    if (fsa.length < 3) { lastLookupFsaRef.current = ''; return; }
    if (fsa === lastLookupFsaRef.current) return;
    lastLookupFsaRef.current = fsa;

    postalCodeOptions({ postal_code: fsa }).then(rows => {
      if (!Array.isArray(rows) || !rows.length) return;
      const best = rows.find((r: any) => Number(r.is_primary) === 1) || rows[0];
      const city = best?.city || best?.area_name;
      if (city) setDraftDeliveryCity(formatDeliveryCity(city));
      if (best?.province_code) {
        setDraftProvince({
          value: best.province_code,
          label: best.province_name,
          province_code: best.province_code,
          province_name: best.province_name,
        });
      }
    });
  };

  const [lines, setLines] = useState<Line[]>([]);

  // Duplicate confirmation modal
  const [dupOpen, setDupOpen] = useState(false);
  const [dupDate, setDupDate] = useState('');
  const [dupDuplicates, setDupDuplicates] = useState<any[]>([]);
  const dupResolveRef = useRef<((r: { confirmed: boolean; effectiveDate?: string }) => void) | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [apiError, setApiError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const [templateOpen, setTemplateOpen] = useState(false);
  const [templateText, setTemplateText] = useState('');
  const [templateCopied, setTemplateCopied] = useState(false);

  useEffect(() => {
    setLoadingCustomers(true);
    fetch(buildApiUrl(GET_CLIENT_USER_LIST), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ page: 1, pageSize: 999, sortField: 'company_name', sortOrder: 'ASC' }),
    })
      .then(r => r.json())
      .then(d => {
        const arr = Array.isArray(d?.data) ? d.data : [];
        setCustomers(
          arr
            .map((x: any) => ({
              user_id: String(x.user_id ?? x.id ?? ''),
              user_name: String(x.company_name || x.user_name || ''),
            }))
            .filter((x: any) => x.user_id)
        );
      })
      .catch(() => {})
      .finally(() => setLoadingCustomers(false));
  }, []);

  // ── Draft handlers ──

  const onDraftCategoryChange = (cat: string) => {
    setDraftCategory(cat);
    setDraftServiceCode('');
    setDraftUnit('');
    setDraftFreeAmount('');
    setDraftAdditionalInfo('');
    setDraftLogisticsType('');
    if (cat !== 'logistics') setDraftPod('');
  };

  const onDraftServiceChange = (code: string) => {
    setDraftServiceCode(code);
    const item = findItem(code);
    const unit = item?.unit || '';
    const fa = item?.defaultFreeAmount || '';
    setDraftUnit(unit);
    setDraftFreeAmount(fa);
    setDraftAdditionalInfo(buildAdditionalInformation(unit, fa));
  };

  const onDraftUnitChange = (unit: string) => {
    setDraftUnit(unit);
    setDraftFreeAmount('');
    setDraftAdditionalInfo('');
  };

  const onDraftFreeAmountChange = (fa: string) => {
    setDraftFreeAmount(fa);
    setDraftAdditionalInfo(buildAdditionalInformation(draftUnit, fa));
  };

  // Sync all logistics lines when header delivery fields change
  useEffect(() => {
    setLines(prev => {
      if (!prev.some(l => l.category === 'logistics')) return prev;
      return prev.map(l => {
        if (l.category !== 'logistics') return l;
        return {
          ...l,
          pod: draftPod.trim(),
          delivery_city: draftDeliveryCity.trim() ? formatDeliveryCity(draftDeliveryCity) : l.delivery_city,
          postcode: draftPostcode.trim() ? formatCanadianPostcode(draftPostcode) : l.postcode,
        };
      });
    });
  }, [draftPod, draftDeliveryCity, draftPostcode]);

  // Sync all lines when header currency changes
  useEffect(() => {
    const flag: 0 | 1 = currency === '1' ? 1 : 0;
    setLines(prev => {
      if (!prev.length) return prev;
      return prev.map(l => ({ ...l, currency: flag }));
    });
  }, [currency]);

  const showDeliveryFields = draftCategory !== 'brokerage';
  const serviceOptions = ITEMS.filter(i => !draftCategory || i.cat === draftCategory);
  const serviceOptionsForCat = (cat: string) => ITEMS.filter(i => i.cat === cat);

  const addCbDefaultLines = () => {
    setApiError('');
    if (!userId) { setApiError(tt('quote.errSelectCustomer')); return; }
    const currFlag: 0 | 1 = currency === '1' ? 1 : 0;
    const existingKeys = new Set(lines.map(x => `brokerage_${x.serviceCode}`.toLowerCase()));
    const newLines: Line[] = CB_DEFAULT_LINES
      .filter(x => !existingKeys.has(`brokerage_${x.serviceCode}`.toLowerCase()))
      .map(x => ({
        _id: ++_idCtr,
        category: 'brokerage',
        serviceCode: x.serviceCode,
        details: x.details,
        fee: x.fee,
        currency: currFlag,
        address: draftAddress.trim(),
        pod: '',
        delivery_city: '',
        postcode: '',
        dock: draftDock,
        unit: x.unit,
        freeAmount: x.freeAmount,
        additional_information: x.additional_information,
        logistics_type: '',
      }));
    if (!newLines.length) { setApiError(tt('quote.errCbExists')); return; }
    setLines(prev => [...prev, ...newLines]);
    setSuccessMsg(tt('quote.cbAdded', { count: newLines.length }));
  };

  const addFclDefaultLines = () => {
    setApiError('');
    if (draftCategory !== 'logistics' || draftLogisticsType !== 'FCL') {
      setApiError(tt('quote.errLogisticsFcl')); return;
    }
    if (!userId) { setApiError(tt('quote.errSelectCustomer')); return; }
    if (!draftDeliveryCity.trim()) { setApiError(tt('quote.errDeliveryCity')); return; }
    if (!draftPostcode.trim()) { setApiError(tt('quote.errPostcode')); return; }
    if (!isValidCanadianPostcode(draftPostcode)) {
      setApiError(tt('quote.errInvalidPostcode')); return;
    }
    const city = formatDeliveryCity(draftDeliveryCity);
    const postcode = formatCanadianPostcode(draftPostcode);
    const currFlag: 0 | 1 = currency === '1' ? 1 : 0;
    const existingKeys = new Set(lines.map(x => `${x.category}_${x.serviceCode}`.toLowerCase()));
    const newLines: Line[] = FCL_DEFAULT_LINES
      .filter(x => !existingKeys.has(`${x.category ?? 'logistics'}_${x.serviceCode}`.toLowerCase()))
      .map(x => {
        const cat = x.category ?? 'logistics';
        const isLogistics = cat !== 'brokerage';
        return {
          _id: ++_idCtr,
          category: cat,
          serviceCode: x.serviceCode,
          details: x.details,
          fee: x.fee,
          currency: currFlag,
          address: draftAddress.trim(),
          pod: isLogistics ? draftPod.trim() : '',
          delivery_city: isLogistics ? city : '',
          postcode: isLogistics ? postcode : '',
          dock: draftDock,
          unit: x.unit,
          freeAmount: x.freeAmount,
          additional_information: x.additional_information,
          logistics_type: isLogistics ? 'FCL' : '',
        };
      });
    if (!newLines.length) { setApiError(tt('quote.errFclExists')); return; }
    setLines(prev => [...prev, ...newLines]);
    setSuccessMsg(tt('quote.fclAdded', { count: newLines.length }));
  };

  const addLine = () => {
    setApiError('');
    const errs: string[] = [];
    if (!draftCategory) errs.push(tt('quote.category'));
    if (!draftServiceCode) errs.push(tt('quote.service'));
    if (draftFee === '' || isNaN(Number(draftFee))) errs.push(tt('quote.fee'));
    if (showDeliveryFields) {
      if (!draftDeliveryCity.trim()) errs.push(tt('quote.deliveryCity'));
      if (!draftPostcode.trim()) errs.push(tt('quote.postcode'));
      if (draftPostcode.trim() && !isValidCanadianPostcode(draftPostcode)) {
        setApiError(tt('quote.errInvalidPostcode')); return;
      }
    }
    if (errs.length) { setApiError(tt('quote.errPleaseFill', { fields: errs.join(', ') })); return; }

    const currFlag: 0 | 1 = currency === '1' ? 1 : 0;
    const unit = draftUnit.trim() || findItem(draftServiceCode)?.unit || '';
    setLines(prev => [...prev, {
      _id: ++_idCtr,
      category: draftCategory,
      serviceCode: draftServiceCode,
      details: draftDetails.trim(),
      fee: Number(draftFee),
      currency: currFlag,
      address: draftAddress.trim(),
      pod: draftCategory === 'logistics' ? draftPod.trim() : '',
      delivery_city: showDeliveryFields ? formatDeliveryCity(draftDeliveryCity) : '',
      postcode: showDeliveryFields ? formatCanadianPostcode(draftPostcode) : '',
      dock: draftDock,
      unit,
      freeAmount: draftFreeAmount,
      additional_information: draftAdditionalInfo.trim(),
      logistics_type: draftLogisticsType,
    }]);

    // Reset but keep delivery info and logistics type
    setDraftCategory('');
    setDraftServiceCode('');
    setDraftDetails('');
    setDraftFee('');
    setDraftUnit('');
    setDraftFreeAmount('');
    setDraftAdditionalInfo('');
    setDraftAddress('');
    setDraftDock('0');
  };

  // ── Line editing ──

  const setLineField = useCallback((idx: number, field: keyof Line, value: any) => {
    setLines(prev => prev.map((l, i) => i === idx ? { ...l, [field]: value } : l));
  }, []);

  const handleLineCategoryChange = useCallback((idx: number, cat: string) => {
    setLines(prev => prev.map((l, i) => {
      if (i !== idx) return l;
      return {
        ...l,
        category: cat,
        serviceCode: '',
        unit: '',
        freeAmount: '',
        additional_information: '',
        logistics_type: cat === 'logistics' ? (l.logistics_type || 'FCL') : '',
        pod: cat === 'logistics' ? l.pod : '',
        delivery_city: cat === 'brokerage' ? '' : l.delivery_city,
        postcode: cat === 'brokerage' ? '' : l.postcode,
      };
    }));
  }, []);

  const handleLineServiceChange = useCallback((idx: number, code: string) => {
    const item = findItem(code);
    const unit = item?.unit || '';
    const freeAmount = item?.defaultFreeAmount || '';
    setLines(prev => prev.map((l, i) => i !== idx ? l : {
      ...l, serviceCode: code, unit, freeAmount,
      additional_information: buildAdditionalInformation(unit, freeAmount),
    }));
  }, []);

  const handleLineUnitChange = useCallback((idx: number, unit: string) => {
    setLines(prev => prev.map((l, i) => i !== idx ? l : {
      ...l, unit, freeAmount: '', additional_information: '',
    }));
  }, []);

  const handleLineFreeAmountChange = useCallback((idx: number, fa: string, unit: string) => {
    setLines(prev => prev.map((l, i) => i !== idx ? l : {
      ...l, freeAmount: fa, additional_information: buildAdditionalInformation(unit, fa),
    }));
  }, []);

  const removeLine = (idx: number) => setLines(prev => prev.filter((_, i) => i !== idx));

  // ── Duplicate modal ──

  const confirmDuplicate = useCallback(
    (dups: any[]): Promise<{ confirmed: boolean; effectiveDate?: string }> =>
      new Promise(resolve => {
        setDupDuplicates(dups);
        setDupDate('');
        setDupOpen(true);
        dupResolveRef.current = resolve;
      }),
    []
  );

  const handleDupConfirm = () => {
    setDupOpen(false);
    dupResolveRef.current?.({ confirmed: true, effectiveDate: dupDate });
  };

  const handleDupCancel = () => {
    setDupOpen(false);
    dupResolveRef.current?.({ confirmed: false });
  };

  // ── Submit ──

  const canSubmit = !!userId && !!salesId && lines.length > 0;

  const submitAll = async () => {
    setApiError('');
    setSuccessMsg('');
    if (!salesId || salesId <= 0) { setApiError(tt('quote.errNoSalesId')); return; }
    if (!userId.trim()) { setApiError(tt('quote.errCustomerRequired')); return; }
    if (!lines.length) { setApiError(tt('quote.errAddOneLine')); return; }
    if (!canSubmitRole) { setApiError(tt('quote.noPerm')); return; }

    const validated: Line[] = [];
    for (let i = 0; i < lines.length; i++) {
      const l = { ...lines[i] };
      if (!l.category) { setApiError(tt('quote.errLineCategory', { n: i + 1 })); return; }
      if (!l.serviceCode) { setApiError(tt('quote.errLineService', { n: i + 1 })); return; }
      if (l.fee === '' || isNaN(Number(l.fee))) { setApiError(tt('quote.errLineFee', { n: i + 1 })); return; }
      if (l.category !== 'brokerage') {
        if (!l.delivery_city?.trim()) { setApiError(tt('quote.errLineCity', { n: i + 1 })); return; }
        if (!l.postcode?.trim()) { setApiError(tt('quote.errLinePostcode', { n: i + 1 })); return; }
        if (!isValidCanadianPostcode(l.postcode)) {
          setApiError(tt('quote.errLineInvalidPostcode', { n: i + 1 })); return;
        }
        l.delivery_city = formatDeliveryCity(l.delivery_city);
        l.postcode = formatCanadianPostcode(l.postcode);
      } else {
        l.delivery_city = '';
        l.postcode = '';
      }
      validated.push(l);
    }

    setSubmitting(true);
    let dupEffectiveDate: string | null = null;

    for (let i = 0; i < validated.length; i++) {
      const l = validated[i];
      const payload = {
        user_id: userId,
        sales_id: salesId,
        service: l.category,
        service_details: l.serviceCode,
        note: l.details || null,
        currency: (l.currency === 1 ? 1 : 0) as 0 | 1,
        fee: Number(l.fee),
        address: l.address?.trim() || null,
        pod: l.category === 'logistics' ? (l.pod?.trim() || null) : null,
        delivery_city: l.delivery_city?.trim() || null,
        postcode: l.postcode?.trim() || null,
        dock: (Number(l.dock) === 1 ? 1 : 0) as 0 | 1,
        unit: l.unit?.trim() || null,
        additional_information: l.additional_information?.trim() || null,
      };

      const doInsert = async (extra?: Record<string, any>) => {
        const res = await fetch(buildApiUrl(INSERT_SALES_QUOTE), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...payload, ...extra }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw { status: res.status, ...data };
      };

      try {
        await doInsert();
      } catch (e: any) {
        if (e?.status === 409 && e?.duplicate) {
          const dups = Array.isArray(e?.duplicates) ? e.duplicates : [];
          if (dupEffectiveDate === null) {
            const result = await confirmDuplicate(dups);
            if (!result.confirmed) {
              setApiError(tt('quote.errCancelled'));
              setSubmitting(false);
              return;
            }
            dupEffectiveDate = result.effectiveDate || '';
          }
          try {
            await doInsert({ confirm_duplicate: true, effective_date: dupEffectiveDate });
          } catch {
            setApiError(tt('quote.errLineFailed', { n: i + 1 }));
            setSubmitting(false);
            return;
          }
        } else {
          setApiError(e?.error || e?.message || tt('quote.errLineFailed', { n: i + 1 }));
          setSubmitting(false);
          return;
        }
      }
    }

    setSubmitting(false);
    setSuccessMsg(tt('quote.successSubmitted'));
    setLines([]);
  };

  // ── PDF ──

  const generateQuotePdf = () => {
    if (!userId) { setApiError(tt('quote.errCustomerRequired')); return; }
    if (!lines.length) { setApiError(tt('quote.errAddOneLine')); return; }
    const customerName = escapeHtml(customers.find(c => String(c.user_id) === String(userId))?.user_name || '-');
    const rowsHtml = lines.map((line, i) => `
      <tr>
        <td>${i + 1}</td>
        <td>${escapeHtml(categoryLabel(line.category))}</td>
        <td>${escapeHtml(formatServiceDisplay(line.serviceCode))}</td>
        <td>${escapeHtml(line.details || '-')}</td>
        <td class="right"><strong>${line.currency === 1 ? 'US$' : 'C$'} ${Number(line.fee || 0).toFixed(2)}</strong>${line.unit ? `<div class="sub">${line.unit}</div>` : ''}${line.additional_information ? `<div class="sub">${line.additional_information}</div>` : ''}</td>
        <td>${escapeHtml(line.address || '-')}</td>
        <td>${escapeHtml(line.pod || '-')}</td>
        <td>${escapeHtml(line.delivery_city || '-')}</td>
        <td>${escapeHtml(line.postcode || '-')}</td>
        <td>${line.dock === '1' ? tt('quote.dockYes') : tt('quote.dockNo')}</td>
      </tr>`).join('');

    const html = `<!DOCTYPE html><html><head><title>${tt('quote.pdfTitle')}</title><style>
      body{font-family:Arial,sans-serif;padding:28px;color:#111}
      .header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:24px;border-bottom:2px solid #111;padding-bottom:12px}
      h1{margin:0;font-size:24px}.meta{font-size:13px;line-height:1.6}
      table{width:100%;border-collapse:collapse;margin-top:18px;font-size:12px}
      th,td{border:1px solid #333;padding:8px;vertical-align:top}
      th{background:#f1f1f1;font-weight:700}.right{text-align:right}
      .sub{margin-top:4px;font-size:11px;font-weight:600;color:#333}
      .footer{margin-top:28px;font-size:12px;color:#555}
      @media print{button{display:none}}
    </style></head><body>
      <div class="header">
        <div><h1>${tt('quote.pdfTitle')}</h1><div class="meta">${tt('quote.pdfCustomer')}: ${customerName}</div></div>
        <div class="meta">${tt('quote.pdfDate')}: ${new Date().toLocaleDateString()}<br/>${tt('quote.pdfCurrency')}: ${currency === '1' ? 'USD' : 'CAD'}</div>
      </div>
      <table><thead><tr>
        <th>#</th>
        <th>${tt('quote.pdfColCategory')}</th>
        <th>${tt('quote.pdfColService')}</th>
        <th>${tt('quote.pdfColNote')}</th>
        <th>${tt('quote.pdfColFee')}</th>
        <th>${tt('quote.pdfColAddress')}</th>
        <th>${tt('quote.pdfColPod')}</th>
        <th>${tt('quote.pdfColCity')}</th>
        <th>${tt('quote.pdfColPostcode')}</th>
        <th>${tt('quote.pdfColDock')}</th>
      </tr></thead>
        <tbody>${rowsHtml}</tbody></table>
      <div class="footer">${tt('quote.pdfFooter')}</div>
      <script>window.onload=function(){window.print();}<\/script>
    </body></html>`;

    const win = window.open('', '_blank');
    if (!win) { setApiError(tt('quote.errNoPdfPopup')); return; }
    win.document.open(); win.document.write(html); win.document.close();
  };

  // ── Email template ──

  const generateEmailTemplate = () => {
    if (!lines.length) { setApiError(tt('quote.errAddOneLine')); return; }

    const logisticsLine = lines.find(l => l.category === 'logistics');
    const pod = logisticsLine?.pod?.trim() || '';

    const headerCur = currency === '1' ? 'USD' : 'CAD';
    const drayageLine = lines.find(l => l.serviceCode === 'DrayageFee');
    const drayageFeeStr = drayageLine && Number(drayageLine.fee)
      ? `${drayageLine.currency === 1 ? 'USD' : 'CAD'}${Number(drayageLine.fee).toFixed(0)}`
      : `${headerCur}--------------------------`;

    const formatLineText = (line: Line): string | null => {
      const cur = line.currency === 1 ? 'US$' : 'C$';
      const fee = Number(line.fee);
      const fa = line.freeAmount;
      switch (line.serviceCode) {
        case 'DrayageFee': return null;
        case 'BrokerageFee':      return `清关费：${cur}${fee}/票`;
        case 'DutyGSTAdmin':      return `税金代付费：${cur}${fee}/笔`;
        case 'DutyGSTAdvance':    return `关税代缴：${cur}${fee}/笔`;
        case 'PrePull':           return `pre-pul:${cur}${fee}/次`;
        case 'StorageFee':        return `Yard storage:${cur}${fee}/天${fa ? ` ${fa}天免费）` : ''}`;
        case 'ChassisRental':     return `chassis：${cur}${fee}/天${fa ? `（${fa}天免费）` : ''}`;
        case 'LiveUnloadWaiting': return `Live-unload waiting time：${cur}${fee}/hour${fa ? `（${fa} hours free）` : ''}`;
        case 'TerminalWaiting':   return `Terminal waiting time：${cur}${fee}/hour${fa ? `（${fa} hours free）` : ''}`;
        case 'DGSurcharge':       return `DG surcharge：${cur}${fee}`;
        case 'DGLabelRemove':     return `DG label remove：${cur}${fee}`;
        case 'ExtraStopSOC':      return `Extra Stop/SOC：${line.additional_information || '单独询价'}`;
        case 'DropOff':           return `Drop off：${line.additional_information || '单独询价'}`;
        case 'OtherLocalTrucking': return '需收货地自行卸货';
        default: {
          const item = findItem(line.serviceCode);
          const label = item ? item.en : line.serviceCode;
          const feeStr = fee ? `${cur}${fee}${line.unit ? line.unit : ''}` : (line.additional_information || '');
          return `${label}：${feeStr}`;
        }
      }
    };

    const extraLines = lines
      .filter(l => l.serviceCode !== 'DrayageFee')
      .map(formatLineText)
      .filter((s): s is string => s !== null);

    const text = [
      `From ${pod}`,
      `To：`,
      `提柜及派送费：${drayageFeeStr}`,
      '-'.repeat(28),
      '下面情况如额外发生的费用：',
      ...extraLines,
    ].join('\n');

    setTemplateText(text);
    setTemplateCopied(false);
    setTemplateOpen(true);
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="page-content">
      <Container fluid>
        <BreadCrumb title={tt('quote.title')} pageTitle={tt('quote.pageTitle')} />

        {apiError && <Alert color="danger" toggle={() => setApiError('')}>{apiError}</Alert>}
        {successMsg && <Alert color="success" toggle={() => setSuccessMsg('')}>{successMsg}</Alert>}

        <Row className="g-3">
          {/* LEFT: header + add-line form */}
          <Col xs={12} xl={5} className="quote-form-col-left">

            {/* Header card */}
            <Card className="mb-3">
              <CardBody>
                <FormGroup>
                  <Label className="fw-semibold">{tt('quote.customer')} *</Label>
                  <Select
                    options={customers.map(c => ({ value: c.user_id, label: c.user_name }))}
                    value={customers.map(c => ({ value: c.user_id, label: c.user_name })).find(o => o.value === userId) ?? null}
                    onChange={(opt: any) => setUserId(opt ? opt.value : '')}
                    placeholder={tt('quote.selectCustomer')}
                    isClearable isSearchable
                    isDisabled={loadingCustomers}
                    classNamePrefix="rs"
                  />
                </FormGroup>

                <FormGroup>
                  <Label className="fw-semibold">{tt('quote.currency')}</Label>
                  <div className="d-flex gap-3">
                    {[['0', 'CAD'], ['1', 'USD']].map(([v, lbl]) => (
                      <label key={v} className="d-flex align-items-center gap-1 mb-0 sl-radio-label">
                        <Input type="radio" name="currency" value={v} checked={currency === v} onChange={() => setCurrency(v as '0' | '1')} className="sl-radio-input" />
                        {lbl}
                      </label>
                    ))}
                  </div>
                </FormGroup>

                {showDeliveryFields && (
                  <>
                    {draftCategory === 'logistics' && (
                      <FormGroup className="mb-2">
                        <Label className="fw-semibold">{tt('quote.pod')}</Label>
                        <SelectDestination
                          value={draftPod}
                          onChange={setDraftPod}
                          placeholder={tt('quote.pod')}
                        />
                      </FormGroup>
                    )}
                    <FormGroup className="mb-2">
                      <Label className="fw-semibold">{tt('quote.province')}</Label>
                      <AsyncSelect
                        value={draftProvince}
                        onChange={(opt: any) => onDraftProvinceChange(opt)}
                        loadOptions={loadProvinceOptions}
                        defaultOptions
                        isClearable isSearchable
                        placeholder={tt('quote.selectProvince')}
                        classNamePrefix="rs"
                      />
                    </FormGroup>
                    <FormGroup className="mb-2">
                      <Label className="fw-semibold">{tt('quote.deliveryCity')}</Label>
                      <AsyncCreatableSelect
                        key={draftProvince?.province_code || 'no-province'}
                        value={draftDeliveryCity ? { value: draftDeliveryCity, label: draftDeliveryCity, area_name: draftDeliveryCity } : null}
                        onChange={(opt: any) => onDraftAreaChange(opt)}
                        loadOptions={loadAreaOptions}
                        defaultOptions
                        createOptionPosition="first"
                        getNewOptionData={(inputValue: string, optionLabel: any) => ({
                          value: inputValue, label: optionLabel, area_name: inputValue,
                        })}
                        formatCreateLabel={(v: string) => `${tt('quote.useTyped')} "${v}"`}
                        isClearable isSearchable
                        isDisabled={!draftProvince}
                        placeholder={draftProvince ? tt('quote.deliveryCityPlaceholder') : tt('quote.selectProvinceFirstHint')}
                        noOptionsMessage={() => tt('quote.typeToSearch')}
                        classNamePrefix="rs"
                      />
                    </FormGroup>
                    <FormGroup className="mb-0">
                      <Label className="fw-semibold">{tt('quote.postcode')}</Label>
                      <Input
                        value={draftPostcode}
                        onChange={e => onPostcodeInputChange(e.target.value)}
                        placeholder={tt('quote.postcodePlaceholderExample')}
                      />
                      {fsaSuggestions.length > 0 && (
                        <div className="mt-1">
                          <div className="text-muted mb-1 sl-text-xs">
                            {tt('quote.fsaSuggestionsLabel')}
                          </div>
                          <div className="d-flex flex-wrap gap-1">
                            {fsaSuggestions.slice(0, MAX_FSA_SUGGESTIONS).map(o => (
                              <Button
                                key={o.value}
                                type="button"
                                size="sm"
                                color="light"
                                className="border py-0 px-2 sl-text-xs-btn"
                                onClick={() => applyFsaSuggestion(o)}
                              >
                                {o.label}
                              </Button>
                            ))}
                          </div>
                          {fsaSuggestions.length > MAX_FSA_SUGGESTIONS && (
                            <div className="text-muted mt-1 sl-text-xs">
                              {tt('quote.fsaSuggestionsMore', { count: fsaSuggestions.length - MAX_FSA_SUGGESTIONS })}
                            </div>
                          )}
                        </div>
                      )}
                    </FormGroup>
                  </>
                )}
              </CardBody>
            </Card>

            {/* Add line card */}
            <Card>
              <CardHeader className="fw-bold">{tt('quote.addLine')}</CardHeader>
              <CardBody>
                <FormGroup>
                  <Label className="fw-semibold">{tt('quote.category')} *</Label>
                  <Input type="select" value={draftCategory} onChange={e => onDraftCategoryChange(e.target.value)}>
                    <option value="">{tt('quote.pickCategory')}</option>
                    {CATEGORIES.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
                  </Input>
                </FormGroup>

                {draftCategory === 'logistics' && (
                  <FormGroup>
                    <Label className="fw-semibold">{tt('quote.logisticsType')}</Label>
                    <Input type="select" value={draftLogisticsType} onChange={e => setDraftLogisticsType(e.target.value)}>
                      <option value="">Select FCL / LCL</option>
                      <option value="FCL">FCL</option>
                      <option value="LCL">LCL</option>
                    </Input>
                  </FormGroup>
                )}

                {draftCategory === 'brokerage' && (
                  <FormGroup>
                    <Button color="primary" outline size="sm" onClick={addCbDefaultLines}>
                      + {tt('quote.addDefaultCb')}
                    </Button>
                  </FormGroup>
                )}

                {draftCategory === 'logistics' && draftLogisticsType === 'FCL' && (
                  <FormGroup>
                    <Button color="primary" outline size="sm" onClick={addFclDefaultLines}>
                      + {tt('quote.addDefaultFcl')}
                    </Button>
                  </FormGroup>
                )}

                <FormGroup>
                  <Label className="fw-semibold">{tt('quote.service')} *</Label>
                  <Input type="select" value={draftServiceCode} onChange={e => onDraftServiceChange(e.target.value)} disabled={!draftCategory}>
                    <option value="">{tt('quote.pickService')}</option>
                    {serviceOptions.map(i => (
                      <option key={`${i.code}-${i.cat}`} value={i.code}>{formatServiceDisplay(i.code)}</option>
                    ))}
                  </Input>
                </FormGroup>

                <FormGroup>
                  <Label className="fw-semibold">{tt('quote.note')}</Label>
                  <Input value={draftDetails} onChange={e => setDraftDetails(e.target.value)} maxLength={50} placeholder={tt('quote.note')} />
                </FormGroup>

                <FormGroup>
                  <Label className="fw-semibold">{tt('quote.fee')} *</Label>
                  <Input type="number" value={draftFee} onChange={e => setDraftFee(e.target.value)} placeholder="0.00" />
                </FormGroup>

                <FormGroup>
                  <Label className="fw-semibold">{tt('quote.unit')}</Label>
                  <Input type="select" value={draftUnit} onChange={e => onDraftUnitChange(e.target.value)}>
                    <option value="">{tt('quote.selectUnit')}</option>
                    <option value="/Trip">/Trip</option>
                    <option value="/Day">/Day</option>
                    <option value="/Hour">/Hour</option>
                  </Input>
                </FormGroup>

                {(draftUnit === '/Day' || draftUnit === '/Hour') ? (
                  <FormGroup>
                    <Label className="fw-semibold">{draftUnit === '/Day' ? tt('quote.freeDays') : tt('quote.freeHours')}</Label>
                    <Input type="select" value={draftFreeAmount} onChange={e => onDraftFreeAmountChange(e.target.value)}>
                      <option value="">{tt('quote.selectFreeAmount')}</option>
                      {['1', '2', '3', '4', '5'].map(v => <option key={v} value={v}>{v}</option>)}
                    </Input>
                  </FormGroup>
                ) : (
                  <FormGroup>
                    <Label className="fw-semibold">{tt('quote.additionalInfo')}</Label>
                    <Input
                      value={draftAdditionalInfo}
                      onChange={e => setDraftAdditionalInfo(e.target.value)}
                      placeholder={tt('quote.additionalInfo')}
                      maxLength={100}
                    />
                  </FormGroup>
                )}

                <FormGroup>
                  <Label className="fw-semibold">{tt('quote.address')}</Label>
                  <Input value={draftAddress} onChange={e => setDraftAddress(e.target.value)} placeholder={tt('quote.addressOptional')} />
                </FormGroup>

                <FormGroup>
                  <Label className="fw-semibold">{tt('quote.dock')}</Label>
                  <div className="d-flex gap-3">
                    {[['0', tt('quote.dockNo')], ['1', tt('quote.dockYes')]].map(([v, lbl]) => (
                      <label key={v} className="d-flex align-items-center gap-1 mb-0 sl-radio-label">
                        <Input type="radio" name="dock" value={v} checked={draftDock === v} onChange={() => setDraftDock(v as '0' | '1')} className="sl-radio-input" />
                        {lbl}
                      </label>
                    ))}
                  </div>
                </FormGroup>

                <Button color="primary" className="quote-form-add-btn" onClick={addLine}>
                  + {tt('quote.addLine')}
                </Button>
              </CardBody>
            </Card>
          </Col>

          {/* RIGHT: lines table */}
          <Col xs={12} xl={7} className="quote-form-col-right">
            <Card className="sl-table-card">
              <CardHeader className="d-flex justify-content-between align-items-center">
                <span className="fw-bold">{tt('quote.addedLines')}</span>
                {lines.length > 0 && (
                  <div className="d-flex gap-2">
                    <Button color="secondary" outline onClick={generateEmailTemplate}>
                      Copy
                    </Button>
                    <Button color="secondary" outline onClick={generateQuotePdf}>
                      {tt('quote.generatePdf')}
                    </Button>
                  </div>
                )}
              </CardHeader>
              <CardBody className="p-0">
                {lines.length === 0 ? (
                  <div className="text-center text-muted py-5">{tt('quote.noLinesYet')}</div>
                ) : (
                  <div className="sl-table-scroll">
                    <Table className="mb-0 sl-table sl-table--wrap">
                      <thead>
                        <tr>
                          <th className="sl-mw-210">{tt('quote.category')}</th>
                          <th className="sl-mw-310">{tt('quote.service')} (EN | 中文)</th>
                          <th className="sl-mw-250">{tt('quote.fee')}</th>
                          <th className="sl-mw-100">{tt('quote.currency')}</th>
                          <th className="sl-mw-180">{tt('quote.address')}</th>
                          <th className="sl-mw-150">{tt('quote.pod')}</th>
                          <th className="sl-mw-150">{tt('quote.deliveryCity')}</th>
                          <th className="sl-mw-130">{tt('quote.postcode')}</th>
                          <th className="sl-mw-90">{tt('quote.dock')}</th>
                          <th className="sl-mw-200">{tt('quote.note')}</th>
                          <th className="sl-mw-100">{tt('common.operation') || 'Action'}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {lines.map((line, idx) => (
                          <tr key={line._id}>
                            <td>
                              <Input type="select" bsSize="sm" value={line.category}
                                onChange={e => handleLineCategoryChange(idx, e.target.value)}>
                                {CATEGORIES.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
                              </Input>
                            </td>
                            <td>
                              <Input type="select" bsSize="sm" value={line.serviceCode}
                                onChange={e => handleLineServiceChange(idx, e.target.value)}>
                                <option value="">— {tt('quote.pickService')} —</option>
                                {serviceOptionsForCat(line.category).map(i => (
                                  <option key={`${i.code}-${i.cat}`} value={i.code}>{formatServiceDisplay(i.code)}</option>
                                ))}
                              </Input>
                            </td>
                            <td>
                              <Input bsSize="sm" type="number" value={String(line.fee)}
                                onChange={e => setLineField(idx, 'fee', e.target.value)}
                                className="sl-w-110 mb-1" />
                              <Input type="select" bsSize="sm" value={line.unit}
                                onChange={e => handleLineUnitChange(idx, e.target.value)}
                                className="sl-w-110 mb-1">
                                <option value="">{tt('quote.unit')}</option>
                                <option value="/Trip">/Trip</option>
                                <option value="/Day">/Day</option>
                                <option value="/Hour">/Hour</option>
                              </Input>
                              {(line.unit === '/Day' || line.unit === '/Hour') ? (
                                <Input type="select" bsSize="sm" value={line.freeAmount}
                                  onChange={e => handleLineFreeAmountChange(idx, e.target.value, line.unit)}
                                  className="sl-w-110">
                                  <option value="">{tt('quote.freeAmt')}</option>
                                  {['1', '2', '3', '4', '5'].map(v => <option key={v} value={v}>{v}</option>)}
                                </Input>
                              ) : (
                                <Input bsSize="sm" value={line.additional_information}
                                  onChange={e => setLineField(idx, 'additional_information', e.target.value)}
                                  placeholder={tt('quote.additionalInfo')} maxLength={100}
                                  className="sl-w-110" />
                              )}
                            </td>
                            <td>
                              <Input type="select" bsSize="sm" value={String(line.currency)}
                                onChange={e => setLineField(idx, 'currency', Number(e.target.value) as 0 | 1)}
                                className="sl-w-80">
                                <option value="0">CAD</option>
                                <option value="1">USD</option>
                              </Input>
                            </td>
                            <td>
                              <Input bsSize="sm" value={line.address}
                                onChange={e => setLineField(idx, 'address', e.target.value)}
                                placeholder={tt('quote.addressOptional')} />
                            </td>
                            <td>
                              <SelectDestination
                                value={line.pod}
                                onChange={v => setLineField(idx, 'pod', v)}
                                isDisabled={line.category !== 'logistics'}
                                placeholder={tt('quote.pod')}
                                className="rs-sm"
                              />
                            </td>
                            <td>
                              <Input bsSize="sm" value={line.delivery_city}
                                disabled={line.category === 'brokerage'}
                                onChange={e => setLineField(idx, 'delivery_city', e.target.value)}
                                onBlur={() => {
                                  if (line.category !== 'brokerage')
                                    setLineField(idx, 'delivery_city', formatDeliveryCity(line.delivery_city));
                                }}
                                placeholder={tt('quote.deliveryCity')} />
                            </td>
                            <td>
                              <Input bsSize="sm" value={line.postcode}
                                disabled={line.category === 'brokerage'}
                                onChange={e => setLineField(idx, 'postcode',
                                  line.category === 'brokerage' ? '' : formatCanadianPostcode(e.target.value))}
                                placeholder={tt('quote.postcode')} />
                            </td>
                            <td>
                              <Input type="select" bsSize="sm" value={line.dock}
                                onChange={e => setLineField(idx, 'dock', e.target.value as '0' | '1')}
                                className="sl-w-75">
                                <option value="0">{tt('quote.dockNo')}</option>
                                <option value="1">{tt('quote.dockYes')}</option>
                              </Input>
                            </td>
                            <td>
                              <Input bsSize="sm" value={line.details}
                                onChange={e => setLineField(idx, 'details', e.target.value)}
                                maxLength={50} placeholder={tt('quote.note')} />
                            </td>
                            <td className="text-center">
                              <Button size="sm" color="danger" onClick={() => removeLine(idx)}>{tt('quote.delete')}</Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </Table>
                  </div>
                )}
              </CardBody>
            </Card>

            <div className="d-flex justify-content-center mt-3">
              <Button color="success" className="quote-form-submit-btn"
                disabled={!canSubmit || !canSubmitRole || submitting}
                onClick={submitAll}>
                {submitting && <Spinner size="sm" className="me-1" />}
                {tt('quote.submitAll')}
              </Button>
            </div>
            {!canSubmitRole && (
              <div className="text-center text-muted mt-2 sl-text-sm">
                {tt('quote.noPerm')}
              </div>
            )}
          </Col>
        </Row>
      </Container>

      {/* Email template modal */}
      <Modal isOpen={templateOpen} toggle={() => setTemplateOpen(false)} size="lg">
        <ModalHeader toggle={() => setTemplateOpen(false)}>{tt('quote.generateTemplate')}</ModalHeader>
        <ModalBody>
          <textarea
            value={templateText}
            onChange={e => setTemplateText(e.target.value)}
            rows={18}
            className="form-control font-monospace quote-form-textarea"
          />
        </ModalBody>
        <ModalFooter>
          <Button
            color={templateCopied ? 'success' : 'primary'}
            onClick={() => {
              navigator.clipboard.writeText(templateText).then(() => {
                setTemplateCopied(true);
                setTimeout(() => setTemplateCopied(false), 2000);
              });
            }}
          >
            {templateCopied ? '✓ Copied!' : 'Copy'}
          </Button>
          <Button color="secondary" onClick={() => setTemplateOpen(false)}>{tt('quote.cancel')}</Button>
        </ModalFooter>
      </Modal>

      {/* Duplicate confirmation modal */}
      <Modal isOpen={dupOpen} toggle={handleDupCancel}>
        <ModalHeader toggle={handleDupCancel}>{tt('quote.duplicateTitle')}</ModalHeader>
        <ModalBody>
          <p>{tt('quote.duplicateBody')}</p>
          {dupDuplicates.length > 0 && (
            <div className="mb-3 text-muted small">
              {dupDuplicates.map((d: any, i: number) => (
                <div key={i}>{d.service_details || d.service} — {d.fee} {d.currency === 1 ? 'USD' : 'CAD'}</div>
              ))}
            </div>
          )}
          <FormGroup>
            <Label>{tt('quote.effectiveDate')} *</Label>
            <Input type="date" value={dupDate} onChange={e => setDupDate(e.target.value)} />
          </FormGroup>
        </ModalBody>
        <ModalFooter>
          <Button color="secondary" onClick={handleDupCancel}>{tt('quote.cancel')}</Button>
          <Button color="primary" onClick={handleDupConfirm} disabled={!dupDate}>{tt('quote.confirm')}</Button>
        </ModalFooter>
      </Modal>
    </div>
  );
};

export default CreateQuote;
