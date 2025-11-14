"""
Comprehensive LLM interaction logger for curriculum authoring.

Logs all LLM interactions with full context for debugging and analysis.
Each generation run is stored in a timestamped directory with structured JSON files.
"""

import json
import logging
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, Optional
from functools import wraps
import time

logger = logging.getLogger(__name__)


class LLMLogger:
    """
    Centralized logger for all LLM interactions in the curriculum authoring pipeline.

    Directory structure:
        logs/generation_runs/{timestamp}_{subskill_id}/
            tier1_teaching_plan.json
            tier2_section_1.json
            tier2_section_2.json
            ...
            tier3_integration.json
            summary.json
    """

    def __init__(self, base_log_dir: str = "logs/generation_runs"):
        self.base_log_dir = Path(base_log_dir)
        self.base_log_dir.mkdir(parents=True, exist_ok=True)
        self.current_run_dir: Optional[Path] = None
        self.run_metadata: Dict[str, Any] = {}

    def start_generation_run(self, subskill_id: str, grade_level: str, subject: str = None,
                            unit: str = None, skill: str = None) -> str:
        """
        Start a new generation run and create directory for logs.

        Args:
            subskill_id: ID of the subskill being generated
            grade_level: Target grade level
            subject: Subject area (optional)
            unit: Unit within subject (optional)
            skill: Skill within unit (optional)

        Returns:
            Path to the run directory
        """
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        run_name = f"{timestamp}_{subskill_id}"
        self.current_run_dir = self.base_log_dir / run_name
        self.current_run_dir.mkdir(parents=True, exist_ok=True)

        self.run_metadata = {
            "run_id": run_name,
            "subskill_id": subskill_id,
            "grade_level": grade_level,
            "subject": subject,
            "unit": unit,
            "skill": skill,
            "start_time": datetime.now().isoformat(),
            "tier_logs": []
        }

        logger.info(f"📝 Started generation run: {run_name}")
        return str(self.current_run_dir)

    def log_llm_interaction(
        self,
        tier: str,
        stage_name: str,
        prompt: str,
        response: Any,
        model_name: str,
        temperature: float,
        config: Dict[str, Any] = None,
        section_type: str = None,
        section_number: int = None,
        selected_primitives: list = None,
        duration_seconds: float = None,
        metadata: Dict[str, Any] = None
    ) -> None:
        """
        Log a single LLM interaction with full context.

        Args:
            tier: Which tier (tier1, tier2, tier3)
            stage_name: Descriptive name of this stage
            prompt: Full prompt sent to LLM
            response: Full response from LLM (will be serialized)
            model_name: Name of the model used
            temperature: Temperature setting
            config: Additional model configuration
            section_type: Type of section being generated (if applicable)
            section_number: Section number (if applicable)
            selected_primitives: List of selected primitive types (if applicable)
            duration_seconds: Time taken for this call
            metadata: Additional metadata to store
        """
        if not self.current_run_dir:
            logger.warning("No active run. Call start_generation_run() first.")
            return

        timestamp = datetime.now().isoformat()

        # Create log entry
        log_entry = {
            "timestamp": timestamp,
            "tier": tier,
            "stage_name": stage_name,
            "model_config": {
                "model_name": model_name,
                "temperature": temperature,
                "additional_config": config or {}
            },
            "prompt": prompt,
            "response": self._serialize_response(response),
            "duration_seconds": duration_seconds,
            "section_metadata": {
                "section_type": section_type,
                "section_number": section_number,
                "selected_primitives": selected_primitives
            } if section_type or section_number else None,
            "metadata": metadata or {}
        }

        # Determine filename
        if tier == "tier2" and section_number is not None:
            filename = f"tier2_section_{section_number}.json"
        else:
            filename = f"{tier}_{stage_name.replace(' ', '_').lower()}.json"

        # Write log file
        log_file = self.current_run_dir / filename
        with open(log_file, 'w', encoding='utf-8') as f:
            json.dump(log_entry, f, indent=2, ensure_ascii=False)

        # Track in run metadata
        self.run_metadata["tier_logs"].append({
            "tier": tier,
            "stage_name": stage_name,
            "filename": filename,
            "timestamp": timestamp,
            "section_type": section_type,
            "section_number": section_number
        })

        logger.info(f"📋 Logged {tier} - {stage_name} to {filename}")

    def end_generation_run(self, success: bool = True, error_message: str = None) -> None:
        """
        Finalize the generation run and write summary.

        Args:
            success: Whether the run completed successfully
            error_message: Error message if run failed
        """
        if not self.current_run_dir:
            logger.warning("No active run to end.")
            return

        self.run_metadata["end_time"] = datetime.now().isoformat()
        self.run_metadata["success"] = success
        self.run_metadata["error_message"] = error_message

        # Calculate total duration
        start = datetime.fromisoformat(self.run_metadata["start_time"])
        end = datetime.fromisoformat(self.run_metadata["end_time"])
        self.run_metadata["total_duration_seconds"] = (end - start).total_seconds()

        # Write summary
        summary_file = self.current_run_dir / "summary.json"
        with open(summary_file, 'w', encoding='utf-8') as f:
            json.dump(self.run_metadata, f, indent=2, ensure_ascii=False)

        status = "✅ SUCCESS" if success else "❌ FAILED"
        logger.info(f"{status} Generation run completed: {self.run_metadata['run_id']}")
        logger.info(f"📊 Total duration: {self.run_metadata['total_duration_seconds']:.2f}s")
        logger.info(f"📁 Logs saved to: {self.current_run_dir}")

        # Reset current run
        self.current_run_dir = None
        self.run_metadata = {}

    def _serialize_response(self, response: Any) -> Any:
        """
        Serialize response to JSON-compatible format.

        Handles Pydantic models, dicts, and other common types.
        """
        if response is None:
            return None

        # If it's a Pydantic model
        if hasattr(response, 'model_dump'):
            return response.model_dump()

        # If it's a dict
        if isinstance(response, dict):
            return response

        # If it's a list
        if isinstance(response, list):
            return [self._serialize_response(item) for item in response]

        # Try to convert to dict
        try:
            return dict(response)
        except (TypeError, ValueError):
            pass

        # Fall back to string representation
        return str(response)


