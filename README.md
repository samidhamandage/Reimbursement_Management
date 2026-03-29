# Smart Expense Reimbursement Management System (SERMS)

AI-powered reimbursement management system with OCR and fraud detection.

## Problem Statement
Manual expense reimbursements are prone to fraud, manual entry errors, and slow approval cycles. Companies lose millions due to duplicate claims or exaggerated amounts.

## Solution
SERMS uses AI-based OCR (Tesseract) to extract data from receipts, automatically validates it against company rules, and provides real-time tracking via Socket.IO for both employees and managers.

## Features
- **Upload Receipt**: Drag and drop receipt images.
- **AI-OCR Extraction**: Automatically extract amount, date, and category.
- **Fraud Prevention**: Rules-based validation to detect anomalies.
- **Manager Dashboard**: One-click approval/rejection workflows.
- **Admin Control**: Define custom organizational reimbursement rules.
- **Real-time Notifications**: Status updates via WebSockets.

## Tech Stack
- **Frontend**: Next.js 14, React, Tailwind CSS, ShadCN UI
- **Backend**: Node.js, Express.js
- **ORM**: Prisma (SQLite/PostgreSQL)
- **Real-time**: Socket.IO
- **OCR**: Tesseract.js

## Project Structure
- /frontend: Next.js Client App
- /backend: Express Server & API
- /docs: Documentation & Assets

## Project Progress

### ✅ Completed Tasks
- [x] **Monorepo Refactor**: Reorganized into clean `/frontend` and `/backend` structure.
- [x] **Controller Pattern**: Implemented Controller-Service-Route architecture in the backend.
- [x] **Database Migration**: Successfully transitioned Prisma schema from SQLite to PostgreSQL.
- [x] **Auth & Security**: JWT-based authentication with role-based access control (RBAC).
- [x] **Real-time Engine**: Socket.IO integration for instant expense status updates.
- [x] **Clean Repository**: Properly configured `.gitignore` and removed all environment/dependency noise.
- [x] **Root Scripting**: Added workspace-aware scripts for unified project management.

- [x] **Multi-currency Support**: Automatic conversion using real-time exchange rates.
- [x] **Offline Resilience**: Session caching and restoration when the backend drops connection.
- [x] **Advanced OCR**: Enhance extraction accuracy for handwritten receipts.
- [x] **Email Alerts**: Automatic email notifications for pending approvals.
- [ ] **Cloud Storage**: Integrate AWS S3/Google Cloud Storage for receipt images.

## Installation & Setup

1. **Clone the repository**:
   ```bash
   git clone https://github.com/shivammane2007/Reimbursement_Management.git
   cd Reimbursement_Management
   ```

2. **Environment Configuration**:
   - Copy `backend/.env.example` to `backend/.env` and fill in your PostgreSQL details.
   - Copy `frontend/.env.example` to `frontend/.env`.

3. **Install Dependencies & Start**:
   Using the root workspace scripts:
   ```bash
   npm install         # Install all dependencies
   npm run prisma:gen  # Generate Prisma client
   npm run dev        # Run both Frontend & Backend concurrently
   ```

## License
MIT
