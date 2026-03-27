import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Moon, Sun, Menu, Bell, CheckCheck } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { getNotifications, getUnreadCount, markRead, markAllRead } from '../api/notifications'
import { useWebSocket } from '../hooks/useWebSocket'

const typeLabels = {
  checkin_reminder: '签到提醒',
  absence_alert: '缺勤通知',
  leave_result: '请假结果',
  system: '系统通知',
}

export default function Header({ theme, onToggleTheme, onToggleMenu }) {
  const { user, token } = useAuth()
  const { addListener } = useWebSocket(token)
  const navigate = useNavigate()
  const [unreadCount, setUnreadCount] = useState(0)
  const [showDropdown, setShowDropdown] = useState(false)
  const [notifications, setNotifications] = useState([])
  const dropdownRef = useRef(null)

  const fetchUnread = useCallback(async () => {
    try {
      const res = await getUnreadCount()
      setUnreadCount(res.data.data?.count || 0)
    } catch {}
  }, [])

  const fetchRecent = useCallback(async () => {
    try {
      const res = await getNotifications({ page: 1, limit: 10 })
      setNotifications(res.data.data?.items || [])
    } catch {}
  }, [])

  useEffect(() => { fetchUnread() }, [fetchUnread])

  // Listen for WS notification messages
  useEffect(() => {
    const remove = addListener('header-notifications', (msg) => {
      if (msg.type === 'notification') {
        setUnreadCount((c) => c + 1)
        setNotifications((prev) => [msg.payload, ...prev].slice(0, 10))
      }
    })
    return remove
  }, [addListener])

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const toggleDropdown = () => {
    if (!showDropdown) fetchRecent()
    setShowDropdown(!showDropdown)
  }

  const handleMarkRead = async (n) => {
    if (!n.is_read) {
      await markRead(n.id)
      setUnreadCount((c) => Math.max(0, c - 1))
      setNotifications((prev) => prev.map((x) => x.id === n.id ? { ...x, is_read: 1 } : x))
    }
    if (n.link) {
      navigate(n.link)
      setShowDropdown(false)
    }
  }

  const handleMarkAllRead = async () => {
    await markAllRead()
    setUnreadCount(0)
    setNotifications((prev) => prev.map((x) => ({ ...x, is_read: 1 })))
  }

  return (
    <header className="header">
      <div className="header-left">
        <button className="btn-icon btn-secondary" onClick={onToggleMenu} style={{ display: 'none' }}
                ref={(el) => { if (el && window.innerWidth <= 768) el.style.display = 'flex' }}>
          <Menu size={18} />
        </button>
      </div>
      <div className="header-right">
        {/* Notification Bell */}
        <div style={{ position: 'relative' }} ref={dropdownRef}>
          <button className="btn-icon btn-secondary" onClick={toggleDropdown} title="通知">
            <Bell size={18} />
            {unreadCount > 0 && (
              <span style={{
                position: 'absolute', top: -4, right: -4,
                background: '#ef4444', color: '#fff', fontSize: 10,
                minWidth: 16, height: 16, borderRadius: 8,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: '0 4px', fontWeight: 700
              }}>
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>

          {showDropdown && (
            <div style={{
              position: 'absolute', top: '100%', right: 0, marginTop: 8,
              width: 360, maxHeight: 480, overflow: 'auto',
              background: 'var(--bg-card, #fff)', borderRadius: 12,
              boxShadow: '0 8px 32px rgba(0,0,0,0.15)', zIndex: 1000,
              border: '1px solid var(--border, #e5e7eb)'
            }}>
              <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '12px 16px', borderBottom: '1px solid var(--border, #e5e7eb)'
              }}>
                <strong style={{ fontSize: 14 }}>通知</strong>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn-sm btn-secondary" onClick={handleMarkAllRead} title="全部已读">
                    <CheckCheck size={14} />
                  </button>
                  <button className="btn-sm btn-secondary" onClick={() => { navigate('/notifications'); setShowDropdown(false) }}>
                    查看全部
                  </button>
                </div>
              </div>
              {notifications.length === 0 ? (
                <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-secondary, #6b7280)', fontSize: 13 }}>
                  暂无通知
                </div>
              ) : (
                notifications.map((n) => (
                  <div key={n.id} onClick={() => handleMarkRead(n)} style={{
                    padding: '10px 16px', cursor: 'pointer',
                    borderBottom: '1px solid var(--border, #f3f4f6)',
                    background: n.is_read ? 'transparent' : 'rgba(37,99,235,0.04)',
                    transition: 'background 0.15s'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover, #f9fafb)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = n.is_read ? 'transparent' : 'rgba(37,99,235,0.04)'}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 12, color: 'var(--text-secondary, #6b7280)' }}>
                        {typeLabels[n.type] || n.type}
                      </span>
                      {!n.is_read && (
                        <span style={{ width: 6, height: 6, borderRadius: 3, background: '#2563eb', flexShrink: 0 }} />
                      )}
                    </div>
                    <div style={{ fontSize: 13, fontWeight: n.is_read ? 400 : 600, marginTop: 2 }}>{n.title}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary, #9ca3af)', marginTop: 2 }}>{n.content}</div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

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
