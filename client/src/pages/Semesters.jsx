import { useState, useEffect, useCallback } from 'react'
import { getSemesters, createSemester, updateSemester, setCurrentSemester, deleteSemester } from '../api/semesters'
import { useToast } from '../components/Toast'
import DataTable from '../components/DataTable'
import Modal from '../components/Modal'
import { Plus, Edit, Trash2, CheckCircle, Circle } from 'lucide-react'

export default function Semesters() {
  const [semesters, setSemesters] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editItem, setEditItem] = useState(null)
  const [form, setForm] = useState({ name: '', start_date: '', end_date: '' })
  const toast = useToast()

  const fetchList = useCallback(async () => {
    setLoading(true)
    try {
      const res = await getSemesters()
      setSemesters(res.data.data || [])
    } catch { toast.addToast('获取学期列表失败', 'error') }
    finally { setLoading(false) }
  }, [toast])

  useEffect(() => { fetchList() }, [fetchList])

  const openCreate = () => {
    setEditItem(null)
    setForm({ name: '', start_date: '', end_date: '' })
    setShowModal(true)
  }

  const openEdit = (item) => {
    setEditItem(item)
    setForm({ name: item.name, start_date: item.start_date, end_date: item.end_date })
    setShowModal(true)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      if (editItem) {
        await updateSemester(editItem.id, form)
        toast.addToast('更新成功', 'success')
      } else {
        await createSemester(form)
        toast.addToast('创建成功', 'success')
      }
      setShowModal(false)
      fetchList()
    } catch (e) { toast.addToast(e.response?.data?.message || '操作失败', 'error') }
  }

  const handleSetCurrent = async (id) => {
    try {
      await setCurrentSemester(id)
      toast.addToast('已设为当前学期', 'success')
      fetchList()
    } catch (e) { toast.addToast(e.response?.data?.message || '操作失败', 'error') }
  }

  const handleDelete = async (id) => {
    if (!confirm('确定删除此学期？')) return
    try {
      await deleteSemester(id)
      toast.addToast('已删除', 'success')
      fetchList()
    } catch (e) { toast.addToast(e.response?.data?.message || '操作失败', 'error') }
  }

  const columns = [
    { key: 'name', label: '学期名称', render: (r) => (
      <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {r.name}
        {r.is_current === 1 && (
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 3,
            background: '#dcfce7', color: '#166534', fontSize: 11,
            padding: '2px 8px', borderRadius: 12, fontWeight: 600
          }}>
            <CheckCircle size={12} /> 当前学期
          </span>
        )}
      </span>
    )},
    { key: 'start_date', label: '开始日期' },
    { key: 'end_date', label: '结束日期' },
    { key: 'actions', label: '操作', render: (r) => (
      <div className="table-actions">
        <button className="btn-sm btn-secondary" title="编辑" onClick={() => openEdit(r)}>
          <Edit size={14} />
        </button>
        {r.is_current !== 1 && (
          <button className="btn-sm btn-success" title="设为当前学期" onClick={() => handleSetCurrent(r.id)}>
            <Circle size={14} />
          </button>
        )}
        <button className="btn-sm btn-danger" title="删除" onClick={() => handleDelete(r.id)}>
          <Trash2 size={14} />
        </button>
      </div>
    )},
  ]

  return (
    <div>
      <div className="page-header">
        <h1>学期管理</h1>
        <button className="btn-primary" onClick={openCreate}>
          <Plus size={16} style={{ marginRight: 4 }} />新建学期
        </button>
      </div>

      <div className="card">
        <DataTable columns={columns} data={semesters} loading={loading} emptyText="暂无学期" />
      </div>

      {showModal && (
        <Modal title={editItem ? '编辑学期' : '新建学期'} onClose={() => setShowModal(false)}>
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>学期名称</label>
              <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required placeholder="例如：2024-2025-1" />
            </div>
            <div className="form-group">
              <label>开始日期</label>
              <input type="date" value={form.start_date} onChange={e => setForm({ ...form, start_date: e.target.value })} required />
            </div>
            <div className="form-group">
              <label>结束日期</label>
              <input type="date" value={form.end_date} onChange={e => setForm({ ...form, end_date: e.target.value })} required />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
              <button type="button" className="btn-secondary" onClick={() => setShowModal(false)}>取消</button>
              <button type="submit" className="btn-primary">{editItem ? '更新' : '创建'}</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
