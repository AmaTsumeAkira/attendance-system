import { useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { changePassword } from '../api/auth'
import { useToast } from '../components/Toast'
import { Lock, User, Mail, Phone, Shield } from 'lucide-react'

export default function Profile() {
  const { user } = useAuth()
  const toast = useToast()
  const [pwForm, setPwForm] = useState({ oldPassword: '', newPassword: '', confirmPassword: '' })
  const [loading, setLoading] = useState(false)

  const handleChangePassword = async (e) => {
    e.preventDefault()
    if (pwForm.newPassword !== pwForm.confirmPassword) {
      toast.addToast('两次输入的密码不一致', 'warning')
      return
    }
    if (pwForm.newPassword.length < 6) {
      toast.addToast('密码长度至少6位', 'warning')
      return
    }
    setLoading(true)
    try {
      await changePassword({ oldPassword: pwForm.oldPassword, newPassword: pwForm.newPassword })
      toast.addToast('密码修改成功', 'success')
      setPwForm({ oldPassword: '', newPassword: '', confirmPassword: '' })
    } catch (e) {
      toast.addToast(e.response?.data?.message || '修改失败', 'error')
    } finally { setLoading(false) }
  }

  const roleMap = { super_admin: '超级管理员', admin: '管理员', teacher: '教师', student: '学生' }

  return (
    <div>
      <div className="page-header"><h1>个人设置</h1></div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        <div className="card">
          <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>基本信息</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <User size={18} style={{ color: 'var(--text-secondary)' }} />
              <div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>用户名</div>
                <div style={{ fontWeight: 500 }}>{user?.username}</div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <User size={18} style={{ color: 'var(--text-secondary)' }} />
              <div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>姓名</div>
                <div style={{ fontWeight: 500 }}>{user?.real_name || '-'}</div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <Shield size={18} style={{ color: 'var(--text-secondary)' }} />
              <div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>角色</div>
                <div style={{ fontWeight: 500 }}>{roleMap[user?.role] || user?.role}</div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <Mail size={18} style={{ color: 'var(--text-secondary)' }} />
              <div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>邮箱</div>
                <div style={{ fontWeight: 500 }}>{user?.email || '-'}</div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <Phone size={18} style={{ color: 'var(--text-secondary)' }} />
              <div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>电话</div>
                <div style={{ fontWeight: 500 }}>{user?.phone || '-'}</div>
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}><Lock size={16} style={{ verticalAlign: 'middle', marginRight: 4 }} />修改密码</h3>
          <form onSubmit={handleChangePassword}>
            <div className="form-group">
              <label>当前密码</label>
              <input type="password" value={pwForm.oldPassword} onChange={e => setPwForm({ ...pwForm, oldPassword: e.target.value })} required />
            </div>
            <div className="form-group">
              <label>新密码</label>
              <input type="password" value={pwForm.newPassword} onChange={e => setPwForm({ ...pwForm, newPassword: e.target.value })} required />
            </div>
            <div className="form-group">
              <label>确认新密码</label>
              <input type="password" value={pwForm.confirmPassword} onChange={e => setPwForm({ ...pwForm, confirmPassword: e.target.value })} required />
            </div>
            <button type="submit" className="btn-primary" disabled={loading} style={{ marginTop: 8 }}>
              {loading ? <div className="spinner" /> : '修改密码'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
