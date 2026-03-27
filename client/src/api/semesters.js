import apiClient from './client'

export const getSemesters = () => apiClient.get('/semesters')
export const createSemester = (data) => apiClient.post('/semesters', data)
export const updateSemester = (id, data) => apiClient.put(`/semesters/${id}`, data)
export const setCurrentSemester = (id) => apiClient.put(`/semesters/${id}/set-current`)
export const deleteSemester = (id) => apiClient.delete(`/semesters/${id}`)
