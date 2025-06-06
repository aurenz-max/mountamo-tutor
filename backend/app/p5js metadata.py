#!/usr/bin/env python3
"""
Script to analyze p5.js code snippets in Cosmos DB and generate educational metadata using Gemini.
This script reads existing p5.js code records, analyzes them for educational content,
and updates them with Subject, Skill, Subskill, Key Concepts, and tags.
"""

import asyncio
import json
import logging
import os
import re
import time
from typing import Dict, List, Optional, Any
from datetime import datetime

from google import genai
from google.genai import types
import hashlib
from azure.cosmos import CosmosClient, PartitionKey
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(name)s - %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
logger = logging.getLogger(__name__)

class P5jsCodeAnalyzer:
    def __init__(self):
        # Get configuration from environment variables
        self.gemini_api_key = os.getenv("GEMINI_GENERATE_KEY")
        self.cosmos_endpoint = os.getenv("COSMOS_ENDPOINT")
        self.cosmos_key = os.getenv("COSMOS_KEY")
        self.cosmos_database = os.getenv("COSMOS_DATABASE")
        
        # Validate required environment variables
        if not self.gemini_api_key:
            raise ValueError("GEMINI_GENERATE_KEY environment variable is required")
        if not self.cosmos_endpoint or not self.cosmos_key or not self.cosmos_database:
            raise ValueError("Cosmos DB environment variables (COSMOS_ENDPOINT, COSMOS_KEY, COSMOS_DATABASE) are required")
        
        # Initialize Gemini client
        self.client = genai.Client(api_key=self.gemini_api_key)
        
        # Initialize Cosmos DB client
        self.cosmos_client = CosmosClient(self.cosmos_endpoint, self.cosmos_key)
        self.database = self.cosmos_client.create_database_if_not_exists(id=self.cosmos_database)
        
        # Get the p5js_code_snippets container
        self.p5js_container = self.database.create_container_if_not_exists(
            id="p5js_code_snippets",
            partition_key=PartitionKey(path="/student_id")
        )
        
        # System instructions for educational content analysis
        self.ANALYSIS_SYSTEM_INSTRUCTIONS = """
        You are an expert educational content analyzer specializing in p5.js creative coding projects.
        Your task is to analyze p5.js code and identify educational metadata.
        
        For each code snippet, provide:
        1. Subject (e.g., "Mathematics", "Computer Science", "Art", "Science", "Language Arts")
        2. Skill (e.g., "Geometry", "Programming Logic", "Data Visualization", "Animation")
        3. Subskill (e.g., "Coordinate Systems", "Loops", "Arrays", "Color Theory")
        4. Key Concepts (list of 3-5 specific concepts demonstrated)
        5. Tags (list of 5-10 relevant tags for searchability)
        
        Focus on the educational value and learning objectives that this code demonstrates.
        Consider what students would learn by creating or studying this code.
        
        """
    
    async def analyze_code_with_gemini(self, code: str, title: str = "", description: str = "") -> Dict[str, Any]:
        """Analyze p5.js code using Gemini to extract educational metadata."""
        
        analysis_prompt = f"""
        Analyze this p5.js educational code for its learning objectives and educational content:
        
        Title: {title}
        Description: {description}
        
        Code:
        ```javascript
        {code}
        ```
        
        Please analyze this code and identify:
        1. What subject area this teaches (Mathematics, Computer Science, Science, Art, Language Arts, etc.)
        2. What primary skill it develops
        3. What specific subskill it focuses on
        4. What key concepts students learn from this
        5. Relevant tags for educational search and categorization
        
        Consider the educational value, age appropriateness, and learning objectives.
        Focus on what students would actually learn by working with this code.
        
        Return ONLY a valid JSON object with no additional text or formatting.
        """
        
        logger.info(f"Sending code analysis request to Gemini (code length: {len(code)} chars)")
        
        # Define the JSON schema for structured output
        json_schema = {
            "type": "object",
            "properties": {
                "subject": {"type": "string"},
                "skill": {"type": "string"},
                "subskill": {"type": "string"},
                "key_concepts": {
                    "type": "array",
                    "items": {"type": "string"}
                },
                "tags": {
                    "type": "array",
                    "items": {"type": "string"}
                }
            },
            "required": ["subject", "skill", "subskill", "key_concepts", "tags"]
        }

        response = await self.client.aio.models.generate_content(
            model='gemini-2.5-flash-preview-05-20',
            contents=analysis_prompt,
            config=types.GenerateContentConfig(
                temperature=0.3,
                top_p=0.95,
                top_k=40,
                max_output_tokens=4096,  # Reduced since we only need JSON
                system_instruction=self.ANALYSIS_SYSTEM_INSTRUCTIONS,
                response_mime_type="application/json",
                response_schema=json_schema,
            ),
        )
        
        # Log detailed response information
        logger.info(f"Response type: {type(response)}")
        logger.info(f"Response attributes: {[attr for attr in dir(response) if not attr.startswith('_')]}")
        
        # Log candidates information
        if hasattr(response, 'candidates') and response.candidates:
            logger.info(f"Number of candidates: {len(response.candidates)}")
            candidate = response.candidates[0]
            logger.info(f"Candidate finish_reason: {candidate.finish_reason}")
            logger.info(f"Candidate content: {candidate.content}")
            
            if candidate.content and hasattr(candidate.content, 'parts'):
                logger.info(f"Content parts: {candidate.content.parts}")
                if candidate.content.parts:
                    for i, part in enumerate(candidate.content.parts):
                        logger.info(f"Part {i}: {type(part)}, content: {part}")
        
        # Check if response has text attribute
        if hasattr(response, 'text'):
            logger.info(f"Response.text exists: {response.text is not None}")
            if response.text is not None:
                logger.info(f"Response.text length: {len(response.text)}")
                logger.info(f"Response.text preview: {repr(response.text[:200])}")
            else:
                logger.error("Response.text is None")
        else:
            logger.error("Response does not have 'text' attribute")
        
        # Try to extract text from response
        response_text = None
        
        if hasattr(response, 'text') and response.text is not None:
            response_text = response.text.strip()
        elif hasattr(response, 'candidates') and response.candidates:
            # Try to extract from first candidate
            candidate = response.candidates[0]
            if candidate.content and hasattr(candidate.content, 'parts') and candidate.content.parts:
                # Look for text in parts
                for part in candidate.content.parts:
                    if hasattr(part, 'text') and part.text:
                        response_text = part.text.strip()
                        logger.info(f"Extracted text from candidate part: {len(response_text)} chars")
                        break
        
        if response_text is None:
            raise ValueError(f"Could not extract text from Gemini response: {response}")
        
        logger.info(f"Final response text: {len(response_text)} chars")
        logger.info(f"Response text content: {repr(response_text)}")
        
        # Parse JSON directly - let it fail if it's not valid JSON
        analysis_result = json.loads(response_text)
        logger.info("Successfully parsed JSON response from Gemini")
        logger.info(f"Parsed result: {analysis_result}")
        
        return analysis_result
    
    async def get_unanalyzed_records(self, limit: int = 100) -> List[Dict[str, Any]]:
        """Get p5.js code records that haven't been analyzed yet."""
        try:
            # Simple approach: get all p5js records and filter in Python
            logger.info("Fetching all p5js code snippets...")
            
            query = "SELECT * FROM c WHERE c.type = 'p5js_code_snippet'"
            
            all_records = list(self.p5js_container.query_items(
                query=query,
                enable_cross_partition_query=True
            ))
            
            logger.info(f"Found {len(all_records)} total p5js records")
            
            # Filter in Python for records that need analysis
            unanalyzed_records = []
            for record in all_records:
                # Check if record needs analysis
                needs_analysis = (
                    'subject' not in record or 
                    record.get('subject') is None or 
                    record.get('subject') == '' or
                    'analyzed_at' not in record
                )
                
                if needs_analysis:
                    unanalyzed_records.append(record)
                    
                # Stop at limit
                if len(unanalyzed_records) >= limit:
                    break
            
            logger.info(f"Found {len(unanalyzed_records)} unanalyzed records")
            
            # Show some debug info about what we found
            if unanalyzed_records:
                sample = unanalyzed_records[0]
                logger.info(f"Sample record fields: {list(sample.keys())}")
                logger.info(f"Sample title: {sample.get('title', 'No title')}")
                
            return unanalyzed_records[:limit]
            
        except Exception as e:
            logger.error(f"Error querying unanalyzed records: {str(e)}")
            import traceback
            logger.error(f"Traceback: {traceback.format_exc()}")
            raise

    async def update_record_with_analysis(self, record_id: str, student_id: int, analysis: Dict[str, Any]) -> bool:
        """Update a record with the analysis results."""
        try:
            # Get the existing record first
            existing_record = self.p5js_container.read_item(
                item=record_id,
                partition_key=student_id
            )
            
            if not existing_record:
                logger.error(f"Record {record_id} not found")
                return False
            
            # Update the record with the new metadata
            existing_record.update({
                "subject": analysis.get("subject", ""),
                "skill": analysis.get("skill", ""),
                "subskill": analysis.get("subskill", ""),
                "key_concepts": analysis.get("key_concepts", []),
                "tags": analysis.get("tags", []),
                "analyzed_at": datetime.utcnow().isoformat(),
                "analysis_version": "1.0",
                "updated_at": datetime.utcnow().isoformat()
            })
            
            # Use replace_item to update with all fields
            result = self.p5js_container.replace_item(
                item=record_id,
                body=existing_record
            )
            
            logger.info(f"Successfully updated record {record_id} with analysis")
            return True
                
        except Exception as e:
            logger.error(f"Error updating record {record_id}: {str(e)}")
            return False

    async def process_single_record(self, record: Dict[str, Any]) -> bool:
        """Process a single record: analyze and update."""
        record_id = record.get("id", "")
        student_id = record.get("student_id", 0)
        code = record.get("code", "")
        title = record.get("title", "")
        description = record.get("description", "")
        
        if not code:
            logger.warning(f"Record {record_id} has no code to analyze")
            return False
        
        logger.info(f"Processing record {record_id}: '{title}'")
        
        try:
            # Analyze the code
            analysis = await self.analyze_code_with_gemini(code, title, description)
            
            # Update the record
            success = await self.update_record_with_analysis(record_id, student_id, analysis)
            
            if success:
                logger.info(f"✅ Successfully processed record {record_id}")
                logger.info(f"   Subject: {analysis.get('subject', 'N/A')}")
                logger.info(f"   Skill: {analysis.get('skill', 'N/A')}")
                logger.info(f"   Subskill: {analysis.get('subskill', 'N/A')}")
                logger.info(f"   Tags: {', '.join(analysis.get('tags', []))}")
            else:
                logger.error(f"❌ Failed to process record {record_id}")
            
            return success
            
        except Exception as e:
            logger.error(f"❌ Error processing record {record_id}: {str(e)}")
            return False

    async def run_analysis_batch(self, batch_size: int = 10, delay_between_requests: float = 1.0):
        """Run analysis on a batch of unanalyzed records."""
        logger.info(f"Starting batch analysis (batch_size: {batch_size})")
        
        try:
            # Get unanalyzed records
            records = await self.get_unanalyzed_records(limit=batch_size)
            
            if not records:
                logger.info("No unanalyzed records found")
                return
            
            logger.info(f"Processing {len(records)} records...")
            
            successful_updates = 0
            failed_updates = 0
            
            for i, record in enumerate(records, 1):
                logger.info(f"Processing record {i}/{len(records)}")
                
                success = await self.process_single_record(record)
                
                if success:
                    successful_updates += 1
                else:
                    failed_updates += 1
                
                # Add delay between requests to be nice to the API
                if i < len(records) and delay_between_requests > 0:
                    logger.info(f"Waiting {delay_between_requests}s before next request...")
                    await asyncio.sleep(delay_between_requests)
            
            logger.info(f"Batch processing complete!")
            logger.info(f"✅ Successful updates: {successful_updates}")
            logger.info(f"❌ Failed updates: {failed_updates}")
            
        except Exception as e:
            logger.error(f"Error during batch processing: {str(e)}")
            raise

