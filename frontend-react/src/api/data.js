import api from './axios';

export const getDashboardSummary = () => api.get('/dashboard/summary');
export const getLowInventory = () => api.get('/risks/low-inventory');
export const getDelayedShipments = () => api.get('/risks/delayed-shipments');
export const getCompanies = () => api.get('/companies');
export const getSuppliers = () => api.get('/suppliers');
export const getProducts = () => api.get('/products');
export const getWarehouses = () => api.get('/warehouses');
export const getInventory = () => api.get('/inventory');
export const getShipments = () => api.get('/shipments');
export const getOrders = () => api.get('/orders');
export const getRisks = () => api.get('/risks');
export const getSupplierReliability = () => api.get('/suppliers/reliability');
export const getDropdownCompanies = () => api.get('/dropdown/companies');
export const getDropdownProducts = () => api.get('/dropdown/products');

export const createOrder = (data) => api.post('/orders', data);
export const resolveRisk = (id) => api.put(`/risks/${id}/resolve`);
export const deleteRisk = (id) => api.delete(`/risks/${id}`);
export const updateShipmentStatus = (id, status) =>
    api.put(`/shipments/${id}/status`, { status });
export const detectRisks = () => api.post('/risks/detect');
