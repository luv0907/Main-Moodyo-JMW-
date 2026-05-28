def reflect(step, result):
    """
    Returns True if retry is needed
    """
    if result["status"] == "success":
        return False

    if "not found" in str(result).lower():
        return True

    if "timeout" in str(result).lower():
        return True

    return False