# Example usage function
async def main():
    """Main function to run the analysis."""
    
    logger.info("P5.js Code Analysis Script")
    logger.info("This script will analyze p5.js code records and add educational metadata.")
    
    # Check environment variables
    gemini_key = os.getenv("GEMINI_GENERATE_KEY")
    cosmos_endpoint = os.getenv("COSMOS_ENDPOINT")
    cosmos_database = os.getenv("COSMOS_DATABASE")
    
    logger.info(f"Gemini API Key: {'✅ Set' if gemini_key else '❌ Missing'}")
    logger.info(f"Cosmos DB Endpoint: {cosmos_endpoint[:50] + '...' if cosmos_endpoint else '❌ Missing'}")
    logger.info(f"Cosmos DB Database: {cosmos_database if cosmos_database else '❌ Missing'}")
    
    if not gemini_key or not cosmos_endpoint or not cosmos_database:
        logger.error("Missing required environment variables. Please check your .env file.")
        return
    
    # Create analyzer (it handles its own initialization now)
    try:
        analyzer = P5jsCodeAnalyzer()
        logger.info("✅ Cosmos DB and Gemini connected successfully")
    except Exception as e:
        logger.error(f"Failed to initialize analyzer: {str(e)}")
        return
    
    # Run analysis
    try:
        await analyzer.run_analysis_batch(
            batch_size=20,  # Process 20 records at a time
            delay_between_requests=2.0  # 2 second delay between API calls
        )
    except Exception as e:
        logger.error(f"Analysis failed: {str(e)}")

if __name__ == "__main__":
    print("P5.js Code Analysis Script")
    print("=" * 50)
    print("This script will analyze p5.js code records and add educational metadata.")
    print("Make sure you have set the required environment variables in your .env file:")
    print("- GEMINI_GENERATE_KEY")
    print("- COSMOS_ENDPOINT") 
    print("- COSMOS_KEY")
    print("- COSMOS_DATABASE")
    print()
    
    # Run the async main function
    asyncio.run(main())