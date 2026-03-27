import apiClient from './client'

export const getClasses = (params) => apiClient.get('/classes', { params })
export const getClass = (id) => apiClient.get(`/classes/${id}`)
export const createClass = (data) => apiClient.post('/classes', data)
export const updateClass = (id, data) => apiClient.put(`/classes/${id}`, data)
export const deleteClass = (id) => apiClient.delete(`/classes/${id}`)
export const addStudents = (classId, userIds) =>
  apiClient.post(`/classes/${classId}/students`, { userIds })
export const removeStudent = (classId, userId) =>
  apiClient.delete(`/classes/${classId}/students/${userId}`)
