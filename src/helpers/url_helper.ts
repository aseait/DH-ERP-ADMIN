//REGISTER
export const POST_FAKE_REGISTER = '/auth/signup';

//LOGIN
export const POST_FAKE_LOGIN = '/auth/signin';
export const POST_FAKE_JWT_LOGIN = '/post-jwt-login';
export const POST_FAKE_PASSWORD_FORGET = '/auth/forgot-password';
export const POST_FAKE_JWT_PASSWORD_FORGET = '/jwt-forget-pwd';
export const SOCIAL_LOGIN = '/social-login';

//PROFILE
export const POST_EDIT_JWT_PROFILE = '/post-jwt-profile';
export const POST_EDIT_PROFILE = '/user';

// Calendar
export const GET_EVENTS = '/events';
export const GET_CATEGORIES = '/categories';
export const GET_UPCOMMINGEVENT = '/upcommingevents';
export const ADD_NEW_EVENT = '/add/event';
export const UPDATE_EVENT = '/update/event';
export const DELETE_EVENT = '/delete/event';

// Chat
export const GET_DIRECT_CONTACT = '/chat';
export const GET_MESSAGES = '/messages';
export const ADD_MESSAGE = 'add/message';
export const GET_CHANNELS = '/channels';
export const DELETE_MESSAGE = 'delete/message';

//Mailbox
export const GET_MAIL_DETAILS = '/mail';
export const DELETE_MAIL = '/delete/mail';
export const UNREAD_MAIL = '/unread/mail';
export const STARED_MAIL = '/stared/mail';
export const LABEL_MAIL = '/label/mail';
export const TRASH_MAIL = '/trash/mail';

// Ecommerce
// Product
export const GET_PRODUCTS = '/product';
export const DELETE_PRODUCT = '/delete/product';
export const ADD_NEW_PRODUCT = '/add/product';
export const UPDATE_PRODUCT = '/update/product';

// Orders
export const GET_ORDERS = '/order';
export const ADD_NEW_ORDER = '/add/order';
export const UPDATE_ORDER = '/update/order';
export const DELETE_ORDER = '/delete/order';

// Customers
export const GET_CUSTOMERS = '/apps/customer';
export const ADD_NEW_CUSTOMER = '/apps/customer';
export const UPDATE_CUSTOMER = '/apps/customer';
export const DELETE_CUSTOMER = '/apps/customer';

// Sellers
export const GET_SELLERS = '/sellers';

// Project list
export const GET_PROJECT_LIST = '/project/list';

// Task
export const GET_TASK_LIST = '/apps/task';
export const ADD_NEW_TASK = '/apps/task';
export const UPDATE_TASK = '/apps/task';
export const DELETE_TASK = '/apps/task';

// kanban
export const GET_TASKS = '/apps/tasks';
export const ADD_TASKS = '/add/tasks';
export const UPDATE_TASKS = '/update/tasks';
export const DELETE_TASKS = '/delete/tasks';

// CRM
// Conatct
export const GET_CONTACTS = '/apps/contact';
export const ADD_NEW_CONTACT = '/apps/contact';
export const UPDATE_CONTACT = '/apps/contact';
export const DELETE_CONTACT = '/apps/contact';

// Companies
export const GET_COMPANIES = '/apps/company';
export const ADD_NEW_COMPANIES = '/apps/company';
export const UPDATE_COMPANIES = '/apps/company';
export const DELETE_COMPANIES = '/apps/company';

// Lead
export const GET_LEADS = '/apps/lead';
export const ADD_NEW_LEAD = '/apps/lead';
export const UPDATE_LEAD = '/apps/lead';
export const DELETE_LEAD = '/apps/lead';

// Deals
export const GET_DEALS = '/deals';

// Crypto
export const GET_TRANSACTION_LIST = '/transaction-list';
export const GET_ORDRER_LIST = '/order-list';

// Invoice
export const GET_INVOICES = '/apps/invoice';
export const ADD_NEW_INVOICE = '/apps/invoice';
export const UPDATE_INVOICE = '/apps/invoice';
export const DELETE_INVOICE = '/apps/invoice';

