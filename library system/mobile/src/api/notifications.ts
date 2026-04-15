import { apiRequest } from "../lib/http";
import { ApiResult, NotificationItem } from "../types";

type NotificationListResponse = {
  results?: NotificationItem[];
  unread_count?: number;
};

type UnreadCountResponse = {
  unread_count?: number;
};

type MarkReadResponse = {
  message?: string;
  unread_count?: number;
};

export const notificationsApi = {
  async getNotifications(limit = 50, unreadOnly = false): Promise<ApiResult<NotificationListResponse>> {
    const params = new URLSearchParams();
    params.set("limit", String(limit));
    if (unreadOnly) {
      params.set("unread", "true");
    }
    const result = await apiRequest<NotificationListResponse>(`/auth/notifications/?${params.toString()}`, {
      method: "GET",
      auth: true,
    });
    if (result.error || !result.data) {
      return { data: null, error: result.error ?? "Unable to load notifications." };
    }
    return result;
  },

  async getUnreadCount(): Promise<ApiResult<UnreadCountResponse>> {
    const result = await apiRequest<UnreadCountResponse>("/auth/notifications/unread-count/", {
      method: "GET",
      auth: true,
    });
    if (result.error || !result.data) {
      return { data: null, error: result.error ?? "Unable to load unread notification count." };
    }
    return result;
  },

  async markRead(id: number): Promise<ApiResult<MarkReadResponse>> {
    const result = await apiRequest<MarkReadResponse>(`/auth/notifications/${id}/mark-read/`, {
      method: "POST",
      auth: true,
      body: JSON.stringify({}),
    });
    if (result.error || !result.data) {
      return { data: null, error: result.error ?? "Unable to mark notification as read." };
    }
    return result;
  },

  async markAllRead(): Promise<ApiResult<MarkReadResponse>> {
    const result = await apiRequest<MarkReadResponse>("/auth/notifications/mark-all-read/", {
      method: "POST",
      auth: true,
      body: JSON.stringify({}),
    });
    if (result.error || !result.data) {
      return { data: null, error: result.error ?? "Unable to mark notifications as read." };
    }
    return result;
  },
};
