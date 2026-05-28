import streamlit as st
import json

st.set_page_config(layout="wide")

st.title("🧠 JARVIS Agent Dashboard")

st.sidebar.header("Agent Control")

mode = st.sidebar.radio("Mode", ["SAFE", "GOD"])
goal = st.sidebar.text_input("Goal")

if st.sidebar.button("Start Agent"):
    st.session_state["goal"] = goal
    st.session_state["mode"] = mode

st.subheader("Current Goal")
st.write(st.session_state.get("goal", "None"))

st.subheader("Agent Log")
st.json(st.session_state.get("log", []))
