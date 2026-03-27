import apiClient from './client'

export const getUsers = (params) => apiClient.get('/users', { params })
export const getUser = (id) => apiClient.get(`/users/${id}`)
export const createUser = (data) => apiClient.post('/users', data)
export const updateUser = (id, data) => apiClient.put(`/users/${id}`, data)
export const deleteUser = (id) => apiClient.delete(`/users/${id}`)
export const importUsers = (formData) =>
  apiClient.post('/users/import', formData, { headers: { 'Content-Type': 'multipart/form-data' } })
export const downloadTemplate = () =>
  apiClient.get('/users/template', { responseType: 'blob' })
