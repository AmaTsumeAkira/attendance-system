import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { getDb } from './db.js';

const db = getDb();

console.log('🌱 Seeding database...');

// Clear existing data
db.exec(`
  DELETE FROM audit_logs;
  DELETE FROM system_config;
  DELETE FROM user_status;
  DELETE FROM attendance_records;
  DELETE FROM leave_requests;
  DELETE FROM schedule_templates;
  DELETE FROM sessions;
  DELETE FROM course_classes;
  DELETE FROM courses;
  DELETE FROM class_students;
  DELETE FROM classes;
  DELETE FROM grades;
  DELETE FROM users;
`);

const t = new Date().toISOString().slice(0, 19).replace('T', ' ');

// --- Users ---
const hash = (pw) => bcrypt.hashSync(pw, 10);

const insertUser = db.prepare(`
  INSERT INTO users (username, password_hash, real_name, role, student_id, phone, email, status, created_at, updated_at)
  VALUES (?,?,?,?,?,?,?,?,?,?)
`);

// Admin
insertUser.run('admin', hash('admin123'), '系统管理员', 'super_admin', '', '13800000000', 'admin@school.edu', 'active', t, t);

// Teachers
insertUser.run('teacher1', hash('teacher123'), '张老师', 'teacher', '', '13800000001', 'teacher1@school.edu', 'active', t, t);
insertUser.run('teacher2', hash('teacher123'), '李老师', 'teacher', '', '13800000002', 'teacher2@school.edu', 'active', t, t);

// Students
for (let i = 1; i <= 10; i++) {
  const num = String(i).padStart(2, '0');
  const names = ['王小明', '李小红', '张小华', '刘小强', '陈小芳', '杨小伟', '赵小丽', '黄小军', '周小燕', '吴小刚'];
  insertUser.run(`student${num}`, hash('student123'), names[i - 1], 'student', `2024${num}`, `1390000${num}`, `student${num}@school.edu`, 'active', t, t);
}

console.log('  ✅ Users created');

// --- Grades ---
const insertGrade = db.prepare('INSERT INTO grades (name, description, created_at, updated_at) VALUES (?,?,?,?)');
insertGrade.run('2023级', '2023年入学', t, t);
insertGrade.run('2024级', '2024年入学', t, t);

console.log('  ✅ Grades created');

// --- Classes ---
const insertClass = db.prepare('INSERT INTO classes (name, grade_id, description, created_at, updated_at) VALUES (?,?,?,?,?)');
insertClass.run('计算机1班', 1, '2023级计算机科学与技术1班', t, t);
insertClass.run('计算机2班', 1, '2023级计算机科学与技术2班', t, t);
insertClass.run('软件工程班', 2, '2024级软件工程班', t, t);

console.log('  ✅ Classes created');

// --- Class Students ---
const insertCS = db.prepare('INSERT INTO class_students (class_id, user_id, created_at) VALUES (?,?,?)');
// Class 1: students 1-4
for (let i = 1; i <= 4; i++) insertCS.run(1, i + 3, t); // user_id 4-7
// Class 2: students 5-7
for (let i = 5; i <= 7; i++) insertCS.run(2, i + 3, t); // user_id 8-10
// Class 3: students 8-10
for (let i = 8; i <= 10; i++) insertCS.run(3, i + 3, t); // user_id 11-13

console.log('  ✅ Class students assigned');

// --- Courses ---
const insertCourse = db.prepare('INSERT INTO courses (name, code, description, teacher_id, semester, created_at, updated_at) VALUES (?,?,?,?,?,?,?)');
insertCourse.run('高等数学', 'MATH101', '高等数学A', 2, '2024-2025-1', t, t);
insertCourse.run('大学英语', 'ENG101', '大学英语B', 3, '2024-2025-1', t, t);
insertCourse.run('数据结构', 'CS201', '数据结构与算法', 2, '2024-2025-1', t, t);
insertCourse.run('操作系统', 'CS301', '操作系统原理', 3, '2024-2025-1', t, t);

console.log('  ✅ Courses created');

// --- Course Classes ---
const insertCC = db.prepare('INSERT INTO course_classes (course_id, class_id, semester, created_at) VALUES (?,?,?,?)');
insertCC.run(1, 1, '2024-2025-1', t); // 高数 - 计算机1班
insertCC.run(1, 2, '2024-2025-1', t); // 高数 - 计算机2班
insertCC.run(2, 1, '2024-2025-1', t); // 英语 - 计算机1班
insertCC.run(2, 3, '2024-2025-1', t); // 英语 - 软件工程班
insertCC.run(3, 1, '2024-2025-1', t); // 数据结构 - 计算机1班
insertCC.run(3, 2, '2024-2025-1', t); // 数据结构 - 计算机2班
insertCC.run(4, 3, '2024-2025-1', t); // 操作系统 - 软件工程班

