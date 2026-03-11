# Quick Diagnostic Queries for Silent Skip Issue

## Check What Happened with Your Import

### 1. Check the Import Batch Details

```sql
SELECT 
    id,
    filename,
    total_rows,
    successful_imports,
    failed_imports,
    skipped_imports,
    status,
    created_at
FROM import_batches
WHERE id = '35a979f5-1213-40f4-a719-6578188910a5';
```

**Your Result:**
- total_rows: 1
- successful_imports: 0
- skipped_imports: 1
- **Conclusion:** The row was skipped before profile creation

---

### 2. Check If Any Profiles Were Created

```sql
SELECT 
    p.id,
    p.display_name,
    p.first_name,
    p.last_name,
    p.invitation_status,
    p.import_batch_id,
    p.created_at,
    u.email
FROM profiles p
LEFT JOIN users u ON p.user_id = u.id
WHERE p.import_batch_id = '35a979f5-1213-40f4-a719-6578188910a5';
```

**Expected:** 0 rows (confirms skip happened before profile creation)

---

### 3. Check Possible Duplicate Emails

Check if the emails from your CSV already exist:

```sql
-- Replace with actual emails from your CSV
SELECT 
    id,
    email,
    username,
    created_at,
    is_admin
FROM users
WHERE email IN (
    'miriamkwambui6@gmail.com',
    'meshackcheboi3@gmail.com'
    -- Add more emails from your CSV here
);
```

**If rows returned:** User already exists (most likely cause of skip)

---

### 4. Check All Recent Imports

```sql
SELECT 
    ib.id,
    ib.filename,
    ib.total_rows,
    ib.successful_imports,
    ib.skipped_imports,
    ib.created_at,
    COUNT(p.id) as profiles_created
FROM import_batches ib
LEFT JOIN profiles p ON p.import_batch_id = ib.id
GROUP BY ib.id, ib.filename, ib.total_rows, ib.successful_imports, ib.skipped_imports, ib.created_at
ORDER BY ib.created_at DESC
LIMIT 10;
```

---

### 5. Find Profiles Without Batch ID (Manual Imports)

```sql
SELECT 
    p.id,
    p.display_name,
    p.type,
    p.invitation_status,
    u.email,
    p.created_at
FROM profiles p
JOIN users u ON p.user_id = u.id
WHERE p.import_batch_id IS NULL
ORDER BY p.created_at DESC
LIMIT 20;
```

---

### 6. Check All Pending Invitations

```sql
SELECT 
    p.id,
    p.display_name,
    p.invitation_status,
    p.invitation_sent_at,
    p.import_batch_id,
    u.email,
    CASE 
        WHEN p.invitation_sent_at < NOW() - INTERVAL '24 hours' THEN 'EXPIRED'
        ELSE 'VALID'
    END as token_status
FROM profiles p
JOIN users u ON p.user_id = u.id
WHERE p.invitation_status = 'pending'
ORDER BY p.invitation_sent_at DESC;
```

---

## Most Likely Cause

Based on `skipped_imports=1` and `successful_imports=0`:

### Hypothesis 1: Email Already Exists (90% probability)

The CSV contains an email that's already in the users table.

**Verify:**
```sql
-- Check the most recently created users
SELECT email, created_at 
FROM users 
ORDER BY created_at DESC 
LIMIT 20;
```

Look for emails matching your CSV.

**Solution:** 
- Delete the existing user, OR
- Use a different email in CSV

---

### Hypothesis 2: CSV Email Field Empty (8% probability)

The CSV has the wrong column name for email.

**Check your CSV headers** - Must include one of:
- `Email`
- `Email address`
- `email`
- `email address`
- `email_address`

**Solution:** 
- Rename column to match expected names
- Or add mapping in `csv_validator.py`

---

### Hypothesis 3: Invalid Email Format (2% probability)

Email in CSV is malformed (no @ symbol).

**Solution:**
- Fix email format in CSV

---

## Action Plan

### Step 1: Run Query #3
Check if emails already exist in database.

### Step 2: Re-import with Fixed Code
The updated code will now show exact error message.

### Step 3: Check Logs
Look for lines like:
```
Row 2: User with email [email] already exists
```

### Step 4: Fix and Retry
Based on error message, fix the issue and re-import.

---

## Quick Test

Create a simple test CSV:

**test.csv**
```csv
Email address,Full name(s)
uniquetest123@example.com,Test User
```

Import this and it should succeed (unless this email also exists).

If this succeeds but your original CSV fails, compare the two to find differences.
