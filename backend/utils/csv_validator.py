import logging
from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass
import re

logger = logging.getLogger(__name__)

@dataclass
class CSVFieldMapping:
    """Defines how CSV fields map to database fields"""
    csv_field: str
    db_field: str
    field_type: str  # 'user', 'profile', 'metadata'
    required: bool = False
    transform_func: Optional[callable] = None


class CSVTemplateValidator:
    """
    Dynamic CSV template validator and field mapper for bulk user imports.
    Supports flexible field matching and intelligent field mapping.
    """
    
    # Base required fields for user creation
    REQUIRED_USER_FIELDS = ['email']
    
    # Field mapping definitions with multiple possible CSV field names
    FIELD_MAPPINGS = [
        # User table fields
        CSVFieldMapping('email', 'email', 'user', True),
        CSVFieldMapping('email address', 'email', 'user', True),
        CSVFieldMapping('email_address', 'email', 'user', True),
        
        # Profile identification fields
        CSVFieldMapping('full name', 'display_name', 'profile', False),
        CSVFieldMapping('full name(s)', 'display_name', 'profile', False),
        CSVFieldMapping('name', 'display_name', 'profile', False),
        CSVFieldMapping('first name', 'first_name', 'profile', False),
        CSVFieldMapping('last name', 'last_name', 'profile', False),
        
        # Contact fields
        CSVFieldMapping('mobile', 'phone', 'profile', False),
        CSVFieldMapping('mobile number', 'phone', 'profile', False),
        CSVFieldMapping('phone', 'phone', 'profile', False),
        CSVFieldMapping('telephone', 'phone', 'profile', False),
        
        # Professional fields
        CSVFieldMapping('occupation', 'title', 'profile', False),
        CSVFieldMapping('what\'s your occupation?', 'title', 'profile', False),
        CSVFieldMapping('job title', 'title', 'profile', False),
        CSVFieldMapping('position', 'title', 'profile', False),
        CSVFieldMapping('occupancy / position', 'title', 'profile', False),
        
        # Organization fields
        CSVFieldMapping('college/university', 'organization', 'profile', False),
        CSVFieldMapping('university', 'organization', 'profile', False),
        CSVFieldMapping('college', 'organization', 'profile', False),
        CSVFieldMapping('organisation/company', 'organization', 'profile', False),
        CSVFieldMapping('company', 'organization', 'profile', False),
        CSVFieldMapping('organization', 'organization', 'profile', False),
        
        # Academic fields
        CSVFieldMapping('department', 'metadata_.department', 'profile', False),
        CSVFieldMapping('department/faculty', 'metadata_.department', 'profile', False),
        CSVFieldMapping('faculty', 'metadata_.department', 'profile', False),
        CSVFieldMapping('study program', 'metadata_.study_program', 'profile', False),
        CSVFieldMapping('study program/major', 'metadata_.study_program', 'profile', False),
        CSVFieldMapping('major', 'metadata_.study_program', 'profile', False),
        
        # Specialization
        CSVFieldMapping('field of specialization', 'expertise', 'profile', False),
        CSVFieldMapping('specialization', 'expertise', 'profile', False),
        CSVFieldMapping('expertise', 'expertise', 'profile', False),
        
        # Bio/Idea fields
        CSVFieldMapping('idea', 'bio', 'profile', False),
        CSVFieldMapping('idea (250 words)', 'bio', 'profile', False),
        CSVFieldMapping('description', 'bio', 'profile', False),
        CSVFieldMapping('ideas title', 'metadata_.idea_title', 'profile', False),
        CSVFieldMapping('title', 'metadata_.idea_title', 'profile', False),
        
        # Theme/Category
        CSVFieldMapping('select theme', 'metadata_.theme', 'profile', False),
        CSVFieldMapping('theme', 'metadata_.theme', 'profile', False),
        CSVFieldMapping('category', 'metadata_.theme', 'profile', False),
        
        # Type/Group
        CSVFieldMapping('individual /group', 'metadata_.group_type', 'profile', False),
        CSVFieldMapping('type', 'metadata_.group_type', 'profile', False),
        CSVFieldMapping('group', 'metadata_.group_type', 'profile', False),
        
        # Timestamp
        CSVFieldMapping('timestamp', 'metadata_.import_timestamp', 'profile', False),
        
        # Additional fields that could be mapped
        CSVFieldMapping('website', 'website', 'profile', False),
        CSVFieldMapping('linkedin', 'metadata_.linkedin', 'profile', False),
        CSVFieldMapping('github', 'metadata_.github', 'profile', False),
    ]
    
    def __init__(self):
        self.field_map = {mapping.csv_field.lower(): mapping for mapping in self.FIELD_MAPPINGS}
    
    def normalize_field_name(self, field_name: str) -> str:
        """Normalize CSV field name for matching"""
        if not field_name:
            return ""
        
        # Convert to lowercase and strip whitespace
        normalized = field_name.lower().strip()
        
        # Remove extra whitespace and special characters
        normalized = re.sub(r'\s+', ' ', normalized)
        normalized = re.sub(r'[^\w\s/-]', '', normalized)
        
        return normalized
    
    def validate_csv_headers(self, csv_headers: List[str]) -> Tuple[bool, Dict[str, str], List[str]]:
        """
        Validate CSV headers and create field mapping.
        
        Returns:
            (is_valid, field_mapping, missing_required_fields)
        """
        field_mapping = {}
        used_fields = set()
        missing_required = []
        
        # Normalize headers
        normalized_headers = [self.normalize_field_name(header) for header in csv_headers]
        
        # Check for required fields first
        email_found = False
        for i, normalized_header in enumerate(normalized_headers):
            if normalized_header in self.field_map:
                mapping = self.field_map[normalized_header]
                if mapping.db_field == 'email':
                    email_found = True
                    break
        
        if not email_found:
            return False, {}, ['email']
        
        # Create field mapping
        for i, (original_header, normalized_header) in enumerate(zip(csv_headers, normalized_headers)):
            if normalized_header in self.field_map:
                mapping = self.field_map[normalized_header]
                
                # Don't map the same db field multiple times
                if mapping.db_field in used_fields:
                    continue
                
                field_mapping[original_header] = {
                    'db_field': mapping.db_field,
                    'field_type': mapping.field_type,
                    'required': mapping.required,
                    'transform_func': mapping.transform_func,
                    'csv_index': i
                }
                used_fields.add(mapping.db_field)
        
        return True, field_mapping, missing_required
    
    def infer_profile_type(self, csv_row: Dict[str, str], field_mapping: Dict[str, str]) -> str:
        """
        Infer profile type from occupation and other fields.
        """
        # Get occupation/title field
        occupation_field = None
        for csv_field, mapping in field_mapping.items():
            if mapping['db_field'] in ['title', 'occupation']:
                occupation_field = csv_row.get(csv_field, '').lower()
                break
        
        if not occupation_field:
            return 'academic'  # default
        
        # Check for specific keywords
        if any(keyword in occupation_field for keyword in ['student', 'graduate', 'undergraduate', 'postgraduate', 'phd']):
            return 'academic'
        elif any(keyword in occupation_field for keyword in ['entrepreneur', 'founder', 'ceo', 'startup', 'business']):
            return 'entrepreneur'
        elif any(keyword in occupation_field for keyword in ['researcher', 'scientist', 'professor', 'academic']):
            return 'lab'
        elif any(keyword in occupation_field for keyword in ['investor', 'funder', 'venture', 'capital']):
            return 'funder'
        else:
            return 'academic'  # default
    
    def extract_user_data(self, csv_row: Dict[str, str], field_mapping: Dict[str, str]) -> Dict[str, str]:
        """
        Extract user data from CSV row using field mapping.
        """
        user_data = {}
        
        for csv_field, mapping in field_mapping.items():
            if mapping['field_type'] == 'user':
                value = csv_row.get(csv_field, '').strip()
                if value:
                    user_data[mapping['db_field']] = value
        
        return user_data
    
    def extract_profile_data(self, csv_row: Dict[str, str], field_mapping: Dict[str, str]) -> Dict[str, any]:
        """
        Extract profile data from CSV row using field mapping.
        """
        profile_data = {
            'metadata_': {},
            'expertise': []
        }
        
        for csv_field, mapping in field_mapping.items():
            if mapping['field_type'] == 'profile':
                value = csv_row.get(csv_field, '').strip()
                
                if not value:
                    continue
                
                # Handle nested fields (like metadata_.field)
                if '.' in mapping['db_field']:
                    field_parts = mapping['db_field'].split('.')
                    if len(field_parts) == 2 and field_parts[0] == 'metadata_':
                        profile_data['metadata_'][field_parts[1]] = value
                    elif len(field_parts) == 2 and field_parts[0] == 'expertise':
                        # Handle expertise as list
                        profile_data['expertise'].append(value)
                else:
                    # Regular field
                    profile_data[mapping['db_field']] = value
        
        # Clean up empty metadata
        if not profile_data['metadata_']:
            del profile_data['metadata_']
        
        if not profile_data['expertise']:
            del profile_data['expertise']
        
        return profile_data
    
    def validate_row_data(self, user_data: Dict[str, str], profile_data: Dict[str, any]) -> Tuple[bool, List[str]]:
        """
        Validate extracted data for a single row.
        """
        errors = []
        
        # Validate required user fields
        if 'email' not in user_data or not user_data['email']:
            errors.append('Email address is required')
        elif '@' not in user_data['email']:
            errors.append('Invalid email format')
        
        # Validate phone if present
        if 'phone' in profile_data and profile_data['phone']:
            phone = re.sub(r'[^\d+]', '', profile_data['phone'])
            if len(phone) < 10:
                errors.append('Phone number appears to be too short')
        
        return len(errors) == 0, errors
    
    def get_template_info(self) -> Dict[str, any]:
        """
        Get template information for frontend display.
        """
        required_fields = []
        optional_fields = []
        
        for mapping in self.FIELD_MAPPINGS:
            field_info = {
                'csv_name': mapping.csv_field,
                'db_field': mapping.db_field,
                'field_type': mapping.field_type,
                'required': mapping.required
            }
            
            if mapping.required:
                required_fields.append(field_info)
            else:
                optional_fields.append(field_info)
        
        return {
            'required_fields': required_fields,
            'optional_fields': optional_fields,
            'description': 'The system accepts CSV files with flexible field names. The following fields are supported:',
            'examples': [
                {
                    'template_name': 'Standard Template',
                    'fields': ['Email address', 'Full name(s)', 'Mobile Number', 'What\'s your occupation?', 'College/University', 'Department/Faculty', 'Study Program/Major', 'Field of Specialization', 'Idea (250 words)']
                },
                {
                    'template_name': 'Simple Template', 
                    'fields': ['Email', 'Name', 'Phone', 'Occupation', 'Organization', 'Bio']
                },
                {
                    'template_name': 'Academic Template',
                    'fields': ['email', 'first_name', 'last_name', 'phone', 'occupation', 'university', 'department', 'major', 'specialization']
                }
            ]
        }


def create_csv_validation_service() -> CSVTemplateValidator:
    """Factory function to create CSV validation service"""
    return CSVTemplateValidator()