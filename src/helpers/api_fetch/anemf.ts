import axios from 'axios';
import { buildApiUrl } from '../apiBase';
import { UPLOAD_MARINE_CB_AN_EMF_ONLY } from '../url_helper';

export const uploadMarineCbAnEmfOnlyApi = async (payload: FormData) => {
  const url = buildApiUrl(UPLOAD_MARINE_CB_AN_EMF_ONLY);

  const response = await axios.post(url, payload, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });

  return response.data;
};
