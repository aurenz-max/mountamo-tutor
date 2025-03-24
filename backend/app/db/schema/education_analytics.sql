-- Simplified Schema for Three-Metric Tutoring Dashboard System

-- Students table with grade level
CREATE TABLE students (
    student_id INTEGER PRIMARY KEY,
    name VARCHAR(255),
    grade VARCHAR(50)
);

-- Curriculum table for the entire hierarchy
CREATE TABLE curriculum (
    id SERIAL PRIMARY KEY,
    subject VARCHAR(100) NOT NULL,
    grade VARCHAR(50),
    unit_id VARCHAR(100) NOT NULL,
    unit_title VARCHAR(255) NOT NULL,
    skill_id VARCHAR(100) NOT NULL,
    skill_description TEXT NOT NULL,
    subskill_id VARCHAR(100) NOT NULL UNIQUE,
    subskill_description TEXT NOT NULL,
    difficulty_start NUMERIC(5,2),
    difficulty_end NUMERIC(5,2),
    target_difficulty NUMERIC(5,2)
);

-- Create indexes for curriculum lookups
CREATE INDEX idx_curriculum_subject ON curriculum(subject);
CREATE INDEX idx_curriculum_subskill ON curriculum(subskill_id);
CREATE INDEX idx_curriculum_skill ON curriculum(skill_id);

-- Learning paths table
CREATE TABLE learning_paths (
    id SERIAL PRIMARY KEY,
    prerequisite_skill_id VARCHAR(100) NOT NULL,
    unlocks_skill_id VARCHAR(100) NOT NULL,
    min_score_threshold NUMERIC(5,2) DEFAULT 6.0,
    UNIQUE (prerequisite_skill_id, unlocks_skill_id)
);

-- Problem attempts table
CREATE TABLE attempts (
    attempt_id SERIAL PRIMARY KEY,
    student_id INTEGER NOT NULL REFERENCES students(student_id),
    subject VARCHAR(100) NOT NULL,
    skill_id VARCHAR(100) NOT NULL,
    subskill_id VARCHAR(100) NOT NULL REFERENCES curriculum(subskill_id),
    score NUMERIC(5,2) NOT NULL CHECK (score >= 0 AND score <= 10),
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX idx_attempts_student ON attempts(student_id);
CREATE INDEX idx_attempts_subskill ON attempts(subskill_id);
CREATE INDEX idx_attempts_timestamp ON attempts(timestamp);
CREATE INDEX idx_attempts_student_subject ON attempts(student_id, subject);