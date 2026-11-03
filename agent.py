# Chain of thought prompting

import os
from pathlib import Path
import requests

from dotenv import load_dotenv
from openai import OpenAI
from pydantic import BaseModel, Field
from typing import Optional

import json


env_file = Path(__file__).resolve().parent / ".env"
load_dotenv(env_file)

api_key = (
    os.getenv("GEMMA_API_KEY")
    or os.getenv("OPEN_ROUTER")
    or os.getenv("OPENROUTER_API_KEY")
)
if not api_key:
    raise RuntimeError("Set OPEN_ROUTER (or GEMMA_API_KEY) in the project .env file.")

client = OpenAI(
    api_key=api_key,
    base_url="https://openrouter.ai/api/v1",
    timeout=150.0,
    max_retries=3,
)

def run_command(cmd:str):
    result = os.system(cmd)
    return result


def get_weather(city):
    url = f"https://wttr.in/{city}?format=%C+%t+%w"
    # Note: This is a simplified example. In a real application, you would need to handle the HTTP request and response properly.
    response = requests.get(url)
    if response.status_code == 200:
        return f"The weather in {city} is: {response.text}"
    else:
        return "Could not retrieve weather information."

available_tools = {
    "get_weather": get_weather,
    "run_command": run_command
}


SYSTEM_PROMPT = """
       
       You are an expert AI assistant in resolvung user queries using chain of thought 
       You work on START , PLAN and OUTPUT steps.
       You need to first PLAN what needs to be done. The PLAN can be multiple steps.
       Once you think eneough PLAN has been done , finally you can give an OUTPUT.
       You can also call a TOOL if required from the list of available tools.
       for every tool call wait for the observe step which is the output from the called tool.



       Rules:
       - Strictly follow the given json output format 
       - Only run one step at a time.
       - The sequence of steps is START (where user gives and input), PLAN (That can be multiple times)
         and finally OUTPUT ( which is going to be displayed to the user).

        OUTPUT JSON FORM:
        {"step": "START|PLAN|TOOL|OBSERVE|OUTPUT", "content": "Your content here", "tool": "tool name", "input": "tool input"}

        Available TOOLS:
        - get_weather(city:str): This tool retrieves the current weather information for a specified city. It returns a string describing the weather conditions, temperature, and wind speed.
        - run_command(cmd: str): Takes a system linux command as a string and execute the command on user's system and return the ouput from that command
        Example:
        START: What is the weather in Noida ?
        PLAN: {"step": "PLAN", "content": "Seems like user is interested in getting the weather information for Noida in India."}
        PLAN: {"step": "PLAN", "content": "Let's see if we have any available tool from the list of available tools"}
        PLAN : {"step": "PLAN", "content": "Great we have get_weather tool available for this query."}
        PLAN: {"step": "PLAN", "content": "I need to call the get_weather tool with the city parameter set to 'Noida'."}
        PLAN : {"step": "TOOL", "tool": "get_weather", "input":"Noida", "content": "Calling the get_weather tool with the city parameter set to 'Noida'."}
        PLAN: {"step": "OBSERVE","tool": "get_weather", "output":"The Temp of Noida is 30°C, with clear skies and a gentle breeze from the northwest at 10 km/h."}
        PLAN: {"step": "PLAN", "content": "Now that we have the weather information, we can provide the final output to the user."}
        OUTPUT: {"step": "OUTPUT", "content": "The current weather in Noida is 30°C with clear skies and a gentle breeze from the northwest at 10 km/h."

"""


# This creates the message list sent to the model. The system message contains the instructions above. 
# The list will also hold the user’s question and the model’s replies. basically this will contain the entire history 
# of all queries and responses in the current session. This is important for maintaining context in a conversation with the model.


class MyoutputFormat(BaseModel):
    step : str = Field(..., description="The step of the process: START, PLAN, TOOL, OBSERVE, OUTPUT")
    content : Optional[str] = Field(None, description="The content of the message")
    tool : Optional[str] = Field(None, description="The tool used")
    input : Optional[str] = Field(None, description="The input to the tool")
    output : Optional[str] = Field(None, description="The output from the tool")

message_history = [
    {"role":"system", "content": SYSTEM_PROMPT}
]

while True:
    user_query = input("Enter your query (or 'exit' to quit): ").strip()
    if user_query.lower() in {"exit", "quit"}:
        print("Goodbye!")
        break
    if not user_query:
        continue

    message_history.append({"role": "user", "content": user_query})

    while True:
        response = client.chat.completions.parse(
            model="recursive/flint-v1.0:free",
            max_tokens=2048,
            response_format=MyoutputFormat,
            messages=message_history,
            extra_body={"reasoning": {"enabled": True}},
        )

        raw_result = response.choices[0].message.content
        message_history.append({"role": "assistant", "content": raw_result})

        parsed_result = response.choices[0].message.parsed

        if parsed_result.step == "START":
            print("Starting the process...", parsed_result.content)
            continue

        if parsed_result.step == "TOOL":
            tool_to_call = parsed_result.tool
            tool_input = parsed_result.input
            print(f"Calling tool: {tool_to_call} with input: {tool_input}")
            tool_function = available_tools.get(tool_to_call)
            if tool_function is None:
                raise ValueError(f"Unknown tool requested by model: {tool_to_call}")
            tool_response = tool_function(tool_input)
            message_history.append({"role": "assistant", "content": json.dumps(
                {"step": "OBSERVE", "tool": tool_to_call, "input": tool_input, "output": tool_response}
            )})
            continue

        if parsed_result.step == "PLAN":
            print("Planning step:", parsed_result.content)
            continue

        if parsed_result.step == "OUTPUT":
            print("Final output:", parsed_result.content)
            break