// TicketsList
export const GET_TICKETS_LIST = '/ticket';
export const ADD_NEW_TICKET = '/add/ticket';
export const UPDATE_TICKET = '/update/ticket';
export const DELETE_TICKET = '/delete/ticket';

// Dashboard Analytics

// Sessions by Countries
export const GET_ALL_DATA = '/all-data';
export const GET_HALFYEARLY_DATA = '/halfyearly-data';
export const GET_MONTHLY_DATA = '/monthly-data';

// Audiences Metrics
export const GET_ALLAUDIENCESMETRICS_DATA = '/allAudiencesMetrics-data';
export const GET_MONTHLYAUDIENCESMETRICS_DATA = '/monthlyAudiencesMetrics-data';
export const GET_HALFYEARLYAUDIENCESMETRICS_DATA = '/halfyearlyAudiencesMetrics-data';
export const GET_YEARLYAUDIENCESMETRICS_DATA = '/yearlyAudiencesMetrics-data';

// Users by Device
export const GET_TODAYDEVICE_DATA = '/todayDevice-data';
export const GET_LASTWEEKDEVICE_DATA = '/lastWeekDevice-data';
export const GET_LASTMONTHDEVICE_DATA = '/lastMonthDevice-data';
export const GET_CURRENTYEARDEVICE_DATA = '/currentYearDevice-data';

// Audiences Sessions by Country
export const GET_TODAYSESSION_DATA = '/todaySession-data';
export const GET_LASTWEEKSESSION_DATA = '/lastWeekSession-data';
export const GET_LASTMONTHSESSION_DATA = '/lastMonthSession-data';
export const GET_CURRENTYEARSESSION_DATA = '/currentYearSession-data';

// Dashboard CRM

// Balance Overview
export const GET_TODAYBALANCE_DATA = '/todayBalance-data';
export const GET_LASTWEEKBALANCE_DATA = '/lastWeekBalance-data';
export const GET_LASTMONTHBALANCE_DATA = '/lastMonthBalance-data';
export const GET_CURRENTYEARBALANCE_DATA = '/currentYearBalance-data';

// Deal type
export const GET_TODAYDEAL_DATA = '/todayDeal-data';
export const GET_WEEKLYDEAL_DATA = '/weeklyDeal-data';
export const GET_MONTHLYDEAL_DATA = '/monthlyDeal-data';
export const GET_YEARLYDEAL_DATA = '/yearlyDeal-data';

// Sales Forecast

export const GET_OCTSALES_DATA = '/octSales-data';
export const GET_NOVSALES_DATA = '/novSales-data';
export const GET_DECSALES_DATA = '/decSales-data';
export const GET_JANSALES_DATA = '/janSales-data';

// Dashboard Ecommerce
// Revenue
export const GET_ALLREVENUE_DATA = '/allRevenue-data';
export const GET_MONTHREVENUE_DATA = '/monthRevenue-data';
export const GET_HALFYEARREVENUE_DATA = '/halfYearRevenue-data';
export const GET_YEARREVENUE_DATA = '/yearRevenue-data';

// Dashboard Crypto
// Portfolio
export const GET_BTCPORTFOLIO_DATA = '/btcPortfolio-data';
export const GET_USDPORTFOLIO_DATA = '/usdPortfolio-data';
export const GET_EUROPORTFOLIO_DATA = '/euroPortfolio-data';

// Market Graph
export const GET_ALLMARKETDATA_DATA = '/allMarket-data';
export const GET_YEARMARKET_DATA = '/yearMarket-data';
export const GET_MONTHMARKET_DATA = '/monthMarket-data';
export const GET_WEEKMARKET_DATA = '/weekMarket-data';
export const GET_HOURMARKET_DATA = '/hourMarket-data';

// Dashboard Crypto
// Project Overview
export const GET_ALLPROJECT_DATA = '/allProject-data';
export const GET_MONTHPROJECT_DATA = '/monthProject-data';
export const GET_HALFYEARPROJECT_DATA = '/halfYearProject-data';
export const GET_YEARPROJECT_DATA = '/yearProject-data';

