import { toast } from 'react-toastify';

import {
    leaveMessageError,
    setPosting,
    setRetrieving,
    setMarkingRead,
    postMessageSuccess,
    retrieveMessagesSuccess,
    markReadSuccess,
} from './reducer';
import {
    markLeaveMessagesAsReadApi,
    postLeaveMessageApi,
    retrieveLeaveMessagesApi,
} from '../../helpers/api_fetch/leaveMessage';

// ---------- POST ----------
export const postLeaveMessage =
    (payload: {
        user_id: string | number;
        task_id: string | number;
        note_text: string;
        sender_type: string;
        container_number?: string | null;
        awb?: string | null;
        read_status_user?: number | null;
        read_status_admin?: string | null;
    }) =>
        async (dispatch: any) => {
            try {
                dispatch(setPosting(true));
                const data = await postLeaveMessageApi(payload);
                dispatch(postMessageSuccess(data));

                toast.success(data?.message || 'Message sent', { autoClose: 2000 });
                return data;
            } catch (err: any) {
                const msg = err?.message || 'Failed to send message';
                dispatch(leaveMessageError(msg));
                toast.error(msg, { autoClose: 2500 });
                return Promise.reject(msg);
            } finally {
                dispatch(setPosting(false));
            }
        };

// ---------- RETRIEVE ----------
export const retrieveLeaveMessages =
    (payload: {
        task_id: string | number;
        extra_task_ids?: Array<string | number>;
        container_number?: string | null;
        awb?: string | null;
    }) =>
        async (dispatch: any) => {
            try {
                dispatch(setRetrieving(true));
                const data = await retrieveLeaveMessagesApi(payload);
                dispatch(retrieveMessagesSuccess(data));
                return data;
            } catch (err: any) {
                const msg = err?.message || 'Failed to retrieve messages';
                dispatch(leaveMessageError(msg));
                toast.error(msg, { autoClose: 2500 });
                return Promise.reject(msg);
            } finally {
                dispatch(setRetrieving(false));
            }
        };

// ---------- MARK READ ----------
export const markLeaveMessagesAsRead =
    (payload: { note_ids: Array<string | number>; name?: string }) =>
        async (dispatch: any) => {
            try {
                dispatch(setMarkingRead(true));
                const data = await markLeaveMessagesAsReadApi(payload);
                dispatch(markReadSuccess(data));

                toast.success(data?.message || 'Marked as read', { autoClose: 1800 });
                return data;
            } catch (err: any) {
                const msg = err?.message || 'Failed to mark as read';
                dispatch(leaveMessageError(msg));
                toast.error(msg, { autoClose: 2500 });
                return Promise.reject(msg);
            } finally {
                dispatch(setMarkingRead(false));
            }
        };