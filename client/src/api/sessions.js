import apiClient from './client'

export const getSessions = (params) => apiClient.get('/sessions', { params })
export const getSession = (id) => apiClient.get(`/sessions/${id}`)
export const createSession = (data) => apiClient.post('/sessions', data)
export const updateSession = (id, data) => apiClient.put(`/sessions/${id}`, data)
export const startSession = (id) => apiClient.post(`/sessions/${id}/start`)
export const endSession = (id) => apiClient.post(`/sessions/${id}/end`)
export const cancelSession = (id) => apiClient.delete(`/sessions/${id}`)
