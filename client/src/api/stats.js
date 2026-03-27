import apiClient from './client'

export const getOverview = (params) => apiClient.get('/stats/overview', { params })
export const getClassStats = (id, params) => apiClient.get(`/stats/class/${id}`, { params })
export const getCourseStats = (id, params) => apiClient.get(`/stats/course/${id}`, { params })
export const getStudentStats = (id, params) => apiClient.get(`/stats/student/${id}`, { params })
