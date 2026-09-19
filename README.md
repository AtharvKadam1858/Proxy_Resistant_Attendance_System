<div align="center">

# 🎯 Proxy-Resistant Real-Time QR-Based Smart Attendance System

### AI-powered, browser-only attendance management that eliminates proxy attendance — no extra hardware required.

![Status](https://img.shields.io/badge/Status-Completed-brightgreen?style=for-the-badge)
![Phase](https://img.shields.io/badge/Capstone-Phase%20II-blueviolet?style=for-the-badge)
![License](https://img.shields.io/badge/License-MIT-blue?style=for-the-badge)

![React](https://img.shields.io/badge/React.js-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)
![Express](https://img.shields.io/badge/Express.js-000000?style=for-the-badge&logo=express&logoColor=white)
![MongoDB](https://img.shields.io/badge/MongoDB-47A248?style=for-the-badge&logo=mongodb&logoColor=white)
![MySQL](https://img.shields.io/badge/MySQL-4479A1?style=for-the-badge&logo=mysql&logoColor=white)
![TensorFlow](https://img.shields.io/badge/TensorFlow-FF6F00?style=for-the-badge&logo=tensorflow&logoColor=white)
![OpenCV](https://img.shields.io/badge/OpenCV-5C3EE8?style=for-the-badge&logo=opencv&logoColor=white)

**[View Demo](#-screenshots) · [Report Bug](../../issues) · [Request Feature](../../issues)**

</div>

---

## 📖 Table of Contents

- [About the Project](#-about-the-project)
- [Problem Statement](#-problem-statement)
- [Key Features](#-key-features)
- [System Architecture](#-system-architecture)
- [Screenshots](#-screenshots)
- [Tech Stack](#-tech-stack)
- [Getting Started](#-getting-started)
- [Project Structure](#-project-structure)
- [API Overview](#-api-overview)
- [Results](#-results)
- [Roadmap](#-roadmap)
- [Contributors](#-contributors)
- [License](#-license)

---

## 📌 About the Project

Traditional attendance systems — manual roll calls, paper registers, and even static QR-code solutions — are **time-consuming**, **error-prone**, and **highly vulnerable to proxy attendance**. Static QR codes in particular can be screenshotted and forwarded to absent students in seconds.

This project delivers a **complete, deployed, web-based attendance system** that closes that gap. It combines a **session-bound dynamic QR code** with a **live, camera-based face verification step**, so attendance can only be marked by a student who is genuinely present in front of their own device at that exact moment — all through an ordinary smartphone browser, with **no dedicated hardware, app installation, or biometric scanner** required.

The system has been fully built, deployed, and tested end-to-end with real Admin, Teacher, and Student accounts. Every screen below is a real screenshot of the working application — not a mockup.

## 🎯 Problem Statement

> Develop a **secure, real-time, web-based attendance system** that prevents proxy attendance and ensures attendance is recorded **only** by physically present, authenticated students.

### Objectives
- ✅ Eliminate proxy attendance through multi-layer verification
- ✅ Automate attendance recording to cut manual effort for faculty
- ✅ Deliver a cost-effective, hardware-independent, scalable solution
- ✅ Improve transparency and accountability with auditable, exportable records

## ✨ Key Features

| Module | Description |
|---|---|
| 🔐 **Role-Based Authentication** | Dedicated, secure login for **Admin**, **Teacher**, and **Student** roles |
| 🔄 **Dynamic QR Code Engine** | Generates a unique, session-bound QR code per lecture that auto-expires — no reuse, no screenshot sharing |
| 📷 **Live QR Scanning** | Mobile-browser-based scanning with instant session validation |
| 🤖 **AI Face Verification** | Live camera capture with a liveness check to confirm a real person is present — not a photo |
| 📍 **Geo-Fencing (Roadmap)** | GPS-based location validation to confirm on-campus presence *(architecture ready — see [Roadmap](#-roadmap))* |
| 🧾 **Attendance Management** | Duplicate-proof, timestamped attendance logging with a faculty-side manual override |
| 📊 **Admin Dashboard** | Add/manage students, filter by year & department, and oversee institution-wide data |
| 📈 **Automated Reports** | One-click **Monthly Attendance** and **Defaulter List** exports in Excel format |

## 🏗 System Architecture

The workflow follows a clean, layered pipeline: