# Enhanced Bulk Import System - Frontend Implementation Guide

## Overview

This guide provides comprehensive frontend implementation details for the enhanced bulk user import system with invitation tracking, bulk actions, analytics, retry functionality, and dynamic CSV template validation.

## New Features Implemented

### 1. Invitation Status Tracking
- **Purpose**: Track the status of each imported user through their invitation journey
- **Statuses**: `pending`, `accepted`, `declined`, `expired`
- **Metadata**: Invitation sent/responded timestamps, batch tracking

### 2. Bulk Actions System
- **Purpose**: Perform actions on multiple imported users at once
- **Actions**: Delete, Retry invitation, Force accept, Force decline

### 3. Analytics & Statistics
- **Purpose**: Comprehensive insights into import performance
- **Metrics**: Acceptance rates, batch history, status breakdowns

### 4. Retry Functionality
- **Purpose**: Resend invitations to expired/declined users
- **Features**: New token generation, fresh expiration, email resend

### 5. Dynamic CSV Template Validation
- **Purpose**: Support various CSV formats with intelligent field mapping
- **Features**: Flexible field name recognition, automatic type detection, validation feedback
- **Templates**: Support for standard, simple, academic, and minimal CSV formats

## New API Endpoints

### 1. Validate CSV File (NEW)
**Endpoint**: `POST /api/admin/users/validate-csv`
**Authentication**: Admin token required

#### Request:
- `file`: CSV file to validate

#### Response:
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
    }
  },
  "missing_required": [],
  "template_info": {
    "required_fields": [...],
    "optional_fields": [...],
    "examples": [...]
  },
  "sample_rows": [...]
}
```

### 2. Get Bulk Imported Users with Status
**Endpoint**: `GET /api/admin/users/bulk-imported`
**Authentication**: Admin token required

#### Query Parameters:
- `page`: Pagination (default: 1)
- `page_size`: Results per page (1-100, default: 20)
- `status_filter`: Filter by status (`pending|accepted|declined|expired`)
- `batch_id`: Filter by import batch
- `search`: Search by name

#### Response:
```json
{
  "users": [
    {
      "id": "profile-id",
      "email": "user@example.com",
      "full_name": "John Doe",
      "profile_type": "academic",
      "invitation_status": "pending",
      "invitation_sent_at": "2026-01-24T10:00:00Z",
      "invitation_responded_at": null,
      "import_batch_id": "batch-123"
    }
  ],
  "total": 50,
  "page": 1,
  "page_size": 20,
  "total_pages": 3
}
```

### 2. Bulk Actions on Users
**Endpoint**: `POST /api/admin/users/bulk-action`
**Authentication**: Admin token required

#### Request Body:
```json
{
  "user_ids": ["profile-id-1", "profile-id-2"],
  "action": "delete|retry|accept|decline"
}
```

#### Response:
```json
{
  "success": true,
  "message": "Successfully processed 2 users",
  "updated_count": 2,
  "errors": []
}
```

### 3. Bulk Import Users (Enhanced)
**Endpoint**: `POST /api/admin/users/bulk-import`
**Authentication**: Admin token required

#### Request Parameters:
- `file`: CSV file to import
- `selected_rows`: Optional JSON array of row indices

#### Enhanced Response:
```json
{
  "success": true,
  "message": "Imported 25 users, skipped 5",
  "created_users": 25,
  "skipped_users": 5,
  "errors": [],
  "field_mapping": {...},
  "template_info": {...}
}
```

### 4. Import Statistics & Analytics
**Endpoint**: `GET /api/admin/users/import-stats`
**Authentication**: Admin token required

#### Response:
```json
{
  "total_imported": 150,
  "pending": 25,
  "accepted": 80,
  "declined": 15,
  "expired": 30,
  "acceptance_rate": 84.21,
  "recent_batches": [
    {
      "id": "batch-123",
      "filename": "users_jan.csv",
      "created_at": "2026-01-24T10:00:00Z",
      "total_rows": 50,
      "successful_imports": 45,
      "failed_imports": 5,
      "status": "completed"
    }
  ]
}
```

## Frontend Implementation Guide

### 1. Enhanced Admin Dashboard

#### Component Structure:
```
components/admin/
  BulkImport/
    index.tsx              # Main import interface with validation
    CSVPreview.tsx          # Enhanced with field mapping display
    ImportProgress.tsx      # Status display
    CSVValidator.tsx        # NEW: CSV validation interface
    FieldMapping.tsx        # NEW: Field mapping visualization
  ImportedUsers/
    index.tsx              # User management dashboard
    UserList.tsx           # Filterable user list
    BulkActions.tsx        # Action panel
    UserStatus.tsx         # Status indicators
  ImportAnalytics/
    index.tsx              # Analytics dashboard
    StatsCards.tsx         # Key metrics
    BatchHistory.tsx       # Import history
