import logging
import uuid
from io import BytesIO
from typing import Dict, List, Any, Tuple, Optional

import pandas as pd
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert

from models.db_models import HackathonParticipant

logger = logging.getLogger(__name__)

# Alias dictionary for semantic column matching
COLUMN_ALIASES: Dict[str, List[str]] = {
    "first_name": ["first_name", "first name", "firstname", "given name", "given_name", "fname"],
    "last_name": ["last_name", "last name", "lastname", "surname", "family name", "family_name", "lname"],
    "email": ["email", "email address", "e-mail", "email_address", "mail"],
    "organization": ["organization", "organisation", "org", "company", "institution", "affiliation", "school", "university", "college/university", "college", "organisation/company"],
    "team_name": ["team_name", "team name", "team", "group", "group_name", "group name"],
    "project_title": ["project_title", "project title", "project", "project name", "project_name", "idea_title"],
    "project_description": ["project_description", "project description", "description", "abstract", "summary", "project_summary", "idea", "idea (250 words", "idea (250 words)"],
    "phone_number": ["phone_number", "phone number", "phone", "mobile", "mobile number", "cell", "cell phone", "telephone", "tel"],
    "country": ["country", "country name", "nation", "nationality", "region"],
    "timezone": ["timezone", "time zone", "tz", "time_zone"],
    # New fields for extended CSV support
    "theme": ["theme", "select theme", "hackathon theme", "track", "category"],
    "participant_type": ["participant_type", "individual /group", "individual/group", "individual / group", "type", "participation type", "entry type", "team type"],
    "occupation": ["occupation", "what's your occupation?", "what's your occupation", "whats your occupation", "job", "role"],
    "department": ["department", "department/faculty", "faculty", "dept"],
    "major": ["major", "study program/major", "study program", "program", "course", "field of study"],
    "position": ["position", "occupancy / position", "occupancy/position", "occupancy", "job title", "title"],
    "specialization": ["specialization", "field of specialization", "specialisation", "specialty", "focus area", "expertise"],
}

# Phone country code -> (country, timezone)
PHONE_CODE_MAP: Dict[str, Tuple[str, str]] = {
    "1": ("United States", "America/New_York"),
    "20": ("Egypt", "Africa/Cairo"),
    "27": ("South Africa", "Africa/Johannesburg"),
    "211": ("South Sudan", "Africa/Juba"),
    "212": ("Morocco", "Africa/Casablanca"),
    "213": ("Algeria", "Africa/Algiers"),
    "216": ("Tunisia", "Africa/Tunis"),
    "218": ("Libya", "Africa/Tripoli"),
    "220": ("Gambia", "Africa/Banjul"),
    "221": ("Senegal", "Africa/Dakar"),
    "222": ("Mauritania", "Africa/Nouakchott"),
    "223": ("Mali", "Africa/Bamako"),
    "224": ("Guinea", "Africa/Conakry"),
    "225": ("Ivory Coast", "Africa/Abidjan"),
    "226": ("Burkina Faso", "Africa/Ouagadougou"),
    "227": ("Niger", "Africa/Niamey"),
    "228": ("Togo", "Africa/Lome"),
    "229": ("Benin", "Africa/Porto-Novo"),
    "230": ("Mauritius", "Indian/Mauritius"),
    "231": ("Liberia", "Africa/Monrovia"),
    "232": ("Sierra Leone", "Africa/Freetown"),
    "233": ("Ghana", "Africa/Accra"),
    "234": ("Nigeria", "Africa/Lagos"),
    "235": ("Chad", "Africa/Ndjamena"),
    "236": ("Central African Republic", "Africa/Bangui"),
    "237": ("Cameroon", "Africa/Douala"),
    "238": ("Cape Verde", "Atlantic/Cape_Verde"),
    "239": ("Sao Tome and Principe", "Africa/Sao_Tome"),
    "240": ("Equatorial Guinea", "Africa/Malabo"),
    "241": ("Gabon", "Africa/Libreville"),
    "242": ("Republic of the Congo", "Africa/Brazzaville"),
    "243": ("DR Congo", "Africa/Kinshasa"),
    "244": ("Angola", "Africa/Luanda"),
    "245": ("Guinea-Bissau", "Africa/Bissau"),
    "248": ("Seychelles", "Indian/Mahe"),
    "249": ("Sudan", "Africa/Khartoum"),
    "250": ("Rwanda", "Africa/Kigali"),
    "251": ("Ethiopia", "Africa/Addis_Ababa"),
    "252": ("Somalia", "Africa/Mogadishu"),
    "253": ("Djibouti", "Africa/Djibouti"),
    "254": ("Kenya", "Africa/Nairobi"),
    "255": ("Tanzania", "Africa/Dar_es_Salaam"),
    "256": ("Uganda", "Africa/Kampala"),
    "257": ("Burundi", "Africa/Bujumbura"),
    "258": ("Mozambique", "Africa/Maputo"),
    "260": ("Zambia", "Africa/Lusaka"),
    "261": ("Madagascar", "Indian/Antananarivo"),
    "263": ("Zimbabwe", "Africa/Harare"),
    "264": ("Namibia", "Africa/Windhoek"),
    "265": ("Malawi", "Africa/Lilongwe"),
    "266": ("Lesotho", "Africa/Maseru"),
    "267": ("Botswana", "Africa/Gaborone"),
    "268": ("Eswatini", "Africa/Mbabane"),
    "269": ("Comoros", "Indian/Comoro"),
    "44": ("United Kingdom", "Europe/London"),
    "49": ("Germany", "Europe/Berlin"),
    "33": ("France", "Europe/Paris"),
    "91": ("India", "Asia/Kolkata"),
    "86": ("China", "Asia/Shanghai"),
    "971": ("UAE", "Asia/Dubai"),
    "966": ("Saudi Arabia", "Asia/Riyadh"),
}


