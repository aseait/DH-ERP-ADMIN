export const APP_BASE_TITLE = 'DH ERP | Supply Chain Management System';

const ROUTE_TITLE_KEYS: Record<string, string> = {
  '/work': 'menu.home',
  '/notification': 'notification.title',
  '/notificationfee': 'financeNotification.title',
  '/quote/service': 'menu.createQuote',
  '/quote/list': 'menu.quoteList',
  '/order/service': 'createOrder.pageTitle',
  '/order/create/haiyun': 'uploadMarine.title',
  '/order/create/kongyun': 'uploadAir.title',
  '/order/create/truck': 'uploadTruck.title',
  '/order_run/list/all': 'orderList.title',
  '/order_run/info/h_info': 'uploadMarine.title',
  '/order_run/info/k_info': 'uploadAir.title',
  '/order_run/info/t_info': 'uploadTruck.title',
  '/order_run/sea/marine': 'menu.customsClearance',
  '/order_run/sea/logistic': 'menu.containerPickup',
  '/order_run/sea/wms': 'menu.warehouse',
  '/order_run/air/marine': 'menu.customsClearance',
  '/order_run/air/logistic': 'menu.airPickup',
  '/order_run/air/wms': 'menu.warehouse',
  '/order_run/truck/marine': 'menu.customsClearance',
  '/order_run/truck/logistic': 'menu.containerPickup',
  '/order_run/truck/usatoca': 'menu.usaToCa',
  '/user/add': 'createUser.title',
  '/user/run': 'userList.title',
  '/user/info': 'userInfo.title',
  '/sop/dh': 'menu.sopDh',
  '/sop/public': 'menu.sopPublic',
  '/sop/details': 'menu.sop',
  '/support/submit': 'menu.submitTicket',
  '/support/tickets': 'menu.ticketList',
  '/profile': 'menu.profile',
};

export function getPageTitleKey(pathname: string): string | undefined {
  if (ROUTE_TITLE_KEYS[pathname]) return ROUTE_TITLE_KEYS[pathname];
  // /support/tickets/:ticketNumber deep links share the list page's title.
  if (pathname.startsWith('/support/tickets/')) return ROUTE_TITLE_KEYS['/support/tickets'];
  return undefined;
}