console.log('  ✅ Course-class associations created');

// --- Sessions ---
const insertSession = db.prepare(`
  INSERT INTO sessions (course_id, class_id, title, session_date, start_time, end_time, status, late_threshold_min, auto_end_min, created_by, created_at, updated_at)
  VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
`);

// Today's sessions
const today = new Date().toISOString().slice(0, 10);
insertSession.run(1, 1, '高等数学第10周', today, '08:00', '09:40', 'scheduled', 10, 60, 2, t, t);
insertSession.run(3, 1, '数据结构第10周', today, '10:00', '11:40', 'active', 10, 60, 2, t, t);
insertSession.run(2, 3, '大学英语第10周', today, '14:00', '15:40', 'scheduled', 10, 60, 3, t, t);

// Past sessions
const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
insertSession.run(1, 1, '高等数学第9周', yesterday, '08:00', '09:40', 'ended', 10, 60, 2, t, t);
insertSession.run(3, 1, '数据结构第9周', yesterday, '10:00', '11:40', 'ended', 10, 60, 2, t, t);

console.log('  ✅ Sessions created');

// --- Attendance Records for ended sessions ---
const insertAR = db.prepare(`
  INSERT INTO attendance_records (session_id, user_id, class_id, course_id, status, check_in_time, check_in_method, created_at, updated_at)
  VALUES (?,?,?,?,?,?,?,?,?)
`);

// Session 4 (ended, class 1, students 4-7)
const statuses = ['present', 'present', 'late', 'present'];
for (let i = 0; i < 4; i++) {
  insertAR.run(4, i + 4, 1, 1, statuses[i], yesterday + ' 08:0' + (i + 5), 'qr', t, t);
}
// Session 5 (ended, class 1, students 4-7)
for (let i = 0; i < 4; i++) {
  const st = i === 2 ? 'absent' : 'present';
  insertAR.run(5, i + 4, 1, 3, st, st === 'present' ? yesterday + ' 10:0' + (i + 5) : null, 'qr', t, t);
}
// Session 2 (active, class 1, partially checked in)
insertAR.run(2, 4, 1, 3, 'present', today + ' 10:05', 'qr', t, t);
insertAR.run(2, 5, 1, 3, 'absent', null, '', t, t);
insertAR.run(2, 6, 1, 3, 'absent', null, '', t, t);
insertAR.run(2, 7, 1, 3, 'absent', null, '', t, t);

console.log('  ✅ Attendance records created');

// --- Schedule Templates ---
const insertST = db.prepare('INSERT INTO schedule_templates (course_id, class_id, semester, day_of_week, start_time, end_time, location, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?)');
insertST.run(1, 1, '2024-2025-1', 1, '08:00', '09:40', '教学楼A101', t, t);
insertST.run(1, 2, '2024-2025-1', 3, '08:00', '09:40', '教学楼A102', t, t);
insertST.run(3, 1, '2024-2025-1', 2, '10:00', '11:40', '教学楼B201', t, t);
insertST.run(3, 2, '2024-2025-1', 4, '10:00', '11:40', '教学楼B202', t, t);
insertST.run(2, 1, '2024-2025-1', 3, '14:00', '15:40', '教学楼C301', t, t);
insertST.run(2, 3, '2024-2025-1', 5, '14:00', '15:40', '教学楼C302', t, t);
insertST.run(4, 3, '2024-2025-1', 1, '10:00', '11:40', '教学楼D401', t, t);

console.log('  ✅ Schedule templates created');

// --- System Config ---
const insertConfig = db.prepare('INSERT OR IGNORE INTO system_config (key, value, updated_at) VALUES (?,?,?)');
insertConfig.run('site_name', '智能考勤系统', t);
insertConfig.run('late_threshold', '10', t);

console.log('  ✅ System config created');

// --- Semesters ---
const insertSemester = db.prepare('INSERT INTO semesters (name, start_date, end_date, is_current, created_at) VALUES (?,?,?,?,?)');
insertSemester.run('2023-2024-1', '2023-09-01', '2024-01-15', 0, t);
insertSemester.run('2023-2024-2', '2024-02-20', '2024-07-05', 0, t);
insertSemester.run('2024-2025-1', '2024-09-01', '2025-01-15', 1, t);
insertSemester.run('2024-2025-2', '2025-02-24', '2025-07-04', 0, t);

console.log('  ✅ Semesters created');

console.log('\n🎉 Seed complete!');
console.log('\n📋 Accounts:');
console.log('   admin / admin123 (super_admin)');
console.log('   teacher1 / teacher123 (teacher)');
console.log('   teacher2 / teacher123 (teacher)');
console.log('   student01~10 / student123 (student)');

process.exit(0);
