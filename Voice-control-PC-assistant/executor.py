class JarvisExecutor:
    def execute(self, step):
        action = step["action"]
        params = step.get("params", {})

        if action == "open_app":
            self.open_app(params["app_name"])

        elif action == "type_text":
            self.smart_type(params["text"], params.get("instant", False))

        elif action == "key_press":
            pyautogui.press(params["key"])

        elif action == "click":
            pyautogui.click(params["x"], params["y"])

        elif action == "execute_shell":
            subprocess.run(params["command"], shell=True)

        elif action == "wait":
            time.sleep(params.get("seconds", 1))

        elif action == "speak":
            return ("speak", params["text"])

        return ("success", None)
