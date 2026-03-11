import os
import smtplib
import logging
from email.message import EmailMessage
from dotenv import load_dotenv
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from models.db_models import Entity
from uuid import UUID as UUID4
from utils.email_templates import (
    get_branded_email_template,
    get_cta_button,
    get_info_box,
    get_detail_table,
    get_event_details_box,
    get_location_section,
)

logger = logging.getLogger(__name__)
load_dotenv()

# Update your SMTP configuration for port 465
SMTP_SERVER = os.getenv("SMTP_SERVER", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", 465))  # Changed from 587 to 465
SMTP_USERNAME = os.getenv("SMTP_USERNAME")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD")
RECIPIENT_EMAIL = os.getenv("RECIPIENT_EMAIL")


def _send_email(msg: EmailMessage) -> bool:
    """Shared helper to send an email via SMTP SSL."""
    try:
        with smtplib.SMTP_SSL(SMTP_SERVER, SMTP_PORT, timeout=30) as server:
            server.login(SMTP_USERNAME, SMTP_PASSWORD)
            server.send_message(msg)
        return True
    except smtplib.SMTPAuthenticationError as e:
        logger.error(f"SMTP Authentication failed: {e}")
        return False
    except smtplib.SMTPException as e:
        logger.error(f"SMTP protocol error: {e}")
        return False
    except Exception as e:
        logger.error(f"SMTP connection error: {e}")
        return False


def _greeting(name: str) -> str:
    return f'<p style="margin: 0 0 20px 0; color: #333; font-size: 16px; line-height: 1.6;">Hello <strong>{name}</strong>,</p>'


def _text(content: str) -> str:
    return f'<p style="margin: 0 0 20px 0; color: #555; font-size: 16px; line-height: 1.6;">{content}</p>'


def _footer_note(text: str) -> str:
    return f'<p style="margin: 20px 0 0 0; color: #6c757d; font-size: 13px; font-style: italic;">{text}</p>'


async def send_inquiry_email(
    client_name: str,
    client_email: str,
    entity_id: Optional[int],
    entity_url: Optional[str],
    inquiry: str,
    db: AsyncSession
) -> bool:
    """Send an inquiry email using SSL on port 465."""
    try:
        logger.debug(f"Sending inquiry email from {client_email} about entity ID {entity_id or 'N/A'}, URL {entity_url or 'N/A'}")

        if not all([SMTP_SERVER, SMTP_USERNAME, SMTP_PASSWORD, RECIPIENT_EMAIL]):
            logger.error("Missing required SMTP environment variables")
            return False

        # Retrieve entity details if provided
        entity_details = {}
        if entity_id or entity_url:
            query = select(Entity)
            if entity_id:
                query = query.where(Entity.id == entity_id)
            elif entity_url:
                query = query.where(Entity.url == entity_url)
            result = await db.execute(query)
            entity = result.scalars().first()
            if entity:
                entity_details = {
                    "University": entity.university or "N/A",
                    "URL": entity.url or "N/A",
                    "Research Abstract": entity.research_abstract or "N/A",
                    "Location": entity.get_json_field("location") or {},
                    "Point of Contact": entity.get_json_field("point_of_contact") or {}
                }

        # Build detail rows
        detail_rows = [
            ("Client Name", client_name),
            ("Client Email", client_email),
        ]
        if entity_details:
            detail_rows.append(("University", entity_details["University"]))
            detail_rows.append(("URL", entity_details["URL"]))
            loc = entity_details["Location"]
            detail_rows.append(("Location", f"{loc.get('country', 'N/A')}, {loc.get('city', 'N/A')}"))
            poc = entity_details["Point of Contact"]
            detail_rows.append(("Point of Contact", f"{poc.get('name', 'N/A')} ({poc.get('email', 'N/A')})"))
        else:
            detail_rows.append(("Entity", "No specific entity provided"))

        main_content = (
            _text("A client has submitted an inquiry requesting additional information.")
            + get_detail_table(detail_rows)
            + get_info_box("Inquiry Message", inquiry, icon="💬", box_type="private")
        )

        html = get_branded_email_template(
            greeting=_greeting("Researcher"),
            main_content=main_content,
            footer_note=_footer_note("Please follow up with the client directly using their provided email address."),
        )

        # Plain text fallback
        plain = (
            f"Dear Researcher,\n\n"
            f"A client has submitted an inquiry requesting additional information.\n\n"
            f"Client Name: {client_name}\nClient Email: {client_email}\n\n"
        )
        if entity_details:
            plain += f"University: {entity_details['University']}\nURL: {entity_details['URL']}\n"
        plain += f"\nInquiry:\n{inquiry}\n\nBest regards,\nThe Unlokinno Intelligence Team"

        msg = EmailMessage()
        msg["Subject"] = f"Research Inquiry from {client_name}"
        msg["From"] = SMTP_USERNAME
        msg["To"] = RECIPIENT_EMAIL
        msg["Reply-To"] = client_email
        msg.set_content(plain)
        msg.add_alternative(html, subtype='html')

        if _send_email(msg):
            logger.info(f"Successfully sent inquiry email from {client_email} to {RECIPIENT_EMAIL}")
            return True
        return False

    except Exception as e:
        logger.error(f"Failed to send inquiry email from {client_email}: {str(e)}", exc_info=True)
        return False


async def send_feedback_email(
    feedback: str,
    name: Optional[str] = None,
    email: Optional[str] = None,
    user_id: Optional[UUID4] = None
) -> bool:
    """Send a feedback email using SSL on port 465."""
    try:
        logger.debug(f"Sending feedback email from {email or 'anonymous'}")

        if not all([SMTP_SERVER, SMTP_USERNAME, SMTP_PASSWORD, RECIPIENT_EMAIL]):
            logger.error("Missing required SMTP environment variables")
            return False

        detail_rows = []
        if user_id:
            detail_rows.append(("User ID", str(user_id)))
        if name:
            detail_rows.append(("Name", name))
        if email:
            detail_rows.append(("Email", email))

        main_content = (
            _text("You have received new user feedback.")
            + (get_detail_table(detail_rows) if detail_rows else "")
            + get_info_box("Feedback", feedback, icon="💬", box_type="private")
        )

        html = get_branded_email_template(
            greeting=_greeting("Platform Team"),
            main_content=main_content,
            footer_note=_footer_note("This feedback was submitted through the Unlokinno Intelligence platform."),
        )

        plain = (
            f"Dear Platform Team,\n\nYou have received new user feedback.\n\n"
            f"{'User ID: ' + str(user_id) + chr(10) if user_id else ''}"
            f"{'Name: ' + name + chr(10) if name else ''}"
            f"{'Email: ' + email + chr(10) if email else ''}"
            f"\nFeedback:\n{feedback}\n\nBest regards,\nThe Unlokinno Intelligence Team"
        )

        msg = EmailMessage()
        msg["Subject"] = f"User Feedback from {name or 'Anonymous'}"
        msg["From"] = SMTP_USERNAME
        msg["To"] = RECIPIENT_EMAIL
        if email:
            msg["Reply-To"] = email
        msg.set_content(plain)
        msg.add_alternative(html, subtype='html')

        if _send_email(msg):
            logger.info(f"Successfully sent feedback email from {email or 'anonymous'}")
            return True
        return False

    except Exception as e:
        logger.error(f"Failed to send feedback email: {str(e)}", exc_info=True)
        return False


async def send_password_reset_email(
    email: str,
    reset_link: str,
    user_name: Optional[str] = None
) -> bool:
    """Send password reset email to user."""
    try:
        logger.debug(f"Sending password reset email to {email}")

        if not all([SMTP_SERVER, SMTP_USERNAME, SMTP_PASSWORD]):
            logger.error("Missing required SMTP environment variables")
            return False

        display_name = user_name or "User"

        main_content = (
            _text("You recently requested to reset your password for your Unlokinno Intelligence account.")
            + get_info_box(
                "Password Reset Request",
                "Click the button below to reset your password. This link will expire in 1 hour.",
                icon="🔐",
                box_type="info",
            )
        )

        html = get_branded_email_template(
            greeting=_greeting(display_name),
            main_content=main_content,
            cta_button=get_cta_button("Reset Password", reset_link),
            footer_note=_footer_note("If you did not request this password reset, please ignore this email or contact support."),
        )

        plain = (
            f"Hello {display_name},\n\n"
            f"You recently requested to reset your password.\n\n"
            f"Click the link below to reset your password:\n{reset_link}\n\n"
            f"This link will expire in 1 hour.\n\n"
            f"If you did not request this, please ignore this email.\n\n"
            f"Best regards,\nThe Unlokinno Intelligence Team"
        )

        msg = EmailMessage()
        msg["Subject"] = "Reset Your Password | Unlokinno Intelligence"
        msg["From"] = SMTP_USERNAME
        msg["To"] = email
        msg.set_content(plain)
        msg.add_alternative(html, subtype='html')

        if _send_email(msg):
            logger.info(f"Password reset email sent to {email}")
            return True
        return False

    except Exception as e:
        logger.error(f"Unexpected error sending password reset email: {str(e)}")
        return False


async def send_password_reset_confirmation_email(
    email: str,
    user_name: Optional[str] = None
) -> bool:
    """Send confirmation email after successful password reset."""
    try:
        logger.debug(f"Sending password reset confirmation email to {email}")

        if not all([SMTP_SERVER, SMTP_USERNAME, SMTP_PASSWORD]):
            logger.error("Missing required SMTP environment variables")
            return False

        display_name = user_name or "User"

        main_content = (
            get_info_box(
                "Password Successfully Reset",
                "Your password has been successfully reset for your Unlokinno Intelligence account.",
                icon="✅",
                box_type="success",
            )
            + get_info_box(
                "Security Notice",
                "If you did not make this change, please contact support immediately to secure your account.",
                icon="⚠️",
                box_type="warning",
            )
        )

        html = get_branded_email_template(
            greeting=_greeting(display_name),
            main_content=main_content,
        )

        plain = (
            f"Hello {display_name},\n\n"
            f"Your password has been successfully reset.\n\n"
            f"If you did not make this change, please contact support immediately.\n\n"
            f"Best regards,\nThe Unlokinno Intelligence Team"
        )

        msg = EmailMessage()
        msg["Subject"] = "Password Successfully Reset | Unlokinno Intelligence"
        msg["From"] = SMTP_USERNAME
        msg["To"] = email
        msg.set_content(plain)
        msg.add_alternative(html, subtype='html')

        if _send_email(msg):
            logger.info(f"Password reset confirmation email sent to {email}")
            return True
        return False

    except Exception as e:
        logger.error(f"Unexpected error sending password reset confirmation email: {str(e)}")
        return False


async def send_event_registration_confirmation_email(
    email: str,
    first_name: str,
    event_title: str,
    event_date: str,
    event_location: str,
    registration_type: str,
    setup_password_url: Optional[str] = None,
    reject_registration_url: Optional[str] = None,
    virtual_link: Optional[str] = None,
    location_type: Optional[str] = None
) -> bool:
    """Send confirmation email after event registration using shared branded template."""
    try:
        logger.debug(f"Sending event registration confirmation email to {email}")

        if not all([SMTP_SERVER, SMTP_USERNAME, SMTP_PASSWORD]):
            logger.error("Missing required SMTP environment variables")
            return False

        location_html = get_location_section(event_location, location_type, virtual_link)
        event_box = get_event_details_box(event_date, location_html)

        # Build content section based on registration type
        if registration_type == "profile_first" and setup_password_url:
            content_section = (
                get_info_box(
                    "Complete Your Account Setup",
                    "You've registered using the \"Profile-First\" option. Set up your password to manage your registration.",
                    icon="🔐",
                    box_type="private",
                )
                + get_cta_button("Set Up Password", setup_password_url)
                + _text("⏰ This link will expire in 24 hours.")
                + _text("<strong>After setting up your password, you'll be able to:</strong>")
                + """<ul style="margin: 0 0 20px 0; padding-left: 20px; color: #555; font-size: 14px; line-height: 1.8;">
                    <li>Manage your event registration</li>
                    <li>Connect with other attendees</li>
                    <li>Update your profile</li>
                    <li>Access exclusive event features</li>
                </ul>"""
            )
            if reject_registration_url:
                content_section += _footer_note(
                    f'Don\'t want to attend? <a href="{reject_registration_url}" style="color: #dc3545;">Cancel Registration</a>'
                )
        elif registration_type == "full":
            content_section = (
                get_info_box(
                    "Your Account is Ready!",
                    "Your account has been created successfully! You can now log in and enjoy all the features.",
                    icon="✨",
                    box_type="success",
                )
                + _text("<strong>What you can do now:</strong>")
                + """<ul style="margin: 0 0 20px 0; padding-left: 20px; color: #555; font-size: 14px; line-height: 1.8;">
                    <li>Manage your event registration</li>
                    <li>Connect with other attendees</li>
                    <li>Update your profile</li>
                    <li>Access exclusive event features</li>
                </ul>"""
                + _footer_note("If you did not register for this event, please contact support immediately.")
            )
        elif registration_type == "anonymous":
            content_section = (
                get_info_box(
                    "Private Registration",
                    "Your registration is private - your name will not appear in the public attendee list.",
                    icon="🔒",
                    box_type="private",
                )
                + _footer_note("If you did not register for this event, please ignore this email.")
            )
        else:  # basic or fallback
            content_section = (
                get_info_box(
                    "Registration Confirmed",
                    "We're excited to have you join us! We'll send you more details as the event date approaches.",
                    icon="✅",
                    box_type="success",
                )
                + _footer_note("If you did not register for this event, please ignore this email.")
            )

        main_content = (
            _text(f'Thank you for registering for <strong>{event_title}</strong>!')
            + event_box
            + content_section
        )

        html = get_branded_email_template(
            greeting=_greeting(first_name),
            main_content=main_content,
        )

        plain = (
            f"Hello {first_name},\n\n"
            f"Thank you for registering for {event_title}!\n\n"
            f"Event Details:\nDate & Time: {event_date}\nLocation: {event_location}\n\n"
            f"{'Your registration is private.' + chr(10) if registration_type == 'anonymous' else ''}"
            f"{'Set up your password: ' + setup_password_url + chr(10) if setup_password_url else ''}"
            f"\nBest regards,\nThe Unlokinno Intelligence Team"
        )

        msg = EmailMessage()
        msg["Subject"] = f"Registration Confirmed: {event_title} | Unlokinno Intelligence"
        msg["From"] = SMTP_USERNAME
        msg["To"] = email
        msg.set_content(plain)
        msg.add_alternative(html, subtype='html')

        if _send_email(msg):
            logger.info(f"Event registration confirmation email sent to {email}")
            return True
        return False

    except Exception as e:
        logger.error(f"Unexpected error sending registration confirmation email: {str(e)}")
        return False


async def send_registration_rejection_confirmation_email(
    email: str,
    first_name: str,
    event_title: str
) -> bool:
    """Send confirmation email after a registration has been rejected/cancelled."""
    try:
        logger.debug(f"Sending registration rejection confirmation email to {email}")

        if not all([SMTP_SERVER, SMTP_USERNAME, SMTP_PASSWORD]):
            logger.error("Missing required SMTP environment variables")
            return False

        main_content = (
            _text(f'Your registration for <strong>{event_title}</strong> has been cancelled.')
            + get_info_box(
                "Registration Cancelled",
                "All your information has been removed from our systems. If you did not request this cancellation, please contact support immediately.",
                icon="❌",
                box_type="warning",
            )
            + _text("If you wish to register again in the future, you can do so through our event page.")
        )

        html = get_branded_email_template(
            greeting=_greeting(first_name),
            main_content=main_content,
        )

        plain = (
            f"Hello {first_name},\n\n"
            f"Your registration for {event_title} has been cancelled.\n\n"
            f"All your information has been removed. If you did not request this, contact support.\n\n"
            f"Best regards,\nThe Unlokinno Intelligence Team"
        )

        msg = EmailMessage()
        msg["Subject"] = f"Registration Cancelled: {event_title} | Unlokinno Intelligence"
        msg["From"] = SMTP_USERNAME
        msg["To"] = email
        msg.set_content(plain)
        msg.add_alternative(html, subtype='html')

        if _send_email(msg):
            logger.info(f"Registration rejection confirmation email sent to {email}")
            return True
        return False

    except Exception as e:
        logger.error(f"Unexpected error sending rejection confirmation email: {str(e)}")
        return False


async def send_event_registration_admin_notification_email(
    admin_email: str,
    event_title: str,
    registrant_name: str,
    registrant_email: str,
    registration_type: str
) -> bool:
    """Send notification to admin about new event registration."""
    try:
        logger.debug(f"Sending admin notification email for new registration")

        if not all([SMTP_SERVER, SMTP_USERNAME, SMTP_PASSWORD, RECIPIENT_EMAIL]):
            logger.error("Missing required SMTP environment variables")
            return False

        base_url = os.getenv("FRONTEND_URL", "http://localhost:3000")

        main_content = (
            _text(f'A new registration has been received for <strong>{event_title}</strong>.')
            + get_detail_table([
                ("Name", registrant_name),
                ("Email", registrant_email),
                ("Type", registration_type),
            ])
        )

        html = get_branded_email_template(
            greeting=_greeting("Admin"),
            main_content=main_content,
            cta_button=get_cta_button("View Dashboard", f"{base_url}/admin"),
        )

        plain = (
            f"Hello Admin,\n\n"
            f"A new registration has been received for {event_title}.\n\n"
            f"Name: {registrant_name}\nEmail: {registrant_email}\nType: {registration_type}\n\n"
            f"Best regards,\nThe Unlokinno Intelligence Team"
        )

        msg = EmailMessage()
        msg["Subject"] = f"New Event Registration: {registrant_name} for {event_title}"
        msg["From"] = SMTP_USERNAME
        msg["To"] = admin_email
        msg.set_content(plain)
        msg.add_alternative(html, subtype='html')

        if _send_email(msg):
            logger.info(f"Admin notification email sent for new registration")
            return True
        return False

    except Exception as e:
        logger.error(f"Unexpected error sending admin notification email: {str(e)}")
        return False


async def send_bulk_import_invitation_email(
    email: str,
    invitation_link: str,
    full_name: str,
    profile_type: str
) -> bool:
    """Send invitation email for bulk imported users to set up their account."""
    try:
        logger.debug(f"Sending bulk import invitation email to {email}")

        if not all([SMTP_SERVER, SMTP_USERNAME, SMTP_PASSWORD]):
            logger.error("Missing required SMTP environment variables")
            return False

        main_content = (
            _text(f'You\'ve been invited to join the Unlokinno Intelligence platform as a <strong>{profile_type}</strong>!')
            + get_info_box(
                "Complete Your Profile",
                "Set up your password to start connecting with the climate tech community.",
                icon="🚀",
                box_type="info",
            )
            + _text("<strong>After setting up your password, you'll be able to:</strong>")
            + """<ul style="margin: 0 0 20px 0; padding-left: 20px; color: #555; font-size: 14px; line-height: 1.8;">
                <li>Create and manage your profile</li>
                <li>Connect with labs, entrepreneurs, and researchers</li>
                <li>Access research entities and matchmaking features</li>
                <li>Participate in events and workshops</li>
            </ul>"""
            + _text("⏰ This link will expire in 24 hours. If you don't respond, your profile will be automatically removed.")
        )

        html = get_branded_email_template(
            greeting=_greeting(full_name),
            main_content=main_content,
            cta_button=get_cta_button("Set Up Account", invitation_link),
            footer_note=_footer_note("If you did not request this invitation, you can ignore this email."),
        )

        plain = (
            f"Hello {full_name},\n\n"
            f"You've been invited to join the Unlokinno Intelligence platform as a {profile_type}!\n\n"
            f"Set up your account: {invitation_link}\n\n"
            f"This link will expire in 24 hours.\n\n"
            f"Best regards,\nThe Unlokinno Intelligence Team"
        )

        msg = EmailMessage()
        msg["Subject"] = "Welcome to Unlokinno Intelligence - Complete Your Profile Setup"
        msg["From"] = SMTP_USERNAME
        msg["To"] = email
        msg.set_content(plain)
        msg.add_alternative(html, subtype='html')

        if _send_email(msg):
            logger.info(f"Bulk import invitation email sent to {email}")
            return True
        return False

    except Exception as e:
        logger.error(f"Unexpected error sending invitation email: {str(e)}")
        return False


async def send_partner_approval_email(email: str, partner_name: str) -> bool:
    """Send email notifying partner their application was approved."""
    try:
        if not all([SMTP_SERVER, SMTP_USERNAME, SMTP_PASSWORD]):
            logger.error("Missing required SMTP environment variables")
            return False

        base_url = os.getenv("FRONTEND_URL", "http://localhost:3000")

        main_content = (
            get_info_box(
                "Application Approved!",
                f'Great news! Your partner application for "<strong>{partner_name}</strong>" has been approved on Unlokinno Intelligence.',
                icon="🎉",
                box_type="success",
            )
            + _text("You can now access your partner dashboard and start managing your organization.")
        )

        html = get_branded_email_template(
            greeting=_greeting("Partner"),
            main_content=main_content,
            cta_button=get_cta_button("Go to Dashboard", f"{base_url}/partners"),
        )

        plain = (
            f"Hello,\n\n"
            f"Great news! Your partner application for \"{partner_name}\" has been approved.\n\n"
            f"You can now access your partner dashboard.\n\n"
            f"Best regards,\nThe Unlokinno Intelligence Team"
        )

        msg = EmailMessage()
        msg["Subject"] = f"Partner Application Approved: {partner_name} | Unlokinno Intelligence"
        msg["From"] = SMTP_USERNAME
        msg["To"] = email
        msg.set_content(plain)
        msg.add_alternative(html, subtype='html')

        if _send_email(msg):
            logger.info(f"Partner approval email sent to {email}")
            return True
        return False

    except Exception as e:
        logger.error(f"Failed to send partner approval email: {str(e)}")
        return False


async def send_partner_rejection_email(email: str, partner_name: str) -> bool:
    """Send email notifying partner their application was rejected."""
    try:
        if not all([SMTP_SERVER, SMTP_USERNAME, SMTP_PASSWORD]):
            logger.error("Missing required SMTP environment variables")
            return False

        main_content = (
            _text("Thank you for your interest in becoming a partner on Unlokinno Intelligence.")
            + get_info_box(
                "Application Update",
                f'After reviewing your application for "<strong>{partner_name}</strong>", we are unable to approve it at this time.',
                icon="📋",
                box_type="info",
            )
            + _text("If you have questions, please contact our support team.")
        )

        html = get_branded_email_template(
            greeting=_greeting("Partner"),
            main_content=main_content,
        )

        plain = (
            f"Hello,\n\n"
            f"Thank you for your interest in becoming a partner on Unlokinno Intelligence.\n\n"
            f"After reviewing your application for \"{partner_name}\", we are unable to approve it at this time.\n\n"
            f"If you have questions, please contact our support team.\n\n"
            f"Best regards,\nThe Unlokinno Intelligence Team"
        )

        msg = EmailMessage()
        msg["Subject"] = f"Partner Application Update: {partner_name} | Unlokinno Intelligence"
        msg["From"] = SMTP_USERNAME
        msg["To"] = email
        msg.set_content(plain)
        msg.add_alternative(html, subtype='html')

        if _send_email(msg):
            logger.info(f"Partner rejection email sent to {email}")
            return True
        return False

    except Exception as e:
        logger.error(f"Failed to send partner rejection email: {str(e)}")
        return False


async def send_partner_invitation_email(email: str, partner_name: str, invite_token: str, role: str) -> bool:
    """Send invitation email to join a partner organization."""
    try:
        if not all([SMTP_SERVER, SMTP_USERNAME, SMTP_PASSWORD]):
            logger.error("Missing required SMTP environment variables")
            return False

        base_url = os.getenv("FRONTEND_URL", "http://localhost:3000")
        invite_link = f"{base_url}/partners/invite?token={invite_token}"

        main_content = (
            _text(f'You\'ve been invited to join "<strong>{partner_name}</strong>" as a <strong>{role}</strong> on Unlokinno Intelligence.')
            + get_info_box(
                "Team Invitation",
                "Click the button below to accept the invitation and join the organization.",
                icon="🤝",
                box_type="info",
            )
            + _text("⏰ This invitation will expire in 7 days.")
        )

        html = get_branded_email_template(
            greeting=_greeting("there"),
            main_content=main_content,
            cta_button=get_cta_button("Accept Invitation", invite_link),
            footer_note=_footer_note("If you did not expect this invitation, you can ignore this email."),
        )

        plain = (
            f"Hello,\n\n"
            f"You've been invited to join \"{partner_name}\" as a {role} on Unlokinno Intelligence.\n\n"
            f"Accept the invitation: {invite_link}\n\n"
            f"This invitation will expire in 7 days.\n\n"
            f"Best regards,\nThe Unlokinno Intelligence Team"
        )

        msg = EmailMessage()
        msg["Subject"] = f"Invitation to join {partner_name} | Unlokinno Intelligence"
        msg["From"] = SMTP_USERNAME
        msg["To"] = email
        msg.set_content(plain)
        msg.add_alternative(html, subtype='html')

        if _send_email(msg):
            logger.info(f"Partner invitation email sent to {email}")
            return True
        return False

    except Exception as e:
        logger.error(f"Failed to send partner invitation email: {str(e)}")
        return False


async def send_admin_partner_invite_email(
    email: str,
    organization_name: Optional[str] = None,
    message: Optional[str] = None
) -> bool:
    """Send an admin-initiated invitation to register as a partner on the platform."""
    try:
        if not all([SMTP_SERVER, SMTP_USERNAME, SMTP_PASSWORD]):
            logger.error("Missing required SMTP environment variables")
            return False

        base_url = os.getenv("FRONTEND_URL", "http://localhost:3000")
        register_link = f"{base_url}/partners/new?ref=admin-invite&email={email}"

        org_mention = f' on behalf of <strong>{organization_name}</strong>' if organization_name else ""
        custom_msg = ""
        if message:
            custom_msg = get_info_box("Message from the Team", message, icon="💬", box_type="info")

        main_content = (
            _text(f"You've been invited{org_mention} to join Unlokinno Intelligence as a partner organization!")
            + custom_msg
            + _text(
                "Unlokinno Intelligence connects innovators in climate tech — labs, researchers, entrepreneurs, and organizations. "
                "As a partner, you'll be able to showcase your organization, manage your team, and connect with the community."
            )
        )

        html = get_branded_email_template(
            greeting=_greeting("there"),
            main_content=main_content,
            cta_button=get_cta_button("Register as Partner", register_link),
            footer_note=_footer_note("If you did not expect this invitation, you can ignore this email."),
        )

        plain = (
            f"Hello,\n\n"
            f"You've been invited to join Unlokinno Intelligence as a partner organization"
            f"{' on behalf of ' + organization_name if organization_name else ''}!\n\n"
            f"{('Message: ' + message + chr(10) + chr(10)) if message else ''}"
            f"Register here: {register_link}\n\n"
            f"Best regards,\nThe Unlokinno Intelligence Team"
        )

        msg = EmailMessage()
        msg["Subject"] = "You're Invited to Join Unlokinno Intelligence as a Partner"
        msg["From"] = SMTP_USERNAME
        msg["To"] = email
        msg.set_content(plain)
        msg.add_alternative(html, subtype='html')

        if _send_email(msg):
            logger.info(f"Admin partner invite email sent to {email}")
            return True
        return False

    except Exception as e:
        logger.error(f"Failed to send admin partner invite email: {str(e)}")
        return False