# Global logger instance
_global_llm_logger: Optional[LLMLogger] = None


def get_llm_logger() -> LLMLogger:
    """Get or create the global LLM logger instance."""
    global _global_llm_logger
    if _global_llm_logger is None:
        _global_llm_logger = LLMLogger()
    return _global_llm_logger


def log_llm_call(tier: str, stage_name: str, section_type: str = None, section_number: int = None):
    """
    Decorator to automatically log LLM calls.

    Usage:
        @log_llm_call(tier="tier1", stage_name="teaching_plan")
        async def generate_teaching_plan(self, ...):
            # Make LLM call
            response = await model.generate_content_async(...)
            return response

    The decorator will:
    - Log the prompt and response automatically
    - Track duration
    - Extract model config
    """
    def decorator(func):
        @wraps(func)
        async def async_wrapper(*args, **kwargs):
            start_time = time.time()

            try:
                result = await func(*args, **kwargs)
                duration = time.time() - start_time

                # Try to extract prompt and config from function context
                # This is a placeholder - actual implementation may need adjustment
                # based on specific function signatures

                return result
            except Exception as e:
                duration = time.time() - start_time
                logger.error(f"Error in {func.__name__}: {e}")
                raise

        @wraps(func)
        def sync_wrapper(*args, **kwargs):
            start_time = time.time()

            try:
                result = func(*args, **kwargs)
                duration = time.time() - start_time
                return result
            except Exception as e:
                duration = time.time() - start_time
                logger.error(f"Error in {func.__name__}: {e}")
                raise

        # Return appropriate wrapper based on whether function is async
        import asyncio
        if asyncio.iscoroutinefunction(func):
            return async_wrapper
        else:
            return sync_wrapper

    return decorator


def format_log_summary(run_dir: Path) -> str:
    """
    Format a human-readable summary of a generation run.

    Args:
        run_dir: Path to the generation run directory

    Returns:
        Formatted summary string
    """
    summary_file = run_dir / "summary.json"
    if not summary_file.exists():
        return f"No summary found for {run_dir}"

    with open(summary_file, 'r', encoding='utf-8') as f:
        summary = json.load(f)

    lines = [
        f"Generation Run: {summary['run_id']}",
        f"Subskill: {summary['subskill_id']}",
        f"Grade Level: {summary['grade_level']}",
        f"Status: {'✅ SUCCESS' if summary['success'] else '❌ FAILED'}",
        f"Duration: {summary.get('total_duration_seconds', 0):.2f}s",
        f"\nTier Logs ({len(summary['tier_logs'])}):"
    ]

    for log in summary['tier_logs']:
        section_info = f" (Section {log['section_number']}: {log['section_type']})" if log.get('section_number') else ""
        lines.append(f"  - {log['tier']}: {log['stage_name']}{section_info}")

    return "\n".join(lines)
