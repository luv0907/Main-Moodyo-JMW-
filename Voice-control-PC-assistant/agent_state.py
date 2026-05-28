class AgentState:
    def __init__(self, goal):
        self.goal = goal
        self.current_plan = []
        self.completed_steps = []
        self.failed_steps = []
        self.attempts = 0
        self.max_attempts = 5
        self.status = "running"  # running | completed | failed