def parse_phone_number(raw: str) -> Tuple[Optional[str], Optional[str]]:
    """Parse phone number prefix and return (country, timezone) or (None, None)."""
    cleaned = raw.strip().replace(" ", "").replace("-", "").replace("(", "").replace(")", "")
    if cleaned.startswith("+"):
        cleaned = cleaned[1:]
    elif cleaned.startswith("00"):
        cleaned = cleaned[2:]
    else:
        return None, None

    # Try longest prefix first (3 digits, then 2, then 1)
    for length in (3, 2, 1):
        prefix = cleaned[:length]
        if prefix in PHONE_CODE_MAP:
            return PHONE_CODE_MAP[prefix]
    return None, None


REQUIRED_FIELDS = {"email"}
TARGET_FIELDS = set(COLUMN_ALIASES.keys())


def _normalize(col: str) -> str:
    return col.strip().lower().replace("-", " ").replace("_", " ")


def infer_column_mapping(columns: List[str]) -> Tuple[Dict[str, str], List[str]]:
    """Return (mapping: source_col -> target_field, unmapped_columns)."""
    mapping: Dict[str, str] = {}
    used_targets = set()

    for col in columns:
        norm = _normalize(col)
        # Check for "full name" / "name" / "participant" → split later
        if norm in ("full name", "name", "participant", "participant name", "fullname"):
            mapping[col] = "__full_name__"
            continue
        for target, aliases in COLUMN_ALIASES.items():
            if target in used_targets:
                continue
            if norm in aliases:
                mapping[col] = target
                used_targets.add(target)
                break

    unmapped = [c for c in columns if c not in mapping]
    return mapping, unmapped


async def parse_upload(
    file_content: bytes,
    filename: str,
) -> Tuple[pd.DataFrame, str]:
    """Parse CSV or Excel bytes into a DataFrame."""
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    buf = BytesIO(file_content)
    if ext in ("xlsx", "xls"):
        df = pd.read_excel(buf)
    elif ext == "csv":
        df = pd.read_csv(buf)
    else:
        raise ValueError(f"Unsupported file type: .{ext}. Use .csv or .xlsx")

    df = df.dropna(how="all")
    batch_id = uuid.uuid4().hex[:16]
    return df, batch_id


def build_preview(
    df: pd.DataFrame,
    mapping: Dict[str, str],
    unmapped: List[str],
    batch_id: str,
    filename: str,
    max_preview: int = 5,
) -> Dict[str, Any]:
    preview_rows = df.head(max_preview).fillna("").to_dict(orient="records")
    return {
        "upload_batch_id": batch_id,
        "total_rows": len(df),
        "inferred_mapping": mapping,
        "unmapped_columns": unmapped,
        "preview_rows": preview_rows,
        "filename": filename,
    }


