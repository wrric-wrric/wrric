# CSV Template System Documentation

## Overview

The bulk import system now supports **dynamic CSV template validation** that can handle various CSV formats while intelligently mapping fields to the correct database columns. This makes the system flexible enough to work with different CSV templates from various sources.

## Supported Field Mappings

The system recognizes multiple variations of the same field name and automatically maps them to the appropriate database fields:

### Required Fields

| CSV Field Variations | Database Field | Description |
|---------------------|---------------|-------------|
| `email`, `Email address`, `email_address` | `users.email` | **Required** - User's email address |

### User Profile Fields

| CSV Field Variations | Database Field | Description |
|---------------------|---------------|-------------|
| `full name`, `Full name(s)`, `name` | `profiles.display_name` | User's full name |
| `first name` | `profiles.first_name` | First name |
| `last name` | `profiles.last_name` | Last name |
| `mobile`, `Mobile Number`, `phone`, `telephone` | `profiles.phone` | Phone number |
| `occupation`, `What's your occupation?`, `job title`, `position`, `Occupancy / position` | `profiles.title` | Professional title/occupation |
| `college/university`, `university`, `college`, `Organisation/company`, `company`, `organization` | `profiles.organization` | Academic institution or company |
| `website` | `profiles.website` | Personal/organizational website |

### Extended Profile Fields (Stored in JSONB metadata)

| CSV Field Variations | Database Field | Description |
|---------------------|---------------|-------------|
| `department`, `Department/Faculty`, `faculty` | `profiles.metadata_.department` | Academic department |
| `study program`, `Study Program/Major`, `major` | `profiles.metadata_.study_program` | Field of study |
| `field of specialization`, `specialization`, `expertise` | `profiles.expertise` | Areas of expertise |
| `idea`, `Idea (250 words)`, `description` | `profiles.bio` | Bio/description |
| `ideas title`, `title` | `profiles.metadata_.idea_title` | Title of idea/project |
| `select theme`, `theme`, `category` | `profiles.metadata_.theme` | Theme/category |
| `individual /group`, `type`, `group` | `profiles.metadata_.group_type` | Individual or group |
| `timestamp` | `profiles.metadata_.import_timestamp` | Original CSV timestamp |
| `linkedin` | `profiles.metadata_.linkedin` | LinkedIn profile |
| `github` | `profiles.metadata_.github` | GitHub profile |

## Profile Type Auto-Detection

The system automatically determines the profile type based on the occupation field:

| Occupation Keywords | Profile Type |
|--------------------|--------------|
| `student`, `graduate`, `undergraduate`, `postgraduate`, `phd` | `academic` |
| `entrepreneur`, `founder`, `ceo`, `startup`, `business` | `entrepreneur` |
| `researcher`, `scientist`, `professor`, `academic` | `lab` |
| `investor`, `funder`, `venture`, `capital` | `funder` |
| *Any other keyword* | `academic` (default) |

## CSV Template Examples

### Example 1: Standard Template (From CURRENT_ERRORS.txt)
```csv
Timestamp,Email address,select theme,Individual /group,Full name(s),Mobile Number,What's your occupation?,College/University,Department/Faculty,Study Program/Major,Organisation/company,Occupancy / position,Field of Specialization,Idea (250 words),Ideas title,Attach photos (if any ) as a proof of work,Want to submit your idea?
14/01/2026 17:55:42,miriamkwambui6@gmail.com,"Green Chemistry, Climate Innovation & Renewable Energy",individual,Miriam Wambui Karanja,±254790413351,Graduate,,,,,,,,,,"No, complete registration"
14/01/2026 18:02:56,meshackcheboi3@gmail.com,"water, Geography and Green Economy",individual,Meshack kirop cheboi ,0705 111596 ,Student,University ,Computing ,Applied computer science ,,,,,,,"Yes, let's preceed to idea submision"
```

### Example 2: Simple Template
```csv
Email,Name,Phone,Occupation,Organization,Bio
john@example.com,John Doe,555-0123,Software Engineer,Tech Corp,Experienced developer in web applications
jane@example.com,Jane Smith,555-0456,Data Scientist,University PhD,Machine learning researcher
```

### Example 3: Academic Template
```csv
email,first_name,last_name,phone,occupation,university,department,major,specialization
student1@university.edu,John,Doe,123-456-7890,Graduate Student,MIT,Computer Science,Machine Learning,Deep Learning
prof1@university.edu,Jane,Smith,987-654-3210,Professor,Stanford,Biology,Molecular Biology,Genetics
```

### Example 4: Minimal Template
```csv
Email address,Full name,What's your occupation?
user1@example.com,Alice Johnson,Student
user2@example.com,Bob Williams,Entrepreneur
```

## Field Validation

### Email Validation
- Must contain '@' symbol
- Cannot be empty
- Must be unique in the system

### Phone Validation
- Optional field
- If provided, should have at least 10 digits after cleaning
- Accepts various formats: `+1234567890`, `(123) 456-7890`, `123-456-7890`

### Name Validation
- Full name is optional
- First and last names are processed from full name if available
- Names are stripped of extra whitespace

## API Usage

### Step 1: Validate CSV File
```javascript
// First, validate the CSV file to see field mapping
const formData = new FormData();
formData.append('file', csvFile);

const response = await fetch('/api/admin/users/validate-csv', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`
  },
  body: formData
});

const validationResult = await response.json();
```

**Response Structure:**
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

### Step 2: Import Users
```javascript
// After validation, proceed with import
const formData = new FormData();
formData.append('file', csvFile);
formData.append('selected_rows', JSON.stringify([0, 1, 2])); // Optional

const importResponse = await fetch('/api/admin/users/bulk-import', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`
  },
  body: formData
});

const importResult = await importResponse.json();
```

## Error Handling

### Common Validation Errors

1. **Missing Email Field**
   ```json
   {
     "detail": "Invalid CSV format. Missing required fields: email"
   }
   ```

2. **Invalid Email Format**
   ```
   "Row 5: Invalid email format"
   ```

3. **Duplicate Email**
   ```json
   {
     "created_users": 10,
     "skipped_users": 2,
     "errors": [],
     "field_mapping": {...}
   }
   ```

### Row-Level Errors
- Invalid email format
- Phone number too short
- Missing required fields

## Flexible Field Matching Algorithm

The system uses intelligent field matching:

1. **Normalization**: Field names are converted to lowercase, stripped of special characters
2. **Fuzzy Matching**: Recognizes common variations of the same field
3. **Priority Ordering**: Exact matches take precedence over partial matches
4. **Duplicate Prevention**: Same database field won't be mapped from multiple CSV columns

## Data Storage

### Users Table
- `email` (required)
- `username` (auto-generated)
- `password` (set during invitation acceptance)

### Profiles Table
- `display_name`, `first_name`, `last_name`
- `phone`, `organization`, `title`, `bio`
- `type` (auto-detected from occupation)
- `metadata_` (JSONB for extended fields like department, major, etc.)
- `expertise` (JSONB array)
- `invitation_*` fields for tracking

## Best Practices for CSV Files

1. **Headers**: Use clear, descriptive column headers
2. **Encoding**: Save as UTF-8 to support special characters
3. **Consistency**: Use consistent date and phone number formats
4. **Required Fields**: Ensure email column is present for all rows
5. **Empty Values**: Leave cells empty rather than using "N/A" or similar

This flexible system allows organizations to use their existing CSV templates with minimal modifications, while ensuring data is correctly mapped to the database schema.