
CREATE DATABASE IF NOT EXISTS leave_management;
USE leave_management;

CREATE TABLE IF NOT EXISTS employees (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    designation VARCHAR(100) NOT NULL,
    email VARCHAR(150),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS leave_requests (
    id INT AUTO_INCREMENT PRIMARY KEY,
    employee_id INT NOT NULL,
    leave_type VARCHAR(30) NOT NULL,
    number_of_days INT NOT NULL,
    leave_date DATE NOT NULL,
    description VARCHAR(500) NOT NULL,
    status VARCHAR(20) DEFAULT 'Pending',
    request_date DATE NOT NULL,
    FOREIGN KEY (employee_id)
        REFERENCES employees(id)
        ON DELETE CASCADE
);

INSERT INTO employees (name, designation, email)
SELECT 'Geetha', 'Developer', 'geetha@example.com'
WHERE NOT EXISTS (
    SELECT 1 FROM employees WHERE name = 'Geetha'
);

INSERT INTO employees (name, designation, email)
SELECT 'Rahul Sharma', 'Manager', 'rahul@example.com'
WHERE NOT EXISTS (
    SELECT 1 FROM employees WHERE name = 'Rahul Sharma'
);

INSERT INTO employees (name, designation, email)
SELECT 'Priya Singh', 'Designer', 'priya@example.com'
WHERE NOT EXISTS (
    SELECT 1 FROM employees WHERE name = 'Priya Singh'
);

INSERT INTO employees (name, designation, email)
SELECT 'Arjun Mehta', 'Tester', 'arjun@example.com'
WHERE NOT EXISTS (
    SELECT 1 FROM employees WHERE name = 'Arjun Mehta'
);

INSERT INTO employees (name, designation, email)
SELECT 'Sneha Reddy', 'HR', 'sneha@example.com'
WHERE NOT EXISTS (
    SELECT 1 FROM employees WHERE name = 'Sneha Reddy'
);

INSERT INTO leave_requests
(employee_id, leave_type, number_of_days, leave_date,
 description, status, request_date)
SELECT id, 'Casual', 2, '2026-06-10',
       'Personal work', 'Approved', '2026-06-10'
FROM employees
WHERE name = 'Geetha'
AND NOT EXISTS (
    SELECT 1 FROM leave_requests WHERE description = 'Personal work'
);
