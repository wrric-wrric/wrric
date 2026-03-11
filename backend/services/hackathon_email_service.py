import logging
import mimetypes
from typing import List, Optional, Dict, Any
from email.message import EmailMessage

import markdown2

from api.manager_email_service import _send_email, SMTP_USERNAME
from utils.email_templates import get_branded_email_template, get_cta_button

logger = logging.getLogger(__name__)


def _personalize_content(template: str, data: Dict[str, Any]) -> str:
    """
    Replace placeholders in template with data.
    
    Supported placeholders for participants:
        {{first_name}}, {{last_name}}, {{full_name}}, {{email}},
        {{organization}}, {{team_name}}, {{project_title}}, {{theme}},
        {{participant_type}}, {{country}}, {{phone_number}},
        {{occupation}}, {{department}}, {{major}}, {{position}}, {{specialization}}
    
    Supported placeholders for judges:
        {{name}}, {{display_name}}, {{username}}, {{email}}, {{event_title}}
    """
    replacements = {
        # Common
        "{{email}}": data.get("email", ""),
        "{{event_title}}": data.get("event_title", ""),
        # Participant fields
        "{{first_name}}": data.get("first_name", ""),
        "{{last_name}}": data.get("last_name", ""),
        "{{full_name}}": f"{data.get('first_name', '')} {data.get('last_name', '')}".strip() or data.get("display_name", ""),
        "{{organization}}": data.get("organization", ""),
        "{{team_name}}": data.get("team_name", ""),
        "{{project_title}}": data.get("project_title", ""),
        "{{theme}}": data.get("theme", ""),
        "{{participant_type}}": data.get("participant_type", ""),
        "{{country}}": data.get("country", ""),
        "{{phone_number}}": data.get("phone_number", ""),
        "{{occupation}}": data.get("occupation", ""),
        "{{department}}": data.get("department", ""),
        "{{major}}": data.get("major", ""),
        "{{position}}": data.get("position", ""),
        "{{specialization}}": data.get("specialization", ""),
        # Judge fields
        "{{name}}": data.get("display_name") or data.get("username") or "",
        "{{display_name}}": data.get("display_name", ""),
        "{{username}}": data.get("username", ""),
    }
    
    result = template
    for placeholder, value in replacements.items():
        result = result.replace(placeholder, value or "")

    return result


def _markdown_to_html(text: str) -> str:
    """Convert Markdown text to styled HTML for emails."""
    html = markdown2.markdown(
        text,
        extras=["fenced-code-blocks", "tables", "strike", "target-blank-links"]
    )
    return f'<div style="color: #333; font-size: 16px; line-height: 1.7;">{html}</div>'


def send_hackathon_participant_email(
    participants: List[Dict[str, Any]],
    subject: str,
    body: str,
    event_title: str,
    meeting_link: Optional[str] = None,
    attachments: Optional[List[Dict[str, Any]]] = None,
) -> dict:
    """Send personalized branded email to hackathon participants. Returns {sent, failed}.

    participants: list of dicts with keys: email, first_name, last_name, organization, team_name, etc.
    body: Can contain placeholders like {{first_name}}, {{team_name}}, etc.
    attachments: list of {"filename": str, "content": bytes, "content_type": str}
    """
    sent = 0
    failed = 0

    for participant in participants:
        try:
            email_addr = participant.get("email")
            if not email_addr:
                failed += 1
                continue
            
            first_name = participant.get("first_name", "Participant")
            
            # Personalize subject and body
            personalized_subject = _personalize_content(subject, participant)
            personalized_body = _personalize_content(body, participant)
            
            # Build body HTML
            body_html = _markdown_to_html(personalized_body)
            if meeting_link:
                body_html += f"""
                <div style="margin: 20px 0; padding: 16px; background: #f0fdf4; border-radius: 8px; border-left: 4px solid #00FB75;">
                    <p style="margin: 0 0 8px 0; font-weight: 600; color: #333;">🔗 Meeting Link</p>
                    <a href="{meeting_link}" style="color: #059669; word-break: break-all;">{meeting_link}</a>
                </div>
                """

            if attachments:
                att_names = ", ".join(a["filename"] for a in attachments)
                body_html += f"""
                <div style="margin: 20px 0; padding: 12px 16px; background: #f8f9fa; border-radius: 8px; border: 1px solid #e9ecef;">
                    <p style="margin: 0; font-size: 13px; color: #666;">📎 Attachments: {att_names}</p>
                </div>
                """

            # Build plain text
            plain_text = f"Hello {first_name},\n\n{personalized_body}"
            if meeting_link:
                plain_text += f"\n\nMeeting Link: {meeting_link}"

            # Use personalized greeting with first name
            html_content = get_branded_email_template(
                greeting=f'<p style="margin: 0 0 10px 0; color: #333; font-size: 16px;">Hello <strong>{first_name}</strong>,</p>',
                main_content=body_html,
            )

            msg = EmailMessage()
            msg["Subject"] = f"[{event_title}] {personalized_subject}"
            msg["From"] = SMTP_USERNAME
            msg["To"] = email_addr
            msg.set_content(plain_text)
            msg.add_alternative(html_content, subtype="html")

            # Add attachments
            if attachments:
                for att in attachments:
                    maintype, subtype = att["content_type"].split("/", 1) if "/" in att["content_type"] else ("application", "octet-stream")
                    msg.add_attachment(
                        att["content"],
                        maintype=maintype,
                        subtype=subtype,
                        filename=att["filename"],
                    )

            if _send_email(msg):
                sent += 1
            else:
                failed += 1
        except Exception as e:
            logger.error(f"Failed to send hackathon email to {participant.get('email', 'unknown')}: {e}")
            failed += 1

    return {"sent": sent, "failed": failed}