// Project Status
export const GET_ALLPROJECTSTATUS_DATA = '/allProjectStatus-data';
export const GET_WEEKPROJECTSTATUS_DATA = '/weekProjectStatus-data';
export const GET_MONTHPROJECTSTATUS_DATA = '/monthProjectStatus-data';
export const GET_QUARTERPROJECTSTATUS_DATA = '/quarterProjectStatus-data';

// Dashboard NFT
// Marketplace
export const GET_ALLMARKETPLACE_DATA = '/allMarketplace-data';
export const GET_MONTHMARKETPLACE_DATA = '/monthMarketplace-data';
export const GET_HALFYEARMARKETPLACE_DATA = '/halfYearMarketplace-data';
export const GET_YEARMARKETPLACE_DATA = '/yearMarketplace-data';

// Project
export const ADD_NEW_PROJECT = '/add/project';
export const UPDATE_PROJECT = '/update/project';
export const DELETE_PROJECT = '/delete/project';

// Pages > Team
export const GET_TEAMDATA = '/teamData';
export const DELETE_TEAMDATA = '/delete/teamData';
export const ADD_NEW_TEAMDATA = '/add/teamData';
export const UPDATE_TEAMDATA = '/update/teamData';

// File Manager
// Folder
export const GET_FOLDERS = '/folder';
export const DELETE_FOLDER = '/delete/folder';
export const ADD_NEW_FOLDER = '/add/folder';
export const UPDATE_FOLDER = '/update/folder';

// File
export const GET_FILES = '/file';
export const DELETE_FILE = '/delete/file';
export const ADD_NEW_FILE = '/add/file';
export const UPDATE_FILE = '/update/file';

// To do
export const GET_TODOS = '/todo';
export const DELETE_TODO = '/delete/todo';
export const ADD_NEW_TODO = '/add/todo';
export const UPDATE_TODO = '/update/todo';

// To do Project
export const GET_PROJECTS = '/projects';
export const ADD_NEW_TODO_PROJECT = '/add/project';

//JOB APPLICATION
export const GET_APPLICATION_LIST = '/application-list';
export const ADD_NEW_APPLICATION_LIST = '/add/application-list';
export const UPDATE_APPLICATION_LIST = '/update/application-list';
export const DELETE_APPLICATION_LIST = '/delete/application-list';

//JOB APPLICATION
export const GET_API_KEY = '/api-key';

// CANDIDATE LIST
export const GET_CANDIDATE = '/candidates';
export const ADD_NEW_CANDIDATE = 'add/candidates';
export const UPDATE_CANDIDATE = 'update/candidates';
export const DELETE_CANDIDATE = 'delete/candidates';

export const GET_CANDIDATE_GRID = '/category-grid';
export const ADD_CANDIDATE_GRID = '/add/category-grid';

export const GET_CATEGORY_LIST = '/category-list';
export const ADD_CATEGORY_LIST = '/add/category-list';

// main ticket details
export const MAIN_TICKET_DETAILS = '/admin/mainTicketDetails';

// event tracking
export const EVENT_TRACKING = '/admin/event/eventTracking';

export const GET_TICKET_SUMMARY = '/admin/getTicketSummary';

export const GET_NON_CLOSED_TICKET_SUMMARY = '/admin/getNonClosedTicket';

// Destination list
export const FETCH_CITIES = '/admin/fetchCities';

// Marine main ticket creation
export const CREATE_MARINE_MAIN_TICKET = '/admin/marine/createMainTicket';

// Air main ticket creation
export const CREATE_AIR_MAIN_TICKET = '/admin/air/createMainTicket';

// Truck / Parse main ticket creation
export const CREATE_PARSE_MAIN_TICKET = '/admin/parse/createMainTicket';

// Excel import/export
export const UPLOAD_MARINE_EXCEL = '/admin/upload-marine-excel';
export const BULK_CREATE_LOGISTIC_MARINE_EXCEL = '/admin/marine/bulkCreateLogisticMarine';
export const BULK_UPDATE_TRAIN_ETA_EXCEL = '/admin/marine/bulkUpdateTrainEta';

// File upload and retrieve
export const UPLOAD_FILES = 'admin/uploadFiles';

export const RETRIEVE_FILES = 'admin/retrieveFiles';

