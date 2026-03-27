import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './hooks/useAuth'
import Layout from './components/Layout'
import ProtectedRoute from './components/ProtectedRoute'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Users from './pages/Users'
import Classes from './pages/Classes'
import Courses from './pages/Courses'
import Sessions from './pages/Sessions'
import SessionActive from './pages/SessionActive'
import StudentCheckIn from './pages/StudentCheckIn'
import Attendance from './pages/Attendance'
import Stats from './pages/Stats'
import Leaves from './pages/Leaves'
import MyAttendance from './pages/MyAttendance'
import Schedules from './pages/Schedules'
import Profile from './pages/Profile'

export default function App() {
  const { loading } = useAuth()

  if (loading) return <div className="loading" style={{ minHeight: '100vh' }}><div className="spinner" /></div>

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/users" element={<ProtectedRoute roles={['super_admin', 'admin']}><Users /></ProtectedRoute>} />
        <Route path="/classes" element={<ProtectedRoute roles={['super_admin', 'admin']}><Classes /></ProtectedRoute>} />
        <Route path="/courses" element={<ProtectedRoute roles={['super_admin', 'admin']}><Courses /></ProtectedRoute>} />
        <Route path="/sessions" element={<ProtectedRoute roles={['super_admin', 'admin', 'teacher']}><Sessions /></ProtectedRoute>} />
        <Route path="/sessions/:id/active" element={<ProtectedRoute roles={['super_admin', 'admin', 'teacher']}><SessionActive /></ProtectedRoute>} />
        <Route path="/attendance" element={<ProtectedRoute roles={['super_admin', 'admin', 'teacher']}><Attendance /></ProtectedRoute>} />
        <Route path="/stats" element={<ProtectedRoute roles={['super_admin', 'admin', 'teacher']}><Stats /></ProtectedRoute>} />
        <Route path="/schedules" element={<ProtectedRoute roles={['super_admin', 'admin', 'teacher']}><Schedules /></ProtectedRoute>} />
        <Route path="/check-in" element={<ProtectedRoute roles={['student']}><StudentCheckIn /></ProtectedRoute>} />
        <Route path="/my-attendance" element={<ProtectedRoute roles={['student']}><MyAttendance /></ProtectedRoute>} />
        <Route path="/leaves" element={<Leaves />} />
        <Route path="/profile" element={<Profile />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
