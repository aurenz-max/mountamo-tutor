"""
Tier 1: Structural Validator (Schema-Driven Architecture)

Validates that generated problems conform to the expected schema.
Loads validation rules dynamically from YAML schema files.

Architecture:
- Schema registry loads all problem type schemas from schemas/ directory
- Validation logic is data-driven, not hardcoded
- Adding new problem types requires only creating a new YAML file
"""

import logging
import yaml
from pathlib import Path
from typing import Dict, Any, List, Optional
from .rubrics import StructuralResult

logger = logging.getLogger(__name__)


class StructuralValidator:
    """Schema-driven structural validator for generated problems"""

    # Valid enum values (shared across all problem types)
    VALID_DIFFICULTIES = {"easy", "medium", "hard"}
    VALID_VISUAL_TYPES = {
        # Foundational visuals
        "object-collection", "comparison-panel",
        # Math visuals
        "bar-model", "number-line", "base-ten-blocks", "fraction-circles", "geometric-shape",
        # Science visuals
        "labeled-diagram", "cycle-diagram", "tree-diagram", "line-graph", "thermometer",
        # Language arts visuals
        "sentence-diagram", "story-sequence", "word-web", "character-web", "venn-diagram",
        # ABC/Literacy visuals
        "letter-tracing", "letter-picture", "alphabet-sequence", "rhyming-pairs",
        "sight-word-card", "sound-sort"
    }

    def __init__(self, schemas_dir: Optional[Path] = None):
        """
        Initialize validator and load schema registry

        Args:
            schemas_dir: Path to schemas directory (defaults to ../schemas relative to this file)
        """
        if schemas_dir is None:
            # Default to schemas directory at same level as evaluation directory
            schemas_dir = Path(__file__).parent.parent / "schemas"

        self.schemas_dir = Path(schemas_dir)
        self.schema_registry: Dict[str, Dict[str, Any]] = {}

        # Load all schemas
        self._load_schemas()

        logger.info(f"Loaded {len(self.schema_registry)} problem type schemas")

    def _load_schemas(self):
        """Load all YAML schema files from schemas directory"""
        if not self.schemas_dir.exists():
            logger.error(f"Schemas directory not found: {self.schemas_dir}")
            raise FileNotFoundError(f"Schemas directory not found: {self.schemas_dir}")

        yaml_files = list(self.schemas_dir.glob("*.yaml"))
        if not yaml_files:
            logger.warning(f"No schema files found in {self.schemas_dir}")
            return

        for yaml_file in yaml_files:
            try:
                with open(yaml_file, 'r', encoding='utf-8') as f:
                    schema = yaml.safe_load(f)

                if not schema or 'type_name' not in schema:
                    logger.warning(f"Invalid schema file {yaml_file.name}: missing type_name")
                    continue

                type_name = schema['type_name']
                self.schema_registry[type_name] = schema
                logger.debug(f"Loaded schema for '{type_name}' from {yaml_file.name}")

            except Exception as e:
                logger.error(f"Error loading schema {yaml_file.name}: {str(e)}")

    def validate(self, problem: Dict[str, Any]) -> StructuralResult:
        """
        Validate problem structure using schema registry

        Args:
            problem: Problem dict to validate

        Returns:
            StructuralResult with validation details
        """
        issues = []
        required_fields_present = True
        valid_enums = True
        valid_types = True
        visual_intent_valid = None

        # Detect problem type
        problem_type = self._detect_problem_type(problem)
        if not problem_type:
            issues.append("Could not detect problem type (missing 'problem_type' field or recognizable structure)")
            return StructuralResult(
                passed=False,
                issues=issues,
                required_fields_present=False,
                valid_enums=False,
                valid_types=False,
                visual_intent_valid=False
            )

        logger.info(f"Validating {problem_type} problem: {problem.get('id', 'unknown')}")
        logger.info(f"Problem has keys: {list(problem.keys())}")

        # Look up schema for this problem type
        schema = self.schema_registry.get(problem_type)
        if not schema:
            logger.warning(f"No schema found for problem type '{problem_type}' - skipping validation")
            issues.append(f"Unknown problem type '{problem_type}' (no schema file found)")
            return StructuralResult(
                passed=False,
                issues=issues,
                required_fields_present=False,
                valid_enums=False,
                valid_types=False,
                visual_intent_valid=None
            )

        logger.info(f"Using schema for {problem_type}")

        # Check required fields
        required_fields = schema.get('required_fields', [])
        logger.info(f"Required fields for {problem_type}: {required_fields}")

        missing_fields = [field for field in required_fields if field not in problem]
        if missing_fields:
            required_fields_present = False
            issues.append(f"Missing required fields: {', '.join(missing_fields)}")
            logger.warning(f"Missing fields: {missing_fields}")

        # Validate types
        type_issues = self._validate_types(problem, schema)
        if type_issues:
            valid_types = False
            issues.extend(type_issues)

        # Validate enum values
        enum_issues = self._validate_enums(problem, schema)
        if enum_issues:
            valid_enums = False
            issues.extend(enum_issues)

        # Validate visual fields (if present)
        visual_issues = self._validate_visual_fields(problem, schema)
        if visual_issues:
            # Check if visual is on roadmap (treat as optional/warning)
            visual_on_roadmap = schema.get('visual_on_roadmap', False)
            if visual_on_roadmap:
                logger.info(f"Visual validation issues (roadmap feature): {visual_issues}")
                visual_intent_valid = None  # Treat as optional
            else:
                visual_intent_valid = False
                issues.extend(visual_issues)
        else:
            # Visual validation passed or was skipped
            visual_intent_valid = None if not self._has_visual_fields(problem, schema) else True

        # Overall pass/fail
        passed = required_fields_present and valid_enums and valid_types and (
            visual_intent_valid is None or visual_intent_valid
        )

        logger.info(f"Validation result - Passed: {passed}, Issues: {len(issues)}")
        if issues:
            logger.warning(f"Validation issues: {issues}")

        return StructuralResult(
            passed=passed,
            issues=issues,
            required_fields_present=required_fields_present,
            valid_enums=valid_enums,
            valid_types=valid_types,
            visual_intent_valid=visual_intent_valid
        )

    def _detect_problem_type(self, problem: Dict[str, Any]) -> Optional[str]:
        """Detect problem type from explicit field or structure"""
        # First check if problem_type is explicitly set
        if "problem_type" in problem:
            return problem.get("problem_type")

        # Fall back to structural detection for backward compatibility
        # Check against known patterns
        if "question" in problem and "options" in problem:
            return "multiple_choice"
        elif "statement" in problem and "correct" in problem:
            return "true_false"
        elif "text_with_blanks" in problem and "blanks" in problem:
            return "fill_in_blanks"
        elif "left_items" in problem and "right_items" in problem:
            return "matching_activity"
        elif "instruction" in problem and "items" in problem and "categories" not in problem:
            return "sequencing_activity"
        elif "instruction" in problem and "categories" in problem and "categorization_items" in problem:
            return "categorization_activity"
        elif "scenario" in problem and "scenario_question" in problem:
            return "scenario_question"
        elif "question" in problem and "options" not in problem:
            # Could be short_answer or other question type
            return "short_answer"

        return None

    def _validate_types(self, problem: Dict[str, Any], schema: Dict[str, Any]) -> List[str]:
        """Validate field types based on schema"""
        issues = []
        field_types = schema.get('field_types', {})
        optional_fields = schema.get('optional_fields', [])
        nested_structures = schema.get('nested_structures', {})

        for field_name, type_spec in field_types.items():
            # Skip if field not present and is optional
            if field_name not in problem:
                if field_name in optional_fields:
                    continue
                # Required fields checked separately
                continue

            value = problem[field_name]

            # Handle null values for optional fields
            if value is None:
                if field_name in optional_fields:
                    logger.debug(f"Field '{field_name}' is null (allowed for optional field)")
                    continue
                else:
                    issues.append(f"{field_name} is null but is required")
                    continue

            # Validate based on type spec
            if type_spec == "string":
                if not isinstance(value, str):
                    issues.append(f"{field_name} must be a string")

            elif type_spec == "boolean":
                if not isinstance(value, bool):
                    issues.append(f"{field_name} must be a boolean")

            elif type_spec == "integer":
                if not isinstance(value, int):
                    issues.append(f"{field_name} must be an integer")

            elif type_spec == "list_of_string":
                if not isinstance(value, list):
                    issues.append(f"{field_name} must be a list")
                elif not all(isinstance(item, str) for item in value):
                    issues.append(f"{field_name} must be a list of strings")

            elif type_spec == "list_of_dict":
                if not isinstance(value, list):
                    issues.append(f"{field_name} must be a list")
                else:
                    # Check nested structure if defined
                    if field_name in nested_structures:
                        struct_def = nested_structures[field_name]
                        required_keys = struct_def.get('required_keys', [])
                        key_types = struct_def.get('key_types', {})

                        for i, item in enumerate(value):
                            if not isinstance(item, dict):
                                issues.append(f"{field_name}[{i}] must be a dict")
                                continue

                            # Check required keys
                            for req_key in required_keys:
                                if req_key not in item:
                                    issues.append(f"{field_name}[{i}] missing required key '{req_key}'")

                            # Check key types
                            for key, key_type in key_types.items():
                                if key not in item:
                                    continue

                                if key_type == "string" and not isinstance(item[key], str):
                                    issues.append(f"{field_name}[{i}].{key} must be a string")
                                elif key_type == "boolean" and not isinstance(item[key], bool):
                                    issues.append(f"{field_name}[{i}].{key} must be a boolean")
                                elif key_type == "list_of_string":
                                    if not isinstance(item[key], list):
                                        issues.append(f"{field_name}[{i}].{key} must be a list")
                                    elif not all(isinstance(s, str) for s in item[key]):
                                        issues.append(f"{field_name}[{i}].{key} must be a list of strings")

            elif type_spec == "dict" or type_spec == "dict_or_null":
                if not isinstance(value, dict):
                    issues.append(f"{field_name} must be a dict")

            elif type_spec == "enum":
                # Enum validation handled separately
                pass

        return issues

    def _validate_enums(self, problem: Dict[str, Any], schema: Dict[str, Any]) -> List[str]:
        """Validate enum field values based on schema"""
        issues = []
        enum_values = schema.get('enum_values', {})

        for field_name, valid_values in enum_values.items():
            if field_name not in problem:
                continue

            value = problem[field_name]
            if value not in valid_values:
                issues.append(
                    f"Invalid {field_name} '{value}'. "
                    f"Must be one of: {', '.join(valid_values)}"
                )

        return issues

    def _validate_visual_fields(self, problem: Dict[str, Any], schema: Dict[str, Any]) -> List[str]:
        """Validate visual intent/data fields if present"""
        issues = []

        visual_field = schema.get('visual_field')
        visual_field_alt = schema.get('visual_field_alt')

        if not visual_field:
            return issues  # No visual validation for this type

        # Check primary visual field
        if visual_field in problem:
            visual_value = problem[visual_field]

            # Allow null for optional visual fields
            if visual_value is None:
                logger.debug(f"Visual field '{visual_field}' is null (allowed)")
                return issues

            # Validate visual intent structure
            visual_issues = self._validate_visual_intent(visual_value)
            issues.extend(visual_issues)

        # Check alternative visual field (Step 2 output)
        elif visual_field_alt and visual_field_alt in problem:
            visual_value = problem[visual_field_alt]

            # Allow null for optional visual fields
            if visual_value is None:
                logger.debug(f"Visual field '{visual_field_alt}' is null (allowed)")
                return issues

            # Validate visual data structure
            visual_issues = self._validate_visual_data(visual_value)
            issues.extend(visual_issues)
            logger.info(f"Found {visual_field_alt} (Step 2 output)")

        return issues

    def _has_visual_fields(self, problem: Dict[str, Any], schema: Dict[str, Any]) -> bool:
        """Check if problem has any visual fields"""
        visual_field = schema.get('visual_field')
        visual_field_alt = schema.get('visual_field_alt')

        has_primary = visual_field and visual_field in problem and problem[visual_field] is not None
        has_alt = visual_field_alt and visual_field_alt in problem and problem[visual_field_alt] is not None

        return has_primary or has_alt

    def _validate_visual_intent(self, visual_intent: Any) -> List[str]:
        """Validate visual intent structure"""
        issues = []

        if not isinstance(visual_intent, dict):
            return ["visual_intent must be a dict"]

        # Check required fields
        if "needs_visual" not in visual_intent:
            issues.append("visual_intent missing 'needs_visual' field")
            return issues

        if not isinstance(visual_intent["needs_visual"], bool):
            issues.append("visual_intent.needs_visual must be a boolean")

        # If needs_visual is true, check additional fields
        if visual_intent.get("needs_visual"):
            if "visual_type" not in visual_intent:
                issues.append("visual_intent must have 'visual_type' when needs_visual=true")
            elif visual_intent["visual_type"] not in self.VALID_VISUAL_TYPES:
                issues.append(
                    f"Invalid visual_type '{visual_intent['visual_type']}'. "
                    f"Must be one of: {', '.join(sorted(self.VALID_VISUAL_TYPES))}"
                )

            if "visual_id" not in visual_intent:
                issues.append("visual_intent must have 'visual_id' when needs_visual=true")

            if "visual_purpose" not in visual_intent:
                issues.append("visual_intent must have 'visual_purpose' when needs_visual=true")

        return issues

    def _validate_visual_data(self, visual_data: Any) -> List[str]:
        """Validate visual data structure (Step 2 output from backend)"""
        issues = []

        if not isinstance(visual_data, dict):
            return ["visual_data must be a dict"]

        # Check for required fields in visual data
        if "type" not in visual_data:
            issues.append("visual_data missing 'type' field")
        elif visual_data["type"] not in self.VALID_VISUAL_TYPES:
            issues.append(
                f"Invalid visual type '{visual_data['type']}'. "
                f"Must be one of: {', '.join(sorted(self.VALID_VISUAL_TYPES))}"
            )

        if "data" not in visual_data:
            issues.append("visual_data missing 'data' field")
        elif not isinstance(visual_data["data"], dict):
            issues.append("visual_data.data must be a dict")

        return issues


# Convenience function
def validate_problem(problem: Dict[str, Any]) -> StructuralResult:
    """
    Validate a single problem's structure

    Args:
        problem: Problem dict to validate

    Returns:
        StructuralResult
    """
    validator = StructuralValidator()
    return validator.validate(problem)
