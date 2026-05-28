from memory import JarvisMemory
import time

def test_memory():
    memory = JarvisMemory()
    
    # Test 1: Store an event
    test_event = "User is working on a Python project called JARVIS."
    print(f"Storing: {test_event}")
    memory.store_event(test_event, category="test")
    
    # Test 2: Store another event with 'it' context
    test_event_2 = "The project uses ChromaDB for memory. It is very useful."
    print(f"Storing: {test_event_2}")
    memory.store_event(test_event_2, category="test")
    
    # Wait a bit for persistence
    time.sleep(1)
    
    # Test 3: Recall
    query = "What is the user working on?"
    print(f"Querying: {query}")
    results = memory.recall(query)
    print("Results:", results)
    
    query_2 = "What does the project use for memory?"
    print(f"Querying: {query_2}")
    results_2 = memory.recall(query_2)
    print("Results 2:", results_2)

if __name__ == "__main__":
    try:
        test_memory()
        print("\nMemory test successful!")
    except Exception as e:
        print(f"\nMemory test failed: {e}")
