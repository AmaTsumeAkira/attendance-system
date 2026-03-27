import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { getNotifications, markRead, markAllRead, deleteNotification } from '../api/notifications'
import { useToast } from '../components/Toast'
import DataTable from '../components/DataTable'
import { Bell, Check, CheckCheck, Trash2 } from 'lucide-react'

const typeLabels = {
  checkin_reminder: '签到提醒',
  absence_alert: '缺勤通知',
  leave_result: '请假结果',
  system: '系统通知',
}

export default function Notifications() {
  const [items, setItems] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('')
  const toast = useToast()
  const navigate = useNavigate()
  const limit = 20

  const fetchList = useCallback(async () => {
    setLoading(true)
    try {
      const params = { page, limit }
      if (filter !== '') params.is_read = filter
      const res = await getNotifications(params)
      const data = res.data.data
      setItems(data?.items || [])
      setTotal(data?.total || 0)
    } catch { toast.addToast('获取通知失败', 'error') }
    finally { setLoading(false) }
  }, [page, filter, toast])

  useEffect(() => { fetchList() }, [fetchList])

  const handleMarkRead = async (id, link) => {
    try {
      await markRead(id)
      if (link) navigate(link)
      fetchList()
    } catch { toast.addToast('操作失败', 'error') }
  }

  const handleMarkAllRead = async () => {
    try {
      await markAllRead()
      toast.addToast('已全部标记已读', 'success')
      fetchList()
    } catch { toast.addToast('操作失败', 'error') }
  }

  const handleDelete = async (id) => {
    if (!confirm('确定删除此通知？')) return
    try {
      await deleteNotification(id)
      toast.addToast('已删除', 'success')
      fetchList()
    } catch { toast.addToast('操作失败', 'error') }
  }

  const columns = [
    { key: 'type', label: '类型', width: 100, render: (r) => typeLabels[r.type] || r.type },
    { key: 'title', label: '标题', width: 180, render: (r) => (
      <span style={{ fontWeight: r.is_read ? 'normal' : 600 }}>{r.title}</span>
    )},
    { key: 'content', label: '内容', render: (r) => (
      <span style={{ color: 'var(--text-secondary)', fontSize: 13 }}>{r.content}</span>
    )},
    { key: 'created_at', label: '时间', width: 160 },
    { key: 'is_read', label: '状态', width: 80, render: (r) => (
      <span style={{ color: r.is_read ? 'var(--text-secondary)' : '#2563eb', fontWeight: r.is_read ? 'normal' : 600 }}>
        {r.is_read ? '已读' : '未读'}
      </span>
    )},
    { key: 'actions', label: '操作', width: 120, render: (r) => (
      <div className="table-actions">
        {!r.is_read && (
          <button className="btn-sm btn-success" title="标记已读" onClick={() => handleMarkRead(r.id, r.link)}>
            <Check size={14} />
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
        <h1><Bell size={20} style={{ marginRight: 8 }} />通知中心</h1>
        <button className="btn-secondary" onClick={handleMarkAllRead}>
          <CheckCheck size={16} style={{ marginRight: 4 }} />全部已读
        </button>
      </div>

      <div className="filter-bar">
        <select value={filter} onChange={e => { setFilter(e.target.value); setPage(1) }}>
          <option value="">全部通知</option>
          <option value="0">未读</option>
          <option value="1">已读</option>
        </select>
      </div>

      <div className="card">
        <DataTable columns={columns} data={items} loading={loading} page={page} total={total} limit={limit} onPageChange={setPage} />
      </div>
    </div>
  )
}
