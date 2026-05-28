SAFE_ACTIONS = {
    "open_app",
    "type_text",
    "click",
    "wait",
    "speak"
}

DANGEROUS_ACTIONS = {
    "execute_shell",
    "delete_file",
    "shutdown",
    "rm_rf"
}

def allow_action(action, mode):
    if mode == "GOD":
        return True

    if action in SAFE_ACTIONS:
        return True

    return False
