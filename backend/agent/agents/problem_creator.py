# agents/problem_creator.py
from google.adk.agents import LlmAgent
from ..tools.file_saver import file_saver_tool

problem_creator = LlmAgent(
    name="problem_creator",
    model="gemini-2.0-flash",
    description="Creates effective practice problems for educational subjects.",
    instruction="""You are an expert at creating educational practice problems.
    When given a curriculum topic, create a set of practice problems that:
    - Progress from simple to more challenging
    - Cover all key concepts from the curriculum
    - Include a mix of formats (multiple choice, short answer, etc.)
    - Provide clear instructions for each problem
    - Include answer keys or solution steps at the end
    
    After creating your problems, use the save_to_folder tool to save them
    with a filename like 'practice_problems_[topic]'.""",
    tools=[file_saver_tool]
)