export const UPLOAD_TRUCK_FILES = 'admin/uploadTruckFiles';

export const ADMIN_DELETE_FILE = 'admin/deleteFile';

export const UPLOAD_POA_FILES = 'admin/uploadPoa';

export const RETRIEVE_POA_FILES = 'admin/getPoaFile';

export const LIST_IMPORTER_NAMES = 'admin/importer/listNames';

export const IMPORTER_LIST_WITH_DOCS = 'admin/importer/listWithDocs';
export const CREATE_IMPORTER = 'admin/importer/create';
export const UPDATE_IMPORTER_GST_DUTY = 'admin/importer/updateGst';
export const REPLACE_FILE = 'admin/replaceFile';

export const UPDATE_MARINE_CB_TICKET_DETAILS = 'admin/marine/updateCbTicketDetails';

export const UPDATE_MARINE_LOGISTIC_TICKET_DETAILS = 'admin/marine/updateLogisticTicketDetails';

export const UPDATE_MARINE_WAREHOUSE_TICKET_DETAILS = 'admin/marine/updateWarehouseTicketDetails';

export const UPDATE_AIR_CB_TICKET_DETAILS = 'admin/air/updateCbTicketDetails';

export const UPDATE_AIR_LOGISTIC_TICKET_DETAILS = 'admin/air/updateLogisticTicketDetails';

export const UPDATE_AIR_WAREHOUSE_TICKET_DETAILS = 'admin/air/updateWarehouseTicketDetails';

export const UPDATE_TRUCK_CB_CONTAINER = 'admin/parse/updateTruckCbContainer';

export const UPDATE_TRUCK_CB_LOGISTIC = 'admin/parse/updateTruckCbLogistic';

export const UPDATE_TRUCK_US_TO_CA = 'admin/parse/updateTruckUsToCa';

export const UPDATE_SERVICE = '/admin/service/changeService';

export const MARINE_CONTAINER_EVENTS = '/admin/marineContainerEvents';

// no admin equivalent — used only by the public EMF upload form
export const MARINE_TRAIN_TRACKING = '/user/marineTrainTracking';

export const RETRIEVE_NOTES = '/admin/retrieveNotes';

export const POST_NOTES = 'admin/postNotes';

export const MARK_NOTES_AS_READ = 'admin/markNotesAsRead';

// admin-only internal notes
export const POST_INTERNAL_NOTES = '/admin/postInternalNotes';

export const RETRIEVE_INTERNAL_NOTES = '/admin/retrieveInternalNotes';

export const MARK_INTERNAL_NOTES_AS_READ = '/admin/markInternalNotesAsRead';

export const GET_IMPORTER_GST_DUTY = 'admin/importer/getGst';

export const CALCULATE_DUTY_TAXES = '/others/calculateDutyTaxes';

export const FETCH_EMAIL = 'email/fetchEmail';
export const SEND_MAIL = 'email/send';

// public EMF upload — user endpoint, no admin equivalent
export const UPLOAD_MARINE_CB_AN_EMF_ONLY = '/user/uploadMarineCbAnEmfOnly';
export const CREATE_MARINE_AN_EMF_UPLOAD_LINK = '/user/createMarineAnEmfUploadLink';

// Download all files for a ticket as a zip
export const DOWNLOAD_ALL_FILES_ZIP = '/admin/zipFilesAndDownload';

// Notification
export const RETRIEVE_CAD_DRAFT_OVERDUE = '/admin/retrieveCadDraftOverdue';
export const GET_USER_POA_LIST = '/admin/getUserPoaList';
export const GET_SPECIFIC_USER = '/admin/getSpecificUser';

// Finance notification
export const RETRIEVE_FINANCE_FEE_ALERTS = '/finance/retrieveFinanceFeeAlerts';
export const EXPORT_ADDITIONAL_FEE_DATA = '/finance/exportAdditionalFeeData';
export const EXPORT_INVOICE_FEE_DATA = '/finance/exportInvoiceFeeData';

// Client user management (user portal users, not admin users)
export const GET_CLIENT_USER_LIST = '/clientUser/getClientUserList';
export const GET_CLIENT_USER_INFO = '/clientUser/user/info';
export const ADMIN_CONTACTS_SEARCH = '/admin/contacts/search';

