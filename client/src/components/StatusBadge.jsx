export default function StatusBadge({ status }) {
  const map = {
    present: '已签到', absent: '缺勤', late: '迟到', leave: '请假',
    active: '进行中', scheduled: '已排课', ended: '已结束', cancelled: '已取消',
    pending: '待审批', approved: '已批准', rejected: '已拒绝', cancelled_leave: '已取消',
  }
  return <span className={`badge badge-${status}`}>{map[status] || status}</span>
}
