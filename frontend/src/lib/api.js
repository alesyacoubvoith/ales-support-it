import axios from "axios";

const rawBackendUrl = process.env.REACT_APP_BACKEND_URL || "";
const BACKEND_URL = /^https?:\/\//i.test(rawBackendUrl) ? rawBackendUrl.replace(/\/+$/, "") : "";
export const API = `${BACKEND_URL}/api`;
export const FILE_BASE = BACKEND_URL;

export const api = axios.create({ baseURL: API });

api.interceptors.request.use((config) => {
  try {
    const raw = localStorage.getItem("helpdesk_user");
    if (raw) {
      const user = JSON.parse(raw);
      if (user?.id) config.headers["X-User-Id"] = user.id;
    }
  } catch {
    // ignore invalid localStorage
  }
  return config;
});

export const endpoints = {
  login: (employee_id) => api.post("/auth/login", { employee_id }),
  users: () => api.get("/users"),
  createUser: (data) => api.post("/users", data),
  deleteUser: (id) => api.delete(`/users/${id}`),
  meta: () => api.get("/meta"),
  tickets: (params) => api.get("/tickets", { params }),
  createTicket: (data) => api.post("/tickets", data),
  updateTicket: (id, data) => api.patch(`/tickets/${id}`, data),
  resolvedTicketStats: () => api.get("/tickets/resolved-stats"),
  ticketAdminComments: (id) => api.get(`/tickets/${id}/admin-comments`),
  addTicketAdminComment: (id, message) => api.post(`/tickets/${id}/admin-comments`, { message }),
  inventory: () => api.get("/inventory"),
  createItem: (data) => api.post("/inventory", data),
  updateItem: (id, data) => api.patch(`/inventory/${id}`, data),
  deleteItem: (id) => api.delete(`/inventory/${id}`),
  reminders: () => api.get("/reminders"),
  createReminder: (data) => api.post("/reminders", data),
  toggleReminder: (id) => api.patch(`/reminders/${id}`),
  deleteReminder: (id) => api.delete(`/reminders/${id}`),
  logs: () => api.get("/logs"),
  stats: () => api.get("/stats"),
  assets: () => api.get("/assets"),
  createAsset: (data) => api.post("/assets", data),
  updateAsset: (id, data) => api.patch(`/assets/${id}`, data),
  deleteAsset: (id) => api.delete(`/assets/${id}`),
  exportAssets: () => api.get("/assets/export", { responseType: "blob" }),
  setupNeeded: () => api.get("/setup-needed"),
  setup: (data) => api.post("/setup", data),
  uploadFile: (formData) => api.post("/upload", formData),
  importInventory: (formData) => api.post("/inventory/import", formData),
  inventoryTemplate: () => api.get("/inventory/template", { responseType: "blob" }),
  tips: () => api.get("/tips"),
  createTip: (data) => api.post("/tips", data),
  updateTip: (id, data) => api.patch(`/tips/${id}`, data),
  deleteTip: (id) => api.delete(`/tips/${id}`),
};
