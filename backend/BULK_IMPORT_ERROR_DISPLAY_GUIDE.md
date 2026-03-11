# Bulk Import Frontend Integration - Error Display Guide

## API Response Structure

### Complete Response with Error Details

```json
{
  "success": true,
  "message": "Imported 0 users, skipped 1, 1 errors",
  "created_users": 0,
  "skipped_users": 1,
  "errors": [
    "Row 2: User with email daniel.doe@a2sv.org already exists"
  ],
  "details": {
    "total_rows_processed": 1,
    "batch_id": "uuid-here",
    "has_errors": true,
    "error_count": 1,
    "error_breakdown": {
      "validation_errors": [],
      "duplicate_users": [
        "Row 2: User with email daniel.doe@a2sv.org already exists"
      ],
      "other_errors": []
    },
    "summary": {
      "success_rate": 0.0,
      "skip_rate": 100.0
    }
  }
}
```

---

## React Component Implementation

```tsx
import React, { useState } from 'react';

interface BulkImportResult {
  success: boolean;
  message: string;
  created_users: number;
  skipped_users: number;
  errors: string[];
  details?: {
    total_rows_processed: number;
    batch_id: string;
    has_errors: boolean;
    error_count: number;
    error_breakdown: {
      validation_errors: string[];
      duplicate_users: string[];
      other_errors: string[];
    };
    summary: {
      success_rate: number;
      skip_rate: number;
    };
  };
}

export const BulkImport: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<BulkImportResult | null>(null);
  const [loading, setLoading] = useState(false);

  const handleImport = async () => {
    if (!file) return;

    setLoading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('/api/admin/users/bulk-import', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: formData
      });

      const data = await response.json();
      setResult(data);

      // Show notifications
      if (data.created_users > 0) {
        alert(`✅ Successfully imported ${data.created_users} users!`);
      }
      if (data.errors.length > 0) {
        alert(`⚠️ ${data.errors.length} issues found. Check details below.`);
      }
    } catch (error) {
      alert('❌ Import failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bulk-import">
      <h2>Bulk Import Users</h2>

      {/* File Upload */}
      <div>
        <input
          type="file"
          accept=".csv"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
        />
        <button onClick={handleImport} disabled={!file || loading}>
          {loading ? 'Importing...' : 'Import'}
        </button>
      </div>

      {/* Results */}
      {result && (
        <>
          <ResultsSummary result={result} />
          {result.errors.length > 0 && (
            <ErrorDisplay errors={result.errors} details={result.details} />
          )}
        </>
      )}
    </div>
  );
};

// Results Summary Component
const ResultsSummary: React.FC<{ result: BulkImportResult }> = ({ result }) => (
  <div className="results">
    <h3>Import Complete</h3>
    <div className="stats">
      <div className="stat success">
        <span>✓</span>
        <strong>{result.created_users}</strong>
        <span>Imported</span>
      </div>
      <div className="stat warning">
        <span>⊗</span>
        <strong>{result.skipped_users}</strong>
        <span>Skipped</span>
      </div>
    </div>
    {result.details && (
      <div className="progress">
        <div
          className="progress-bar success"
          style={{ width: `${result.details.summary.success_rate}%` }}
        >
          {result.details.summary.success_rate.toFixed(0)}%
        </div>
      </div>
    )}
  </div>
);

// Error Display Component
const ErrorDisplay: React.FC<{
  errors: string[];
  details?: any;
}> = ({ errors, details }) => {
  const [expanded, setExpanded] = useState<string | null>(null);
  const breakdown = details?.error_breakdown;

  return (
    <div className="errors">
      <h3>⚠️ Issues Found ({errors.length})</h3>

      {/* Duplicate Users */}
      {breakdown?.duplicate_users.length > 0 && (
        <div className="error-category">
          <div
            className="category-header"
            onClick={() => setExpanded(expanded === 'dup' ? null : 'dup')}
          >
            <span>👥 Duplicate Users ({breakdown.duplicate_users.length})</span>
            <span>{expanded === 'dup' ? '▼' : '▶'}</span>
          </div>
          {expanded === 'dup' && (
            <div className="category-content">
              <p className="tip">
                💡 These emails already exist. Delete existing users first or use different emails.
              </p>
              <ul>
                {breakdown.duplicate_users.map((err: string, i: number) => (
                  <li key={i}>{err}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Validation Errors */}
      {breakdown?.validation_errors.length > 0 && (
        <div className="error-category">
          <div
            className="category-header"
            onClick={() => setExpanded(expanded === 'val' ? null : 'val')}
          >
            <span>❌ Validation Errors ({breakdown.validation_errors.length})</span>
            <span>{expanded === 'val' ? '▼' : '▶'}</span>
          </div>
          {expanded === 'val' && (
            <div className="category-content">
              <p className="tip">
                💡 Fix these data issues in your CSV and try importing again.
              </p>
              <ul>
                {breakdown.validation_errors.map((err: string, i: number) => (
                  <li key={i}>{err}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Export Button */}
      <button onClick={() => exportErrors(errors)}>
        📥 Export Error Report
      </button>
    </div>
  );
};

// Helper: Export errors to CSV
const exportErrors = (errors: string[]) => {
  const csv = 'Row,Error\n' + errors.map(e => {
    const match = e.match(/Row (\d+): (.+)/);
    return match ? `${match[1]},"${match[2]}"` : `N/A,"${e}"`;
  }).join('\n');

  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `import-errors-${Date.now()}.csv`;
  a.click();
};
```

