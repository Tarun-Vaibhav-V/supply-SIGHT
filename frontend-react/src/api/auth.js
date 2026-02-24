import api from './axios';

export const loginUser = (email, password) =>
    api.post('/auth/login', { email, password });

export const googleLogin = (id_token, company_id) =>
    api.post('/auth/google', { id_token, company_id });

export const registerUser = (data) =>
    api.post('/auth/register', data);

export const refreshToken = (refresh_token) =>
    api.post('/auth/refresh', { refresh_token });

export const getMe = () =>
    api.get('/auth/me');

export const getCompaniesDropdown = () =>
    api.get('/dropdown/companies');
