# Bulk User Import & Invitation System - Frontend Integration Guide

## Overview

This document provides comprehensive guidance for frontend developers to implement the bulk user import and invitation system for the Unlokinno Intelligence Platform. The system allows administrators to upload CSV files containing user information, create profiles, and send invitation emails to users for account setup.

## Features Implemented

### 1. CSV Bulk Import System
- **Purpose**: Allow administrators to import multiple users from a CSV file
- **Location**: Admin dashboard → User Management → Bulk Import
- **Functionality**: Upload CSV, preview data, select specific rows, create profiles, send invitations

### 2. Invitation-Based Account Setup
- **Purpose**: Users receive email invitations to set up their accounts
- **Flow**: Email → Setup Page → Accept/Decline → Password Creation → Account Activation

### 3. Profile Management
- **Purpose**: Automatically create profiles based on CSV data
- **Mapping**: CSV fields mapped to profile attributes (name, email, occupation, etc.)

## API Endpoints

### 1. Bulk Import Users
**Endpoint**: `POST /api/admin/users/bulk-import`
**Authentication**: Admin token required
**Content-Type**: `multipart/form-data`

#### Request Parameters:
- `file` (File): CSV file to import
- `selected_rows` (Optional, String): JSON array of row indices to import (0-based)

#### CSV Format Requirements:
```csv
Timestamp,Email address,select theme,Individual /group,Full name(s),Mobile Number,What's your occupation?,College/University,Department/Faculty,Study Program/Major,Organisation/company,Position/Occupancy,Field of Specialization,Idea (250 words),Ideas title,Attach photos (if any ) as a proof of work,Want to submit your idea?
```

#### Response:
```json
{
  "success": true,
  "message": "Imported 25 users, skipped 5, 2 errors",
  "created_users": 25,
  "skipped_users": 5,
  "errors": [
    "Row 12: Missing email",
    "Row 18: Failed to send email to user@example.com"
  ]
}
```

### 2. Check Invitation Status
**Endpoint**: `GET /api/auth/invitation-status`
**Authentication**: None (public)
**Query Parameters**: `token` (String)

#### Response:
```json
{
  "valid": true,
  "expired": false,
  "used": false,
  "user_email": "user@example.com",
  "profile_type": "academic"
}
```

### 3. Setup Invitation
**Endpoint**: `POST /api/auth/invitation-setup`
**Authentication**: None (public)
**Content-Type**: `application/json`

#### Request Body:
```json
{
  "token": "abc123...",
  "password": "securePassword123",
  "accept": true
}
```

#### Response (Accept):
```json
{
  "message": "Account activated successfully. You can now log in."
}
```

#### Response (Decline):
```json
{
  "message": "Invitation declined. Your information has been removed."
}
```

#### Response (Expired):
```json
{
  "valid": false,
  "expired": true
}
```

## Frontend Implementation Guide

### 1. Admin Dashboard - Bulk Import Component

#### File Structure:
```
components/
  admin/
    BulkImport/
      index.tsx
      CSVPreview.tsx
      ImportProgress.tsx
```

#### Component Implementation:

```typescript
// components/admin/BulkImport/index.tsx
import React, { useState } from 'react';
import { CSVPreview } from './CSVPreview';
import { ImportProgress } from './ImportProgress';

interface BulkImportProps {}

export const BulkImport: React.FC<BulkImportProps> = () => {
  const [file, setFile] = useState<File | null>(null);
  const [csvData, setCsvData] = useState<any[]>([]);
  const [selectedRows, setSelectedRows] = useState<number[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<any>(null);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFile = event.target.files?.[0];
    if (!uploadedFile) return;

    setFile(uploadedFile);
    
    // Parse CSV for preview
    const text = await uploadedFile.text();
    const rows = text.split('\n').map(row => row.split(','));
    const headers = rows[0];
    const data = rows.slice(1).map((row, index) => ({
      index,
      data: headers.reduce((obj, header, i) => ({
        ...obj,
        [header]: row[i] || ''
      }), {})
    }));
    
    setCsvData(data);
    setSelectedRows(data.map((_, index) => index)); // Select all by default
  };

  const handleImport = async () => {
    if (!file) return;

    setIsImporting(true);
    
    const formData = new FormData();
    formData.append('file', file);
    formData.append('selected_rows', JSON.stringify(selectedRows));

    try {
      const response = await fetch('/api/admin/users/bulk-import', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: formData
      });

      const result = await response.json();
      setImportResult(result);
    } catch (error) {
      console.error('Import failed:', error);
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="bulk-import-container">
      <h2>Bulk User Import</h2>
      
      <div className="upload-section">
        <input
          type="file"
          accept=".csv"
          onChange={handleFileUpload}
          disabled={isImporting}
        />
      </div>

      {csvData.length > 0 && (
        <CSVPreview
          data={csvData}
          selectedRows={selectedRows}
          onSelectionChange={setSelectedRows}
        />
      )}

      {file && (
        <div className="import-actions">
          <button
            onClick={handleImport}
            disabled={isImporting || selectedRows.length === 0}
            className="import-button"
          >
            {isImporting ? 'Importing...' : `Import ${selectedRows.length} Users`}
          </button>
        </div>
      )}

      {isImporting && <ImportProgress />}
      
      {importResult && (
        <div className="import-result">
          <h3>Import Complete</h3>
          <p>{importResult.message}</p>
          <div className="result-stats">
            <span>Created: {importResult.created_users}</span>
            <span>Skipped: {importResult.skipped_users}</span>
            <span>Errors: {importResult.errors.length}</span>
          </div>
          {importResult.errors.length > 0 && (
            <div className="error-list">
              <h4>Errors:</h4>
              {importResult.errors.map((error: string, index: number) => (
                <div key={index} className="error-item">{error}</div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
```

