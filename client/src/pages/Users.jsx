import { useState, useEffect, useCallback } from 'react'
import { getUsers, createUser, updateUser, deleteUser, importUsers } from '../api/users'
import { useToast } from '../components/Toast'
import DataTable from '../components/DataTable'
import Modal from '../components/Modal'
import StatusBadge from '../components/StatusBadge'
import { Plus, Upload, Search, Edit2, Trash2, ToggleLeft, ToggleRight } from 'lucide-react'

export default function Users() {
  const [users, setUsers] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [showImport, setShowImport] = useState(false)
  const [importFile, setImportFile] = useState(null)
  const [dragOver, setDragOver] = useState(false)
  const toast = useToast()
  const limit = 20

  const [form, setForm] = useState({ username: '', password: '', real_name: '', role: 'student', email: '', phone: '' })

  const fetchUsers = useCallback(async () => {
    setLoading(true)
    try {
      const res = await getUsers({ page, limit, search, role: roleFilter })
      const data = res.data.data
      setUsers(data?.items || [])
      setTotal(data?.total || 0)
    } catch (e) {
      toast.addToast('获取用户列表失败', 'error')
    } finally {
      setLoading(false)
    }
  }, [page, search, roleFilter, toast])

  useEffect(() => { fetchUsers() }, [fetchUsers])

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      if (editing) {
        await updateUser(editing.id, form)
        toast.addToast('用户更新成功', 'success')
      } else {
        await createUser(form)
        toast.addToast('用户创建成功', 'success')
      }
      setShowModal(false)
      setEditing(null)
      fetchUsers()
    } catch (e) {
      toast.addToast(e.response?.data?.message || '操作失败', 'error')
    }
  }

  const handleEdit = (user) => {
    setEditing(user)
    setForm({ username: user.username, password: '', real_name: user.real_name || '', role: user.role, email: user.email || '', phone: user.phone || '' })
    setShowModal(true)
  }

  const handleDelete = async (user) => {
    if (!confirm(`确定要删除用户 "${user.real_name || user.username}" 吗？`)) return
    try {
      await deleteUser(user.id)
      toast.addToast('用户已删除', 'success')
      fetchUsers()
    } catch (e) {
      toast.addToast(e.response?.data?.message || '删除失败', 'error')
    }
  }

  const handleToggle = async (user) => {
    try {
      await updateUser(user.id, { status: user.status === 'active' ? 'disabled' : 'active' })
      toast.addToast('状态已更新', 'success')
      fetchUsers()
    } catch (e) {
      toast.addToast('操作失败', 'error')
    }
  }

  const handleImport = async () => {
    if (!importFile) return
    const fd = new FormData()
    fd.append('file', importFile)
    try {
      const res = await importUsers(fd)
      toast.addToast(`导入成功: ${res.data.data?.imported || 0} 条`, 'success')
      setShowImport(false)
      setImportFile(null)
      fetchUsers()
    } catch (e) {
      toast.addToast(e.response?.data?.message || '导入失败', 'error')
    }
  }

  const openCreate = () => {
    setEditing(null)
    setForm({ username: '', password: '', real_name: '', role: 'student', email: '', phone: '' })
    setShowModal(true)
  }

  const columns = [
    { key: 'username', label: '用户名', sortable: true },
    { key: 'real_name', label: '姓名', sortable: true },
    { key: 'role', label: '角色', render: (r) => {
      const map = { super_admin: '超级管理员', admin: '管理员', teacher: '教师', student: '学生' }
      return map[r.role] || r.role
    }},
    { key: 'email', label: '邮箱' },
    { key: 'phone', label: '电话' },
    { key: 'status', label: '状态', render: (r) => <StatusBadge status={r.status} /> },
    { key: 'actions', label: '操作', render: (r) => (
      <div className="table-actions">
        <button className="btn-sm btn-secondary" onClick={() => handleEdit(r)}><Edit2 size={14} /></button>
        <button className="btn-sm btn-secondary" onClick={() => handleToggle(r)}>
          {r.status === 'active' ? <ToggleRight size={14} style={{ color: 'var(--success)' }} /> : <ToggleLeft size={14} style={{ color: 'var(--text-secondary)' }} />}
        </button>
        <button className="btn-sm btn-danger" onClick={() => handleDelete(r)}><Trash2 size={14} /></button>
      </div>
    )},
  ]

  return (
    <div>
      <div className="page-header">
        <h1>用户管理</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn-secondary" onClick={() => setShowImport(true)}><Upload size={16} style={{ marginRight: 4 }} />批量导入</button>
          <button className="btn-primary" onClick={openCreate}><Plus size={16} style={{ marginRight: 4 }} />新建用户</button>
        </div>
      </div>

      <div className="filter-bar">
        <div className="search-box">
          <Search size={16} />
          <input placeholder="搜索用户名/姓名..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1) }} style={{ paddingLeft: 36 }} />
        </div>
        <select value={roleFilter} onChange={(e) => { setRoleFilter(e.target.value); setPage(1) }}>
          <option value="">全部角色</option>
          <option value="admin">管理员</option>
          <option value="teacher">教师</option>
          <option value="student">学生</option>
        </select>
      </div>

      <div className="card">
        <DataTable columns={columns} data={users} loading={loading} page={page} total={total} limit={limit} onPageChange={setPage} />
      </div>

      {showModal && (
        <Modal title={editing ? '编辑用户' : '新建用户'} onClose={() => { setShowModal(false); setEditing(null) }}>
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>用户名</label>
              <input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} required disabled={!!editing} />
            </div>
            {!editing && (
              <div className="form-group">
                <label>密码</label>
                <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
              </div>
            )}
            <div className="form-group">
              <label>姓名</label>
              <input value={form.real_name} onChange={(e) => setForm({ ...form, real_name: e.target.value })} />
            </div>
            <div className="form-group">
              <label>角色</label>
              <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                <option value="student">学生</option>
                <option value="teacher">教师</option>
                <option value="admin">管理员</option>
              </select>
            </div>
            <div className="form-group">
              <label>邮箱</label>
              <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div className="form-group">
              <label>电话</label>
              <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
              <button type="button" className="btn-secondary" onClick={() => { setShowModal(false); setEditing(null) }}>取消</button>
              <button type="submit" className="btn-primary">{editing ? '保存' : '创建'}</button>
            </div>
          </form>
        </Modal>
      )}

      {showImport && (
        <Modal title="批量导入用户" onClose={() => { setShowImport(false); setImportFile(null) }}>
          <div
            className={`drop-zone ${dragOver ? 'dragover' : ''}`}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => { e.preventDefault(); setDragOver(false); setImportFile(e.dataTransfer.files[0]) }}
            onClick={() => document.getElementById('import-file').click()}
          >
            <Upload size={32} style={{ marginBottom: 8 }} />
            <p>拖拽 CSV 文件到这里，或点击选择</p>
            {importFile && <p style={{ marginTop: 8, fontWeight: 600 }}>{importFile.name}</p>}
            <input id="import-file" type="file" accept=".csv" style={{ display: 'none' }} onChange={(e) => setImportFile(e.target.files[0])} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
            <button className="btn-secondary" onClick={() => { setShowImport(false); setImportFile(null) }}>取消</button>
            <button className="btn-primary" disabled={!importFile} onClick={handleImport}>导入</button>
          </div>
        </Modal>
      )}
    </div>
  )
}
