import {
  apiError,
  setLoadingCities,
  setCreatingMarine,
  setCreatingAir,
  setCreatingParse,
  fetchCitiesSuccess,
  createMarineMainTicketSuccess,
  createAirMainTicketSuccess,
  createParseMainTicketSuccess,
} from './reducer';

import {
  fetchCitiesApi,
  createMarineMainTicketApi,
  createAirMainTicketApi,
  createParseMainTicketApi,
} from '../../helpers/api_fetch/order';

// 1) Fetch destination cities
export const fetchCities = () => async (dispatch: any) => {
  try {
    dispatch(setLoadingCities(true));

    const data = await fetchCitiesApi();

    // normalize: support either { data: [...] } or direct [...]
    const cities = data?.data ?? data ?? [];
    dispatch(fetchCitiesSuccess(cities));

    return cities;
  } catch (err: any) {
    const msg = err?.message || 'Failed to fetch destination cities';
    dispatch(apiError(msg));
    return Promise.reject(msg);
  } finally {
    dispatch(setLoadingCities(false));
  }
};

// 2) Create marine main ticket
export const createMarineMainTicket = (payload: any) => async (dispatch: any) => {
  try {
    dispatch(setCreatingMarine(true));

    const data = await createMarineMainTicketApi(payload ?? {});
    dispatch(createMarineMainTicketSuccess(data));

    return data;
  } catch (err: any) {
    const isDuplicateContainer = err?.status === 409 && err?.code === 'CONTAINER_ALREADY_EXISTS';
    if (!isDuplicateContainer) {
      const msg =
          err?.response?.data?.message ||
          err?.message ||
          'Failed to create marine order';
      dispatch(apiError(msg));
    }

    return Promise.reject(err);
  } finally {
    dispatch(setCreatingMarine(false));
  }
};

// 3) Create air main ticket
export const createAirMainTicket = (payload: any) => async (dispatch: any) => {
  try {
    dispatch(setCreatingAir(true));

    const data = await createAirMainTicketApi(payload ?? {});

    dispatch(createAirMainTicketSuccess(data));

    return data;
  } catch (err: any) {
    const msg = err?.message || 'Failed to create air order';
    dispatch(apiError(msg));
    return Promise.reject(msg);
  } finally {
    dispatch(setCreatingAir(false));
  }
};

// 4) Create parse/truck main ticket
export const createParseMainTicket = (payload: any) => async (dispatch: any) => {
  try {
    dispatch(setCreatingParse(true));

    const data = await createParseMainTicketApi(payload ?? {});
    dispatch(createParseMainTicketSuccess(data));

    return data;
  } catch (err: any) {
    const msg = err?.message || 'Failed to create truck/parse order';
    dispatch(apiError(msg));
    return Promise.reject(msg);
  } finally {
    dispatch(setCreatingParse(false));
  }
};
