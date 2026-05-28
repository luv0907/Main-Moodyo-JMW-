"""
Contacts book for JARVIS.
Maps names to email addresses, phone numbers, or other details.
Usage: resolve_email("akshay") -> "akshay@gmail.com"
"""
import json
import os
from jarvis.utils.logger import logger

CONTACTS_FILE = os.path.join(os.path.dirname(__file__), "..", "..", "..", "..", "contacts.json")
CONTACTS_FILE = os.path.abspath(CONTACTS_FILE)


def _load() -> dict:
    if os.path.exists(CONTACTS_FILE):
        try:
            with open(CONTACTS_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            return {}
    return {}


def _save(contacts: dict):
    with open(CONTACTS_FILE, "w", encoding="utf-8") as f:
        json.dump(contacts, f, indent=2)


def list_contacts() -> dict:
    """Return all contacts."""
    return _load()


def resolve_email(name: str) -> str:
    """
    Given a name (e.g. 'akshay'), return the stored email address.
    Falls back to the original name if not found.
    """
    contacts = _load()
    key = name.strip().lower()
    result = contacts.get(key, {})
    if isinstance(result, dict):
        return result.get("email", name)
    if isinstance(result, str):
        return result
    return name


def resolve_contact(name: str) -> dict:
    """Return full contact info for a name."""
    contacts = _load()
    return contacts.get(name.strip().lower(), {})


def add_contact(name: str, email: str, phone: str = ""):
    """Add or update a contact."""
    contacts = _load()
    contacts[name.strip().lower()] = {
        "name": name.strip().title(),
        "email": email.strip(),
        "phone": phone.strip(),
    }
    _save(contacts)
    logger.info(f"Contact saved: {name} <{email}>")


def delete_contact(name: str) -> bool:
    """Remove a contact. Returns True if deleted."""
    contacts = _load()
    key = name.strip().lower()
    if key in contacts:
        del contacts[key]
        _save(contacts)
        return True
    return False


def find_by_name(partial: str) -> list:
    """Find contacts whose name contains the partial string."""
    contacts = _load()
    partial = partial.strip().lower()
    return [
        {"key": k, **v} if isinstance(v, dict) else {"key": k, "email": v}
        for k, v in contacts.items()
        if partial in k
    ]
