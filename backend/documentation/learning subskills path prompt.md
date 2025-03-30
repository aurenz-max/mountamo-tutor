Please analyze the provided syllabus data to generate a JSON object representing a linear, difficulty-ordered learning path.

Input Data:

The input data is a syllabus, structured similarly to a CSV, containing information about subjects, units, skills, and subskills. Key columns used for this analysis are:

      
SkillID: Identifies the parent skill.

SubskillID: The unique identifier for the specific subskill.

DifficultyStart: A numeric value indicating the starting difficulty level of the subskill.

DifficultyEnd: A numeric value indicating the ending difficulty level of the subskill.

(Optional but helpful for tie-breaking: SubskillDescription)

    

IGNORE_WHEN_COPYING_START
Use code with caution.
IGNORE_WHEN_COPYING_END

Core Logic/Strategy:

      
Global Ordering: Create a single, ordered list of all unique SubskillIDs present in the entire dataset.

Sorting: Sort this list based on the following criteria, in order of priority:

    Primary Sort: DifficultyStart (ascending - lower values first).

    Secondary Sort: DifficultyEnd (ascending - lower values first).

    Tertiary Sort (Tiebreaker): If DifficultyStart and DifficultyEnd are identical, use the natural alphabetical/numerical order of the SubskillID itself, or potentially the order they appear in the original data if that implies a sequence.

JSON Structure: Create a JSON object where the top-level key is "subskill_learning_path". The value of this key should be another object where:

    Each key is a SubskillID from the sorted list.

    The value for each SubskillID key is an object containing a single key: "next_subskill".

    The value of "next_subskill" is the SubskillID that comes immediately after the current one in the globally sorted list.

    For the very last SubskillID in the sorted list, the value of "next_subskill" should be null.

    

IGNORE_WHEN_COPYING_START
Use code with caution.
IGNORE_WHEN_COPYING_END

Desired Output Format Example:

{
"subskill_learning_path": {
"SUBSKILL_ID_1_easiest": { "next_subskill": "SUBSKILL_ID_2" },
"SUBSKILL_ID_2": { "next_subskill": "SUBSKILL_ID_3" },
// ... entries for all subskills ...
"SUBSKILL_ID_N_second_hardest": { "next_subskill": "SUBSKILL_ID_N+1_hardest" },
"SUBSKILL_ID_N+1_hardest": { "next_subskill": null }
}
}

IGNORE_WHEN_COPYING_START
Use code with caution.Json
IGNORE_WHEN_COPYING_END

Context:

This JSON represents a recommended learning path where students progress through subskills based primarily on increasing difficulty, allowing for movement between different parent SkillIDs as dictated by the difficulty levels.

Action:

Please perform this analysis on the following syllabus data and generate the complete JSON output:

--- START OF SYLLABUS DATA ---

[ <<< PASTE YOUR NEW SYLLABUS DATA HERE >>>
(Ensure it includes at least the SubskillID, DifficultyStart, and DifficultyEnd columns, preferably in a structured format like CSV or similar table representation) ]

--- END OF SYLLABUS DATA ---

Generate the complete JSON output based on this data and the specified logic.