import logging
import asyncio
from datetime import datetime
from typing import Dict, List, Any, Optional

logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)

class TranscriptService:
    """
    A service that accumulates final transcripts from any STT provider
    (like AzureSpeechService) and stores them in memory until the session ends.
    At session end, it generates an LLM summary and saves only the summary
    (and optionally the full transcript) to Cosmos DB.
    """
    def __init__(
        self,
        cosmos_service,
        anthropic_service
    ):
        self.cosmos_db = cosmos_service
        self.anthropic = anthropic_service

        # We'll store transcripts keyed by session_id
        self._session_transcripts: Dict[str, List[Dict[str, Any]]] = {}

        logger.info("TranscriptService initialized (optimized for minimal DB writes)")

    def handle_final_transcript(
        self,
        session_id: str,
        student_id: int,
        speaker: str,
        text: str
    ):
        """
        Called by AzureSpeechService whenever a final recognized utterance arrives.
        We ONLY accumulate in memory - no DB writes until session end.
        """
        if session_id not in self._session_transcripts:
            self._session_transcripts[session_id] = []

        timestamp = datetime.utcnow().isoformat()
        record = {
            "session_id": session_id,
            "student_id": student_id,
            "speaker": speaker,
            "message": text,
            "timestamp": timestamp
        }

        # Accumulate in memory only
        self._session_transcripts[session_id].append(record)
        logger.debug(f"Accumulated transcript in memory for session {session_id}: {speaker}: {text[:50]}...")

    async def finalize_session(
        self, 
        session_id: str, 
        do_summary: bool = True,
        save_full_transcript: bool = True
    ) -> Optional[str]:
        """
        Called at session end to:
        1. Generate a summary of the session using the LLM
        2. Save the summary to Cosmos DB
        3. Optionally save the full transcript as a single document to Cosmos DB
        4. Clean up memory
        
        Args:
            session_id: The ID of the session to finalize
            do_summary: Whether to generate and save a summary
            save_full_transcript: Whether to also save the full transcript as a single entry
            
        Returns:
            The summary text if generated, otherwise None
        """
        transcripts = self._session_transcripts.get(session_id, [])
        if not transcripts:
            logger.info(f"No transcripts found for session {session_id}. Nothing to finalize.")
            return None
            
        # Extract student_id from the first transcript (they should all be the same)
        student_id = transcripts[0]['student_id']
        
        # Format the full transcript as a single string
        full_transcript = self._format_full_transcript(transcripts)
        
        # 1. Generate summary if requested
        summary_text = None
        if do_summary and self.anthropic:
            logger.info(f"Generating summary for session {session_id} with {len(transcripts)} transcripts.")
            summary_text = await self._generate_summary(session_id, full_transcript)
            
            # 2. Save the summary to Cosmos DB
            if summary_text and self.cosmos_db:
                try:
                    await self.cosmos_db.save_conversation_message(
                        session_id=session_id,
                        student_id=student_id,
                        speaker="system",
                        message=f"SESSION_SUMMARY: {summary_text}",
                        timestamp=datetime.utcnow().isoformat()
                    )
                    logger.info(f"Saved summary to Cosmos DB for session {session_id}")
                except Exception as e:
                    logger.error(f"Error saving summary to Cosmos DB: {e}", exc_info=True)
        
        # 3. Optionally save the full transcript as a single entry
        if save_full_transcript and self.cosmos_db:
            try:
                await self.cosmos_db.save_conversation_message(
                    session_id=session_id,
                    student_id=student_id,
                    speaker="system",
                    message=f"FULL_TRANSCRIPT: {full_transcript}",
                    timestamp=datetime.utcnow().isoformat()
                )
                logger.info(f"Saved full transcript to Cosmos DB for session {session_id}")
            except Exception as e:
                logger.error(f"Error saving full transcript to Cosmos DB: {e}", exc_info=True)
                
        # 4. Clean up memory
        self._session_transcripts.pop(session_id, None)
        return summary_text
    
    def _format_full_transcript(self, transcripts: List[Dict[str, Any]]) -> str:
        """Format the full transcript as a single string."""
        lines = []
        transcripts_sorted = sorted(transcripts, key=lambda x: x['timestamp'])
        for t in transcripts_sorted:
            speaker = t['speaker']
            msg = t['message']
            timestamp = t['timestamp']
            # Format: [2023-04-15T14:30:45.123Z] Speaker: Message
            lines.append(f"[{timestamp}] {speaker}: {msg}")
        return "\n".join(lines)

    async def _generate_summary(self, session_id: str, conversation_text: str) -> str:
        """
        Use AnthropicService's dedicated summarize_session method to generate a summary.
        """
        try:
            # Use the dedicated summarize_session method
            summary_str = await self.anthropic.summarize_session(conversation_text)
            logger.info(f"Summary generation succeeded for session {session_id}")
            return summary_str
        except Exception as e:
            logger.error(f"Error generating summary: {e}", exc_info=True)
            return f"[Summary generation failed: {str(e)}]"