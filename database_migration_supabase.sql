-- =====================================================================
-- PROXY-RESISTANT REAL-TIME QR-BASED SMART ATTENDANCE SYSTEM
-- CLOUD DATABASE MIGRATION SCRIPT (POSTGRESQL / SUPABASE)
-- =====================================================================

-- Enable pgcrypto for UUID generation if needed
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ---------------------------------------------------------------------
-- 1. TABLE: admins
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS admins (
    admin_id VARCHAR(50) PRIMARY KEY,
    full_name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_admins_email ON admins (LOWER(email));

-- ---------------------------------------------------------------------
-- 2. TABLE: teachers
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS teachers (
    teacher_id VARCHAR(50) PRIMARY KEY,
    full_name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(50),
    department VARCHAR(100) NOT NULL,
    designation VARCHAR(100) DEFAULT 'Faculty',
    password_hash VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_teachers_email ON teachers (LOWER(email));
CREATE INDEX IF NOT EXISTS idx_teachers_dept ON teachers (department);

-- ---------------------------------------------------------------------
-- 3. TABLE: students
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS students (
    id BIGSERIAL PRIMARY KEY,
    prn VARCHAR(50) UNIQUE NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(50),
    year VARCHAR(50) NOT NULL,
    branch VARCHAR(100) NOT NULL,
    division VARCHAR(10) NOT NULL,
    gender VARCHAR(20) DEFAULT 'Not Specified',
    face_folder VARCHAR(255),
    password_hash VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_students_prn ON students (prn);
CREATE INDEX IF NOT EXISTS idx_students_email ON students (LOWER(email));
CREATE INDEX IF NOT EXISTS idx_students_dept_year ON students (branch, year);

-- ---------------------------------------------------------------------
-- 4. TABLE: attendance_sessions
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS attendance_sessions (
    session_id VARCHAR(100) PRIMARY KEY,
    qr_token VARCHAR(100) NOT NULL,
    teacher_id VARCHAR(50) NOT NULL,
    subject VARCHAR(150) NOT NULL,
    department VARCHAR(100) NOT NULL,
    year VARCHAR(50) NOT NULL,
    lecture_date DATE NOT NULL DEFAULT CURRENT_DATE,
    start_time TIME NOT NULL DEFAULT CURRENT_TIME,
    end_time TIME,
    lat NUMERIC(10, 7),
    lng NUMERIC(10, 7),
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_session_teacher FOREIGN KEY (teacher_id) REFERENCES teachers (teacher_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_sessions_teacher ON attendance_sessions (teacher_id);
CREATE INDEX IF NOT EXISTS idx_sessions_dept_year ON attendance_sessions (department, year);
CREATE INDEX IF NOT EXISTS idx_sessions_status ON attendance_sessions (status);

-- ---------------------------------------------------------------------
-- 5. TABLE: attendance
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS attendance (
    attendance_id BIGSERIAL PRIMARY KEY,
    session_id VARCHAR(100) NOT NULL,
    teacher_id VARCHAR(50),
    student_name VARCHAR(255) NOT NULL,
    teacher_name VARCHAR(255),
    prn VARCHAR(50) NOT NULL,
    subject VARCHAR(150) NOT NULL,
    department VARCHAR(100) NOT NULL,
    year VARCHAR(50) NOT NULL,
    attendance_date DATE NOT NULL DEFAULT CURRENT_DATE,
    attendance_time TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(50) NOT NULL DEFAULT 'Present',
    leave_type VARCHAR(100),
    leave_comment TEXT,
    leave_verified SMALLINT DEFAULT 0,
    leave_marked_by VARCHAR(50),
    leave_marked_at TIMESTAMPTZ,
    CONSTRAINT fk_attendance_session FOREIGN KEY (session_id) REFERENCES attendance_sessions (session_id) ON DELETE CASCADE,
    CONSTRAINT uq_session_prn UNIQUE (session_id, prn)
);

CREATE INDEX IF NOT EXISTS idx_attendance_session ON attendance (session_id);
CREATE INDEX IF NOT EXISTS idx_attendance_prn ON attendance (prn);
CREATE INDEX IF NOT EXISTS idx_attendance_dept_year ON attendance (department, year, subject, attendance_date);

-- ---------------------------------------------------------------------
-- 6. ROW LEVEL SECURITY (RLS) POLICIES
-- ---------------------------------------------------------------------
ALTER TABLE admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE teachers ENABLE ROW LEVEL SECURITY;
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;

-- Allow public read access to verify accounts and sessions
CREATE POLICY "Public Read Admins" ON admins FOR SELECT USING (true);
CREATE POLICY "Public Read Teachers" ON teachers FOR SELECT USING (true);
CREATE POLICY "Public Read Students" ON students FOR SELECT USING (true);
CREATE POLICY "Public Read Sessions" ON attendance_sessions FOR SELECT USING (true);
CREATE POLICY "Public Read Attendance" ON attendance FOR SELECT USING (true);

-- Allow authenticated/service writes and deletions
CREATE POLICY "Allow Insert Admins" ON admins FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow Update Admins" ON admins FOR UPDATE USING (true);
CREATE POLICY "Allow Delete Admins" ON admins FOR DELETE USING (true);

CREATE POLICY "Allow Insert Teachers" ON teachers FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow Update Teachers" ON teachers FOR UPDATE USING (true);
CREATE POLICY "Allow Delete Teachers" ON teachers FOR DELETE USING (true);

CREATE POLICY "Allow Insert Students" ON students FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow Update Students" ON students FOR UPDATE USING (true);
CREATE POLICY "Allow Delete Students" ON students FOR DELETE USING (true);

CREATE POLICY "Allow Insert Sessions" ON attendance_sessions FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow Update Sessions" ON attendance_sessions FOR UPDATE USING (true);
CREATE POLICY "Allow Delete Sessions" ON attendance_sessions FOR DELETE USING (true);

CREATE POLICY "Allow Insert Attendance" ON attendance FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow Update Attendance" ON attendance FOR UPDATE USING (true);
CREATE POLICY "Allow Delete Attendance" ON attendance FOR DELETE USING (true);

-- ---------------------------------------------------------------------
-- 7. INITIAL MASTER DATA (INSTITUTIONAL FACULTY & ADMINS)
-- ---------------------------------------------------------------------

-- Admins
INSERT INTO admins (admin_id, full_name, email)
VALUES 
    ('ADM001', 'System Administrator', 'admin@ritindia.edu'),
    ('ADM002', 'HOD CSE-AIML', 'hod.aiml@ritindia.edu')
ON CONFLICT (admin_id) DO UPDATE SET 
    full_name = EXCLUDED.full_name,
    email = EXCLUDED.email;

-- Teachers
INSERT INTO teachers (teacher_id, full_name, email, phone, department, designation)
VALUES 
    ('TCH001', 'Dr. K. K. Tangod', 'kk.tangod@ritindia.edu', '9876543210', 'AIML', 'Associate Professor & Guide'),
    ('TCH002', 'Prof. Example Teacher', 'teacher@ritindia.edu', '9876543211', 'AIML', 'Assistant Professor')
ON CONFLICT (teacher_id) DO UPDATE SET 
    full_name = EXCLUDED.full_name,
    email = EXCLUDED.email,
    department = EXCLUDED.department,
    designation = EXCLUDED.designation;

-- Note: Students enroll fresh through the Web Portal ("New Student? Register here")
-- with their actual live webcam photos and verified academic details.
