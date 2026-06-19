# Pull Request & QA Testing Guide

**Project**: NutriSnap  
**Feature Branch**: `main`  
**Description**: Complete Database Migration, Auth Hardening, and Workflow Fixes  

---

## 📋 Overview of Changes
This PR completely overhauls the data persistence layer of NutriSnap. We have migrated away from volatile Local Storage to a robust, containerized PostgreSQL database using the Prisma ORM.

Alongside the database migration, we have squashed several critical UI bugs, hardened the authentication flow, enforced strict onboarding gating, and introduced a new instant-reload development environment.

---

## 🚀 Environment Setup for Testers

To test these features, QA must spin up the application using the new Docker infrastructure.

### Option A: Production Testing
To test exactly how the application runs in production (highly optimized, static generation, no hot-reloading):
```bash
docker-compose up -d --build
```
*Note: This takes ~60 seconds to compile.*

### Option B: Development Testing
To test with instantaneous UI updates (recommended if QA needs to tweak logs or code):
```bash
docker-compose -f docker-compose.dev.yml up
```

### Initializing the Database Schema
Before running test cases, you **must** apply the Prisma schema to your local PostgreSQL container:
```bash
docker run --rm -v $(pwd)/prisma:/prisma -w /prisma \
  --network proxy \
  -e DATABASE_URL="postgresql://nutrisnap:nutrisnap_pass@db:5432/nutrisnap" \
  node:18-alpine sh -c "npm install prisma && npx prisma db push --schema=/prisma/schema.prisma"
```

### Seeding the Admin User
To test the admin dashboard, inject the Super Admin account:
```bash
docker exec nutrisnap_db psql -U nutrisnap -d nutrisnap -c "
  INSERT INTO \"User\" (id, email, name, password, role, onboarded, \"updatedAt\") 
  VALUES ('admin_123', 'admin@mkcyberlabs.in', 'Admin', '\$2b\$12\$CuBxTsNNvuZnfwaUY7cj.uwCviLeneXIpqVTLUKNeIT/eESDFRhvq', 'ADMIN', true, NOW()) 
  ON CONFLICT DO NOTHING;
"
```
*(Password is `ProductionPassword123!`)*

---

## 🧪 Test Cases

### 1. Mandatory Onboarding Gate Enforcement
**Context**: Previously, users could bypass the collection of biological details by navigating straight to the dashboard.
* **Step 1**: Log in using a brand new user account (or register one).
* **Step 2**: When the login succeeds, verify you are redirected to `/onboarding`.
* **Step 3**: Manually alter the URL in your browser to `http://localhost:3000/dashboard`.
* **Expected Result**: The application should instantly kick you back to `/onboarding`. You cannot access the dashboard until you submit the form.
* **Step 4**: Fill out the form (Age, Weight, Height, Gender) and submit. Verify you are automatically redirected to the dashboard.

### 2. "Ghost Deletion" & DB ID Sync Fix
**Context**: Previously, if a user logged a meal, the UI would render it using a temporary local ID. If they clicked "Delete" immediately, the DB would throw an error because the local ID didn't match the database ID, showing a "Deletion Failed" toast while still hiding the UI element.
* **Step 1**: Navigate to `/dashboard`.
* **Step 2**: Use the Meal Analysis Tool to capture/log a new meal. Wait for the success toast.
* **Step 3**: Immediately locate the newly created meal card and click the "Delete" button.
* **Expected Result**: A warning modal should appear saying "This will permanently remove this meal entry from your database."
* **Step 4**: Confirm the deletion.
* **Expected Result**: The item should smoothly disappear, and a green success toast ("Meal log deleted") should appear. There should be NO red error toasts, and the item should actually be removed from the PostgreSQL database.

### 3. Static Quick-Login Removal
**Context**: Hardcoded buttons for "Internal Directory" were removed to ensure strict dynamic auth.
* **Step 1**: Navigate to the root login page (`/`).
* **Expected Result**: The "Internal Directory" section and the "User" / "Global Admin" quick-select buttons should be completely gone. 
* **Step 2**: Manually type in the Admin credentials (`admin@mkcyberlabs.in` / `ProductionPassword123!`) and click login. Verify successful entry into `/admin`.

### 4. Admin Role Redirection Guard
**Context**: Admins should not view the user dashboard.
* **Step 1**: Log in as the Super Admin.
* **Step 2**: You should land on `/admin`.
* **Step 3**: Manually type `http://localhost:3000/dashboard` into your browser.
* **Expected Result**: The application should instantly boot you back to `/admin`.
