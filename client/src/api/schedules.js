import apiClient from './client'

export const getSchedules = (params) => apiClient.get('/schedules', { params })
export const createSchedule = (data) => apiClient.post('/schedules', data)
export const updateSchedule = (id, data) => apiClient.put(`/schedules/${id}`, data)
export const deleteSchedule = (id) => apiClient.delete(`/schedules/${id}`)
export const generateSessions = (data) => apiClient.post('/schedules/generate', data)
