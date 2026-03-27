import { NavLink } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import {
  LayoutDashboard, Users, School, BookOpen, Clock, BarChart3,
  CalendarCheck, FileText, Calendar, User, LogOut
} from 'lucide-react'

export default function Sidebar({ onClose }) {
  const { user, logout } = useAuth()
  const isAdmin = user?.role === 'super_admin' || user?.role === 'admin'
  const isTeacher = user?.role === 'teacher'
  const isStudent = user?.role === 'student'

  const Link = ({ to, icon: Icon, children }) => (
    <NavLink to={to} onClick={onClose} className={({ isActive }) => isActive ? 'active' : ''}>
      <Icon size={18} /> {children}
    </NavLink>
  )

  return (
    <nav className="sidebar-nav">
      <Link to="/" icon={LayoutDashboard}>仪表盘</Link>

      {(isAdmin || isTeacher) && (
        <>
          <div className="sidebar-section">管理</div>
          {isAdmin && <Link to="/users" icon={Users}>用户管理</Link>}
          {isAdmin && <Link to="/classes" icon={School}>班级管理</Link>}
          {isAdmin && <Link to="/courses" icon={BookOpen}>课程管理</Link>}
          <Link to="/sessions" icon={Clock}>签到会话</Link>
          <Link to="/attendance" icon={CalendarCheck}>出勤记录</Link>
          <Link to="/stats" icon={BarChart3}>统计报表</Link>
          <Link to="/leaves" icon={FileText}>请假审批</Link>
          <Link to="/schedules" icon={Calendar}>课表管理</Link>
        </>
      )}

      {isStudent && (
        <>
          <div className="sidebar-section">签到</div>
          <Link to="/check-in" icon={CalendarCheck}>签到</Link>
          <Link to="/my-attendance" icon={BarChart3}>我的出勤</Link>
          <Link to="/leaves" icon={FileText}>请假申请</Link>
        </>
      )}

      <div className="sidebar-section">账户</div>
      <Link to="/profile" icon={User}>个人设置</Link>
      <a href="#" onClick={(e) => { e.preventDefault(); logout(); window.location.href = '/login' }}>
        <LogOut size={18} /> 退出登录
      </a>
    </nav>
  )
}
