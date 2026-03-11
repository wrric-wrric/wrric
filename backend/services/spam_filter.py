SPAM_KEYWORDS = [
    "buy now",
    "click here",
    "free money",
    "casino",
    "earn money fast",
    "limited time offer",
    "act now",
    "congratulations you won",
    "you have been selected",
    "make money online",
    "work from home",
    "double your income",
    "nigerian prince",
    "wire transfer",
    "100% free",
    "no obligation",
    "this is not spam",
    "dear friend",
    "urgent response needed",
    "viagra",
    "cialis",
    "cheap pills",
    "weight loss miracle",
    "crypto investment",
    "guaranteed profit",
]


def check_spam(text: str) -> bool:
    """Returns True if text is likely spam."""
    lowered = text.lower()
    return any(kw in lowered for kw in SPAM_KEYWORDS)