async def confirm_upload(
    db: AsyncSession,
    df: pd.DataFrame,
    column_mapping: Dict[str, str],
    hackathon_id: uuid.UUID,
    batch_id: str,
) -> Dict[str, Any]:
    """Insert participants from DataFrame using confirmed mapping."""
    created = 0
    skipped = 0
    skipped_details: List[str] = []
    errors: List[str] = []

    # Reverse mapping: target_field -> source_col
    target_to_source: Dict[str, str] = {}
    full_name_col: Optional[str] = None
    extra_cols: List[str] = []

    for src, tgt in column_mapping.items():
        if tgt == "__full_name__":
            full_name_col = src
        elif tgt in TARGET_FIELDS:
            target_to_source[tgt] = src
        else:
            extra_cols.append(src)

    # Also collect truly unmapped columns for metadata
    mapped_sources = set(column_mapping.keys())
    unmapped_sources = [c for c in df.columns if c not in mapped_sources]
    extra_cols.extend(unmapped_sources)

    # Track duplicates within this upload batch (email + participant_type combination)
    seen_in_batch: Dict[Tuple[str, Optional[str]], int] = {}

    for idx, row in df.iterrows():
        try:
            data: Dict[str, Any] = {}

            # Handle full name splitting
            if full_name_col and full_name_col in row:
                parts = str(row[full_name_col]).strip().split(None, 1)
                data["first_name"] = parts[0] if parts else ""
                data["last_name"] = parts[1] if len(parts) > 1 else ""

            # Map standard fields
            for target, source in target_to_source.items():
                val = row.get(source, None)
                if pd.notna(val):
                    data[target] = str(val).strip()

            # Ensure first/last name have defaults if missing
            if not data.get("first_name"):
                data["first_name"] = data.get("last_name", "") or "Unknown"
            if not data.get("last_name"):
                data["last_name"] = ""

            # Validate required (only email is truly required)
            missing = REQUIRED_FIELDS - set(k for k, v in data.items() if v)
            if missing:
                errors.append(f"Row {idx + 2}: missing {', '.join(missing)}")
                continue

            # Auto-detect country/timezone from phone number
            phone = data.get("phone_number")
            if phone:
                detected_country, detected_tz = parse_phone_number(phone)
                if not data.get("country") and detected_country:
                    data["country"] = detected_country
                if not data.get("timezone") and detected_tz:
                    data["timezone"] = detected_tz

            # Build metadata from extra columns
            meta = {}
            for col in extra_cols:
                val = row.get(col, None)
                if pd.notna(val):
                    meta[col] = str(val).strip()

            # Normalize participant_type
            participant_type = data.get("participant_type")
            if participant_type:
                participant_type = participant_type.strip().lower()
                if participant_type in ("individual", "solo", "single"):
                    participant_type = "Individual"
                elif participant_type in ("group", "team"):
                    participant_type = "Group"
                else:
                    participant_type = participant_type.title()  # Capitalize first letter
            
            email_lower = data["email"].lower()
            
            # Check for duplicate within this batch (keep first, skip subsequent)
            batch_key = (email_lower, participant_type)
            if batch_key in seen_in_batch:
                skipped += 1
                skipped_details.append(f"Row {idx + 2}: duplicate in batch - email '{email_lower}' (type: {participant_type or 'unspecified'}), first seen at row {seen_in_batch[batch_key]}")
                continue
            
            # Mark as seen in this batch
            seen_in_batch[batch_key] = idx + 2

            participant = HackathonParticipant(
                hackathon_id=hackathon_id,
                upload_batch_id=batch_id,
                first_name=data.get("first_name", ""),
                last_name=data.get("last_name", ""),
                email=email_lower,
                organization=data.get("organization"),
                team_name=data.get("team_name"),
                project_title=data.get("project_title"),
                project_description=data.get("project_description"),
                phone_number=data.get("phone_number"),
                country=data.get("country"),
                timezone=data.get("timezone"),
                # New fields
                theme=data.get("theme"),
                participant_type=participant_type,
                occupation=data.get("occupation"),
                department=data.get("department"),
                major=data.get("major"),
                position=data.get("position"),
                specialization=data.get("specialization"),
                metadata_=meta if meta else {},
            )

            # Check for duplicate email + participant_type in database (across previous uploads)
            existing = await db.execute(
                select(HackathonParticipant).where(
                    HackathonParticipant.hackathon_id == hackathon_id,
                    HackathonParticipant.email == participant.email,
                    HackathonParticipant.participant_type == participant_type,
                )
            )
            if existing.scalar_one_or_none():
                skipped += 1
                skipped_details.append(f"Row {idx + 2}: already exists in database - email '{participant.email}' (type: {participant_type or 'unspecified'})")
                continue

            db.add(participant)
            created += 1
        except Exception as e:
            errors.append(f"Row {idx + 2}: {str(e)}")

    await db.flush()
    return {
        "total_rows": len(df),
        "created": created,
        "skipped_duplicates": skipped,
        "skipped_details": skipped_details,
        "errors": errors,
    }
