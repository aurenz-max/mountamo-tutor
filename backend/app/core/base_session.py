# backend/app/core/base_session.py

import abc
import asyncio
import logging
import uuid
from typing import AsyncGenerator, Dict, Optional, Any
from datetime import datetime

from ..db.cosmos_db import CosmosDBService

logger = logging.getLogger(__name__)
logger.setLevel(logging.DEBUG)

class BaseSession(abc.ABC):
    """Abstract base class for all session types."""

    def __init__(
        self,
        cosmos_db: CosmosDBService,
        student_id: int,
    ):
        self.id = str(uuid.uuid4())
        self.cosmos_db = cosmos_db
        self.student_id = student_id
        
        # Common queues for all session types
        self.text_queue = asyncio.Queue()
        self.transcript_queue = asyncio.Queue()
        
        # State management
        self._active = False
        self.quit_event = asyncio.Event()
        self._initialization_event = asyncio.Event()
        self._event_loop = asyncio.get_event_loop()
        
        logger.debug(f"{self.__class__.__name__} {self.id} created")
    
    async def handle_text(self, text: str) -> None:
        """Handle text response from AI service"""
        try:
            if not self._active:
                return
            await self.text_queue.put(text)
        except Exception as e:
            logger.error(f"Error handling text in session {self.id}: {e}")
            raise
    
    @abc.abstractmethod
    async def initialize(self, **kwargs) -> None:
        """Initialize the session - to be implemented by subclasses"""
        pass
    
    @abc.abstractmethod
    async def process_message(self, message: Dict) -> None:
        """Process incoming messages from client"""
        pass
    
    async def get_responses(self) -> AsyncGenerator[str, None]:
        """Get text responses from the session"""
        if not self._active:
            raise ValueError("Session is not active")

        try:
            while not self.quit_event.is_set():
                try:
                    text = await self.text_queue.get()
                    yield text
                except asyncio.CancelledError:
                    break
                except Exception as e:
                    logger.error(f"Error getting text response: {e}")
                    continue

        except asyncio.CancelledError:
            logger.info(f"Response generator cancelled for session {self.id}")
        except Exception as e:
            logger.error(f"Error getting responses for session {self.id}: {e}")
            raise
    
    
    async def get_transcripts(self) -> AsyncGenerator[Dict[str, Any], None]:
        """Get speech transcripts from the session"""
        if not self._active:
            raise ValueError("Session is not active")

        try:
            logger.debug(f"[Session {self.id}] Starting transcript generator, queue size: {self.transcript_queue.qsize()}")
            transcript_count = 0
            
            while not self.quit_event.is_set():
                try:
                    # Add a timeout to periodically check the quit event
                    transcript = await asyncio.wait_for(self.transcript_queue.get(), timeout=1.0)
                    transcript_count += 1
                    
                    # Log transcript reception for debugging
                    text_preview = transcript.get('data', {}).get('text', '')[:50]
                    speaker = transcript.get('speaker', 'unknown')
                    is_partial = transcript.get('data', {}).get('is_partial', False)
                    
                    logger.info(f"[Session {self.id}] Yielding transcript #{transcript_count}: speaker={speaker}, is_partial={is_partial}, text={text_preview}...")
                    
                    # Mark the task as done before yielding
                    self.transcript_queue.task_done()
                    
                    yield transcript
                except asyncio.TimeoutError:
                    # Just a timeout for checking quit condition periodically
                    continue
                except asyncio.CancelledError:
                    logger.info(f"[Session {self.id}] Transcript generator cancelled after sending {transcript_count} transcripts")
                    break
                except Exception as e:
                    logger.error(f"[Session {self.id}] Error getting transcript: {e}", exc_info=True)
                    continue
        except asyncio.CancelledError:
            logger.info(f"[Session {self.id}] Transcript generator cancelled after sending {transcript_count} transcripts")
        except Exception as e:
            logger.error(f"[Session {self.id}] Error in transcript generator: {e}", exc_info=True)
            raise
    
    async def cleanup(self) -> None:
        """
        Basic cleanup common to all session types.
        Subclasses should call super().cleanup() first, then do their specific cleanup.
        """
        # Common cleanup
        self._active = False
        self.quit_event.set()
        self._initialization_event.clear()

        logger.info(f"Basic cleanup done for session {self.id}")