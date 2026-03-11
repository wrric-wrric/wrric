# Bulk User Import API - Complete Documentation

## Overview

The Bulk User Import system allows administrators to import multiple users from a CSV file, automatically create profiles, and send invitation emails for account activation.

## Table of Contents

1. [API Endpoints](#api-endpoints)
2. [CSV Format & Field Mapping](#csv-format--field-mapping)
3. [Frontend Implementation Guide](#frontend-implementation-guide)
4. [User Flow & Status Lifecycle](#user-flow--status-lifecycle)
5. [Security & Best Practices](#security--best-practices)
6. [Error Handling](#error-handling)

---

## API Endpoints

### 1. Validate CSV File

**Endpoint:** `POST /api/admin/users/validate-csv`  
**Auth Required:** Yes (Admin only)  
**Content-Type:** `multipart/form-data`

#### Purpose
Pre-validate CSV file structure and preview field mappings without creating users.

#### Request
```javascript
const formData = new FormData();
formData.append('file', csvFile);

fetch('/api/admin/users/validate-csv', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${adminToken}`
  },
  body: formData
})
```

#### Response (200 OK)
```json
{
  "is_valid": true,
  "field_mapping": {
    "Email address": {
      "db_field": "email",
      "field_type": "user",
      "required": true,
      "csv_index": 1
    },
    "Full name(s)": {
      "db_field": "display_name",
      "field_type": "profile",
      "required": false,
      "csv_index": 4
    },
    "Mobile Number": {
      "db_field": "phone",
      "field_type": "profile",
      "required": false,
      "csv_index": 5
    }
  },
  "missing_required": [],
  "template_info": {
    "required_fields": [...],
    "optional_fields": [...],
    "description": "The system accepts CSV files with flexible field names...",
    "examples": [...]
  },
  "sample_rows": [
    {
      "Email address": "john@example.com",
      "Full name(s)": "John Doe",
      "Mobile Number": "+1234567890"
    }
  ]
}
```

#### Error Response (400 Bad Request)
```json
{
  "detail": "Only CSV files are supported"
}
```

---

### 2. Bulk Import Users

**Endpoint:** `POST /api/admin/users/bulk-import`  
**Auth Required:** Yes (Admin only)  
**Content-Type:** `multipart/form-data`

#### Purpose
Import users from CSV file, create profiles, and send invitation emails.

#### Request
```javascript
const formData = new FormData();
formData.append('file', csvFile);

// Optional: Import only selected rows (0-based indices)
const selectedRows = [0, 2, 5, 10]; // Import rows 1, 3, 6, 11 (0-indexed)
formData.append('selected_rows', JSON.stringify(selectedRows));

fetch('/api/admin/users/bulk-import', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${adminToken}`
  },
  body: formData
})
```

#### Response (200 OK)
```json
{
  "success": true,
  "message": "Imported 45 users, skipped 3, 2 errors",
  "created_users": 45,
  "skipped_users": 3,
  "errors": [
    "Row 15: Email address is required",
    "Row 23: Failed to send email to invalid@domain.com"
  ],
  "field_mapping": {...},
  "template_info": {...}
}
```

---

### 3. Get Bulk Imported Users

**Endpoint:** `GET /api/admin/users/bulk-imported`  
**Auth Required:** Yes (Admin only)

#### Purpose
Retrieve list of users imported via bulk import with their invitation status.

#### Request
```javascript
fetch('/api/admin/users/bulk-imported?page=1&page_size=20&status=pending', {
  headers: {
    'Authorization': `Bearer ${adminToken}`
  }
})
```

#### Query Parameters
- `page` (optional): Page number (default: 1)
- `page_size` (optional): Items per page (default: 20, max: 100)
- `status` (optional): Filter by invitation status: `pending`, `accepted`, `declined`, `expired`
- `batch_id` (optional): Filter by specific import batch ID

#### Response
```json
{
  "users": [
    {
      "id": "uuid-here",
      "email": "john@example.com",
      "full_name": "John Doe",
      "profile_type": "academic",
      "invitation_status": "pending",
      "invitation_sent_at": "2026-01-24T10:00:00Z",
      "invitation_responded_at": null,
      "import_batch_id": "batch-uuid"
    }
  ],
  "total": 100,
  "page": 1,
  "page_size": 20,
  "total_pages": 5
}
```

---

### 4. Bulk Actions on Imported Users

**Endpoint:** `POST /api/admin/users/bulk-action`  
**Auth Required:** Yes (Admin only)

#### Purpose
Perform bulk actions on imported users (delete, resend invitation, etc.)

#### Request
```javascript
fetch('/api/admin/users/bulk-action', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${adminToken}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    user_ids: ["uuid1", "uuid2", "uuid3"],
    action: "delete"  // or "retry", "accept", "decline"
  })
})
```

#### Actions
- `delete`: Remove users who haven't accepted invitations
- `retry`: Resend invitation emails
- `accept`: Manually mark as accepted (testing only)
- `decline`: Manually mark as declined

---

### 5. Import Statistics

**Endpoint:** `GET /api/admin/users/import-stats`  
**Auth Required:** Yes (Admin only)

#### Response
```json
{
  "total_imported": 250,
  "pending": 45,
  "accepted": 180,
  "declined": 15,
  "expired": 10,
  "acceptance_rate": 0.72,
  "recent_batches": [
    {
      "batch_id": "uuid",
      "filename": "users_batch_1.csv",
      "imported_at": "2026-01-24T10:00:00Z",
      "total_rows": 50,
      "successful": 48,
      "failed": 2
    }
  ]
}
```

---

## CSV Format & Field Mapping

### Automatic Field Recognition

The system automatically recognizes CSV fields using **flexible matching**. Multiple field name variations are supported:

#### User Fields (Required)

| CSV Field Variations | Database Field | Required |
|---------------------|----------------|----------|
| `Email`, `email address`, `email_address`, `Email address` | `email` | ✅ Yes |

#### Profile Fields (Optional)

| CSV Field Variations | Database Field | Type |
|---------------------|----------------|------|
| `Full name`, `Full name(s)`, `name` | `display_name` | String |
| `First name`, `first_name` | `first_name` | String |
| `Last name`, `last_name` | `last_name` | String |
| `Mobile`, `Mobile Number`, `phone`, `telephone` | `phone` | String |
| `Occupation`, `What's your occupation?`, `job title`, `position`, `Occupancy / position` | `title` | String |
| `College/University`, `University`, `Organisation/company`, `company`, `organization` | `organization` | String |
| `Department`, `Department/Faculty`, `faculty` | `metadata.department` | String |
| `Study Program`, `Study Program/Major`, `major` | `metadata.study_program` | String |
| `Field of Specialization`, `specialization`, `expertise` | `expertise` | Array |
| `Idea`, `Idea (250 words)`, `description` | `bio` | Text |
| `Ideas title`, `title` | `metadata.idea_title` | String |
| `Select theme`, `theme`, `category` | `metadata.theme` | String |
| `Individual /group`, `type`, `group` | `metadata.group_type` | String |
| `Timestamp` | `metadata.import_timestamp` | DateTime |
| `Website` | `website` | URL |

### Supported CSV Templates

#### Template 1: Event Registration Form
```csv
Timestamp,Email address,select theme,Individual /group,Full name(s),Mobile Number,What's your occupation?,College/University,Department/Faculty,Study Program/Major,Organisation/company,Occupancy / position,Field of Specialization,Idea (250 words),Ideas title
14/01/2026 17:55:42,john@example.com,Climate Innovation,individual,John Doe,+1234567890,Graduate,MIT,Engineering,Computer Science,,,AI & Climate,My climate tech idea,ClimateAI
```

#### Template 2: Simple Format
```csv
Email,Name,Phone,Occupation,Organization,Bio
john@example.com,John Doe,+1234567890,Researcher,MIT,Working on climate solutions
```

#### Template 3: Academic Format
```csv
email,first_name,last_name,phone,occupation,university,department,major,specialization
john@example.com,John,Doe,+1234567890,PhD Student,MIT,EECS,Computer Science,Machine Learning
```

### Profile Type Inference

The system automatically infers profile type from occupation field:

| Keywords | Profile Type |
|----------|-------------|
| student, graduate, undergraduate, postgraduate, phd | `academic` |
| entrepreneur, founder, ceo, startup, business | `entrepreneur` |
| researcher, scientist, professor, academic | `lab` |
| investor, funder, venture, capital | `funder` |
| *default* | `academic` |

---

## Frontend Implementation Guide

### Step 1: CSV Upload & Validation

```jsx
import React, { useState } from 'react';

function BulkImportWizard() {
  const [file, setFile] = useState(null);
  const [validation, setValidation] = useState(null);
  const [selectedRows, setSelectedRows] = useState([]);
  
  const handleFileUpload = async (e) => {
    const uploadedFile = e.target.files[0];
    setFile(uploadedFile);
    
    // Step 1: Validate CSV
    const formData = new FormData();
    formData.append('file', uploadedFile);
    
    const response = await fetch('/api/admin/users/validate-csv', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      },
      body: formData
    });
    
    const data = await response.json();
    setValidation(data);
  };
  
  return (
    <div>
      <input type="file" accept=".csv" onChange={handleFileUpload} />
      
      {validation && (
        <ValidationResults validation={validation} />
      )}
    </div>
  );
}
```

### Step 2: Display Field Mapping

```jsx
function ValidationResults({ validation }) {
  if (!validation.is_valid) {
    return (
      <div className="error">
        <h3>Invalid CSV Format</h3>
        <p>Missing required fields: {validation.missing_required.join(', ')}</p>
      </div>
    );
  }
  
  return (
    <div className="success">
      <h3>✓ CSV Valid - Field Mapping</h3>
      <table>
        <thead>
          <tr>
            <th>CSV Field</th>
            <th>Maps to</th>
            <th>Type</th>
          </tr>
        </thead>
        <tbody>
          {Object.entries(validation.field_mapping).map(([csvField, mapping]) => (
            <tr key={csvField}>
              <td>{csvField}</td>
              <td>{mapping.db_field}</td>
              <td>{mapping.field_type}</td>
            </tr>
          ))}
        </tbody>
      </table>
      
      <h4>Sample Data</h4>
      <SampleDataTable rows={validation.sample_rows} />
    </div>
  );
}
```

### Step 3: Row Selection (Optional)

```jsx
function RowSelector({ sampleRows, onSelectionChange }) {
  const [selected, setSelected] = useState([]);
  
  const toggleRow = (index) => {
    const newSelected = selected.includes(index)
      ? selected.filter(i => i !== index)
      : [...selected, index];
    
    setSelected(newSelected);
    onSelectionChange(newSelected);
  };
  
  return (
    <div>
      <h3>Select Rows to Import</h3>
      <button onClick={() => setSelected([...Array(100).keys()])}>
        Select All
      </button>
      
      <table>
        {sampleRows.map((row, index) => (
          <tr key={index}>
            <td>
              <input
                type="checkbox"
                checked={selected.includes(index)}
                onChange={() => toggleRow(index)}
              />
            </td>
            <td>{row['Email address']}</td>
            <td>{row['Full name(s)']}</td>
          </tr>
        ))}
      </table>
    </div>
  );
}
```

### Step 4: Import Execution

```jsx
async function handleImport(file, selectedRows = null) {
  const formData = new FormData();
  formData.append('file', file);
  
  if (selectedRows && selectedRows.length > 0) {
    formData.append('selected_rows', JSON.stringify(selectedRows));
  }
  
  const response = await fetch('/api/admin/users/bulk-import', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`
    },
    body: formData
  });
  
  const result = await response.json();
  
  if (result.success) {
    console.log(`✓ Imported ${result.created_users} users`);
    console.log(`⊗ Skipped ${result.skipped_users} users`);
    
    if (result.errors.length > 0) {
      console.warn('Errors:', result.errors);
    }
  }
  
  return result;
}
```

### Step 5: Monitor Import Status

```jsx
function ImportedUsersTable() {
  const [users, setUsers] = useState([]);
  const [filter, setFilter] = useState('pending');
  
  useEffect(() => {
    fetchImportedUsers(filter);
  }, [filter]);
  
  const fetchImportedUsers = async (status) => {
    const response = await fetch(
      `/api/admin/users/bulk-imported?status=${status}&page_size=50`,
      {
        headers: { 'Authorization': `Bearer ${token}` }
      }
    );
    
    const data = await response.json();
    setUsers(data.users);
  };
  
  return (
    <div>
      <select value={filter} onChange={(e) => setFilter(e.target.value)}>
        <option value="pending">Pending</option>
        <option value="accepted">Accepted</option>
        <option value="declined">Declined</option>
        <option value="expired">Expired</option>
      </select>
      
      <table>
        <thead>
          <tr>
            <th>Email</th>
            <th>Name</th>
            <th>Status</th>
            <th>Invited</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {users.map(user => (
            <tr key={user.id}>
              <td>{user.email}</td>
              <td>{user.full_name}</td>
              <td>
                <StatusBadge status={user.invitation_status} />
              </td>
              <td>{formatDate(user.invitation_sent_at)}</td>
              <td>
                {user.invitation_status === 'pending' && (
                  <button onClick={() => resendInvitation(user.id)}>
                    Resend
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

---

## User Flow & Status Lifecycle

### Import Flow

```
1. Admin uploads CSV
   ↓
2. System validates format
   ↓
3. Admin reviews field mapping & sample data
   ↓
4. Admin optionally selects specific rows
   ↓
5. System creates users & profiles
   ↓
6. System sends invitation emails
   ↓
7. Users receive invitation link
   ↓
8. User clicks link → Set password page
   ↓
9. User sets password → Profile activated
   ↓
10. User can create labs and join community
```

### Invitation Status Lifecycle

```
pending (initial) 
   ↓
   ├─→ accepted (user completed setup)
   ├─→ declined (user explicitly declined)
   └─→ expired (24 hours passed, no action)
```

### What Happens on Each Status

| Status | Description | Actions Available |
|--------|-------------|------------------|
| `pending` | Invitation sent, awaiting response | Resend email, Delete user |
| `accepted` | User completed password setup | Full access, Cannot delete |
| `declined` | User declined invitation | Delete user |
| `expired` | Invitation expired (>24h) | Resend email, Delete user |

---

## Security & Best Practices

### Password Security

✅ **Industry Standard Implementation:**

1. **Temporary Password Generation**
   - Uses bcrypt hashing (industry standard)
   - Pattern: `temp_import_{random_uuid}`
   - Hashed with bcrypt.gensalt() (auto-generated salt)
   
2. **Password Reset Token**
   - Cryptographically secure token (`secrets.token_urlsafe(32)`)
   - 24-hour expiration
   - Single-use only (`is_used` flag)

3. **User Activation Flow** (Same as OAuth)
   ```python
   # On import
   temp_password = bcrypt.hashpw(f"temp_import_{uuid4().hex}", bcrypt.gensalt())
   
   # User sets password via invitation link
   new_password = bcrypt.hashpw(user_password, bcrypt.gensalt())
   
   # Old temp password is replaced
   ```

### Profile Data Privacy

- **Invitation Decline:** If user declines, profile is marked `declined` and can be deleted by admin
- **Data Retention:** Imported but unactivated profiles are retained for 30 days (configurable)
- **Cleanup Job:** Automated cleanup runs hourly to remove expired invitations

### Admin Authorization

- All endpoints require admin authentication
- Uses JWT token validation
- Admin status verified on every request

---

## Error Handling

### Common Errors & Solutions

#### 1. Invalid CSV Format
```json
{
  "detail": "Invalid CSV format. Missing required fields: email"
}
```
**Solution:** Ensure CSV has at least one email column with a recognized name.

#### 2. User Already Exists
**Behavior:** Skipped automatically, counted in `skipped_users`

#### 3. Email Send Failure
**Behavior:** User created but error logged in `errors` array
```json
{
  "errors": ["Row 5: Failed to send email to john@example.com"]
}
```

#### 4. Invalid Email Format
```json
{
  "errors": ["Row 10: Invalid email format"]
}
```

#### 5. Authorization Failed
```json
{
  "detail": "Admin access required"
}
```
**Solution:** Ensure admin user is logged in with valid JWT token.

---

## Testing Checklist

### Backend Tests
- ✅ CSV validation with various field names
- ✅ Field mapping accuracy
- ✅ Profile type inference
- ✅ Duplicate email handling
- ✅ Password hashing verification
- ✅ Invitation email sending
- ✅ Token expiration
- ✅ Batch tracking

### Frontend Tests
- ✅ File upload UI
- ✅ Validation results display
- ✅ Field mapping table
- ✅ Row selection
- ✅ Import progress indicator
- ✅ Error message display
- ✅ Status filtering
- ✅ Bulk actions

---

## Support & Troubleshooting

### FAQ

**Q: What happens if CSV has unknown fields?**  
A: Unknown fields are safely ignored. Only recognized fields are mapped.

**Q: Can users be imported without sending emails?**  
A: No, invitation emails are required for password setup.

**Q: How long are invitation links valid?**  
A: 24 hours from import time.

**Q: Can I import users with existing emails?**  
A: Existing users are skipped automatically.

**Q: What if email sending fails?**  
A: User is created but error is logged. Admin can resend invitation.

---

## Changelog

**v1.0.0 (2026-01-24)**
- ✅ Initial implementation
- ✅ Flexible CSV field mapping
- ✅ Profile type inference
- ✅ Bcrypt password hashing
- ✅ Invitation email system
- ✅ Batch tracking
- ✅ Admin management endpoints

---

**Last Updated:** January 24, 2026  
**API Version:** 1.0.0  
**Status:** ✅ Production Ready
