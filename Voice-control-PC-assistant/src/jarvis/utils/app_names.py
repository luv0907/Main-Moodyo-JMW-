"""
App name resolver for macOS.
Maps casual/spoken app names to exact macOS .app names.
"""

# Exact mapping of spoken names → macOS app bundle names
APP_NAME_MAP = {
    # Browsers
    "chrome": "Google Chrome",
    "google chrome": "Google Chrome",
    "chromium": "Chromium",
    "firefox": "Firefox",
    "safari": "Safari",
    "brave": "Brave Browser",
    "opera": "Opera",
    "edge": "Microsoft Edge",

    # Email
    "mail": "Mail",
    "email": "Mail",
    "outlook": "Microsoft Outlook",

    # Office / Text
    "notepad": "TextEdit",
    "note pad": "TextEdit",
    "text edit": "TextEdit",
    "textedit": "TextEdit",
    "notes": "Notes",
    "apple notes": "Notes",
    "word": "Microsoft Word",
    "excel": "Microsoft Excel",
    "powerpoint": "Microsoft PowerPoint",
    "pages": "Pages",
    "numbers": "Numbers",
    "keynote": "Keynote",
    "libreoffice": "LibreOffice",

    # Files / Finder
    "finder": "Finder",
    "files": "Finder",
    "file manager": "Finder",
    "explorer": "Finder",

    # Media
    "music": "Music",
    "spotify": "Spotify",
    "vlc": "VLC",
    "quicktime": "QuickTime Player",
    "photos": "Photos",
    "preview": "Preview",
    "tvplus": "TV",
    "podcasts": "Podcasts",

    # Messaging
    "whatsapp": "WhatsApp",
    "telegram": "Telegram",
    "messages": "Messages",
    "facetime": "FaceTime",
    "slack": "Slack",
    "discord": "Discord",
    "zoom": "zoom.us",
    "teams": "Microsoft Teams",
    "skype": "Skype",

    # Dev tools
    "terminal": "Terminal",
    "iterm": "iTerm2",
    "iterm2": "iTerm2",
    "vscode": "Visual Studio Code",
    "vs code": "Visual Studio Code",
    "visual studio code": "Visual Studio Code",
    "xcode": "Xcode",
    "android studio": "Android Studio",
    "pycharm": "PyCharm",
    "intellij": "IntelliJ IDEA",
    "sublime": "Sublime Text",
    "sublime text": "Sublime Text",
    "atom": "Atom",
    "cursor": "Cursor",
    "postman": "Postman",
    "docker": "Docker",
    "github desktop": "GitHub Desktop",

    # System
    "system preferences": "System Preferences",
    "system settings": "System Preferences",
    "settings": "System Preferences",
    "activity monitor": "Activity Monitor",
    "task manager": "Activity Monitor",
    "calculator": "Calculator",
    "calendar": "Calendar",
    "notes": "Notes",
    "reminders": "Reminders",
    "maps": "Maps",
    "clock": "Clock",
    "weather": "Weather",
    "app store": "App Store",
    "appstore": "App Store",
    "screen saver": "ScreenSaverEngine",
    "disk utility": "Disk Utility",
    "keychain": "Keychain Access",
    "bluetooth": "Bluetooth Screen Lock",
    "airdrop": "Finder",  # AirDrop is in Finder

    # Notes / Writing
    "notion": "Notion",
    "obsidian": "Obsidian",
    "bear": "Bear",
    "ulysses": "Ulysses",

    # Creative
    "photoshop": "Adobe Photoshop 2024",
    "illustrator": "Adobe Illustrator 2024",
    "figma": "Figma",
    "sketch": "Sketch",
    "canva": "Canva",
    "final cut": "Final Cut Pro",
    "final cut pro": "Final Cut Pro",
    "imovie": "iMovie",
    "garage band": "GarageBand",
    "garageband": "GarageBand",
    "logic pro": "Logic Pro",

    # Utilities
    "google drive": "Google Drive",
    "dropbox": "Dropbox",
    "onedrive": "OneDrive",
    "1password": "1Password 7 - Password Manager",
    "bitwarden": "Bitwarden",
    "alfred": "Alfred",
    "raycast": "Raycast",
    "screenflow": "ScreenFlow",
    "loom": "Loom",
}

# ── Web-only services: open these as URLs in the browser ────────────────────
# When an app name matches one of these keys, open_app falls back to open_url.
WEB_URL_MAP = {
    # Google
    "youtube":        "https://www.youtube.com",
    "gmail":          "https://mail.google.com",
    "google mail":    "https://mail.google.com",
    "google maps":    "https://maps.google.com",
    "google docs":    "https://docs.google.com",
    "google sheets":  "https://sheets.google.com",
    "google slides":  "https://slides.google.com",
    "google drive web": "https://drive.google.com",
    "google photos":  "https://photos.google.com",
    "google meet":    "https://meet.google.com",
    "google calendar": "https://calendar.google.com",
    "google translate": "https://translate.google.com",
    # Streaming
    "netflix":        "https://www.netflix.com",
    "prime video":    "https://www.primevideo.com",
    "amazon prime":   "https://www.primevideo.com",
    "hulu":           "https://www.hulu.com",
    "disney plus":    "https://www.disneyplus.com",
    "disney+":        "https://www.disneyplus.com",
    "hotstar":        "https://www.hotstar.com",
    "jio cinema":     "https://www.jiocinema.com",
    "crunchyroll":    "https://www.crunchyroll.com",
    "twitch":         "https://www.twitch.tv",
    # Social
    "twitter":        "https://twitter.com",
    "x":              "https://twitter.com",
    "instagram":      "https://www.instagram.com",
    "facebook":       "https://www.facebook.com",
    "linkedin":       "https://www.linkedin.com",
    "reddit":         "https://www.reddit.com",
    "pinterest":      "https://www.pinterest.com",
    "tiktok":         "https://www.tiktok.com",
    # Dev / Others
    "github":         "https://github.com",
    "stackoverflow":  "https://stackoverflow.com",
    "stack overflow": "https://stackoverflow.com",
    "chatgpt":        "https://chat.openai.com",
    "openai":         "https://chat.openai.com",
    "claude":         "https://claude.ai",
    "gemini":         "https://gemini.google.com",
    "perplexity":     "https://www.perplexity.ai",
    "amazon":         "https://www.amazon.com",
    "flipkart":       "https://www.flipkart.com",
    "wikipedia":      "https://www.wikipedia.org",
}


def resolve_app_name(spoken_name: str) -> str:
    """
    Resolves a spoken/casual app name to the exact macOS app name.
    Falls back to title-casing the input if no match is found.
    """
    key = spoken_name.strip().lower()
    return APP_NAME_MAP.get(key, spoken_name.strip().title())


def resolve_to_url(spoken_name: str) -> str | None:
    """
    Returns a URL if the spoken name is a known web-only service,
    otherwise returns None (meaning it should be opened as a desktop app).
    """
    return WEB_URL_MAP.get(spoken_name.strip().lower())
