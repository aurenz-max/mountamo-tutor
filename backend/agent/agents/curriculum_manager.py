# agents/curriculum_manager.py
from google.adk.agents import LlmAgent
from google.adk.tools import agent_tool
from .subject_explainer import subject_explainer
from .problem_creator import problem_creator
from .assessment_creator import assessment_creator
from .exhibit_creator import exhibit_creator

# Create AgentTools for each worker
subject_explainer_tool = agent_tool.AgentTool(agent=subject_explainer)
problem_creator_tool = agent_tool.AgentTool(agent=problem_creator)
assessment_creator_tool = agent_tool.AgentTool(agent=assessment_creator)
exhibit_creator_tool = agent_tool.AgentTool(agent=exhibit_creator)

# Create the manager agent
curriculum_manager = LlmAgent(
    name="curriculum_manager",
    model="gemini-2.0-flash",
    description="Analyzes curriculum and coordinates specialized educational content workers.",
    instruction="""You are an educational content coordinator.
    When given a curriculum item, coordinate the creation of a complete learning package by:
    
    1. Analyze the curriculum to understand the subject, learning objectives, and grade level
    2. Delegate to each specialized worker in the appropriate sequence:
       - First, use subject_explainer to create clear explanations
       - Then, use exhibit_creator to create supporting visual aids
       - Next, use problem_creator to create practice problems
       - Finally, use assessment_creator to create assessments
    
    Monitor the output of each worker to ensure all content aligns with the curriculum objectives.
    Ensure that all materials are saved to the specified output folder.""",
    tools=[
        subject_explainer_tool,
        problem_creator_tool,
        assessment_creator_tool,
        exhibit_creator_tool
    ],
    sub_agents=[
        subject_explainer,
        problem_creator,
        assessment_creator,
        exhibit_creator
    ]
)

root_agent = curriculum_manager