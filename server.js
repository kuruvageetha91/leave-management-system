
require("dotenv").config();

const express = require("express");
const mysql = require("mysql2/promise");
const path = require("path");

const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const pool = mysql.createPool({
    host: process.env.DB_HOST || "localhost",
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "leave_management",
    waitForConnections: true,
    connectionLimit: 10
});

// Check database connection
app.get("/api/health", async (req, res) => {
    try {
        await pool.query("SELECT 1");
        res.json({ message: "Database connected successfully" });
    } catch (err) {
        res.status(500).json({ error: "Database connection failed" });
    }
});

// GET all employees
app.get("/api/employees", async (req, res) => {
    try {
        const [rows] = await pool.query(
            "SELECT * FROM employees ORDER BY id DESC"
        );
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ADD employee
app.post("/api/employees", async (req, res) => {
    const { name, designation, email } = req.body;

    if (!name || !name.trim() || !designation) {
        return res.status(400).json({
            error: "Name and designation are required"
        });
    }

    try {
        const [result] = await pool.query(
            "INSERT INTO employees (name, designation, email) VALUES (?, ?, ?)",
            [name.trim(), designation, email || null]
        );

        res.status(201).json({
            message: "Employee added successfully",
            id: result.insertId
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// UPDATE employee
app.put("/api/employees/:id", async (req, res) => {
    const { name, designation, email } = req.body;

    if (!name || !name.trim() || !designation) {
        return res.status(400).json({
            error: "Name and designation are required"
        });
    }

    try {
        const [result] = await pool.query(
            `UPDATE employees
             SET name = ?, designation = ?, email = ?
             WHERE id = ?`,
            [name.trim(), designation, email || null, req.params.id]
        );

        if (!result.affectedRows) {
            return res.status(404).json({ error: "Employee not found" });
        }

        res.json({ message: "Employee updated successfully" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE employee (also removes their leave requests)
app.delete("/api/employees/:id", async (req, res) => {
    try {
        const [result] = await pool.query(
            "DELETE FROM employees WHERE id = ?",
            [req.params.id]
        );

        if (!result.affectedRows) {
            return res.status(404).json({ error: "Employee not found" });
        }

        res.json({ message: "Employee deleted successfully" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET all leave requests
app.get("/api/leaves", async (req, res) => {
    try {
        const [rows] = await pool.query(`
            SELECT l.*, e.name AS employee_name, e.designation
            FROM leave_requests l
            JOIN employees e ON l.employee_id = e.id
            ORDER BY l.id DESC
        `);

        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// APPLY for leave
app.post("/api/leaves", async (req, res) => {
    const {
        employee_id,
        leave_type,
        number_of_days,
        leave_date,
        description
    } = req.body;

    if (
        !employee_id || !leave_type || !number_of_days ||
        !leave_date || !description || !description.trim()
    ) {
        return res.status(400).json({
            error: "Please fill in every leave request field"
        });
    }

    const days = Number(number_of_days);

    if (!Number.isInteger(days) || days < 1 || days > 365) {
        return res.status(400).json({ error: "Invalid number of days" });
    }

    const types = [
        "Casual", "Sick", "Personal",
        "Professional", "Earned", "Unpaid"
    ];

    if (!types.includes(leave_type)) {
        return res.status(400).json({ error: "Invalid leave type" });
    }

    try {
        const [result] = await pool.query(
            `INSERT INTO leave_requests
             (employee_id, leave_type, number_of_days, leave_date,
              description, status, request_date)
             VALUES (?, ?, ?, ?, ?, 'Pending', CURDATE())`,
            [
                employee_id,
                leave_type,
                days,
                leave_date,
                description.trim()
            ]
        );

        res.status(201).json({
            message: "Leave request submitted successfully",
            id: result.insertId
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// UPDATE leave request
app.put("/api/leaves/:id", async (req, res) => {
    const {
        employee_id, leave_type, number_of_days,
        leave_date, description, status
    } = req.body;

    const validStatuses = ["Pending", "Approved", "Rejected"];
    const validTypes = [
        "Casual", "Sick", "Personal",
        "Professional", "Earned", "Unpaid"
    ];

    if (
        !employee_id || !validTypes.includes(leave_type) ||
        !Number.isInteger(Number(number_of_days)) ||
        Number(number_of_days) < 1 || !leave_date ||
        !description || !validStatuses.includes(status)
    ) {
        return res.status(400).json({ error: "Invalid leave details" });
    }

    try {
        const [result] = await pool.query(
            `UPDATE leave_requests
             SET employee_id = ?, leave_type = ?, number_of_days = ?,
                 leave_date = ?, description = ?, status = ?
             WHERE id = ?`,
            [
                employee_id, leave_type, Number(number_of_days),
                leave_date, description.trim(), status, req.params.id
            ]
        );

        if (!result.affectedRows) {
            return res.status(404).json({ error: "Leave request not found" });
        }

        res.json({ message: "Leave request updated successfully" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// APPROVE or REJECT a leave request
app.patch("/api/leaves/:id/status", async (req, res) => {
    const { status } = req.body;

    if (!["Pending", "Approved", "Rejected"].includes(status)) {
        return res.status(400).json({ error: "Invalid status" });
    }

    try {
        const [result] = await pool.query(
            "UPDATE leave_requests SET status = ? WHERE id = ?",
            [status, req.params.id]
        );

        if (!result.affectedRows) {
            return res.status(404).json({ error: "Leave request not found" });
        }

        res.json({ message: `Leave request marked ${status}` });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE leave request
app.delete("/api/leaves/:id", async (req, res) => {
    try {
        const [result] = await pool.query(
            "DELETE FROM leave_requests WHERE id = ?",
            [req.params.id]
        );

        if (!result.affectedRows) {
            return res.status(404).json({ error: "Leave request not found" });
        }

        res.json({ message: "Leave request deleted successfully" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});


const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