#### CSV Preview Component:

```typescript
// components/admin/BulkImport/CSVPreview.tsx
import React from 'react';

interface CSVPreviewProps {
  data: any[];
  selectedRows: number[];
  onSelectionChange: (rows: number[]) => void;
}

export const CSVPreview: React.FC<CSVPreviewProps> = ({
  data,
  selectedRows,
  onSelectionChange
}) => {
  const headers = Object.keys(data[0]?.data || {});

  const handleRowSelect = (index: number) => {
    const newSelection = selectedRows.includes(index)
      ? selectedRows.filter(i => i !== index)
      : [...selectedRows, index];
    onSelectionChange(newSelection);
  };

  const handleSelectAll = () => {
    onSelectionChange(
      selectedRows.length === data.length
        ? []
        : data.map((_, index) => index)
    );
  };

  return (
    <div className="csv-preview">
      <div className="preview-header">
        <h3>CSV Preview ({data.length} rows)</h3>
        <button onClick={handleSelectAll}>
          {selectedRows.length === data.length ? 'Deselect All' : 'Select All'}
        </button>
      </div>
      
      <div className="csv-table-container">
        <table className="csv-table">
          <thead>
            <tr>
              <th>
                <input
                  type="checkbox"
                  checked={selectedRows.length === data.length}
                  onChange={handleSelectAll}
                />
              </th>
              <th>Row</th>
              <th>Email</th>
              <th>Full Name</th>
              <th>Occupation</th>
              <th>Organization</th>
              <th>Mobile</th>
            </tr>
          </thead>
          <tbody>
            {data.map((row, index) => (
              <tr key={index} className={selectedRows.includes(index) ? 'selected' : ''}>
                <td>
                  <input
                    type="checkbox"
                    checked={selectedRows.includes(index)}
                    onChange={() => handleRowSelect(index)}
                  />
                </td>
                <td>{index + 2}</td>
                <td>{row.data['Email address']}</td>
                <td>{row.data['Full name(s)']}</td>
                <td>{row.data["What's your occupation?"]}</td>
                <td>
                  {row.data['College/University'] || 
                   row.data['Organisation/company']}
                </td>
                <td>{row.data['Mobile Number']}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
```

### 2. Invitation Setup Page

#### Component Implementation:

```typescript
// pages/invitation-setup.tsx
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';

interface InvitationStatus {
  valid: boolean;
  expired?: boolean;
  used?: boolean;
  user_email?: string;
  profile_type?: string;
}

export default function InvitationSetup() {
  const router = useRouter();
  const [token, setToken] = useState<string>('');
  const [status, setStatus] = useState<InvitationStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const { token: queryToken } = router.query;
    if (queryToken && typeof queryToken === 'string') {
      setToken(queryToken);
      checkInvitationStatus(queryToken);
    }
  }, [router.query]);

  const checkInvitationStatus = async (invitationToken: string) => {
    try {
      const response = await fetch(
        `/api/auth/invitation-status?token=${invitationToken}`
      );
      const data = await response.json();
      setStatus(data);
    } catch (error) {
      setError('Failed to verify invitation');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (accept: boolean) => {
    if (accept && !password) {
      setError('Password is required');
      return;
    }

    if (accept && password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      const response = await fetch('/api/auth/invitation-setup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          token,
          password: accept ? password : '',
          accept
        })
      });

      const data = await response.json();

      if (response.ok) {
        if (accept) {
          // Redirect to login with success message
          router.push('/login?message=account_activated');
        } else {
          // Show declined message
          router.push('/?message=invitation_declined');
        }
      } else {
        setError(data.detail || 'Failed to process invitation');
      }
    } catch (error) {
      setError('Network error. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return <div className="loading">Verifying invitation...</div>;
  }

  if (!status?.valid) {
    return (
      <div className="invitation-invalid">
        <h1>Invalid Invitation</h1>
        <p>
          {status?.expired ? 'This invitation has expired.' : 
           status?.used ? 'This invitation has already been used.' :
           'This invitation is not valid.'}
        </p>
        <button onClick={() => router.push('/')}>
          Return to Home
        </button>
      </div>
    );
  }

  return (
    <div className="invitation-setup">
      <div className="setup-card">
        <h1>Welcome to Unlokinno Intelligence!</h1>
        
        <div className="invitation-info">
          <p>You've been invited to join as a <strong>{status.profile_type}</strong></p>
          <p>Email: <strong>{status.user_email}</strong></p>
        </div>

        <div className="setup-options">
          <h2>Choose Your Option:</h2>
          
          <div className="option accept">
            <h3>Accept Invitation</h3>
            <p>Set up your password and start using the platform</p>
            
            <div className="password-section">
              <input
                type="password"
                placeholder="Create a password (min 8 characters)"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isSubmitting}
              />
            </div>
            
            <button
              onClick={() => handleSubmit(true)}
              disabled={isSubmitting || !password}
              className="accept-button"
            >
              {isSubmitting ? 'Setting up...' : 'Accept & Set Password'}
            </button>
          </div>

          <div className="option decline">
            <h3>Decline Invitation</h3>
            <p>Your information will be permanently removed</p>
            
            <button
              onClick={() => handleSubmit(false)}
              disabled={isSubmitting}
              className="decline-button"
            >
              {isSubmitting ? 'Processing...' : 'Decline Invitation'}
            </button>
          </div>
        </div>

        {error && <div className="error-message">{error}</div>}
      </div>
    </div>
  );
}
```