```

### 2. Enhanced CSV Validation Component (NEW)

```typescript
// components/admin/BulkImport/CSVValidator.tsx
import React, { useState } from 'react';

interface FieldMapping {
  [csvField: string]: {
    db_field: string;
    field_type: string;
    required: boolean;
    csv_index: number;
  };
}

interface ValidationResult {
  is_valid: boolean;
  field_mapping: FieldMapping;
  missing_required: string[];
  template_info: {
    required_fields: Array<{csv_name: string; db_field: string; required: boolean}>;
    optional_fields: Array<{csv_name: string; db_field: string; required: boolean}>;
    examples: Array<{template_name: string; fields: string[]}>;
  };
  sample_rows: Array<{[key: string]: string}>;
}

interface CSVValidatorProps {
  onValidationComplete: (result: ValidationResult) => void;
  file: File;
}

export const CSVValidator: React.FC<CSVValidatorProps> = ({
  onValidationComplete,
  file
}) => {
  const [validating, setValidating] = useState(false);
  const [result, setResult] = useState<ValidationResult | null>(null);

  const validateFile = async () => {
    setValidating(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/admin/users/validate-csv', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: formData
      });

      const validationResult: ValidationResult = await response.json();
      setResult(validationResult);
      onValidationComplete(validationResult);
    } catch (error) {
      console.error('Validation failed:', error);
      alert('Failed to validate CSV file');
    } finally {
      setValidating(false);
    }
  };

  const getStatusColor = (valid: boolean) => {
    return valid ? '#4caf50' : '#f44336';
  };

  const getFieldTypeIcon = (fieldType: string) => {
    switch (fieldType) {
      case 'user': return '👤';
      case 'profile': return '👥';
      default: return '📄';
    }
  };

  return (
    <div className="csv-validator">
      <h2>CSV Template Validation</h2>
      
      <div className="validation-header">
        <button 
          onClick={validateFile}
          disabled={validating}
          className="validate-button"
        >
          {validating ? 'Validating...' : 'Validate CSV File'}
        </button>
      </div>

      {result && (
        <div className="validation-result">
          <div className="validation-status">
            <span 
              className="status-indicator"
              style={{ backgroundColor: getStatusColor(result.is_valid) }}
            />
            <strong>Validation Status:</strong> 
            <span className={result.is_valid ? 'success' : 'error'}>
              {result.is_valid ? 'Valid' : 'Invalid'}
            </span>
          </div>

          {!result.is_valid && result.missing_required.length > 0 && (
            <div className="missing-fields error-box">
              <h4>Missing Required Fields:</h4>
              <ul>
                {result.missing_required.map(field => (
                  <li key={field}>{field}</li>
                ))}
              </ul>
            </div>
          )}

          {result.is_valid && (
            <>
              <div className="field-mapping">
                <h3>Detected Field Mapping</h3>
                <table className="mapping-table">
                  <thead>
                    <tr>
                      <th>CSV Field</th>
                      <th>Database Field</th>
                      <th>Type</th>
                      <th>Required</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(result.field_mapping).map(([csvField, mapping]) => (
                      <tr key={csvField}>
                        <td>{csvField}</td>
                        <td>{mapping.db_field}</td>
                        <td>
                          <span className="field-type">
                            {getFieldTypeIcon(mapping.field_type)}
                            {mapping.field_type}
                          </span>
                        </td>
                        <td>
                          <span className={`required-badge ${mapping.required ? 'required' : 'optional'}`}>
                            {mapping.required ? 'Required' : 'Optional'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="template-examples">
                <h3>Supported Templates</h3>
                <div className="examples-grid">
                  {result.template_info.examples.map((example, index) => (
                    <div key={index} className="template-example">
                      <h4>{example.template_name}</h4>
                      <ul>
                        {example.fields.map((field, i) => (
                          <li key={i}>{field}</li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>

              <div className="sample-data">
                <h3>Sample Data (First 3 Rows)</h3>
                <div className="sample-rows">
                  {result.sample_rows.map((row, index) => (
                    <div key={index} className="sample-row">
                      <h4>Row {index + 2}:</h4>
                      {Object.entries(row).map(([key, value]) => (
                        <div key={key} className="field-value">
                          <strong>{key}:</strong> {value || '(empty)'}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};
```

### 3. Field Mapping Visualization Component (NEW)

```typescript
// components/admin/BulkImport/FieldMapping.tsx
import React from 'react';

interface FieldMappingProps {
  fieldMapping: {[key: string]: any};
  sampleRows: Array<{[key: string]: string}>;
}

export const FieldMapping: React.FC<FieldMappingProps> = ({
  fieldMapping,
  sampleRows
}) => {
  const getFieldTypeColor = (fieldType: string) => {
    switch (fieldType) {
      case 'user': return '#2196f3';
      case 'profile': return '#4caf50';
      default: return '#9e9e9e';
    }
  };

  const getMappedValue = (csvField: string, rowIndex: number) => {
    const mapping = fieldMapping[csvField];
    if (!mapping) return 'Not Mapped';
    
    const sampleRow = sampleRows[rowIndex];
    if (!sampleRow) return 'No Data';
    
    return sampleRow[csvField] || '(empty)';
  };

  return (
    <div className="field-mapping-visualization">
      <h3>Field Mapping Visualization</h3>
      
      <div className="mapping-overview">
        <div className="mapping-stats">
          <span className="mapped-fields">
            {Object.keys(fieldMapping).length} Fields Mapped
          </span>
          <span className="required-fields">
            {Object.values(fieldMapping).filter((m: any) => m.required).length} Required Fields
          </span>
        </div>
      </div>

      <table className="mapping-visualization-table">
        <thead>
          <tr>
            <th>CSV Field</th>
            <th>Database Field</th>
            <th>Type</th>
            {sampleRows.map((_, index) => (
              <th key={index}>Sample {index + 1}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Object.entries(fieldMapping).map(([csvField, mapping]: [string, any]) => (
            <tr key={csvField}>
              <td className="csv-field">{csvField}</td>
              <td className="db-field">{mapping.db_field}</td>
              <td>
                <span 
                  className="field-type-badge"
                  style={{ 
                    backgroundColor: getFieldTypeColor(mapping.field_type),
                    color: 'white'
                  }}
                >
                  {mapping.field_type}
                </span>
              </td>
              {sampleRows.map((_, index) => (
                <td key={index} className="sample-value">
                  {getMappedValue(csvField, index)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
```

### 4. Enhanced Import Component with Validation

```typescript
// components/admin/BulkImport/index.tsx (Updated)
import React, { useState } from 'react';
import { CSVPreview } from './CSVPreview';
import { ImportProgress } from './ImportProgress';
import { CSVValidator } from './CSVValidator';
import { FieldMapping } from './FieldMapping';

interface BulkImportProps {}

export const BulkImport: React.FC<BulkImportProps> = () => {
  const [file, setFile] = useState<File | null>(null);
  const [csvData, setCsvData] = useState<any[]>([]);
  const [selectedRows, setSelectedRows] = useState<number[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<any>(null);
  const [validationResult, setValidationResult] = useState<any>(null);
  const [isValidated, setIsValidated] = useState(false);

  const handleValidationComplete = (result: any) => {
    setValidationResult(result);
    setIsValidated(result.is_valid);
    
    if (result.is_valid) {
      // Parse CSV for preview using field mapping
      const text = file?.text();
      text.then(textContent => {
        const rows = textContent.split('\n').map(row => row.split(','));
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
      });
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFile = event.target.files?.[0];
    if (!uploadedFile) return;

    setFile(uploadedFile);
    setIsValidated(false);
    setValidationResult(null);
    setCsvData([]);
    setSelectedRows([]);
  };

  const handleImport = async () => {
    if (!file || !isValidated) return;

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

      {file && !isValidated && (
        <CSVValidator 
          file={file} 
          onValidationComplete={handleValidationComplete}
        />
      )}

      {isValidated && validationResult && (
        <>
          <FieldMapping 
            fieldMapping={validationResult.field_mapping}
            sampleRows={validationResult.sample_rows}
          />

          {csvData.length > 0 && (
            <CSVPreview
              data={csvData}
              selectedRows={selectedRows}
              onSelectionChange={setSelectedRows}
            />
          )}

          <div className="import-actions">
            <button
              onClick={handleImport}
              disabled={isImporting || selectedRows.length === 0}
              className="import-button"
            >
              {isImporting ? 'Importing...' : `Import ${selectedRows.length} Users`}
            </button>
          </div>

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
        </>
      )}
    </div>
  );
};
```

interface ImportedUser {
  id: string;
  email: string;
  full_name: string;
  profile_type: string;
  invitation_status: 'pending' | 'accepted' | 'declined' | 'expired';
  invitation_sent_at: string;
  invitation_responded_at: string | null;
  import_batch_id: string;
}

interface BulkUsersResponse {
  users: ImportedUser[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export const ImportedUsersManager: React.FC = () => {
  const [users, setUsers] = useState<ImportedUser[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [filters, setFilters] = useState({
    status: '',
    batchId: '',
    search: ''
  });
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: 20,
    total: 0,
    totalPages: 0
  });
  const [loading, setLoading] = useState(false);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        page_size: pagination.pageSize.toString(),
        ...(filters.status && { status_filter: filters.status }),
        ...(filters.batchId && { batch_id: filters.batchId }),
        ...(filters.search && { search: filters.search })
      });

      const response = await fetch(`/api/admin/users/bulk-imported?${params}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      const data: BulkUsersResponse = await response.json();
      setUsers(data.users);
      setPagination(prev => ({
        ...prev,
        total: data.total,
        totalPages: data.total_pages
      }));
    } catch (error) {
      console.error('Failed to fetch users:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [pagination.page, filters]);

  const handleBulkAction = async (action: string) => {
    if (selectedUsers.length === 0) return;

    try {
      const response = await fetch('/api/admin/users/bulk-action', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          user_ids: selectedUsers,
          action
        })
      });

      const result = await response.json();
      
      if (result.success) {
        setSelectedUsers([]);
        fetchUsers(); // Refresh the list
        alert(`Successfully ${action} ${result.updated_count} users`);
      } else {
        alert('Action failed');
      }
    } catch (error) {
      console.error('Bulk action failed:', error);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'accepted': return 'green';
      case 'pending': return 'orange';
      case 'declined': return 'red';
      case 'expired': return 'gray';
      default: return 'gray';
    }
  };

  return (
    <div className="imported-users-manager">
      <h1>Imported Users Management</h1>
      
      {/* Filters */}
      <div className="filters-section">
        <select
          value={filters.status}
          onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
        >
          <option value="">All Statuses</option>
          <option value="pending">Pending</option>
          <option value="accepted">Accepted</option>
          <option value="declined">Declined</option>
          <option value="expired">Expired</option>
        </select>
        
        <input
          type="text"
          placeholder="Search by name..."
          value={filters.search}
          onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
        />
        
        <button onClick={fetchUsers}>Refresh</button>
      </div>

      {/* Bulk Actions */}
      {selectedUsers.length > 0 && (
        <BulkActions
          selectedCount={selectedUsers.length}
          onAction={handleBulkAction}
        />
      )}

      {/* User List */}
      <div className="user-list-container">
        <table className="user-table">
          <thead>
            <tr>
              <th>
                <input
                  type="checkbox"
                  checked={selectedUsers.length === users.length}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedUsers(users.map(u => u.id));
                    } else {
                      setSelectedUsers([]);
                    }
                  }}
                />
              </th>
              <th>Name</th>
              <th>Email</th>
              <th>Profile Type</th>
              <th>Status</th>
              <th>Sent At</th>
              <th>Responded At</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id}>
                <td>
                  <input
                    type="checkbox"
                    checked={selectedUsers.includes(user.id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedUsers(prev => [...prev, user.id]);
                      } else {
                        setSelectedUsers(prev => prev.filter(id => id !== user.id));
                      }
                    }}
                  />
                </td>
                <td>{user.full_name}</td>
                <td>{user.email}</td>
                <td>{user.profile_type}</td>
                <td>
                  <span className={`status-badge ${getStatusColor(user.invitation_status)}`}>
                    {user.invitation_status}
                  </span>
                </td>
                <td>{new Date(user.invitation_sent_at).toLocaleDateString()}</td>
                <td>
                  {user.invitation_responded_at 
                    ? new Date(user.invitation_responded_at).toLocaleDateString()
                    : '-'}
                </td>
                <td>
                  <div className="action-buttons">
                    {user.invitation_status === 'expired' && (
                      <button onClick={() => handleBulkAction('retry')}>
                        Retry
                      </button>
                    )}
                    {user.invitation_status === 'pending' && (
                      <button onClick={() => handleBulkAction('accept')}>
                        Force Accept
                      </button>
                    )}
                    <button onClick={() => handleBulkAction('delete')}>
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="pagination">
        <button
          onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
          disabled={pagination.page <= 1}
        >
          Previous
        </button>
        <span>
          Page {pagination.page} of {pagination.totalPages}
        </span>
        <button
          onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
          disabled={pagination.page >= pagination.totalPages}
        >
          Next
        </button>
      </div>
    </div>
  );
};
```

### 3. Bulk Actions Component

```typescript
// components/admin/ImportedUsers/BulkActions.tsx
import React from 'react';

interface BulkActionsProps {
  selectedCount: number;
  onAction: (action: string) => void;
}

export const BulkActions: React.FC<BulkActionsProps> = ({
  selectedCount,
  onAction
}) => {
  return (
    <div className="bulk-actions">
      <h3>Bulk Actions ({selectedCount} selected)</h3>
      
      <div className="action-buttons">
        <button 
          onClick={() => onAction('delete')}
          className="danger"
        >
          Delete Users
        </button>
        
        <button 
          onClick={() => onAction('retry')}
          className="warning"
        >
          Retry Invitations
        </button>
        
        <button 
          onClick={() => onAction('accept')}
          className="success"
        >
          Force Accept
        </button>
        
        <button 
          onClick={() => onAction('decline')}
          className="secondary"
        >
          Force Decline
        </button>
      </div>
      
      <p className="action-warning">
        These actions are irreversible and will be applied to all selected users.
      </p>
    </div>
  );
};
```

### 4. Analytics Dashboard Component

```typescript
// components/admin/ImportAnalytics/index.tsx
import React, { useState, useEffect } from 'react';

interface ImportStats {
  total_imported: number;
  pending: number;
  accepted: number;
  declined: number;
  expired: number;
  acceptance_rate: number;
  recent_batches: Array<{
    id: string;
    filename: string;
    created_at: string;
    total_rows: number;
    successful_imports: number;
    failed_imports: number;
    status: string;
  }>;
}

export const ImportAnalytics: React.FC = () => {
  const [stats, setStats] = useState<ImportStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const response = await fetch('/api/admin/users/import-stats', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      const data: ImportStats = await response.json();
      setStats(data);
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div>Loading analytics...</div>;
  }

  if (!stats) {
    return <div>Failed to load analytics</div>;
  }

  return (
    <div className="import-analytics">
      <h1>Import Analytics Dashboard</h1>
      
      {/* Stats Cards */}
      <div className="stats-grid">
        <div className="stat-card total">
          <h3>Total Imported</h3>
          <div className="stat-value">{stats.total_imported}</div>
        </div>
        
        <div className="stat-card pending">
          <h3>Pending</h3>
          <div className="stat-value">{stats.pending}</div>
          <div className="stat-percentage">
            {((stats.pending / stats.total_imported) * 100).toFixed(1)}%
          </div>
        </div>
        
        <div className="stat-card accepted">
          <h3>Accepted</h3>
          <div className="stat-value">{stats.accepted}</div>
          <div className="stat-percentage">
            {((stats.accepted / stats.total_imported) * 100).toFixed(1)}%
          </div>
        </div>
        
        <div className="stat-card declined">
          <h3>Declined</h3>
          <div className="stat-value">{stats.declined}</div>
          <div className="stat-percentage">
            {((stats.declined / stats.total_imported) * 100).toFixed(1)}%
          </div>
        </div>
        
        <div className="stat-card expired">
          <h3>Expired</h3>
          <div className="stat-value">{stats.expired}</div>
          <div className="stat-percentage">
            {((stats.expired / stats.total_imported) * 100).toFixed(1)}%
          </div>
        </div>
        
        <div className="stat-card acceptance-rate">
          <h3>Acceptance Rate</h3>
          <div className="stat-value">{stats.acceptance_rate}%</div>
          <div className="stat-description">of responded invitations</div>
        </div>
      </div>

      {/* Recent Batches */}
      <div className="recent-batches">
        <h3>Recent Import Batches</h3>
        <table className="batch-table">
          <thead>
            <tr>
              <th>File Name</th>
              <th>Date</th>
              <th>Total Rows</th>
              <th>Successful</th>
              <th>Failed</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {stats.recent_batches.map((batch) => (
              <tr key={batch.id}>
                <td>{batch.filename}</td>
                <td>{new Date(batch.created_at).toLocaleDateString()}</td>
                <td>{batch.total_rows}</td>
                <td>{batch.successful_imports}</td>
                <td>{batch.failed_imports}</td>
                <td>
                  <span className={`status-badge ${batch.status}`}>
                    {batch.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      <button onClick={fetchStats} className="refresh-button">
        Refresh Analytics
      </button>
    </div>
  );
};
```

### 5. CSS Styles

```css
/* components/admin/ImportedUsers/styles.css */
.imported-users-manager {
  padding: 20px;
  max-width: 1200px;
  margin: 0 auto;
}

.filters-section {
  display: flex;
  gap: 10px;
  margin-bottom: 20px;
  padding: 15px;
  background: #f5f5f5;
  border-radius: 8px;
}

/* CSV Validator Styles */
.csv-validator {
  padding: 20px;
  background: #f8f9fa;
  border-radius: 8px;
  margin-bottom: 20px;
}

.validation-header {
  margin-bottom: 20px;
}

.validate-button {
  background: #2196f3;
  color: white;
  border: none;
  padding: 12px 24px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 16px;
}

.validate-button:hover {
  background: #1976d2;
}

.validate-button:disabled {
  background: #ccc;
  cursor: not-allowed;
}

.validation-result {
  margin-top: 20px;
}

.validation-status {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 20px;
  font-size: 18px;
  font-weight: bold;
}

.status-indicator {
  width: 16px;
  height: 16px;
  border-radius: 50%;
}

.success {
  color: #4caf50;
}

.error {
  color: #f44336;
}

.error-box {
  background: #ffebee;
  border: 1px solid #f44336;
  border-radius: 4px;
  padding: 15px;
  margin-bottom: 20px;
}

.field-mapping {
  margin-bottom: 30px;
}

.mapping-table {
  width: 100%;
  border-collapse: collapse;
  margin-bottom: 20px;
}

.mapping-table th,
.mapping-table td {
  padding: 12px;
  text-align: left;
  border-bottom: 1px solid #ddd;
}

.mapping-table th {
  background: #f5f5f5;
  font-weight: 600;
}

.field-type {
  display: flex;
  align-items: center;
  gap: 5px;
}

.required-badge {
  padding: 4px 8px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 500;
  text-transform: uppercase;
}

.required-badge.required {
  background: #e8f5e8;
  color: #2e7d32;
}

.required-badge.optional {
  background: #fff3e0;
  color: #f57c00;
}

.template-examples {
  margin-bottom: 30px;
}

.examples-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 20px;
}

.template-example {
  background: white;
  padding: 15px;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.template-example h4 {
  margin: 0 0 10px 0;
  color: #2196f3;
}

.template-example ul {
  margin: 0;
  padding-left: 20px;
}

.sample-data {
  margin-bottom: 30px;
}

.sample-rows {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 20px;
}

.sample-row {
  background: #f8f9fa;
  padding: 15px;
  border-radius: 8px;
  border-left: 4px solid #2196f3;
}

.sample-row h4 {
  margin: 0 0 10px 0;
  color: #1976d2;
}

.field-value {
  margin-bottom: 5px;
  padding: 2px 0;
}

.field-mapping-visualization {
  margin-bottom: 30px;
}

.mapping-overview {
  margin-bottom: 20px;
}

.mapping-stats {
  display: flex;
  gap: 20px;
  margin-bottom: 20px;
}

.mapped-fields,
.required-fields {
  background: #e3f2fd;
  padding: 10px 15px;
  border-radius: 4px;
  font-weight: 500;
}

.mapping-visualization-table {
  width: 100%;
  border-collapse: collapse;
  margin-bottom: 20px;
}

.mapping-visualization-table th,
.mapping-visualization-table td {
  padding: 10px;
  text-align: left;
  border-bottom: 1px solid #ddd;
}

.csv-field {
  font-family: monospace;
  background: #f5f5f5;
  padding: 4px 8px;
  border-radius: 3px;
}

.db-field {
  color: #2196f3;
  font-weight: 500;
}

.field-type-badge {
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
}

.sample-value {
  font-size: 12px;
  color: #666;
}

.filters-section select,
.filters-section input {
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
}

.bulk-actions {
  background: #e3f2fd;
  padding: 15px;
  border-radius: 8px;
  margin-bottom: 20px;
}

.action-buttons {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.action-buttons button {
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.action-buttons button.danger {
  background: #f44336;
  color: white;
}

.action-buttons button.warning {
  background: #ff9800;
  color: white;
}

.action-buttons button.success {
  background: #4caf50;
  color: white;
}

.action-buttons button.secondary {
  background: #9e9e9e;
  color: white;
}

.user-table {
  width: 100%;
  border-collapse: collapse;
  margin-bottom: 20px;
}

.user-table th,
.user-table td {
  padding: 12px;
  text-align: left;
  border-bottom: 1px solid #ddd;
}

.user-table th {
  background: #f5f5f5;
  font-weight: 600;
}

.status-badge {
  padding: 4px 8px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 500;
  text-transform: uppercase;
}

.status-badge.pending { background: #fff3cd; color: #856404; }
.status-badge.accepted { background: #d4edda; color: #155724; }
.status-badge.declined { background: #f8d7da; color: #721c24; }
.status-badge.expired { background: #e2e3e5; color: #383d41; }

.pagination {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 10px;
  margin-top: 20px;
}

.pagination button {
  padding: 8px 16px;
  border: 1px solid #ddd;
  background: white;
  cursor: pointer;
}

.pagination button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Analytics Styles */
.import-analytics {
  padding: 20px;
  max-width: 1200px;
  margin: 0 auto;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 20px;
  margin-bottom: 40px;
}

.stat-card {
  background: white;
  padding: 20px;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  text-align: center;
}

.stat-value {
  font-size: 2.5em;
  font-weight: bold;
  margin: 10px 0;
}

.stat-card.total .stat-value { color: #2196f3; }
.stat-card.pending .stat-value { color: #ff9800; }
.stat-card.accepted .stat-value { color: #4caf50; }
.stat-card.declined .stat-value { color: #f44336; }
.stat-card.expired .stat-value { color: #9e9e9e; }
.stat-card.acceptance-rate .stat-value { color: #673ab7; }

.recent-batches {
  background: white;
  padding: 20px;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.batch-table {
  width: 100%;
  border-collapse: collapse;
  margin-top: 15px;
}

.batch-table th,
.batch-table td {
  padding: 12px;
  text-align: left;
  border-bottom: 1px solid #ddd;
}
```

## Database Migration

The new features require database schema changes. Run the migration:

```bash
alembic upgrade head
```

This will:
- Add invitation tracking columns to the `profiles` table
- Create the `import_batches` table
- Add appropriate indexes for performance

## Testing Strategy

### Frontend Tests:
1. **CSV Validation**: Test validation with various CSV formats and edge cases
2. **Field Mapping**: Verify proper field recognition and mapping display
3. **Template Support**: Test different CSV template formats
4. **User List Rendering**: Verify status indicators and data display
5. **Bulk Actions**: Test each action type with different user selections
6. **Filters**: Test status filtering, search functionality
7. **Analytics**: Verify statistics calculations and batch history display
8. **Pagination**: Test navigation through large datasets

### Integration Tests:
1. **End-to-End Import**: CSV validation → Field mapping → Import → Status tracking → Bulk actions
2. **Template Flexibility**: Test with various CSV formats (standard, simple, academic, minimal)
3. **Retry Flow**: Expired user → Retry → Accept/Decline
4. **Analytics Accuracy**: Verify stats match actual database state
5. **Performance**: Test with large user datasets and complex CSVs

### CSV Validation Test Cases:
1. **Valid Templates**: Standard, simple, academic, minimal formats
2. **Missing Required Fields**: CSV without email column
3. **Invalid Email Formats**: Malformed email addresses
4. **Duplicate Headers**: Same field name mapped multiple times
5. **Special Characters**: Names with Unicode characters
6. **Empty Rows**: CSV with blank data rows
7. **Large Files**: Performance with 1000+ rows

## Security Considerations

1. **Admin Authentication**: All endpoints require admin privileges
2. **Action Logging**: All bulk actions are logged for audit purposes
3. **Data Validation**: Validate user IDs before processing actions
4. **Rate Limiting**: Consider implementing rate limits for bulk actions

## Performance Optimizations

1. **Database Indexes**: Added indexes on status, token, and batch_id columns
2. **Pagination**: All user lists are paginated to handle large datasets
3. **Batch Processing**: Bulk actions process users efficiently
4. **Caching**: Consider caching analytics data for dashboard performance
5. **CSV Parsing**: Efficient parsing with streaming for large files
6. **Field Mapping Optimization**: Caching of field recognition patterns
7. **Validation Caching**: Cache validation results for repeated uploads

## Migration Guide

### For Existing Frontend Implementations:
1. **Add CSV Validation Step**: Include validation before import flow
2. **Update Import Component**: Integrate validation and field mapping visualization
3. **Enhance Error Handling**: Add validation-specific error messages
4. **Update Response Handling**: Process new field mapping and template info in import response

### Step-by-Step Frontend Updates:
1. **Add New Components**: `CSVValidator.tsx`, `FieldMapping.tsx`
2. **Update Import Flow**: File upload → Validation → Field mapping → Import
3. **Update UI**: Add validation status and field mapping display
4. **Handle New Responses**: Process enhanced import response with field mapping data

## CSV Template Best Practices

### Recommended Template Structure:
```csv
Email address,Full name(s),Mobile Number,What's your occupation?,College/University,Department/Faculty,Study Program/Major,Field of Specialization,Idea (250 words)
```

### Alternative Supported Structures:
- **Simple**: `Email,Name,Phone,Occupation,Organization,Bio`
- **Academic**: `email,first_name,last_name,university,department,major,specialization`
- **Minimal**: `Email address,Full name,What's your occupation?`

### Field Naming Guidelines:
- Use descriptive column headers
- Support common variations (email vs Email address)
- Include at least email field (required)
- Optional fields can use any recognized variation

This enhanced system provides comprehensive management capabilities for bulk imported users with flexible CSV template support, intelligent field mapping, full lifecycle tracking, actionable insights, and efficient bulk operations.