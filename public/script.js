
const $ = id => document.getElementById(id);

let employees = [];
let leaves = [];
let toastTimer;

function notify(message, error = false) {
    const toast = $("toast");
    toast.textContent = message;
    toast.className = "toast show" + (error ? " error" : "");

    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
        toast.className = "toast";
    }, 3000);
}

async function api(url, options = {}) {
    const response = await fetch(url, {
        ...options,
        headers: {
            "Content-Type": "application/json",
            ...(options.headers || {})
        }
    });

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.error || "Request failed");
    }

    return data;
}

function safe(value) {
    return String(value ?? "").replace(/[&<>"']/g, character => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[character]);
}

function dateText(value) {
    if (!value) return "";
    return String(value).slice(0, 10);
}

function refreshEmployeeDropdown() {
    const dropdown = $("leaveEmployee");
    const selected = dropdown.value;

    dropdown.innerHTML =
        '<option value="">Select Employee</option>' +
        employees.map(employee =>
            `<option value="${employee.id}">
                ${safe(employee.name)} (ID: ${employee.id})
            </option>`
        ).join("");

    if (employees.some(e => String(e.id) === selected)) {
        dropdown.value = selected;
    }
}

function updateStatistics() {
    $("totalEmployees").textContent = employees.length;
    $("totalLeaves").textContent = leaves.length;

    $("approvedLeaves").textContent =
        leaves.filter(l => l.status === "Approved").length;

    $("pendingLeaves").textContent =
        leaves.filter(l => l.status === "Pending").length;
}

function renderLeaves() {
    const search = $("searchInput").value.trim().toLowerCase();

    const filtered = leaves.filter(leave =>
        String(leave.employee_name || "").toLowerCase().includes(search) ||
        String(leave.description || "").toLowerCase().includes(search)
    );

    const tbody = $("leaveTableBody");

    if (!filtered.length) {
        tbody.innerHTML = `
            <tr>
                <td colspan="9" class="empty">
                    No matching leave requests found.
                </td>
            </tr>`;
        return;
    }

    tbody.innerHTML = filtered.map((leave, index) => {
        const type = String(leave.leave_type).toLowerCase();
        const status = String(leave.status).toLowerCase();

        return `
        <tr>
            <td>${index + 1}</td>
            <td>${safe(leave.employee_name)}</td>
            <td>${safe(leave.designation)}</td>
            <td><span class="tag ${type}">${safe(leave.leave_type)}</span></td>
            <td>${leave.number_of_days}</td>
            <td>${safe(leave.description)}</td>
            <td><span class="status ${status}">${safe(leave.status)}</span></td>
            <td>${dateText(leave.request_date)}</td>
            <td>
                <button class="action-btn edit-btn"
                    data-edit="${leave.id}" title="Edit">
                    <i class="fa-solid fa-pen"></i>
                </button>

                ${leave.status === "Pending" ? `
                <button class="action-btn approve-btn"
                    data-approve="${leave.id}" title="Approve">
                    <i class="fa-solid fa-check"></i>
                </button>` : ""}

                <button class="action-btn delete-btn"
                    data-delete="${leave.id}" title="Delete">
                    <i class="fa-solid fa-trash"></i>
                </button>
            </td>
        </tr>`;
    }).join("");
}

async function loadData() {
    try {
        const result = await Promise.all([
            api("/api/employees"),
            api("/api/leaves")
        ]);

        employees = result[0];
        leaves = result[1];

        refreshEmployeeDropdown();
        updateStatistics();
        renderLeaves();

    } catch (error) {
        notify(
            error.message +
            ". Check MySQL and your .env settings.",
            true
        );

        $("leaveTableBody").innerHTML = `
            <tr>
                <td colspan="9" class="empty">
                    Cannot load records. Check your database connection.
                </td>
            </tr>`;
    }
}

// ADD OR UPDATE EMPLOYEE
$("employeeForm").addEventListener("submit", async event => {
    event.preventDefault();

    const id = $("employeeId").value;

    const employee = {
        name: $("employeeName").value.trim(),
        designation: $("designation").value,
        email: $("employeeEmail").value.trim()
    };

    try {
        await api(
            id ? `/api/employees/${id}` : "/api/employees",
            {
                method: id ? "PUT" : "POST",
                body: JSON.stringify(employee)
            }
        );

        resetEmployeeForm();
        await loadData();

        notify(id
            ? "Employee updated successfully."
            : "Employee added successfully.");

    } catch (error) {
        notify(error.message, true);
    }
});

function resetEmployeeForm() {
    $("employeeForm").reset();
    $("employeeId").value = "";
    $("employeeTitle").textContent = "Add Employee";
    $("employeeSubmit").innerHTML =
        '<i class="fa-solid fa-plus"></i> Add Employee';
    $("cancelEdit").hidden = true;
}

$("cancelEdit").addEventListener("click", resetEmployeeForm);

// APPLY FOR LEAVE
$("leaveForm").addEventListener("submit", async event => {
    event.preventDefault();

    const request = {
        employee_id: $("leaveEmployee").value,
        leave_type: $("leaveType").value,
        number_of_days: Number($("leaveDays").value),
        leave_date: $("leaveDate").value,
        description: $("leaveDescription").value.trim()
    };

    try {
        await api("/api/leaves", {
            method: "POST",
            body: JSON.stringify(request)
        });

        $("leaveForm").reset();
        notify("Leave request submitted successfully.");
        await loadData();

    } catch (error) {
        notify(error.message, true);
    }
});

// SEARCH
$("searchInput").addEventListener("input", renderLeaves);

// REFRESH DASHBOARD
$("refreshButton").addEventListener("click", loadData);

// EDIT, APPROVE, REJECT AND DELETE LEAVE REQUESTS
$("leaveTableBody").addEventListener("click", async event => {
    const editButton = event.target.closest("[data-edit]");
    const approveButton = event.target.closest("[data-approve]");
    const deleteButton = event.target.closest("[data-delete]");

    try {
        // EDIT LEAVE REQUEST
        if (editButton) {
            const leave = leaves.find(
                l => String(l.id) === editButton.dataset.edit
            );

            if (!leave) return;

            const employeeOptions = employees.map(employee =>
                `${employee.id}: ${employee.name}`
            ).join("\n");

            const employeeChoice = prompt(
                "Enter employee ID:\n" + employeeOptions,
                leave.employee_id
            );

            if (employeeChoice === null) return;

            const employeeId = Number(employeeChoice);

            if (!employees.some(e => e.id === employeeId)) {
                return notify("Invalid employee ID.", true);
            }

            const type = prompt(
                "Leave type: Casual, Sick, Personal, Professional, Earned, Unpaid",
                leave.leave_type
            );

            if (type === null) return;

            const normalizedType = [
                "Casual", "Sick", "Personal",
                "Professional", "Earned", "Unpaid"
            ].find(t => t.toLowerCase() === type.trim().toLowerCase());

            if (!normalizedType) {
                return notify("Invalid leave type.", true);
            }

            const daysInput = prompt(
                "Number of days:",
                leave.number_of_days
            );

            if (daysInput === null) return;

            const days = Number(daysInput);

            if (!Number.isInteger(days) || days < 1 || days > 365) {
                return notify("Enter a valid number of days.", true);
            }

            const date = prompt(
                "Leave date (YYYY-MM-DD):",
                dateText(leave.leave_date)
            );

            if (date === null) return;

            if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
                return notify("Use date format YYYY-MM-DD.", true);
            }

            const description = prompt(
                "Reason for leave:",
                leave.description
            );

            if (description === null || !description.trim()) return;

            const statusInput = prompt(
                "Status: Pending, Approved, or Rejected",
                leave.status
            );

            if (statusInput === null) return;

            const status = [
                "Pending", "Approved", "Rejected"
            ].find(s =>
                s.toLowerCase() === statusInput.trim().toLowerCase()
            );

            if (!status) {
                return notify("Invalid leave status.", true);
            }

            await api(`/api/leaves/${leave.id}`, {
                method: "PUT",
                body: JSON.stringify({
                    employee_id: employeeId,
                    leave_type: normalizedType,
                    number_of_days: days,
                    leave_date: date,
                    description: description.trim(),
                    status
                })
            });

            await loadData();
            return notify("Leave request updated.");
        }

        // APPROVE LEAVE
        if (approveButton) {
            if (!confirm("Approve this leave request?")) return;

            await api(
                `/api/leaves/${approveButton.dataset.approve}/status`,
                {
                    method: "PATCH",
                    body: JSON.stringify({ status: "Approved" })
                }
            );

            await loadData();
            return notify("Leave request approved.");
        }

        // DELETE LEAVE
        if (deleteButton) {
            if (!confirm("Delete this leave request permanently?")) return;

            await api(`/api/leaves/${deleteButton.dataset.delete}`, {
                method: "DELETE"
            });

            await loadData();
            notify("Leave request deleted.");
        }

    } catch (error) {
        notify(error.message, true);
    }
});

// SIDEBAR: EDIT OR DELETE EMPLOYEES
document.querySelectorAll(".nav-link").forEach(link => {
    link.addEventListener("click", event => {
        document.querySelectorAll(".nav-link").forEach(item =>
            item.classList.remove("active")
        );

        link.classList.add("active");

        if (window.innerWidth <= 700) {
            $("sidebar").classList.remove("open");
        }

        if (link.textContent.includes("Update Employee")) {
            event.preventDefault();

            const employeeId = prompt(
                "Enter employee ID to update:\n" +
                employees.map(e => `${e.id}: ${e.name}`).join("\n")
            );

            if (employeeId === null) return;

            const employee = employees.find(
                e => String(e.id) === employeeId.trim()
            );

            if (!employee) {
                notify("Employee not found.", true);
                return;
            }

            $("employeeId").value = employee.id;
            $("employeeName").value = employee.name;
            $("designation").value = employee.designation;
            $("employeeEmail").value = employee.email || "";
            $("employeeTitle").textContent = "Update Employee";
            $("employeeSubmit").innerHTML =
                '<i class="fa-solid fa-floppy-disk"></i> Update Employee';
            $("cancelEdit").hidden = false;

            $("employeePanel").scrollIntoView({
                behavior: "smooth"
            });
        }

        if (link.textContent.includes("Delete Record")) {
            event.preventDefault();

            const employeeId = prompt(
                "Enter employee ID to delete:\n" +
                employees.map(e => `${e.id}: ${e.name}`).join("\n")
            );

            if (employeeId === null) return;

            const employee = employees.find(
                e => String(e.id) === employeeId.trim()
            );

            if (!employee) {
                notify("Employee not found.", true);
                return;
            }

            if (!confirm(
                `Delete ${employee.name} and all their leave requests?`
            )) return;

            api(`/api/employees/${employee.id}`, {
                method: "DELETE"
            })
            .then(async () => {
                await loadData();
                notify("Employee deleted successfully.");
            })
            .catch(error => notify(error.message, true));
        }
    });
});

// MOBILE MENU
$("menuButton").addEventListener("click", () => {
    $("sidebar").classList.toggle("open");
});

// Prevent selecting past leave dates
const today = new Date();
const localToday = [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, "0"),
    String(today.getDate()).padStart(2, "0")
].join("-");

$("leaveDate").min = localToday;

// START
loadData();
