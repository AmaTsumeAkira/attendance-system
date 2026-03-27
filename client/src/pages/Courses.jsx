import { useState, useEffect, useCallback } from 'react'
import { getCourses, createCourse, updateCourse, deleteCourse, linkClasses } from '../api/courses'
import { getClasses } from '../api/classes'
import { getUsers } from '../api/users'
import { useToast } from '../components/Toast'
import DataTable from '../components/DataTable'
import Modal from '../components/Modal'
import { Plus, Edit2, Trash2 } from 'lucide-react'

export default function Courses() {
  const [courses, setCourses] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [teachers, setTeachers] = useState([])
  const [classList, setClassList] = useState([])
  const toast = useToast()
  const [form, setForm] = useState({ name: '', code: '', teacher_id: '', description: '' })
  const [selectedClasses, setSelectedClasses] = useState([])

  const fetchCourses = useCallback(async () => {
    setLoading(true)
    try { const res = await getCourses(); setCourses(res.data.data?.items || res.data.data || []) }
    catch { toast.addToast('获取课程列表失败', 'error') }
    finally { setLoading(false) }
  }, [toast])

  useEffect(() => { fetchCourses() }, [fetchCourses])

  useEffect(() => {
    if (showModal) {
      getUsers({ role: 'teacher', limit: 100 }).then(r => setTeachers(r.data.data?.items || []))
      getClasses().then(r => setClassList(r.data.data?.items || r.data.data || []))
    }
  }, [showModal])

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      let id
      if (editing) {
        await updateCourse(editing.id, form)
        id = editing.id
        toast.addToast('课程更新成功', 'success')
      } else {
        const res = await createCourse(form)
        id = res.data.data?.id
        toast.addToast('课程创建成功', 'success')
      }
      if (id && selectedClasses.length > 0) {
        await linkClasses(id, selectedClasses, new Date().getFullYear() + '-' + (new Date().getMonth() < 6 ? 'S' : 'F'))
      }
      setShowModal(false); setEditing(null); fetchCourses()
    } catch (e) { toast.addToast(e.response?.data?.message || '操作失败', 'error') }
  }

  const handleDelete = async (course) => {
    if (!confirm(`确定删除课程 "${course.name}"？`)) return
    try { await deleteCourse(course.id); toast.addToast('已删除', 'success'); fetchCourses() }
    catch (e) { toast.addToast(e.response?.data?.message || '删除失败', 'error') }
  }

  const columns = [
    { key: 'name', label: '课程名称', sortable: true },
    { key: 'code', label: '课程代码' },
    { key: 'teacher_name', label: '授课教师' },
    { key: 'class_count', label: '班级数' },
    { key: 'actions', label: '操作', render: (r) => (
      <div className="table-actions">
        <button className="btn-sm btn-secondary" onClick={() => {
          setEditing(r)
          setForm({ name: r.name, code: r.code || '', teacher_id: r.teacher_id || '', description: r.description || '' })
          setSelectedClasses([])
          setShowModal(true)
        }}><Edit2 size={14} /></button>
        <button className="btn-sm btn-danger" onClick={() => handleDelete(r)}><Trash2 size={14} /></button>
      </div>
    )},
  ]

  return (
    <div>
      <div className="page-header">
        <h1>课程管理</h1>
        <button className="btn-primary" onClick={() => { setEditing(null); setForm({ name: '', code: '', teacher_id: '', description: '' }); setSelectedClasses([]); setShowModal(true) }}>
          <Plus size={16} style={{ marginRight: 4 }} />新建课程
        </button>
      </div>
      <div className="card">
        <DataTable columns={columns} data={courses} loading={loading} />
      </div>

      {showModal && (
        <Modal title={editing ? '编辑课程' : '新建课程'} onClose={() => { setShowModal(false); setEditing(null) }}>
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>课程名称</label>
              <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
            </div>
            <div className="form-group">
              <label>课程代码</label>
              <input value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} />
            </div>
            <div className="form-group">
              <label>授课教师</label>
              <select value={form.teacher_id} onChange={e => setForm({ ...form, teacher_id: e.target.value })}>
                <option value="">请选择</option>
                {teachers.map(t => <option key={t.id} value={t.id}>{t.real_name || t.username}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>关联班级</label>
              <select multiple value={selectedClasses} onChange={e => setSelectedClasses(Array.from(e.target.selectedOptions, o => o.value))}
                style={{ minHeight: 100 }}>
                {classList.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
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
    </div>
  )
}
