from brain import JarvisBrain
import json

def test_protocols():
    brain = JarvisBrain()
    
    # Test 1: Exact protocol match
    print("Testing protocol: 'coding mode'")
    result = brain.think("coding mode")
    print("Result:", json.dumps(result, indent=2))
    
    # Test 2: Another protocol
    print("\nTesting protocol: 'goodbye'")
    result = brain.think("goodbye")
    print("Result:", json.dumps(result, indent=2))

def test_context_reasoning():
    brain = JarvisBrain()
    
    # Simulate first interaction (storing something in memory)
    print("\nStoring context: 'The user is reading about Quantum Physics.'")
    brain.memory.store_event("User is reading about Quantum Physics.", category="history")
    
    # Test reasoning with "it"
    print("\nTesting reasoning with 'it': 'Tell me more about it.'")
    # Note: This will call Ollama if it's running. 
    # If Ollama is not running, it will return the error message from brain.py.
    result = brain.think("Tell me more about it.")
    print("Result:", json.dumps(result, indent=2))

if __name__ == "__main__":
    test_protocols()
    test_context_reasoning() # Unleash this if Ollama is ready
