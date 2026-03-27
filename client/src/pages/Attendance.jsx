import { useState, useEffect, useCallback } from 'react'
import { getAttendances, updateAttendance, exportAttendances } from '../api/attendance'
import { getCourses } from '../api/courses'
import { getClasses } from '../api/classes'
import { useToast } from '../components/Toast'
import DataTable from '../components/DataTable'
import Modal from '../components/Modal'
import StatusBadge from '../components/StatusBadge'
import DatePicker from '../components/DatePicker'
import { Download, Edit2, Search } from 'lucide-react'
import { format } from 'date-fns'

export default function Attendance() {
  const [records, setRecords] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [courses, setCourses] = useState([])
  const [classList, setClassList] = useState([])
  const toast = useToast()
  const limit = 20

  const [dateFilter, setDateFilter] = useState('')
  const [classFilter, setClassFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [editing, setEditing] = useState(null)
  const [newStatus, setNewStatus] = useState('')

  const fetchRecords = useCallback(async () => {
    setLoading(true)
    try {
      const params = { page, limit }
      if (dateFilter) params.date = dateFilter
      if (classFilter) params.class_id = classFilter
      if (statusFilter) params.status = statusFilter
      const res = await getAttendances(params)
      const data = res.data.data
      setRecords(data?.items || [])
      setTotal(data?.total || 0)
    } catch { toast.addToast('获取记录失败', 'error') }
    finally { setLoading(false) }
  }, [page, dateFilter, classFilter, statusFilter, toast])

  useEffect(() => { fetchRecords() }, [fetchRecords])

  useEffect(() => {
    getCourses().then(r => setCourses(r.data.data?.items || r.data.data || []))
    getClasses().then(r => setClassList(r.data.data?.items || r.data.data || []))
  }, [])

  const handleExport = async () => {
    try {
      const params = {}
      if (dateFilter) params.start_date = dateFilter
      if (classFilter) params.class_id = classFilter
      const res = await exportAttendances(params)
      const blob = new Blob([res.data], { type: 'text/csv' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = `attendance_${format(new Date(), 'yyyyMMdd')}.csv`; a.click()
      URL.revokeObjectURL(url)
      toast.addToast('导出成功', 'success')
    } catch { toast.addToast('导出失败', 'error') }
  }

  const handleUpdate = async () => {
    if (!editing || !newStatus) return
    try {
      await updateAttendance(editing.id, { status: newStatus })
      toast.addToast('补签成功', 'success')
      setEditing(null); fetchRecords()
    } catch (e) { toast.addToast(e.response?.data?.message || '操作失败', 'error') }
  }

  const columns = [
    { key: 'user_name', label: '姓名', sortable: true },
    { key: 'course_name', label: '课程' },
    { key: 'class_name', label: '班级' },
    { key: 'date', label: '日期', sortable: true },
    { key: 'check_in_time', label: '签到时间', render: (r) => r.check_in_time ? format(new Date(r.check_in_time), 'HH:mm:ss') : '-' },
    { key: 'status', label: '状态', render: (r) => <StatusBadge status={r.status} /> },
    { key: 'actions', label: '操作', render: (r) => (
      <button className="btn-sm btn-secondary" onClick={() => { setEditing(r); setNewStatus(r.status) }}><Edit2 size={14} /> 补签</button>
    )},
  ]

  return (
    <div>
      <div className="page-header">
        <h1>出勤记录</h1>
        <button className="btn-secondary" onClick={handleExport}><Download size={16} style={{ marginRight: 4 }} />导出 CSV</button>
      </div>

      <div className="filter-bar">
        <DatePicker value={dateFilter} onChange={(v) => { setDateFilter(v); setPage(1) }} />
        <select value={classFilter} onChange={e => { setClassFilter(e.target.value); setPage(1) }}>
          <option value="">全部班级</option>
          {classList.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1) }}>
          <option value="">全部状态</option>
          <option value="present">已签到</option>
          <option value="absent">缺勤</option>
          <option value="late">迟到</option>
          <option value="leave">请假</option>
        </select>
      </div>

      <div className="card">
        <DataTable columns={columns} data={records} loading={loading} page={page} total={total} limit={limit} onPageChange={setPage} />
      </div>

      {editing && (
        <Modal title="补签" onClose={() => setEditing(null)}>
          <p style={{ marginBottom: 16 }}>
            为 <strong>{editing.user_name}</strong> 修改 {editing.date} 的出勤状态
          </p>
          <div className="form-group">
            <label>状态</label>
            <select value={newStatus} onChange={e => setNewStatus(e.target.value)}>
              <option value="present">已签到</option>
              <option value="absent">缺勤</option>
              <option value="late">迟到</option>
              <option value="leave">请假</option>
            </select>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
            <button className="btn-secondary" onClick={() => setEditing(null)}>取消</button>
            <button className="btn-primary" onClick={handleUpdate}>确认补签</button>
          </div>
        </Modal>
      )}
    </div>
  )
}
