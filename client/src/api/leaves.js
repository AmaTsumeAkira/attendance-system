import apiClient from './client'

export const getLeaves = (params) => apiClient.get('/leaves', { params })
export const getLeave = (id) => apiClient.get(`/leaves/${id}`)
export const createLeave = (data) => apiClient.post('/leaves', data)
export const reviewLeave = (id, data) => apiClient.put(`/leaves/${id}/review`, data)
export const cancelLeave = (id) => apiClient.put(`/leaves/${id}/cancel`)
