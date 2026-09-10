// src/setupTests.ts

// 1) Extend Jest with DOM matchers
import '@testing-library/jest-dom';

/* ============================
   React Router DOM (v7, ESM)
   ============================ */
jest.mock('react-router-dom', () => {
  const React = require('react');
  return {
    __esModule: true,
    BrowserRouter: ({ children }: any) => React.createElement(React.Fragment, null, children),
    Routes: ({ children }: any) => React.createElement(React.Fragment, null, children),
    Route: () => null,
    Link: ({ children, ...rest }: any) => React.createElement('a', rest, children),
    NavLink: ({ children, ...rest }: any) => React.createElement('a', rest, children),
    Outlet: () => null,
    useNavigate: () => () => {},
    useLocation: () => ({ pathname: '/' }),
    useParams: () => ({}),
  };
});

/* ============================
   Feather Icons (ESM)
   ============================ */
jest.mock('feather-icons-react', () => {
  const React = require('react');
  const FeatherIcon = (props: any) =>
    React.createElement('i', { 'data-testid': 'feather-icon', ...props });
  return { __esModule: true, default: FeatherIcon };
});

/* ============================
   Axios (ESM) – rich mock
   ============================ */
jest.mock('axios', () => {
  const response = { data: {} };

  const m: any = {
    request: jest.fn(() => Promise.resolve(response)),
    get: jest.fn(() => Promise.resolve(response)),
    post: jest.fn(() => Promise.resolve(response)),
    put: jest.fn(() => Promise.resolve(response)),
    delete: jest.fn(() => Promise.resolve(response)),

    defaults: {
      baseURL: '',
      headers: { post: {} as Record<string, any> },
    },

    interceptors: {
      request: { use: jest.fn() },
      response: { use: jest.fn() },
    },

    create: jest.fn((cfg?: any) => {
      const inst: any = {
        request: m.request,
        get: m.get,
        post: m.post,
        put: m.put,
        delete: m.delete,
        interceptors: m.interceptors,
        defaults: {
          baseURL: cfg?.baseURL || '',
          headers: { post: {} as Record<string, any> },
        },
      };
      return inst;
    }),

    isAxiosError: () => false,
    CancelToken: { source: jest.fn(() => ({ token: 'token', cancel: jest.fn() })) },
  };

  return { __esModule: true, default: m };
});

/* ============================
   Swiper (ESM) – virtual mocks
   ============================ */

// Important: use { virtual: true } so Jest doesn’t try to resolve the real ESM package.
jest.mock(
  'swiper/react',
  () => {
    const React = require('react');
    const Swiper = ({ children, ...rest }: any) =>
      React.createElement('div', { 'data-testid': 'swiper', ...rest }, children);
    const SwiperSlide = ({ children, ...rest }: any) =>
      React.createElement('div', { 'data-testid': 'swiper-slide', ...rest }, children);
    return { __esModule: true, Swiper, SwiperSlide };
  },
  { virtual: true }
);

// Stub CSS side-effect imports (also virtual)
jest.mock('swiper/css', () => ({}), { virtual: true });
jest.mock('swiper/css/navigation', () => ({}), { virtual: true });
jest.mock('swiper/css/pagination', () => ({}), { virtual: true });
jest.mock('swiper/css/scrollbar', () => ({}), { virtual: true });

// Mock Swiper modules (Autoplay, Mousewheel, etc.) as inert objects
jest.mock(
  'swiper/modules',
  () => {
    const noop = {};
    return {
      __esModule: true,
      Autoplay: noop,
      Mousewheel: noop,
      Navigation: noop,
      Pagination: noop,
      Scrollbar: noop,
      A11y: noop,
      EffectFade: noop,
      EffectCoverflow: noop,
      FreeMode: noop,
      Thumbs: noop,
    };
  },
  { virtual: true }
);
