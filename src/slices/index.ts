import { combineReducers } from 'redux';

// Front
import LayoutReducer from './layouts/reducer';

// Authentication
import LoginReducer from './auth/login/reducer';
import AccountReducer from './auth/register/reducer';
import ForgetPasswordReducer from './auth/forgetpwd/reducer';
import ProfileReducer from './auth/profile/reducer';

//Calendar
import CalendarReducer from './calendar/reducer';
//Chat
import chatReducer from './chat/reducer';
//Ecommerce
import EcommerceReducer from './ecommerce/reducer';

//Project
import ProjectsReducer from './projects/reducer';

// Tasks
import TasksReducer from './tasks/reducer';

//Crypto
import CryptoReducer from './crypto/reducer';

//TicketsList
import TicketsReducer from './tickets/reducer';
//Crm
import CrmReducer from './crm/reducer';

//Invoice
import InvoiceReducer from './invoice/reducer';

//Mailbox
import MailboxReducer from './mailbox/reducer';

// Dashboard Analytics
import DashboardAnalyticsReducer from './dashboardAnalytics/reducer';

// Dashboard CRM
import DashboardCRMReducer from './dashboardCRM/reducer';

// Dashboard Ecommerce
import DashboardEcommerceReducer from './dashboardEcommerce/reducer';

// Dashboard Cryto
import DashboardCryptoReducer from './dashboardCrypto/reducer';

// Dashboard Cryto
import DashboardProjectReducer from './dashboardProject/reducer';

// Dashboard NFT
import DashboardNFTReducer from './dashboardNFT/reducer';

// Pages > Team
import TeamDataReducer from './team/reducer';

// File Manager
import FileManagerReducer from './fileManager/reducer';

// To do
import TodosReducer from './todos/reducer';

// Job
import JobReducer from './jobs/reducer';

// API Key
import APIKeyReducer from './apiKey/reducer';

//real

import MainTicketDetailsReducer from './ticketDetails/reducer';
import EventTrackingReducer from './events/reducer';
import TicketSummaryReducer from './ticketsSummery/reducer';
import OrderReducer from './order/reducer';
import FileReducer from './file/reducer';
import MarineReducer from './marine/reducer';
import AirReducer from './air/reducer';
import ContainerEvent from './containerEvents/reducer';
import ChangeService from './changeService/reducer';
import AnEmfReducer from './anemf/reducer';
import TrainTrackingReducer from './trainTracking/reducer';
import LeaveMessageReducer from './leaveMessage/reducer';
import SalesQuoteReducer from './salesQuote/reducer';
const rootReducer = combineReducers({
  Layout: LayoutReducer,
  Login: LoginReducer,
  Account: AccountReducer,
  ForgetPassword: ForgetPasswordReducer,
  Profile: ProfileReducer,
  Calendar: CalendarReducer,
  Chat: chatReducer,
  Projects: ProjectsReducer,
  Ecommerce: EcommerceReducer,
  Tasks: TasksReducer,
  Crypto: CryptoReducer,
  Tickets: TicketsReducer,
  Crm: CrmReducer,
  Invoice: InvoiceReducer,
  Mailbox: MailboxReducer,
  DashboardAnalytics: DashboardAnalyticsReducer,
  DashboardCRM: DashboardCRMReducer,
  DashboardEcommerce: DashboardEcommerceReducer,
  DashboardCrypto: DashboardCryptoReducer,
  DashboardProject: DashboardProjectReducer,
  DashboardNFT: DashboardNFTReducer,
  Team: TeamDataReducer,
  FileManager: FileManagerReducer,
  Todos: TodosReducer,
  Jobs: JobReducer,
  APIKey: APIKeyReducer,

  // main ticket details
  MainTicketDetails: MainTicketDetailsReducer,
  EventTracking: EventTrackingReducer,
  TicketSummary: TicketSummaryReducer,
  Order: OrderReducer,
  File: FileReducer,
  Marine: MarineReducer,
  AIR: AirReducer,
  ContainerEvent: ContainerEvent,
  ChangeService: ChangeService,
  AnEmf: AnEmfReducer,
  TrainTracking: TrainTrackingReducer,
  leaveMessage: LeaveMessageReducer,
  SalesQuote: SalesQuoteReducer,
});

export default rootReducer;
