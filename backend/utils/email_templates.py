"""
Branded Email Template for Unlokinno Intelligence
Brand Colors: Light Neon Green, White, Black
"""

def get_branded_email_template(
    greeting: str,
    main_content: str,
    cta_button: str = "",
    footer_note: str = ""
) -> str:
    """
    Reusable branded email template with Unlokinno colors.

    Args:
        greeting: Personalized greeting (e.g., "Hello John,")
        main_content: Main HTML content body
        cta_button: Optional call-to-action button HTML
        footer_note: Optional footer note

    Returns:
        Complete HTML email template
    """

    # Brand Colors
    NEON_GREEN = "#00FB75"      # Primary brand green (matches frontend)
    DARK_GREEN = "#00D95F"      # Darker green (for gradients)
    BLACK = "#000000"           # Black
    WHITE = "#FFFFFF"           # White
    LIGHT_GRAY = "#f4f4f4"      # Light background
    DARK_GRAY = "#333333"       # Dark text
    MED_GRAY = "#666666"        # Medium text

    template = f"""
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Unlokinno Intelligence</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: {LIGHT_GRAY};">
    <table role="presentation" style="width: 100%; border-collapse: collapse;">
        <tr>
            <td align="center" style="padding: 40px 0;">
                <table role="presentation" style="width: 600px; max-width: 100%; background: {WHITE}; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">

                    <!-- Header with Brand Colors -->
                    <tr>
                        <td style="background: linear-gradient(135deg, {NEON_GREEN} 0%, {DARK_GREEN} 100%); padding: 40px 30px; text-align: center; border-radius: 12px 12px 0 0;">
                            <h1 style="margin: 0; color: {BLACK}; font-size: 28px; font-weight: 700; text-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                                🌍 Unlokinno Intelligence
                            </h1>
                        </td>
                    </tr>

                    <!-- Body -->
                    <tr>
                        <td style="padding: 40px 30px;">
                            {greeting}

                            {main_content}

                            {cta_button}

                            {footer_note}
                        </td>
                    </tr>

                    <!-- Footer -->
                    <tr>
                        <td style="padding: 30px; background: {BLACK}; text-align: center; border-radius: 0 0 12px 12px; border-top: 3px solid {NEON_GREEN};">
                            <p style="margin: 0 0 10px 0; color: {WHITE}; font-size: 14px;">Best regards,</p>
                            <p style="margin: 0; color: {NEON_GREEN}; font-size: 16px; font-weight: 700;">The Unlokinno Intelligence Team</p>
                            <p style="margin: 15px 0 0 0; color: {WHITE}; font-size: 12px; opacity: 0.8;">Connecting innovators in climate tech</p>
                        </td>
                    </tr>

                </table>
            </td>
        </tr>
    </table>
</body>
</html>
"""

    return template


def get_event_details_box(
    event_date: str,
    location_content: str,
    box_color: str = "#00FB75"
) -> str:
    """Generate event details box with brand styling."""
    return f"""
<table role="presentation" style="width: 100%; margin: 30px 0;">
    <tr>
        <td style="padding: 25px; background: #000000; border-left: 5px solid {box_color}; border-radius: 8px;">
            <h3 style="margin: 0 0 15px 0; color: {box_color}; font-size: 18px; font-weight: 700;">📅 Event Details</h3>
            <p style="margin: 0 0 10px 0; color: #FFFFFF; font-size: 14px;"><strong>📅 Date & Time:</strong> {event_date}</p>
            {location_content}
        </td>
    </tr>
</table>
"""


def get_info_box(
    title: str,
    content: str,
    icon: str = "ℹ️",
    box_type: str = "info"
) -> str:
    """
    Generate styled info/warning/success boxes.

    Args:
        title: Box title
        content: Box content
        icon: Emoji icon
        box_type: 'info', 'warning', 'success', or 'private'
    """

    colors = {
        "info": {"bg": "#e7f3ff", "border": "#00FB75", "text": "#00D95F"},
        "warning": {"bg": "#fff3cd", "border": "#ffc107", "text": "#856404"},
        "success": {"bg": "#d4edda", "border": "#28a745", "text": "#155724"},
        "private": {"bg": "#1a1a1a", "border": "#00FB75", "text": "#00FB75"},
    }

    style = colors.get(box_type, colors["info"])

    return f"""
<div style="background: {style['bg']}; border-left: 4px solid {style['border']}; padding: 20px; border-radius: 8px; margin: 20px 0;">
    <h3 style="margin: 0 0 10px 0; color: {style['text']}; font-size: 16px; font-weight: 700;">{icon} {title}</h3>
    <p style="margin: 0; color: {style['text']}; font-size: 14px; line-height: 1.6;">
        {content}
    </p>
</div>
"""


def get_cta_button(
    text: str,
    url: str,
    color: str = "#00FB75"
) -> str:
    """Generate call-to-action button with brand styling."""
    return f"""
<div style="text-align: center; margin: 30px 0;">
    <a href="{url}" style="display: inline-block; padding: 15px 40px; background: {color}; color: #000000; text-decoration: none; border-radius: 8px; font-weight: 700; font-size: 16px; box-shadow: 0 4px 6px rgba(0, 251, 117, 0.3);">
        {text}
    </a>
</div>
"""


def get_detail_row(label: str, value: str) -> str:
    """Generate a key-value detail row for emails."""
    return f"""
<tr>
    <td style="padding: 8px 12px; color: #666666; font-size: 14px; font-weight: 600; white-space: nowrap; vertical-align: top;">{label}</td>
    <td style="padding: 8px 12px; color: #333333; font-size: 14px;">{value}</td>
</tr>
"""


def get_detail_table(rows: list[tuple[str, str]]) -> str:
    """Generate a styled detail table from label-value pairs."""
    rows_html = "".join(get_detail_row(label, value) for label, value in rows)
    return f"""
<table role="presentation" style="width: 100%; margin: 20px 0; border-collapse: collapse; background: #f9f9f9; border-radius: 8px; overflow: hidden;">
    {rows_html}
</table>
"""


def get_location_section(
    event_location: str,
    location_type: str = None,
    virtual_link: str = None
) -> str:
    """Generate location section with optional virtual link."""

    if location_type == "virtual" or location_type == "hybrid":
        if virtual_link:
            location_name = event_location if location_type == "hybrid" else "Virtual Event"
            return f"""
<p style="margin: 0 0 10px 0; color: #FFFFFF; font-size: 14px;"><strong>📍 Location:</strong> {location_name}</p>
<div style="margin: 15px 0;">
    <a href="{virtual_link}" style="display: inline-block; padding: 12px 24px; background: #00FB75; color: #000000; text-decoration: none; border-radius: 6px; font-weight: 700; box-shadow: 0 2px 4px rgba(0, 251, 117, 0.3);">
        🔗 Join Virtual Event
    </a>
</div>
"""
        else:
            return '<p style="margin: 0; color: #FFFFFF; font-size: 14px;"><strong>📍 Location:</strong> Virtual Event (Link will be sent closer to the event date)</p>'
    else:
        return f'<p style="margin: 0; color: #FFFFFF; font-size: 14px;"><strong>📍 Location:</strong> {event_location}</p>'
