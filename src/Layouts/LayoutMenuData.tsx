import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useTT } from '../helpers/useTT';
import { canAccessSopDh } from '../helpers/userInformation';

const Navdata = () => {
  const { tt } = useTT();
  const location = useLocation();

  const getOpenMenusByPath = useCallback((pathname: string): Set<string> => {
    const open = new Set<string>();
    if (pathname.startsWith('/quote')) open.add('quote');
    if (pathname.startsWith('/order/service') || pathname.startsWith('/order/create')) open.add('createOrder');
    if (pathname.startsWith('/order_run')) {
      open.add('customerOrder');
      if (pathname.startsWith('/order_run/sea')) open.add('seaOrder');
      if (pathname.startsWith('/order_run/air')) open.add('airOrder');
      if (pathname.startsWith('/order_run/truck')) open.add('truckOrder');
    }
    if (pathname.startsWith('/user')) open.add('userManagement');
    if (pathname.startsWith('/support')) open.add('itSupport');
    return open;
  }, []);

  const SIDEBAR_OPEN_MENUS_KEY = 'sidebarOpenMenus';

  const loadStoredOpenMenus = useCallback((): Set<string> => {
    try {
      const raw = sessionStorage.getItem(SIDEBAR_OPEN_MENUS_KEY);
      const arr = raw ? JSON.parse(raw) : [];
      return new Set(Array.isArray(arr) ? arr : []);
    } catch {
      return new Set();
    }
  }, []);

  const [openMenus, setOpenMenus] = useState<Set<string>>(() => {
    const stored = loadStoredOpenMenus();
    const fromPath = getOpenMenusByPath(location.pathname);
    const merged = new Set<string>(Array.from(stored));
    fromPath.forEach((key) => merged.add(key));
    return merged;
  });

  // Merge in whatever the current path implies should be open, rather than
  // replacing — so a dropdown the user opened manually (unrelated to the
  // active route) doesn't get collapsed just by navigating elsewhere.
  useEffect(() => {
    setOpenMenus((prev) => {
      const next = new Set(prev);
      getOpenMenusByPath(location.pathname).forEach((key) => next.add(key));
      return next;
    });
  }, [location.pathname, getOpenMenusByPath]);

  // Remember open/closed dropdowns for the rest of the browser session.
  useEffect(() => {
    try {
      sessionStorage.setItem(SIDEBAR_OPEN_MENUS_KEY, JSON.stringify(Array.from(openMenus)));
    } catch {
      /* storage full or unavailable — not critical */
    }
  }, [openMenus]);

  const toggleMenu = useCallback((key: string, e: any) => {
    e.preventDefault();
    setOpenMenus((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }, []);

  const menuItems = useMemo(
    () => [
      {
        label: tt('menu.menuHeader') || 'Menu',
        isHeader: true,
      },
      {
        id: 'homepage',
        label: tt('menu.home') || 'Homepage',
        icon: 'bx bx-home-circle',
        link: '/work',
      },
      {
        id: 'notification',
        label: tt('menu.notification') || 'Notification',
        icon: 'bx bx-bell',
        link: '/notification',
      },
      {
        id: 'financeNotification',
        label: tt('menu.financeNotification') || 'Finance Notification',
        icon: 'bx bx-money',
        link: '/notificationfee',
      },
      {
        id: 'quote',
        label: tt('menu.quote') || 'Quote',
        icon: 'bx bx-file',
        link: '/#',
        stateVariables: openMenus.has('quote'),
        click: (e: any) => toggleMenu('quote', e),
        subItems: [
          {
            id: 'createQuote',
            label: tt('menu.createQuote') || 'Create Quote',
            link: '/quote/service',
            parentId: 'quote',
          },
          {
            id: 'quoteList',
            label: tt('menu.quoteList') || 'Quote List',
            link: '/quote/list',
            parentId: 'quote',
          },
        ],
      },
      {
        id: 'createOrder',
        label: tt('menu.createOrder') || 'Create Order',
        icon: 'bx bx-plus-circle',
        link: '/#',
        stateVariables: openMenus.has('createOrder'),
        click: (e: any) => toggleMenu('createOrder', e),
        subItems: [
          {
            id: 'createService',
            label: tt('menu.createService') || 'Create Service',
            link: '/order/service',
            parentId: 'createOrder',
          },
        ],
      },
      {
        id: 'customerOrder',
        label: tt('menu.customerOrder') || 'Customer Order',
        icon: 'bx bx-list-ul',
        link: '/#',
        stateVariables: openMenus.has('customerOrder'),
        click: (e: any) => toggleMenu('customerOrder', e),
        subItems: [
          {
            id: 'orderReview',
            label: tt('menu.orderReview') || 'Order Review',
            link: '/order_run/list/all',
            parentId: 'customerOrder',
          },
          {
            id: 'seaOrder',
            label: tt('menu.seaOrder') || 'Sea Order',
            link: '/#',
            parentId: 'customerOrder',
            isChildItem: true,
            stateVariables: openMenus.has('seaOrder'),
            click: (e: any) => toggleMenu('seaOrder', e),
            childItems: [
              { id: 'seaMarine', label: tt('menu.customsClearance') || 'Customs Clearance', link: '/order_run/sea/marine' },
              { id: 'seaLogistic', label: tt('menu.containerPickup') || 'Container Pickup', link: '/order_run/sea/logistic' },
              { id: 'seaWms', label: tt('menu.warehouse') || 'Warehouse', link: '/order_run/sea/wms' },
            ],
          },
          {
            id: 'airOrder',
            label: tt('menu.airOrder') || 'Air Order',
            link: '/#',
            parentId: 'customerOrder',
            isChildItem: true,
            stateVariables: openMenus.has('airOrder'),
            click: (e: any) => toggleMenu('airOrder', e),
            childItems: [
              { id: 'airMarine', label: tt('menu.customsClearance') || 'Customs Clearance', link: '/order_run/air/marine' },
              { id: 'airLogistic', label: tt('menu.airPickup') || 'Pickup', link: '/order_run/air/logistic' },
              { id: 'airWms', label: tt('menu.warehouse') || 'Warehouse', link: '/order_run/air/wms' },
            ],
          },
          {
            id: 'truckOrder',
            label: tt('menu.truckOrder') || 'Truck Order',
            link: '/#',
            parentId: 'customerOrder',
            isChildItem: true,
            stateVariables: openMenus.has('truckOrder'),
            click: (e: any) => toggleMenu('truckOrder', e),
            childItems: [
              { id: 'truckMarine', label: tt('menu.customsClearance') || 'Customs Clearance', link: '/order_run/truck/marine' },
              { id: 'truckLogistic', label: tt('menu.containerPickup') || 'Container Pickup', link: '/order_run/truck/logistic' },
              { id: 'truckUsaToCa', label: tt('menu.usaToCa') || 'USA To CA', link: '/order_run/truck/usatoca' },
            ],
          },
        ],
      },
      {
        id: 'sop',
        label: tt('menu.sop') || 'SOP Management',
        icon: 'bx bx-book-content',
        link: '/#',
        stateVariables: openMenus.has('sop'),
        click: (e: any) => toggleMenu('sop', e),
        subItems: [
          // DH library is visible only to DH / Logistic staff and full admins.
          ...(canAccessSopDh()
            ? [
                {
                  id: 'sopDh',
                  label: tt('menu.sopDh') || 'SOP DH',
                  link: '/sop/dh',
                  parentId: 'sop',
                },
              ]
            : []),
          {
            id: 'sopPublic',
            label: tt('menu.sopPublic') || 'SOP Public',
            link: '/sop/public',
            parentId: 'sop',
          },
        ],
      },
      {
        id: 'itSupport',
        label: tt('menu.itSupport') || 'IT Support',
        icon: 'bx bx-support',
        link: '/#',
        stateVariables: openMenus.has('itSupport'),
        click: (e: any) => toggleMenu('itSupport', e),
        subItems: [
          {
            id: 'submitTicket',
            label: tt('menu.submitTicket') || 'Submit Ticket',
            link: '/support/submit',
            parentId: 'itSupport',
          },
          {
            id: 'ticketList',
            label: tt('menu.ticketList') || 'Ticket List',
            link: '/support/tickets',
            parentId: 'itSupport',
          },
        ],
      },
      {
        id: 'userManagement',
        label: tt('menu.userManagement') || 'User Management',
        icon: 'bx bx-user',
        link: '/#',
        stateVariables: openMenus.has('userManagement'),
        click: (e: any) => toggleMenu('userManagement', e),
        subItems: [
          {
            id: 'createUser',
            label: tt('menu.createUser') || 'Create User',
            link: '/user/add',
            parentId: 'userManagement',
          },
          {
            id: 'userList',
            label: tt('menu.userList') || 'User List',
            link: '/user/run',
            parentId: 'userManagement',
          },
        ],
      },
    ],
    [openMenus, toggleMenu, tt]
  );

  return <React.Fragment>{menuItems as any}</React.Fragment>;
};

export default Navdata;
