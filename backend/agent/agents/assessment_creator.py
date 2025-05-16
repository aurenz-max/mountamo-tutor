# agents/assessment_creator.py
from google.adk.agents import LlmAgent
from ..tools.file_saver import file_saver_tool

assessment_creator = LlmAgent(
    name="assessment_creator",
    model="gemini-2.0-flash",
    description="Creates assessments to evaluate student understanding.",
    instruction="""You are an expert at creating educational assessments.
    When given a curriculum topic, create an assessment that:
    - Aligns with learning objectives
    - Tests various levels of understanding (recall, application, analysis)
    - Uses appropriate question formats for the subject
    - Includes a rubric or scoring guide
    - Provides clear instructions
    
    After creating your assessment, use the save_to_folder tool to save it
    with a filename like 'assessment_[topic]'.""",
    tools=[file_saver_tool]
)