---

## CSS Styles

```css
.bulk-import {
  max-width: 800px;
  margin: 0 auto;
  padding: 20px;
}

.results {
  background: white;
  padding: 20px;
  border-radius: 8px;
  margin: 20px 0;
}

.stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 16px;
  margin: 20px 0;
}

.stat {
  padding: 20px;
  border-radius: 8px;
  text-align: center;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.stat.success {
  background: #f0fdf4;
  border-left: 4px solid #22c55e;
}

.stat.warning {
  background: #fffbeb;
  border-left: 4px solid #f59e0b;
}

.stat span:first-child {
  font-size: 32px;
}

.stat strong {
  font-size: 28px;
}

.progress {
  height: 32px;
  background: #e5e7eb;
  border-radius: 8px;
  overflow: hidden;
  margin-top: 16px;
}

.progress-bar {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-weight: bold;
  transition: width 0.5s ease;
}

.progress-bar.success {
  background: #22c55e;
}

.errors {
  background: #fef2f2;
  border: 1px solid #fecaca;
  border-radius: 8px;
  padding: 20px;
  margin: 20px 0;
}

.errors h3 {
  color: #991b1b;
  margin: 0 0 16px 0;
}

.error-category {
  border: 1px solid #fed7aa;
  border-radius: 8px;
  margin: 12px 0;
  background: #fffbeb;
  overflow: hidden;
}

.category-header {
  padding: 12px 16px;
  cursor: pointer;
  display: flex;
  justify-content: space-between;
  font-weight: 600;
}

.category-header:hover {
  background: rgba(0,0,0,0.05);
}

.category-content {
  padding: 0 16px 16px 16px;
}

.tip {
  background: #dbeafe;
  padding: 12px;
  border-radius: 4px;
  margin-bottom: 12px;
  color: #1e40af;
}

.errors button {
  margin-top: 16px;
  padding: 10px 20px;
  background: #3b82f6;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
}

.errors button:hover {
  background: #2563eb;
}
```

---

## Implementation Steps

### Step 1: Add File Upload Component
```tsx
<input
  type="file"
  accept=".csv"
  onChange={(e) => setFile(e.target.files?.[0] || null)}
/>
<button onClick={handleImport}>Import</button>
```

### Step 2: Handle API Response
```tsx
const data = await response.json();
setResult(data);

// Check for errors
if (data.errors.length > 0) {
  // Show error UI
}
```

### Step 3: Display Results
```tsx
{result && (
  <>
    <ResultsSummary result={result} />
    {result.errors.length > 0 && (
      <ErrorDisplay errors={result.errors} details={result.details} />
    )}
  </>
)}
```

### Step 4: Show Error Categories
```tsx
// Duplicate Users
{breakdown?.duplicate_users.length > 0 && (
  <ErrorCategory
    title="Duplicate Users"
    errors={breakdown.duplicate_users}
    suggestion="These emails already exist..."
  />
)}

// Validation Errors
{breakdown?.validation_errors.length > 0 && (
  <ErrorCategory
    title="Validation Errors"
    errors={breakdown.validation_errors}
    suggestion="Fix these data issues..."
  />
)}
```

---

## Expected User Experience

### Scenario 1: Duplicate User (Your Case)
```
Import Complete
✓ 0 Imported
⊗ 1 Skipped

⚠️ Issues Found (1)
👥 Duplicate Users (1) ▶
  [Click to expand]
  💡 These emails already exist. Delete existing users first or use different emails.
  • Row 2: User with email daniel.doe@a2sv.org already exists

[📥 Export Error Report]
```

### Scenario 2: Validation Errors
```
Import Complete
✓ 0 Imported
⊗ 2 Skipped

⚠️ Issues Found (2)
❌ Validation Errors (2) ▶
  [Click to expand]
  💡 Fix these data issues in your CSV and try importing again.
  • Row 2: Email address is required
  • Row 3: Invalid email format

[📥 Export Error Report]
```

### Scenario 3: Mixed Success
```
Import Complete
✓ 8 Imported
⊗ 2 Skipped

Progress: [80% Green | 20% Orange]

⚠️ Issues Found (2)
👥 Duplicate Users (2) ▶
  • Row 5: User with email john@example.com already exists
  • Row 10: User with email jane@example.com already exists

[📥 Export Error Report]
```

---

## Testing Checklist

- [ ] Upload CSV file
- [ ] See loading state while importing
- [ ] See success count displayed
- [ ] See skip count displayed
- [ ] See error list when errors exist
- [ ] Click error category to expand/collapse
- [ ] See helpful suggestions for each error type
- [ ] Export error report to CSV
- [ ] See batch ID for tracking

---

## Summary

✅ **API returns:**
- Error messages in `errors` array
- Categorized errors in `details.error_breakdown`
- Success/skip statistics
- Batch ID for tracking

✅ **Frontend displays:**
- Import summary (created vs skipped)
- Progress visualization
- Categorized errors with icons
- Helpful suggestions for each error type
- Export errors button

✅ **Admin sees exactly:**
- What succeeded
- What failed
- Why it failed
- How to fix it

---

**Status:** ✅ Ready for Implementation  
**Last Updated:** January 24, 2026
