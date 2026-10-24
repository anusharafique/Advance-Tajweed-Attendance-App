const MAX_STUDENTS = 20;
const MAX_MARKS = 10;
const STORAGE_KEY = "advanceTajweedBatch19";

let state = loadState();
let attendanceDraft = {};
let toastTimer;

function loadState() {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (!saved) return { students: [], records: {} };

        const parsed = JSON.parse(saved);

        if (!Array.isArray(parsed.students) || !parsed.records ||
            typeof parsed.records !== "object") {
            throw new Error("Invalid saved data");
        }

        return parsed;
    } catch (error) {
        console.error("Could not load saved data:", error);
        return { students: [], records: {} };
    }
}

function saveState() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
        return true;
    } catch (error) {
        console.error("Could not save data:", error);
        showToast("Storage failed. Please export or back up your data.");
        return false;
    }
}

function today() {
    const now = new Date();
    const localDate = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
    return localDate.toISOString().slice(0, 10);
}

function escapeHTML(value) {
    return String(value).replace(/[&<>"']/g, char => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[char]);
}

function showToast(message) {
    const toast = document.getElementById("toast");
    toast.textContent = message;
    toast.classList.add("show");

    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("show"), 3000);
}

function sortedDates() {
    return Object.keys(state.records).sort((a, b) => b.localeCompare(a));
}

function getRecord(date) {
    return state.records[date];
}

function getStatus(date, studentId) {
    const record = getRecord(date);
    if (!record || !Object.prototype.hasOwnProperty.call(record.attendance, studentId)) {
        return null;
    }
    return record.attendance[studentId];
}

function formatDate(date) {
    if (!date) return "—";
    const parts = date.split("-");
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

function avatar(name) {
    return escapeHTML(name.trim().charAt(0).toUpperCase() || "?");
}

function studentName(studentId) {
    const student = state.students.find(item => item.id === studentId);
    return student ? student.name : "Removed student";
}

function goToPage(pageId) {
    const target = document.getElementById(pageId);
    if (!target) return;

    document.querySelectorAll(".page").forEach(page => {
        page.classList.toggle("active-page", page.id === pageId);
    });

    document.querySelectorAll(".nav-link").forEach(link => {
        link.classList.toggle("active", link.dataset.page === pageId);
    });

    const titles = {
        dashboard: "Dashboard",
        students: "Students",
        attendance: "Daily Attendance",
        history: "Attendance History",
        results: "Final Marks"
    };

    document.getElementById("pageTitle").textContent = titles[pageId] || "Dashboard";
    document.getElementById("sidebar").classList.remove("open");

    if (pageId === "attendance") renderAttendance();
    if (pageId === "students") renderStudents();
    if (pageId === "history") renderHistory();
    if (pageId === "results") renderResults();
    if (pageId === "dashboard") renderDashboard();

    window.scrollTo({ top: 0, behavior: "smooth" });
}

function renderDashboard() {
    const date = document.getElementById("attendanceDate").value || today();
    const record = getRecord(date);

    document.getElementById("totalStudents").textContent = state.students.length;
    document.getElementById("totalClasses").textContent = Object.keys(state.records).length;

    const statuses = record ? Object.values(record.attendance) : [];
    document.getElementById("presentToday").textContent =
        statuses.filter(status => status === "present").length;
    document.getElementById("absentToday").textContent =
        statuses.filter(status => status === "absent").length;

    const dates = sortedDates().slice(0, 5);
    const container = document.getElementById("recentAttendance");

    if (!dates.length) {
        container.innerHTML = '<div class="empty-state">No attendance records yet.</div>';
        return;
    }

    container.innerHTML = `
        <table>
            <thead><tr><th>DATE</th><th>PRESENT</th><th>ABSENT</th><th>TOTAL</th></tr></thead>
            <tbody>
                ${dates.map(date => {
                    const values = Object.values(state.records[date].attendance);
                    return `<tr>
                        <td>${formatDate(date)}</td>
                        <td>${values.filter(v => v === "present").length}</td>
                        <td>${values.filter(v => v === "absent").length}</td>
                        <td>${values.length}</td>
                    </tr>`;
                }).join("")}
            </tbody>
        </table>`;
}

function renderStudents() {
    document.getElementById("studentCount").textContent =
        `${state.students.length} / ${MAX_STUDENTS} Students`;

    const query = document.getElementById("studentSearch").value.trim().toLowerCase();
    const students = state.students.filter(student =>
        student.name.toLowerCase().includes(query) ||
        student.roll.toLowerCase().includes(query)
    );

    const container = document.getElementById("studentsTable");

    if (!students.length) {
        container.innerHTML = '<div class="empty-state">No students found. Add your first student above.</div>';
        return;
    }

    container.innerHTML = `
        <table>
            <thead><tr><th>STUDENT</th><th>ROLL NUMBER</th><th>ACTION</th></tr></thead>
            <tbody>
                ${students.map(student => `
                    <tr>
                        <td><span class="student-avatar">${avatar(student.name)}</span>${escapeHTML(student.name)}</td>
                        <td>${escapeHTML(student.roll)}</td>
                        <td><button class="small-btn delete-btn" data-delete="${escapeHTML(student.id)}">Delete</button></td>
                    </tr>
                `).join("")}
            </tbody>
        </table>`;
}

function renderAttendance() {
    const date = document.getElementById("attendanceDate").value || today();
    const savedRecord = getRecord(date);

    state.students.forEach(student => {
        if (!Object.prototype.hasOwnProperty.call(attendanceDraft, student.id)) {
            attendanceDraft[student.id] = getStatus(date, student.id) || "present";
        }
    });

    Object.keys(attendanceDraft).forEach(id => {
        if (!state.students.some(student => student.id === id)) {
            delete attendanceDraft[id];
        }
    });

    const list = document.getElementById("attendanceList");

    if (!state.students.length) {
        list.innerHTML = '<div class="empty-state">Please add students before taking attendance.</div>';
        updateAttendanceSummary();
        return;
    }

    list.innerHTML = state.students.map(student => {
        const status = attendanceDraft[student.id] || "present";

        return `
            <div class="attendance-row">
                <div class="student-details">
                    <span class="student-avatar">${avatar(student.name)}</span>
                    <div>
                        <strong>${escapeHTML(student.name)}</strong>
                        <small>${escapeHTML(student.roll)}</small>
                    </div>
                </div>
                <div class="status-options">
                    <button class="status-btn present ${status === "present" ? "selected" : ""}"
                        data-status="${student.id}" data-value="present"
                        aria-pressed="${status === "present"}">✓ Present</button>
                    <button class="status-btn absent ${status === "absent" ? "selected" : ""}"
                        data-status="${student.id}" data-value="absent"
                        aria-pressed="${status === "absent"}">✕ Absent</button>
                </div>
            </div>`;
    }).join("");

    updateAttendanceSummary();

    if (savedRecord) {
        // Existing saved attendance is loaded for this date.
    }
}

function updateAttendanceSummary() {
    const values = state.students.map(student => attendanceDraft[student.id] || "present");
    document.getElementById("attendancePresent").textContent =
        values.filter(v => v === "present").length;
    document.getElementById("attendanceAbsent").textContent =
        values.filter(v => v === "absent").length;
    document.getElementById("attendanceTotal").textContent = values.length;
}

function renderHistory() {
    const container = document.getElementById("historyTable");
    const dates = sortedDates();

    if (!dates.length) {
        container.innerHTML = '<div class="empty-state">No saved classes to display yet.</div>';
        return;
    }

    container.innerHTML = `
        <table>
            <thead><tr><th>CLASS DATE</th><th>PRESENT</th><th>ABSENT</th><th>RECORDED</th><th>ACTION</th></tr></thead>
            <tbody>
                ${dates.map(date => {
                    const values = Object.values(state.records[date].attendance);
                    return `<tr>
                        <td>${formatDate(date)}</td>
                        <td>${values.filter(v => v === "present").length}</td>
                        <td>${values.filter(v => v === "absent").length}</td>
                        <td>${values.length} / ${state.students.length}</td>
                        <td><button class="small-btn" data-edit-date="${date}">Edit</button></td>
                    </tr>`;
                }).join("")}
            </tbody>
        </table>`;
}

function renderResults() {
    const container = document.getElementById("resultsTable");
    const dates = sortedDates();
    const totalClasses = dates.length;

    if (!state.students.length) {
        container.innerHTML = '<div class="empty-state">Add students to calculate their marks.</div>';
        return;
    }

    container.innerHTML = `
        <table>
            <thead><tr><th>STUDENT</th><th>PRESENT</th><th>ABSENT</th><th>ATTENDANCE</th><th>MARKS / 10</th></tr></thead>
            <tbody>
                ${state.students.map(student => {
                    let present = 0;
                    let absent = 0;

                    dates.forEach(date => {
                        const status = getStatus(date, student.id);
                        if (status === "present") present++;
                        if (status === "absent") absent++;
                    });

                    const recorded = present + absent;
                    const percentage = recorded ? (present / recorded) * 100 : null;
                    const marks = recorded ? (present / recorded) * MAX_MARKS : null;

                    return `<tr>
                        <td><span class="student-avatar">${avatar(student.name)}</span>${escapeHTML(student.name)}</td>
                        <td>${present}</td>
                        <td>${absent}</td>
                        <td>${percentage === null ? "—" : percentage.toFixed(1) + "%"}</td>
                        <td class="mark-value">${marks === null ? "—" : marks.toFixed(2) + " / 10"}</td>
                    </tr>`;
                }).join("")}
            </tbody>
        </table>
        ${!totalClasses ? '<div class="empty-state">Record at least one class to calculate marks.</div>' : ""}
    `;
}

document.getElementById("studentForm").addEventListener("submit", event => {
    event.preventDefault();

    if (state.students.length >= MAX_STUDENTS) {
        showToast(`You can add a maximum of ${MAX_STUDENTS} students.`);
        return;
    }

    const name = document.getElementById("studentName").value.trim();
    const roll = document.getElementById("rollNumber").value.trim();

    if (!name || !roll) {
        showToast("Please enter the student name and roll number.");
        return;
    }

    const duplicate = state.students.some(student =>
        student.roll.toLowerCase() === roll.toLowerCase()
    );

    if (duplicate) {
        showToast("This roll number already exists.");
        return;
    }

    state.students.push({
        id: (crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random())),
        name,
        roll
    });

    if (!saveState()) {
        state.students.pop();
        return;
    }

    event.target.reset();
    renderStudents();
    renderDashboard();
    renderAttendance();
    showToast("Student added successfully! ✨");
});

document.getElementById("studentSearch").addEventListener("input", renderStudents);

document.getElementById("studentsTable").addEventListener("click", event => {
    const button = event.target.closest("[data-delete]");
    if (!button) return;

    const id = button.dataset.delete;
    const student = state.students.find(item => item.id === id);
    if (!student) return;

    if (!confirm(`Delete ${student.name}? Their attendance entries will also be removed.`)) return;

    const previousState = JSON.stringify(state);

    state.students = state.students.filter(item => item.id !== id);

    Object.values(state.records).forEach(record => {
        delete record.attendance[id];
    });

    delete attendanceDraft[id];

    if (!saveState()) {
        state = JSON.parse(previousState);
        return;
    }

    renderStudents();
    renderAttendance();
    renderHistory();
    renderResults();
    renderDashboard();
    showToast("Student deleted.");
});

document.getElementById("attendanceList").addEventListener("click", event => {
    const button = event.target.closest("[data-status]");
    if (!button) return;

    attendanceDraft[button.dataset.status] = button.dataset.value;
    renderAttendance();
});

document.getElementById("markAllPresent").addEventListener("click", () => {
    state.students.forEach(student => {
        attendanceDraft[student.id] = "present";
    });
    renderAttendance();
});

document.getElementById("attendanceDate").addEventListener("change", event => {
    attendanceDraft = {};
    const date = event.target.value;

    state.students.forEach(student => {
        attendanceDraft[student.id] = getStatus(date, student.id) || "present";
    });

    renderAttendance();
    renderDashboard();
});

document.getElementById("saveAttendance").addEventListener("click", () => {
    const date = document.getElementById("attendanceDate").value;

    if (!date) {
        showToast("Please select a class date.");
        return;
    }

    if (date > today()) {
        showToast("You cannot record attendance for a future date.");
        return;
    }

    if (!state.students.length) {
        showToast("Please add students first.");
        return;
    }

    const attendance = {};

    state.students.forEach(student => {
        attendance[student.id] = attendanceDraft[student.id] || "present";
    });

    const previous = state.records[date];

    state.records[date] = {
        attendance,
        savedAt: new Date().toISOString()
    };

    if (!saveState()) {
        if (previous) state.records[date] = previous;
        else delete state.records[date];
        return;
    }

    renderDashboard();
    renderHistory();
    renderResults();
    showToast("Attendance saved successfully! ✓");
});

document.getElementById("historyTable").addEventListener("click", event => {
    const button = event.target.closest("[data-edit-date]");
    if (!button) return;

    const date = button.dataset.editDate;
    document.getElementById("attendanceDate").value = date;
    attendanceDraft = {};

    state.students.forEach(student => {
        attendanceDraft[student.id] = getStatus(date, student.id) || "present";
    });

    goToPage("attendance");
    showToast("Editing attendance for " + formatDate(date));
});

document.getElementById("printHistory").addEventListener("click", () => window.print());
document.getElementById("printResults").addEventListener("click", () => window.print());

document.querySelectorAll("[data-go]").forEach(button => {
    button.addEventListener("click", () => goToPage(button.dataset.go));
});

document.querySelectorAll(".nav-link").forEach(link => {
    link.addEventListener("click", event => {
        event.preventDefault();
        goToPage(link.dataset.page);
    });
});

document.getElementById("menuBtn").addEventListener("click", () => {
    document.getElementById("sidebar").classList.toggle("open");
});

document.getElementById("attendanceDate").value = today();

state.students.forEach(student => {
    attendanceDraft[student.id] = getStatus(today(), student.id) || "present";
});

renderDashboard();
renderStudents();
renderAttendance();
renderHistory();
renderResults();

