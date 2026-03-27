import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import Header from './Header'
import { ToastProvider } from './Toast'

export default function Layout() {
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'light')
  const [menuOpen, setMenuOpen] = useState(false)

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    localStorage.setItem('theme', next)
    document.documentElement.setAttribute('data-theme', next)
  }

  // Apply theme on mount
  if (!document.documentElement.getAttribute('data-theme')) {
    document.documentElement.setAttribute('data-theme', theme)
  }

  return (
    <ToastProvider>
      <div className="layout">
        <div className={`sidebar ${menuOpen ? 'open' : ''}`}>
          <div className="sidebar-logo">📋 智能考勤系统</div>
          <Sidebar onClose={() => setMenuOpen(false)} />
        </div>
        {menuOpen && <div className="modal-overlay" style={{ zIndex: 99 }} onClick={() => setMenuOpen(false)} />}
        <div className="main-content">
          <Header theme={theme} onToggleTheme={toggleTheme} onToggleMenu={() => setMenuOpen(!menuOpen)} />
          <div className="page-content">
            <Outlet />
          </div>
        </div>
      </div>
    </ToastProvider>
  )
}
