from voice import listen

while True:
    text = listen()
    if text:
        print("HEARD:", text)
