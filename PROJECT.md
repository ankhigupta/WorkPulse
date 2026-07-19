# WorkPulse

## Vision

WorkPulse is a multi-tenant SaaS workforce management platform designed for small and medium-sized businesses.

It helps businesses manage employees, attendance, daily wage payroll, payments, and workforce operations from a single mobile application.

The platform is designed to be secure, scalable, easy to use, and production-ready while serving as a real-world portfolio project.

---

# Problem Statement

Many small and medium-sized businesses still manage employee attendance and daily wage payments using paper registers, notebooks, spreadsheets, or WhatsApp.

This often results in:

- Attendance errors
- Payroll mistakes
- Lack of transparency
- Time-consuming administration
- Difficulty tracking employee history
- Poor visibility into daily business operations

WorkPulse aims to digitize these workflows while keeping the application simple enough for any business owner to use.

---

# Goals

- Simple employee management
- Fast attendance tracking
- Automatic wage calculation
- Transparent payment history
- Better visibility into business operations
- Secure multi-tenant architecture
- Mobile-first experience
- Minimal training required for business owners

---

# Design Philosophy

WorkPulse is built around one principle:

> **Every feature must solve a real business problem.**

The application should remain simple, fast, and intuitive.

Complexity should only be introduced when it provides meaningful value.

Version 1 focuses on solving attendance and payroll problems exceptionally well instead of trying to include every possible feature.

---

# User Roles

## Super Admin

Platform owner responsible for managing the SaaS platform.

Responsibilities:

- Manage organizations
- View platform analytics
- Configure platform settings
- Monitor platform health

---

## Organization Admin

Business owner or administrator.

Responsibilities:

- Manage stores
- Manage managers
- Manage employees
- Approve attendance corrections
- Record employee payments
- View reports
- Configure organization settings

---

## Store Manager

Responsibilities:

- Mark employee attendance
- Scan employee QR codes
- Record manual attendance
- Submit attendance correction requests
- View employees assigned to the store

---

## Employee

Responsibilities:

- View attendance history
- View earnings
- View payment history

---

# User Journey

A typical workday inside WorkPulse:

1. Employees arrive at the store.
2. Store Manager marks attendance by scanning the employee QR code or using manual attendance.
3. Attendance is saved.
4. Daily wages are automatically calculated.
5. Managers submit correction requests if attendance needs to be changed.
6. Organization Admin reviews and approves/rejects correction requests.
7. Organization Admin records employee payments.
8. Employees can view attendance, earnings, payment history, and pending payments.

---

# Core Modules

## Authentication

- Login
- Logout
- JWT Authentication
- Refresh Tokens
- Role-Based Access Control (RBAC)

---

## Organization Management

- Create organization
- Manage organization settings
- Manage stores

---

## Store Management

- Create stores
- Update stores
- Assign managers
- View store overview

---

## Manager Management

- Create manager
- Assign manager to store
- Activate / Deactivate manager
- Reset credentials

---

## Employee Management

- Create employee
- Update employee
- Activate / Deactivate employee
- Assign employee to store
- Generate employee QR code
- Employee Notes

Employee Notes are intentionally kept simple so managers and administrators can record important information about an employee.

---

## Attendance

- QR Attendance
- Manual Attendance
- Attendance History
- Attendance Correction Requests
- Attendance Status

Managers cannot directly edit attendance records after they are created.

All corrections require Organization Admin approval.

---

## Payroll

- Automatic daily wage calculation
- Payment recording
- Outstanding balance
- Payment ledger
- Payroll summary

---

## Dashboard

### Organization Admin Dashboard

Provides an overview of the business.

Includes:

- Total Employees
- Employees Present Today
- Employees Absent Today
- Today's Wage Liability
- Outstanding Payments
- Pending Attendance Corrections
- Store Health Overview
- Today's Action Items
- Recent Activity

---

### Store Manager Dashboard

Focused on daily operations.

Includes:

- Employees Present Today
- Employees Absent Today
- QR Attendance
- Manual Attendance
- Pending Correction Requests

---

### Employee Dashboard

Provides personal information.

Includes:

- Today's Attendance
- Today's Earnings
- Weekly Earnings
- Monthly Earnings
- Pending Payments
- Attendance History
- Payment History

---

## Reports

- Attendance Report
- Payroll Report
- Employee Report
- Store-wise Summary

---

# Non-Functional Requirements

The application should be:

- Secure
- Responsive
- Scalable
- Maintainable
- Modular
- Production-ready

---

# Tech Stack

## Mobile

- React Native
- Expo
- TypeScript
- React Navigation
- Zustand
- TanStack Query
- React Native Paper

---

## Backend

- Node.js
- Express
- TypeScript
- PostgreSQL
- Prisma
- JWT
- Pino
- Zod

---

# Multi-Tenancy

WorkPulse is a multi-tenant SaaS application.

Every organization owns its own data.

Every business entity belongs to exactly one organization.

Data from one organization must never be accessible to another organization.

---

# Future Enhancements

Potential future modules include:

- Employee Documents
- Leave Management
- Shift Scheduling
- Inventory Management
- Expense Tracking
- Push Notifications
- Web Admin Dashboard
- Subscription Billing
- Advanced Analytics

---

# Current Version Limitations

Version 1 intentionally does not include:

- Biometric Attendance
- GPS Tracking
- Payment Gateway Integration
- AI-powered Analytics
- Accounting Software Integration

These features may be considered in future versions.