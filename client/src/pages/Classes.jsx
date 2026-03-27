import { useState, useEffect, useCallback } from 'react'
import { getClasses, createClass, updateClass, deleteClass, getClass, addStudents, removeStudent } from '../api/classes'
import { getUsers } from '../api/users'
import { useToast } from '../components/Toast'
import DataTable from '../components/DataTable'
import Modal from '../components/Modal'
import { Plus, Edit2, Trash2, Users, X, UserPlus } from 'lucide-react'

export default function Classes() {
  const [classes, setClasses] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [showDetail, setShowDetail] = useState(null)
  const [students, setStudents] = useState([])
  const [allStudents, setAllStudents] = useState([])
  const [showAddStudents, setShowAddStudents] = useState(false)
  const toast = useToast()
  const [form, setForm] = useState({ name: '', grade: '', teacher_id: '', description: '' })
  const [teachers, setTeachers] = useState([])

  const fetchClasses = useCallback(async () => {
    setLoading(true)
    try {
      const res = await getClasses()
      setClasses(res.data.data?.items || res.data.data || [])
    } catch { toast.addToast('获取班级列表失败', 'error') }
    finally { setLoading(false) }
  }, [toast])

  useEffect(() => { fetchClasses() }, [fetchClasses])

  useEffect(() => {
    if (showModal) {
      getUsers({ role: 'teacher', limit: 100 }).then(r => setTeachers(r.data.data?.items || []))
    }
  }, [showModal])

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      if (editing) {
        await updateClass(editing.id, form)
        toast.addToast('班级更新成功', 'success')
      } else {
        await createClass(form)
        toast.addToast('班级创建成功', 'success')
      }
      setShowModal(false); setEditing(null); fetchClasses()
    } catch (e) { toast.addToast(e.response?.data?.message || '操作失败', 'error') }
  }

  const handleDelete = async (cls) => {
    if (!confirm(`确定删除班级 "${cls.name}"？`)) return
    try { await deleteClass(cls.id); toast.addToast('已删除', 'success'); fetchClasses() }
    catch (e) { toast.addToast(e.response?.data?.message || '删除失败', 'error') }
  }

  const openDetail = async (cls) => {
    try {
      const res = await getClass(cls.id)
      setShowDetail(cls)
      setStudents(res.data.data?.students || [])
    } catch { toast.addToast('获取班级详情失败', 'error') }
  }

  const openAddStudents = async () => {
    try {
      const res = await getUsers({ role: 'student', limit: 200 })
      const all = res.data.data?.items || []
      const existingIds = new Set(students.map(s => s.id))
      setAllStudents(all.filter(s => !existingIds.has(s.id)))
      setShowAddStudents(true)
    } catch { toast.addToast('获取学生列表失败', 'error') }
  }

  const handleAddStudents = async (userIds) => {
    try {
      await addStudents(showDetail.id, userIds)
      toast.addToast('添加成功', 'success')
      setShowAddStudents(false)
      openDetail(showDetail)
    } catch (e) { toast.addToast(e.response?.data?.message || '添加失败', 'error') }
  }

  const handleRemoveStudent = async (userId) => {
    try {
      await removeStudent(showDetail.id, userId)
      toast.addToast('已移除', 'success')
      openDetail(showDetail)
    } catch (e) { toast.addToast('移除失败', 'error') }
  }

  const columns = [
    { key: 'name', label: '班级名称', sortable: true },
    { key: 'grade_name', label: '年级' },
    { key: 'teacher_name', label: '班主任' },
    { key: 'student_count', label: '学生数' },
    { key: 'actions', label: '操作', render: (r) => (
      <div className="table-actions">
        <button className="btn-sm btn-secondary" onClick={() => openDetail(r)}><Users size={14} /></button>
        <button className="btn-sm btn-secondary" onClick={() => { setEditing(r); setForm({ name: r.name, grade: r.grade || '', teacher_id: r.teacher_id || '', description: r.description || '' }); setShowModal(true) }}><Edit2 size={14} /></button>
        <button className="btn-sm btn-danger" onClick={() => handleDelete(r)}><Trash2 size={14} /></button>
      </div>
    )},
  ]

  return (
    <div>
      <div className="page-header">
        <h1>班级管理</h1>
        <button className="btn-primary" onClick={() => { setEditing(null); setForm({ name: '', grade: '', teacher_id: '', description: '' }); setShowModal(true) }}>
          <Plus size={16} style={{ marginRight: 4 }} />新建班级
        </button>
      </div>
      <div className="card">
        <DataTable columns={columns} data={classes} loading={loading} />
      </div>

      {showModal && (
        <Modal title={editing ? '编辑班级' : '新建班级'} onClose={() => { setShowModal(false); setEditing(null) }}>
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>班级名称</label>
              <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
            </div>
            <div className="form-group">
              <label>年级</label>
              <input value={form.grade} onChange={e => setForm({ ...form, grade: e.target.value })} />
            </div>
            <div className="form-group">
              <label>班主任</label>
              <select value={form.teacher_id} onChange={e => setForm({ ...form, teacher_id: e.target.value })}>
                <option value="">请选择</option>
                {teachers.map(t => <option key={t.id} value={t.id}>{t.real_name || t.username}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>描述</label>
              <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
              <button type="button" className="btn-secondary" onClick={() => { setShowModal(false); setEditing(null) }}>取消</button>
              <button type="submit" className="btn-primary">{editing ? '保存' : '创建'}</button>
            </div>
          </form>
        </Modal>
      )}

      {showDetail && (
        <Modal title={`班级详情: ${showDetail.name}`} onClose={() => { setShowDetail(null); setStudents([]) }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <span style={{ color: 'var(--text-secondary)' }}>共 {students.length} 名学生</span>
            <button className="btn-sm btn-primary" onClick={openAddStudents}><UserPlus size={14} style={{ marginRight: 4 }} />添加学生</button>
          </div>
          {students.length === 0 ? (
            <div className="empty">暂无学生</div>
          ) : (
            students.map(s => (
              <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                <div>
                  <span style={{ fontWeight: 500 }}>{s.real_name || s.username}</span>
                  <span style={{ color: 'var(--text-secondary)', fontSize: 13, marginLeft: 8 }}>{s.username}</span>
                </div>
                <button className="btn-sm btn-danger" onClick={() => handleRemoveStudent(s.id)}><X size={14} /></button>
              </div>
            ))
          )}
        </Modal>
      )}

      {showAddStudents && (
        <Modal title="添加学生" onClose={() => setShowAddStudents(false)}>
          {allStudents.length === 0 ? (
            <div className="empty">没有可添加的学生</div>
          ) : (
            <div style={{ maxHeight: 400, overflowY: 'auto' }}>
              {allStudents.map(s => (
                <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                  <div>
                    <span style={{ fontWeight: 500 }}>{s.real_name || s.username}</span>
                    <span style={{ color: 'var(--text-secondary)', fontSize: 13, marginLeft: 8 }}>{s.username}</span>
                  </div>
                  <button className="btn-sm btn-primary" onClick={() => handleAddStudents([s.id])}>添加</button>
                </div>
              ))}
            </div>
          )}
        </Modal>
      )}
    </div>
  )
}
