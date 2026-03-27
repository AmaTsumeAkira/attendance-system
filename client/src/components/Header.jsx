import { Moon, Sun, Menu } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'

export default function Header({ theme, onToggleTheme, onToggleMenu }) {
  const { user } = useAuth()

  return (
    <header className="header">
      <div className="header-left">
        <button className="btn-icon btn-secondary" onClick={onToggleMenu} style={{ display: 'none' }}
                ref={(el) => { if (el && window.innerWidth <= 768) el.style.display = 'flex' }}>
          <Menu size={18} />
        </button>
      </div>
      <div className="header-right">
        <button className="theme-toggle" onClick={onToggleTheme} title="切换主题">
          {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        </button>
        <span style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
          {user?.real_name || user?.username}
        </span>
        <span className="badge badge-scheduled" style={{ fontSize: 11 }}>
          {user?.role === 'super_admin' ? '超级管理员' : user?.role === 'admin' ? '管理员' : user?.role === 'teacher' ? '教师' : '学生'}
        </span>
      </div>
    </header>
  )
}
