// src/routes/allRoutes.tsx
import React, { lazy } from 'react';
import { Navigate } from 'react-router-dom';

// ===== EXISTING PAGES =====
const Dashboard = lazy(() => import('../pages/DashBoard'));
const UserProfile = lazy(() => import('../pages/Authentication/user-profile'));

// Create Order
const CreateOrderService = lazy(() => import('../pages/Order/index'));
const CreateMarine = lazy(() => import('../pages/Order/Marine'));
const CreateAir = lazy(() => import('../pages/Order/Air'));
const CreateTruck = lazy(() => import('../pages/Order/Truck'));

// Customer Order — list & details (reused from user app, adapted for admin)
const OrderReviewAll = lazy(() => import('../pages/OrderLists/All'));
const MarineDetails = lazy(() => import('../pages/OrderLists/OrderDetails/MarineDetails'));
const AirDetails = lazy(() => import('../pages/OrderLists/OrderDetails/AirDetails'));
const TruckDetails = lazy(() => import('../pages/OrderLists/OrderDetails/TruckDetails'));

// ===== NEW ADMIN PAGES =====
const Notification = lazy(() => import('../pages/Notification/Notification'));
const FinanceNotification = lazy(() => import('../pages/Notification/FinanceNotification'));

const CreateQuote = lazy(() => import('../pages/Quote/CreateQuote'));
const QuoteList = lazy(() => import('../pages/Quote/QuoteList'));

const SeaMarine = lazy(() => import('../pages/CustomerOrder/Sea/SeaMarine'));
const SeaLogistic = lazy(() => import('../pages/CustomerOrder/Sea/SeaLogistic'));
const SeaWms = lazy(() => import('../pages/CustomerOrder/Sea/SeaWms'));

const AirMarine = lazy(() => import('../pages/CustomerOrder/Air/AirMarine'));
const AirLogistic = lazy(() => import('../pages/CustomerOrder/Air/AirLogistic'));
const AirWms = lazy(() => import('../pages/CustomerOrder/Air/AirWms'));

const TruckMarine = lazy(() => import('../pages/CustomerOrder/Truck/TruckMarine'));
const TruckLogistic = lazy(() => import('../pages/CustomerOrder/Truck/TruckLogistic'));
const TruckUsaToCa = lazy(() => import('../pages/CustomerOrder/Truck/TruckUsaToCa'));

const CreateUser = lazy(() => import('../pages/UserManagement/CreateUser'));
const UserList = lazy(() => import('../pages/UserManagement/UserList'));
const UserInfo = lazy(() => import('../pages/UserManagement/UserInfo'));

const SopHome = lazy(() => import('../pages/SOP/SopHome'));
const SopDetails = lazy(() => import('../pages/SOP/SopDetails'));

const SubmitTicket = lazy(() => import('../pages/SupportTickets/SubmitTicket'));
const TicketList = lazy(() => import('../pages/SupportTickets/TicketList'));

// ===== PUBLIC PAGES =====
const Login = lazy(() => import('../pages/Authentication/Login'));
const Logout = lazy(() => import('../pages/Authentication/Logout'));
const ChangeRequiredPassword = lazy(() => import('../pages/Authentication/ChangeRequiredPassword'));
const MarineAnEmfUpload = lazy(() => import('../pages/MarineAnEmfUpload/MarineAnEmfUpload'));

// ======================================================
// ROUTES
// ======================================================
const authProtectedRoutes = [
  // Homepage
  { path: '/work', component: <Dashboard /> },

  // Notifications
  { path: '/notification', component: <Notification /> },
  { path: '/notificationfee', component: <FinanceNotification /> },

  // Quote
  { path: '/quote/service', component: <CreateQuote /> },
  { path: '/quote/list', component: <QuoteList /> },

  // Create Order
  { path: '/order/service', component: <CreateOrderService /> },
  { path: '/order/create/haiyun', component: <CreateMarine /> },
  { path: '/order/create/kongyun', component: <CreateAir /> },
  { path: '/order/create/truck', component: <CreateTruck /> },

  // Customer Order — overview
  { path: '/order_run/list/all', component: <OrderReviewAll /> },

  // Customer Order — detail views (hidden routes)
  { path: '/order_run/info/h_info', component: <MarineDetails /> },
  { path: '/order_run/info/k_info', component: <AirDetails /> },
  { path: '/order_run/info/t_info', component: <TruckDetails /> },

  // Sea Order
  { path: '/order_run/sea/marine', component: <SeaMarine /> },
  { path: '/order_run/sea/logistic', component: <SeaLogistic /> },
  { path: '/order_run/sea/wms', component: <SeaWms /> },

  // Air Order
  { path: '/order_run/air/marine', component: <AirMarine /> },
  { path: '/order_run/air/logistic', component: <AirLogistic /> },
  { path: '/order_run/air/wms', component: <AirWms /> },

  // Truck Order
  { path: '/order_run/truck/marine', component: <TruckMarine /> },
  { path: '/order_run/truck/logistic', component: <TruckLogistic /> },
  { path: '/order_run/truck/usatoca', component: <TruckUsaToCa /> },

  // User Management
  { path: '/user/add', component: <CreateUser /> },
  { path: '/user/run', component: <UserList /> },
  { path: '/user/info', component: <UserInfo /> },

  // SOP (Standard Operating Procedure) libraries
  { path: '/sop/dh', component: <SopHome department="DH" /> },
  { path: '/sop/public', component: <SopHome department="Public" /> },
  { path: '/sop/details', component: <SopDetails /> },

  // IT Support Tickets
  { path: '/support/submit', component: <SubmitTicket /> },
  { path: '/support/tickets', component: <TicketList /> },
  { path: '/support/tickets/:ticketNumber', component: <TicketList /> },

  // Profile
  { path: '/profile', component: <UserProfile /> },

  // Fallback
  { path: '/', exact: true, component: <Navigate to="/work" /> },
  { path: '*', component: <Navigate to="/work" /> },
];

const publicRoutes = [
  { path: '/logout', component: <Logout /> },
  { path: '/login', component: <Login /> },
  { path: '/change-required-password', component: <ChangeRequiredPassword /> },
  { path: '/marine-anemf-upload', component: <MarineAnEmfUpload /> },
];

export { authProtectedRoutes, publicRoutes };
