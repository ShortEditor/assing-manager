# Marks Tracker — Assignment & Marks Management System

An institutional web platform designed to streamline student assignments, grading workflows, and performance tracking. Built using **Next.js 15 (App Router)**, **TailwindCSS**, and **Firebase Firestore**, this platform bridges the gap between administrators, teaching staff, and students with real-time syncing, spreadsheet-style grading, and gamified engagement metrics.

---

## 📄 Abstract

### 1. Introduction
In modern academic environments, managing student assignments, grading criteria, and mark records remains a highly repetitive task. Existing learning management systems (LMS) are often bloated, slow, and lack streamlined grid-input tools for instructors or engaging elements for students. **Marks Tracker** is a lightweight, responsive, and high-performance solution tailored to academic departments. It simplifies administration, accelerates grading, and motivates students through positive reinforcement.

### 2. Architecture & Design
The system utilizes a secure Role-Based Access Control (RBAC) architecture, segregating capabilities into three specific dashboards:
* **HOD / Super Admin:** Manages institutional records, resets credentials, maps course subjects, and oversees staff allocations.
* **Staff:** Creates course-specific assignments, grades student submissions with real-time spreadsheet-style inputs, and exports consolidated reports.
* **Student:** Tracks pending assignments, visualizes subject-wise marks progress, and competes on a semester-wide leader board.

### 3. Core Highlights
* **Real-time Synchronization:** Built directly on top of Firebase Firestore, updates to marks and student statuses propagate across the platform instantly.
* **Spreadsheet UX for Instructors:** Eliminates unnecessary modal popups and save clicks. Staff can enter marks directly, which autosyncs to the cloud on field blur or pressing **Enter**.
* **Gamification & Positive Reinforcement:** Implements a dynamic, timestamp-based early submission bonus algorithm and a real-time semester leaderboard to encourage students to beat deadlines.

---

## 🛠️ Feature Directory

### 👑 1. HOD & Super Admin Dashboard
* **Staff Management:**
  * Add teaching staff members with auto-generated credential PINs.
  * Reset passwords/PINs for staff with custom text overrides.
  * Cascade delete staff: Deleting a staff member automatically unassigns their subjects, deletes their assignments, and deletes all associated student grades/submissions in a single database transaction.
* **Student Management:**
  * **Add Individual Student:** Create individual records with Name, Roll Number, Year, and Semester.
  * **Bulk Student Generation:** Sequentially generate student cohorts with custom base roll numbers (e.g. `23N81A0501`) and credentials.
  * **CSV Roster Import:** Parse and ingest student lists from standard `.csv` files.
  * **Interactive Table Data:** Sort students ascending or descending by Name or Roll Number, and filter the registry by Class, Year, and Semester.
  * **Inline Name Editing:** Click directly on a student's name in the registry table, edit it inline, and save instantly via **Enter** (or cancel with **Escape**).
* **Subject Mapping:** Allocate course subjects and assign them to specific staff members.
* **Assignment Audits:** View and monitor all assignments created across the department.

### 👨‍🏫 2. Staff Portal
* **Assignment Management:** Create new assignments with specific titles, types (assignment, lab, project), due dates, and maximum marks.
* **Direct Grid-style Grading:** 
  * Remove status dropdown menus. Staff enter marks directly into input cells.
  * **Auto-Sync:** Changes write to Firestore automatically on `onBlur` or pressing **Enter**.
  * **Auto-Status badges:** If a mark cell is empty, the status displays as `Not Submitted`. If a mark is entered, it instantly changes to `Graded`.
* **Grading Validation:** Restricts input ranges dynamically. Entering scores below `0` or exceeding the assignment's maximum marks is blocked, triggering warning alerts.
* **Data Exporting:** Generate and download custom formatted Excel sheets (`.xlsx`) containing subject codes, maximum marks, student names, roll numbers, and grades.

### 🎓 3. Student Portal
* **Personalized Dashboard:** View active assignments grouped by status, with due dates and subject identifiers.
* **Visual Marks Summary:** Interactive bar charts (using Recharts) displaying academic progress percentages, accompanied by subject-wise progress bars.
* **Semester Leaderboard:** A semester-wide ranking list featuring 🥇, 🥈, and 🥉 trophies for the top three scorers, and showing the student's own position (e.g. `#1 of 53 students`).
* **Dynamic Early Submission Bonus:** To encourage early work, extra points (up to `+5 pts`) are dynamically awarded based on the submission timestamp relative to the assignment duration:
  $$\text{Bonus} = \text{Min}\left(1, \text{Max}\left(0, \frac{\text{Due Date} - \text{Submission Date}}{\text{Due Date} - \text{Created Date}}\right)\right) \times 5$$

---

## 🗄️ Database Architecture

The system utilizes Firebase Firestore with the following collection structures:

### `staff` Collection
```typescript
interface StaffDoc {
  id: string;        // Firebase Auth UID / Document ID
  name: string;
  staffCode: string; // Used as Login Username
  pin: string;       // Login password
  role: 'staff';
}
```

### `students` Collection
```typescript
interface StudentDoc {
  id: string;
  name: string;
  rollNo: string;    // Used as Login ID
  class: string;     // e.g., 'CME'
  year: number;      // 1, 2, 3
  semester: number;  // 1, 2, 3, 4, 5
  section: string;   // Defaults to 'A'
  admissionYear: number;
  pin: string;       // Retained internally (Student logins are password-less)
  createdBy: string;
}
```

### `assignments` Collection
```typescript
interface AssignmentDoc {
  id: string;
  title: string;
  subjectId: string;
  dueDate: Date;
  maxMarks: number;
  type: 'assignment' | 'lab' | 'project';
  createdBy: string; // Staff ID
  createdAt: Date;
}
```

### `submissions` Collection
```typescript
interface SubmissionDoc {
  id: string;          // Document ID (assignmentId_studentId)
  assignmentId: string;
  studentId: string;
  subjectId: string;
  status: 'not_submitted' | 'submitted' | 'graded' | 'late';
  marks: number | null;
  remarks: string | null;
  correctedBy: string | null;
  updatedAt: Date;
}
```

---

## 🚀 Installation & Local Setup

### 1. Clone & Install Dependencies
```bash
git clone https://github.com/ShortEditor/assing-manager.git
cd assing-manager
npm install
```

### 2. Configure Environment Variables
Create a `.env.local` file at the project root and enter your Firebase web app config parameters:
```env
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_auth_domain
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_storage_bucket
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
```

### 3. Bootstrap Super Admin
To create the initial HOD/Super Admin account, run the setup script:
```bash
node scripts/create-admin.mjs
```

### 4. Run Development Server
```bash
npm run dev
```
Open **[http://localhost:3000](http://localhost:3000)** in your browser to access the system.