def send_hackathon_judge_email(
    judges: List[Dict[str, Any]],
    subject: str,
    body: str,
    event_title: str,
    judge_portal_url: Optional[str] = None,
    meeting_link: Optional[str] = None,
    attachments: Optional[List[Dict[str, Any]]] = None,
) -> dict:
    """Send professional branded email to hackathon judges. Returns {sent, failed}.

    In this hackathon system, all judges score all participants/groups based on
    multiple criteria. Scores from all judges are totaled and averaged.

    judges: list of dicts with keys: email, display_name, username
    body: Can contain placeholders like {{name}}, {{display_name}}, {{event_title}}, etc.
    judge_portal_url: URL to the judge scoring portal (optional)
    meeting_link: Judges meeting/briefing link (optional)
    attachments: list of {"filename": str, "content": bytes, "content_type": str}
    """
    sent = 0
    failed = 0

    for judge in judges:
        try:
            email_addr = judge.get("email")
            if not email_addr:
                failed += 1
                continue
            
            display_name = judge.get("display_name") or judge.get("username") or "Judge"
            
            # Add event_title to judge data for personalization
            judge_data = {**judge, "event_title": event_title}
            
            # Personalize subject and body
            personalized_subject = _personalize_content(subject, judge_data)
            personalized_body = _personalize_content(body, judge_data)
            
            # Build body HTML - professional format
            body_html = _markdown_to_html(personalized_body)
            
            # Add judge portal link if provided - professional styling
            if judge_portal_url:
                body_html += f"""
                <div style="margin: 24px 0; text-align: center;">
                    <a href="{judge_portal_url}" style="display: inline-block; padding: 14px 32px; background: #00FB75; color: #000; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 15px;">Access Scoring Portal</a>
                </div>
                <p style="margin: 0 0 20px 0; text-align: center; color: #666; font-size: 13px;">
                    Or copy this link: <a href="{judge_portal_url}" style="color: #059669;">{judge_portal_url}</a>
                </p>
                """
            
            if meeting_link:
                body_html += f"""
                <div style="margin: 20px 0; padding: 16px; background: #f8fafc; border-radius: 8px; border-left: 4px solid #00FB75;">
                    <p style="margin: 0 0 8px 0; font-weight: 600; color: #333;">Meeting Link</p>
                    <a href="{meeting_link}" style="color: #059669; word-break: break-all;">{meeting_link}</a>
                </div>
                """

            if attachments:
                att_names = ", ".join(a["filename"] for a in attachments)
                body_html += f"""
                <div style="margin: 20px 0; padding: 12px 16px; background: #f8f9fa; border-radius: 8px; border: 1px solid #e9ecef;">
                    <p style="margin: 0; font-size: 13px; color: #666;">📎 Attachments included: {att_names}</p>
                </div>
                """

            # Build plain text version
            plain_text = f"Dear {display_name},\n\n{personalized_body}"
            if judge_portal_url:
                plain_text += f"\n\nScoring Portal: {judge_portal_url}"
            if meeting_link:
                plain_text += f"\n\nMeeting Link: {meeting_link}"

            # Use formal greeting
            html_content = get_branded_email_template(
                greeting=f'<p style="margin: 0 0 10px 0; color: #333; font-size: 16px;">Dear <strong>{display_name}</strong>,</p>',
                main_content=body_html,
            )

            msg = EmailMessage()
            msg["Subject"] = f"[{event_title}] {personalized_subject}"
            msg["From"] = SMTP_USERNAME
            msg["To"] = email_addr
            msg.set_content(plain_text)
            msg.add_alternative(html_content, subtype="html")

            # Add attachments
            if attachments:
                for att in attachments:
                    maintype, subtype = att["content_type"].split("/", 1) if "/" in att["content_type"] else ("application", "octet-stream")
                    msg.add_attachment(
                        att["content"],
                        maintype=maintype,
                        subtype=subtype,
                        filename=att["filename"],
                    )

            if _send_email(msg):
                sent += 1
            else:
                failed += 1
        except Exception as e:
            logger.error(f"Failed to send hackathon judge email to {judge.get('email', 'unknown')}: {e}")
            failed += 1

    return {"sent": sent, "failed": failed}