// Status counts for service list pages
export const GET_STATUS_AMOUNT = '/admin/getStatusAmount';

// Sea service-specific list pages
export const MARINE_CB_TICKET_DETAILS = '/admin/marine/customsBrokerage/ticketDetails';
export const MARINE_LOGISTIC_TICKET_DETAILS = '/admin/marine/logistic/ticketDetails';
export const MARINE_WAREHOUSE_TICKET_DETAILS = '/admin/marine/warehouse/ticketDetails';

// Air service-specific list pages
export const AIR_CB_TICKET_DETAILS = '/admin/air/customsBrokerage/ticketDetails';
export const AIR_LOGISTIC_TICKET_DETAILS = '/admin/air/logistic/ticketDetails';
export const AIR_WAREHOUSE_TICKET_DETAILS = '/admin/air/warehouse/ticketDetails';

// Truck service-specific list pages
export const TRUCK_CB_TICKET_DETAILS = '/admin/parse/customsBrokerage/ticketDetails';
export const TRUCK_LOGISTIC_TICKET_DETAILS = '/admin/parse/logistic/ticketDetails';
export const TRUCK_US_TO_CA_TICKET_DETAILS = '/admin/parse/usToCa/ticketDetails';

// Work dashboard charts
export const GET_CITY_TICKET = '/admin/getCityTicket';
export const GET_DAILY_PIN = '/others/getDailyPin';

// Client user (user-portal) management
export const CLIENT_USER_REGISTER = '/clientUser/register';
export const UPDATE_CLIENT_USER_TYPE = '/clientUser/updateUserType';
export const FETCH_ALL_SALESBOND_CUSTOMERS = '/admin/sales/fetchallSalesbondCustomers';
export const INSERT_SALES_CUSTOMERS = '/admin/sales/insertCustomers';

// Sales quotes
export const SUBMIT_IT_SUPPORT_TICKET = '/supportTickets/submitITSupportTicket';
export const RETRIEVE_IT_SUPPORT_TICKETS = '/supportTickets/retrieveITSupportTickets';
export const UPDATE_IT_SUPPORT_TICKET = '/supportTickets/updateITSupportTicket';
export const SUBMIT_IT_SUPPORT_TICKET_COMMENT = '/supportTickets/submitITSupportTicketComment';
export const RETRIEVE_IT_SUPPORT_TICKET_COMMENTS = '/supportTickets/retrieveITSupportTicketComments';

export const RETRIEVE_SALES_QUOTE = '/finance/retrieveSalesQuoteBySales';
export const RETRIEVE_SALES_QUOTE_BY_USER = '/finance/retrieveSalesQuoteByUser';
export const INSERT_SALES_QUOTE = '/finance/insertSalesQuote';
export const UPDATE_SALES_QUOTE = '/finance/updateSalesQuote';
export const FETCH_POSTAL_CODE_OPTIONS = '/finance/fetchPostalCodeOptions';

// SOP (Standard Operating Procedure) library
export const RETRIEVE_SOP_CATEGORIES = '/sop/retrieveSOPCategories';
export const ADD_SOP_CATEGORY = '/sop/addSOPCategory';
export const UPDATE_SOP_CATEGORY = '/sop/updateSOPCategory';
export const DELETE_SOP_CATEGORY = '/sop/deleteSOPCategory';
export const RETRIEVE_SOPS = '/sop/retrieveSOPs';
export const RETRIEVE_SOP_DETAILS = '/sop/retrieveSOPDetails';
export const SUBMIT_SOP = '/sop/submitSOP';
export const UPDATE_SOP = '/sop/updateSOP';
export const DELETE_SOP = '/sop/deleteSOP';
export const INCREMENT_SOP_VIEW = '/sop/incrementSOPView';
export const PROXY_SOP_FILE = '/sop/proxySOPFile';
export const RETRIEVE_SOP_SETTINGS = '/sop/retrieveSOPSettings';
export const SET_SOP_PUBLIC_LOCK = '/sop/setPublicUploadsLocked';
