# test_ssl_fix.py
import smtplib
import os
from dotenv import load_dotenv
from email.message import EmailMessage

load_dotenv()

def test_ssl_email():
    """Test email sending with SSL on port 465"""
    try:
        print("Testing SSL email on port 465...")
        
        # Create a test message
        msg = EmailMessage()
        msg["Subject"] = "Test SSL Email"
        msg["From"] = os.getenv("SMTP_USERNAME")
        msg["To"] = os.getenv("RECIPIENT_EMAIL")
        msg.set_content("This is a test email using SSL on port 465.")
        
        # Connect using SSL
        server = smtplib.SMTP_SSL("smtp.gmail.com", 465, timeout=30)
        print("✓ SSL connection established")
        
        server.login(os.getenv("SMTP_USERNAME"), os.getenv("SMTP_PASSWORD"))
        print("✓ Login successful")
        
        server.send_message(msg)
        print("✓ Email sent successfully")
        
        server.quit()
        print("🎉 SSL email test PASSED!")
        return True
        
    except Exception as e:
        print(f"❌ SSL email test failed: {e}")
        return False

if __name__ == "__main__":
    test_ssl_email()