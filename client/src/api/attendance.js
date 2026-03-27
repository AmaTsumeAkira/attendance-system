import apiClient from './client'

export const getAttendances = (params) => apiClient.get('/attendances', { params })
export const getMyAttendance = () => apiClient.get('/attendances/my')
export const updateAttendance = (id, data) => apiClient.put(`/attendances/${id}`, data)
export const manualUpdateAttendance = (id, data) => apiClient.put(`/attendances/${id}/manual-update`, data)
export const exportAttendances = (params) =>
  apiClient.get('/attendances/export', { params, responseType: 'blob' })
