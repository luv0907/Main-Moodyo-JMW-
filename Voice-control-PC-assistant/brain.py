def goal_think(self, agent_state, screen_context=None):
    prompt = f"""
ROLE: You are JARVIS, an autonomous goal-driven AI agent.

GOAL:
{agent_state.goal}

CURRENT STATE:
- Completed steps: {agent_state.completed_steps}
- Failed steps: {agent_state.failed_steps}
- Attempts: {agent_state.attempts}

SCREEN CONTEXT:
{screen_context}

RULES:
- If the goal is complete, return action: "goal_complete"
- Otherwise, return the NEXT best action plan
- Output ONLY JSON array
"""

    response = requests.post(self.url, json={
        "model": self.model,
        "prompt": prompt,
        "stream": False
    }, timeout=120)

    return self.process_response(response.json())
