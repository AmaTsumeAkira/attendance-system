import apiClient from './client'

export const getCourses = (params) => apiClient.get('/courses', { params })
export const getCourse = (id) => apiClient.get(`/courses/${id}`)
export const createCourse = (data) => apiClient.post('/courses', data)
export const updateCourse = (id, data) => apiClient.put(`/courses/${id}`, data)
export const deleteCourse = (id) => apiClient.delete(`/courses/${id}`)
export const linkClasses = (courseId, classIds, semester) =>
  apiClient.post(`/courses/${courseId}/classes`, { classIds, semester })