### 3. Email Template Integration

#### Email Content Structure:
The invitation emails contain:
- Welcome message
- Profile type information
- Setup link with token
- Expiration information (24 hours) - automatic profile removal if not accepted
- Platform benefits
- Decline option

#### Automated Cleanup:
- **Scheduler**: Runs every hour to check for expired invitations
- **Action**: Automatically deletes users whose invitations have expired (24 hours)
- **Behavior**: Same as user declining - complete data removal
- **Logging**: Audit trail of all automatic deletions

#### Setup Link Format:
```
http://your-domain.com/invitation-setup?token={token}
```

## Error Handling

### Common Error Scenarios:

1. **Invalid CSV Format**
   - Frontend: Validate file type and headers
   - Backend: Return specific error messages

2. **Duplicate Emails**
   - Backend: Skip existing users
   - Frontend: Show skipped count in results

3. **Invalid Invitation Token**
   - Frontend: Show appropriate error message
   - Backend: Validate token existence and expiration

4. **Expired Invitation Token**
   - Frontend: Show "invitation expired" message
   - Backend: User automatically deleted by cleanup scheduler
   - Action: User needs to be re-imported by admin

5. **Email Sending Failures**
   - Backend: Log errors but continue processing
   - Frontend: Show partial success results

## Security Considerations

1. **Admin Authentication**: All import endpoints require admin tokens
2. **Token Security**: Invitation tokens are cryptographically secure
3. **Password Validation**: Minimum 8 characters required
4. **Rate Limiting**: Consider implementing rate limits for invitation checks
5. **Data Privacy**: Declined invitations permanently delete user data

## Testing Strategy

### Frontend Tests:
1. **File Upload**: Test various CSV formats and edge cases
2. **Preview Functionality**: Test row selection and data display
3. **Import Process**: Test successful imports and error handling
4. **Invitation Flow**: Test acceptance and decline scenarios
5. **Form Validation**: Test password requirements and error messages

### Integration Tests:
1. **End-to-End Flow**: CSV upload → Email → Setup → Login
2. **Error Scenarios**: Invalid tokens, expired invitations
3. **Admin Permissions**: Test unauthorized access prevention

## Deployment Notes

1. **Environment Variables**: Ensure SMTP configuration is set
2. **Frontend URL**: Update invitation links with production domain
3. **Email Templates**: Customize branding and messaging
4. **Monitoring**: Track import success rates and email delivery

## Support & Troubleshooting

### Common Issues:
1. **CSV Parsing Errors**: Ensure proper CSV format with correct headers
2. **Email Not Received**: Check SMTP configuration and spam filters
3. **Token Invalid**: Verify token hasn't expired or been used
4. **Permission Errors**: Ensure user has admin privileges

### Debug Information:
- Check browser console for JavaScript errors
- Review network tab for API responses
- Check server logs for detailed error messages
- Verify email service configuration

## Future Enhancements

### Potential Improvements:
1. **Progress Tracking**: Real-time import progress updates
2. **Template System**: Customizable CSV templates
3. **Bulk Actions**: Delete or update imported users
4. **Analytics**: Import statistics and success metrics
5. **Email Customization**: Editable email templates
6. **Validation Rules**: Custom field validation for CSV data

---

This guide provides all necessary information for frontend developers to implement the bulk user import and invitation system. The APIs are designed to be RESTful and provide clear error messages for robust frontend integration.