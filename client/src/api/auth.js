import apiClient from './client'

export const login = (data) => apiClient.post('/auth/login', data)
export const getMe = () => apiClient.get('/auth/me')
export const refreshToken = () => apiClient.post('/auth/refresh')
export const changePassword = (data) => apiClient.post('/auth/change-password', data)
