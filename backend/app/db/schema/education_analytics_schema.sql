--
-- PostgreSQL database dump
--

-- Dumped from database version 17.4
-- Dumped by pg_dump version 17.4

-- Started on 2025-04-15 23:00:56

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- TOC entry 4 (class 2615 OID 2200)
-- Name: public; Type: SCHEMA; Schema: -; Owner: pg_database_owner
--

CREATE SCHEMA public;


ALTER SCHEMA public OWNER TO pg_database_owner;

--
-- TOC entry 4971 (class 0 OID 0)
-- Dependencies: 4
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: pg_database_owner
--

COMMENT ON SCHEMA public IS 'standard public schema';


--
-- TOC entry 228 (class 1255 OID 16786)
-- Name: calculate_coverage(integer, character varying, timestamp with time zone, timestamp with time zone); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.calculate_coverage(p_student_id integer, p_subject character varying, p_start_date timestamp with time zone DEFAULT NULL::timestamp with time zone, p_end_date timestamp with time zone DEFAULT NULL::timestamp with time zone) RETURNS TABLE(coverage_percentage numeric, attempted_items integer, total_curriculum_items integer)
    LANGUAGE plpgsql
    AS $$
BEGIN
    RETURN QUERY
    WITH all_subskills AS (
        SELECT subskill_id FROM curriculum WHERE subject = p_subject
    ),
    attempted_subskills AS (
        SELECT 
            as1.subskill_id, 
            CASE WHEN EXISTS (
                SELECT 1 FROM attempts a 
                WHERE a.subskill_id = as1.subskill_id
                  AND a.student_id = p_student_id
                  AND a.subject = p_subject
                  AND (p_start_date IS NULL OR a.timestamp >= p_start_date)
                  AND (p_end_date IS NULL OR a.timestamp <= p_end_date)
            ) THEN 1 ELSE 0 END AS is_attempted
        FROM all_subskills as1
    )
    SELECT 
        (SUM(is_attempted)::NUMERIC / COUNT(*)) * 100 AS coverage_percentage,
        SUM(is_attempted) AS attempted_items,
        COUNT(*) AS total_curriculum_items
    FROM attempted_subskills;
END;
$$;


ALTER FUNCTION public.calculate_coverage(p_student_id integer, p_subject character varying, p_start_date timestamp with time zone, p_end_date timestamp with time zone) OWNER TO postgres;

--
-- TOC entry 240 (class 1255 OID 16787)
-- Name: calculate_mastery(integer, character varying, timestamp with time zone, timestamp with time zone); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.calculate_mastery(p_student_id integer, p_subject character varying, p_start_date timestamp with time zone DEFAULT NULL::timestamp with time zone, p_end_date timestamp with time zone DEFAULT NULL::timestamp with time zone) RETURNS TABLE(mastery_score numeric, mastery_level character varying, attempted_items integer, total_curriculum_items integer)
    LANGUAGE plpgsql
    AS $$
BEGIN
    RETURN QUERY
    WITH all_subskills AS (
        SELECT subskill_id FROM curriculum WHERE subject = p_subject
    ),
    subskill_scores AS (
        SELECT 
            as1.subskill_id,
            (SELECT AVG(a.score) 
             FROM attempts a 
             WHERE a.subskill_id = as1.subskill_id
               AND a.student_id = p_student_id
               AND a.subject = p_subject
               AND (p_start_date IS NULL OR a.timestamp >= p_start_date)
               AND (p_end_date IS NULL OR a.timestamp <= p_end_date)
            ) AS avg_score,
            CASE WHEN EXISTS (
                SELECT 1 FROM attempts a 
                WHERE a.subskill_id = as1.subskill_id
                  AND a.student_id = p_student_id
                  AND a.subject = p_subject
                  AND (p_start_date IS NULL OR a.timestamp >= p_start_date)
                  AND (p_end_date IS NULL OR a.timestamp <= p_end_date)
            ) THEN 1 ELSE 0 END AS is_attempted
        FROM all_subskills as1
    )
    SELECT 
        COALESCE(SUM(avg_score) / NULLIF(SUM(is_attempted), 0), 0) AS mastery_score,
        CASE 
            WHEN COALESCE(SUM(avg_score) / NULLIF(SUM(is_attempted), 0), 0) < 4.0 THEN 'Beginning'
            WHEN COALESCE(SUM(avg_score) / NULLIF(SUM(is_attempted), 0), 0) < 6.0 THEN 'Developing'
            WHEN COALESCE(SUM(avg_score) / NULLIF(SUM(is_attempted), 0), 0) < 8.0 THEN 'Proficient'
            ELSE 'Advanced'
        END AS mastery_level,
        SUM(is_attempted) AS attempted_items,
        COUNT(*) AS total_curriculum_items
    FROM subskill_scores;
END;
$$;


ALTER FUNCTION public.calculate_mastery(p_student_id integer, p_subject character varying, p_start_date timestamp with time zone, p_end_date timestamp with time zone) OWNER TO postgres;

--
-- TOC entry 241 (class 1255 OID 16788)
-- Name: calculate_proficiency(integer, character varying, timestamp with time zone, timestamp with time zone); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.calculate_proficiency(p_student_id integer, p_subject character varying, p_start_date timestamp with time zone DEFAULT NULL::timestamp with time zone, p_end_date timestamp with time zone DEFAULT NULL::timestamp with time zone) RETURNS TABLE(proficiency_score numeric, attempted_ready_items integer, total_ready_items integer)
    LANGUAGE plpgsql
    AS $$
BEGIN
    RETURN QUERY
    WITH skill_scores AS (
        -- Calculate average score for each skill
        SELECT 
            c.skill_id,
            AVG(a.score) AS avg_score,
            COUNT(DISTINCT a.subskill_id) AS attempted_subskills,
            (SELECT COUNT(*) FROM curriculum c2 WHERE c2.skill_id = c.skill_id) AS total_subskills
        FROM curriculum c
        JOIN attempts a ON a.subskill_id = c.subskill_id
            AND a.student_id = p_student_id
            AND (p_start_date IS NULL OR a.timestamp >= p_start_date)
            AND (p_end_date IS NULL OR a.timestamp <= p_end_date)
        WHERE c.subject = p_subject
        GROUP BY c.skill_id
    ),
    proficient_skills AS (
        -- Determine which skills the student is proficient in
        SELECT 
            skill_id,
            CASE 
                WHEN avg_score >= 6.0 AND 
                     attempted_subskills::FLOAT / total_subskills >= 0.5
                THEN TRUE
                ELSE FALSE
            END AS is_proficient
        FROM skill_scores
    ),
    ready_skills AS (
        -- Find skills that are ready based on prerequisites
        SELECT 
            lp.unlocks_skill_id AS skill_id,
            CASE 
                WHEN ps.is_proficient THEN TRUE
                ELSE FALSE
            END AS is_ready
        FROM learning_paths lp
        JOIN proficient_skills ps ON lp.prerequisite_skill_id = ps.skill_id
        UNION
        -- Include skills that have no prerequisites (they're always ready)
        SELECT 
            c.skill_id,
            TRUE AS is_ready
        FROM curriculum c
        WHERE c.subject = p_subject
        AND NOT EXISTS (
            SELECT 1 FROM learning_paths lp 
            WHERE lp.unlocks_skill_id = c.skill_id
        )
        GROUP BY c.skill_id
    ),
    ready_subskills AS (
        -- Get all subskills that belong to ready skills
        SELECT 
            c.subskill_id,
            rs.is_ready
        FROM curriculum c
        JOIN ready_skills rs ON c.skill_id = rs.skill_id
        WHERE c.subject = p_subject
    ),
    ready_scores AS (
        -- Get scores for ready subskills
        SELECT 
            rs.subskill_id,
            rs.is_ready,
            (SELECT AVG(a.score) 
             FROM attempts a 
             WHERE a.subskill_id = rs.subskill_id
               AND a.student_id = p_student_id
               AND (p_start_date IS NULL OR a.timestamp >= p_start_date)
               AND (p_end_date IS NULL OR a.timestamp <= p_end_date)
            ) AS avg_score,
            CASE WHEN EXISTS (
                SELECT 1 FROM attempts a 
                WHERE a.subskill_id = rs.subskill_id
                  AND a.student_id = p_student_id
                  AND (p_start_date IS NULL OR a.timestamp >= p_start_date)
                  AND (p_end_date IS NULL OR a.timestamp <= p_end_date)
            ) THEN 1 ELSE 0 END AS is_attempted
        FROM ready_subskills rs
    )
    SELECT 
        COALESCE(SUM(CASE WHEN is_ready AND is_attempted = 1 THEN avg_score ELSE 0 END) / 
            NULLIF(SUM(CASE WHEN is_ready AND is_attempted = 1 THEN 1 ELSE 0 END), 0), 0) AS proficiency_score,
        SUM(CASE WHEN is_ready AND is_attempted = 1 THEN 1 ELSE 0 END) AS attempted_ready_items,
        SUM(CASE WHEN is_ready THEN 1 ELSE 0 END) AS total_ready_items
    FROM ready_scores;
END;
$$;


ALTER FUNCTION public.calculate_proficiency(p_student_id integer, p_subject character varying, p_start_date timestamp with time zone, p_end_date timestamp with time zone) OWNER TO postgres;

--
-- TOC entry 242 (class 1255 OID 16789)
-- Name: get_all_metrics(integer, character varying, timestamp with time zone, timestamp with time zone); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.get_all_metrics(p_student_id integer, p_subject character varying, p_start_date timestamp with time zone DEFAULT NULL::timestamp with time zone, p_end_date timestamp with time zone DEFAULT NULL::timestamp with time zone) RETURNS TABLE(mastery_score numeric, mastery_level character varying, coverage_percentage numeric, proficiency_score numeric, attempted_items integer, total_curriculum_items integer, attempted_ready_items integer, total_ready_items integer)
    LANGUAGE plpgsql
    AS $$
BEGIN
    RETURN QUERY
    SELECT 
        m.mastery_score,
        m.mastery_level,
        c.coverage_percentage,
        p.proficiency_score,
        m.attempted_items,
        m.total_curriculum_items,
        p.attempted_ready_items,
        p.total_ready_items
    FROM calculate_mastery(p_student_id, p_subject, p_start_date, p_end_date) m,
         calculate_coverage(p_student_id, p_subject, p_start_date, p_end_date) c,
         calculate_proficiency(p_student_id, p_subject, p_start_date, p_end_date) p;
END;
$$;


ALTER FUNCTION public.get_all_metrics(p_student_id integer, p_subject character varying, p_start_date timestamp with time zone, p_end_date timestamp with time zone) OWNER TO postgres;

--
-- TOC entry 243 (class 1255 OID 16790)
-- Name: identify_gaps(integer, character varying); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.identify_gaps(p_student_id integer, p_subject character varying) RETURNS TABLE(unit_id character varying, unit_title character varying, skill_id character varying, skill_description text, subskill_id character varying, subskill_description text, gap_type character varying, is_ready boolean)
    LANGUAGE plpgsql
    AS $$
BEGIN
    RETURN QUERY
    WITH skill_scores AS (
        -- Calculate average score for each skill
        SELECT 
            c.skill_id,
            AVG(a.score) AS avg_score,
            COUNT(DISTINCT a.subskill_id) AS attempted_subskills,
            (SELECT COUNT(*) FROM curriculum c2 WHERE c2.skill_id = c.skill_id) AS total_subskills
        FROM curriculum c
        JOIN attempts a ON a.subskill_id = c.subskill_id
            AND a.student_id = p_student_id
        WHERE c.subject = p_subject
        GROUP BY c.skill_id
    ),
    proficient_skills AS (
        -- Determine which skills the student is proficient in
        SELECT 
            skill_id,
            CASE 
                WHEN avg_score >= 6.0 AND 
                     attempted_subskills::FLOAT / total_subskills >= 0.5
                THEN TRUE
                ELSE FALSE
            END AS is_proficient
        FROM skill_scores
    ),
    ready_skills AS (
        -- Find skills that are ready based on prerequisites
        SELECT 
            lp.unlocks_skill_id AS skill_id,
            CASE 
                WHEN ps.is_proficient THEN TRUE
                ELSE FALSE
            END AS is_ready
        FROM learning_paths lp
        JOIN proficient_skills ps ON lp.prerequisite_skill_id = ps.skill_id
        UNION
        -- Include skills that have no prerequisites (they're always ready)
        SELECT 
            c.skill_id,
            TRUE AS is_ready
        FROM curriculum c
        WHERE c.subject = p_subject
        AND NOT EXISTS (
            SELECT 1 FROM learning_paths lp 
            WHERE lp.unlocks_skill_id = c.skill_id
        )
        GROUP BY c.skill_id
    ),
    subskill_status AS (
        -- Determine status for each subskill
        SELECT 
            c.subskill_id,
            c.unit_id,
            c.unit_title,
            c.skill_id,
            c.skill_description,
            c.subskill_description,
            rs.is_ready,
            (SELECT AVG(a.score) 
             FROM attempts a 
             WHERE a.subskill_id = c.subskill_id
               AND a.student_id = p_student_id
            ) AS avg_score,
            CASE WHEN EXISTS (
                SELECT 1 FROM attempts a 
                WHERE a.subskill_id = c.subskill_id
                  AND a.student_id = p_student_id
            ) THEN TRUE ELSE FALSE END AS is_attempted
        FROM curriculum c
        LEFT JOIN ready_skills rs ON c.skill_id = rs.skill_id
        WHERE c.subject = p_subject
    )
    SELECT 
        ss.unit_id,
        ss.unit_title,
        ss.skill_id,
        ss.skill_description,
        ss.subskill_id,
        ss.subskill_description,
        CASE 
            WHEN ss.is_ready AND NOT ss.is_attempted THEN 'Coverage Gap'
            WHEN ss.is_ready AND ss.is_attempted AND ss.avg_score < 6.0 THEN 'Performance Gap'
            WHEN NOT ss.is_ready THEN 'Future Item'
            ELSE 'On Track'
        END AS gap_type,
        ss.is_ready
    FROM subskill_status ss
    WHERE 
        (ss.is_ready AND NOT ss.is_attempted) OR 
        (ss.is_ready AND ss.is_attempted AND ss.avg_score < 6.0) OR
        (NOT ss.is_ready)
    ORDER BY 
        CASE 
            WHEN ss.is_ready AND NOT ss.is_attempted THEN 1
            WHEN ss.is_ready AND ss.is_attempted AND ss.avg_score < 6.0 THEN 2
            ELSE 3
        END,
        ss.unit_id,
        ss.skill_id,
        ss.subskill_id;
END;
$$;


ALTER FUNCTION public.identify_gaps(p_student_id integer, p_subject character varying) OWNER TO postgres;

--
-- TOC entry 244 (class 1255 OID 16791)
-- Name: import_learning_path(jsonb); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.import_learning_path(data jsonb) RETURNS void
    LANGUAGE plpgsql
    AS $$
DECLARE
    prerequisite_skill_id TEXT;
    unlocks_skill_ids JSONB;
    unlocks_skill_id TEXT;
BEGIN
    -- Iterate through each skill and the skills it unlocks
    FOR prerequisite_skill_id, unlocks_skill_ids IN SELECT * FROM jsonb_each(data->'learning_path_decision_tree')
    LOOP
        -- Iterate through skills that get unlocked
        IF jsonb_array_length(unlocks_skill_ids) > 0 THEN
            FOR i IN 0..jsonb_array_length(unlocks_skill_ids)-1
            LOOP
                unlocks_skill_id := unlocks_skill_ids->>i;
                
                -- Insert the learning path relationship
                INSERT INTO learning_paths (
                    prerequisite_skill_id, 
                    unlocks_skill_id,
                    min_score_threshold
                ) VALUES (
                    prerequisite_skill_id,  -- The prerequisite skill
                    unlocks_skill_id,       -- The skill that becomes available
                    6.0                     -- Default threshold
                )
                ON CONFLICT (prerequisite_skill_id, unlocks_skill_id) DO NOTHING;
            END LOOP;
        END IF;
    END LOOP;
END;
$$;


ALTER FUNCTION public.import_learning_path(data jsonb) OWNER TO postgres;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- TOC entry 217 (class 1259 OID 16792)
-- Name: attempts; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.attempts (
    attempt_id integer NOT NULL,
    student_id integer NOT NULL,
    subject character varying(100) NOT NULL,
    skill_id character varying(100) NOT NULL,
    subskill_id character varying(100) NOT NULL,
    score numeric(5,2) NOT NULL,
    "timestamp" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT attempts_score_check CHECK (((score >= (0)::numeric) AND (score <= (10)::numeric)))
);


ALTER TABLE public.attempts OWNER TO postgres;

--
-- TOC entry 218 (class 1259 OID 16797)
-- Name: attempts_attempt_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.attempts_attempt_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.attempts_attempt_id_seq OWNER TO postgres;

--
-- TOC entry 4972 (class 0 OID 0)
-- Dependencies: 218
-- Name: attempts_attempt_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.attempts_attempt_id_seq OWNED BY public.attempts.attempt_id;


--
-- TOC entry 219 (class 1259 OID 16798)
-- Name: curriculum; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.curriculum (
    id integer NOT NULL,
    subject character varying(100) NOT NULL,
    grade character varying(50),
    unit_id character varying(100) NOT NULL,
    unit_title character varying(255) NOT NULL,
    skill_id character varying(100) NOT NULL,
    skill_description text NOT NULL,
    subskill_id character varying(100) NOT NULL,
    subskill_description text NOT NULL,
    difficulty_start numeric(5,2),
    difficulty_end numeric(5,2),
    target_difficulty numeric(5,2)
);


ALTER TABLE public.curriculum OWNER TO postgres;

--
-- TOC entry 220 (class 1259 OID 16803)
-- Name: curriculum_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.curriculum_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.curriculum_id_seq OWNER TO postgres;

--
-- TOC entry 4973 (class 0 OID 0)
-- Dependencies: 220
-- Name: curriculum_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.curriculum_id_seq OWNED BY public.curriculum.id;


--
-- TOC entry 221 (class 1259 OID 16804)
-- Name: learning_paths; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.learning_paths (
    id integer NOT NULL,
    prerequisite_skill_id character varying(100) NOT NULL,
    unlocks_skill_id character varying(100) NOT NULL,
    min_score_threshold numeric(5,2) DEFAULT 6.0,
    is_base_node boolean DEFAULT false
);


ALTER TABLE public.learning_paths OWNER TO postgres;

--
-- TOC entry 222 (class 1259 OID 16808)
-- Name: learning_paths_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.learning_paths_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.learning_paths_id_seq OWNER TO postgres;

--
-- TOC entry 4974 (class 0 OID 0)
-- Dependencies: 222
-- Name: learning_paths_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.learning_paths_id_seq OWNED BY public.learning_paths.id;


--
-- TOC entry 227 (class 1259 OID 16985)
-- Name: problem_reviews; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.problem_reviews (
    id integer NOT NULL,
    review_id character varying(255) NOT NULL,
    student_id integer NOT NULL,
    subject character varying(100) NOT NULL,
    skill_id character varying(50) NOT NULL,
    subskill_id character varying(50),
    problem_id character varying(255),
    "timestamp" timestamp with time zone,
    unit_id character varying(50),
    unit_title character varying(255),
    problem_type character varying(100),
    problem_text text,
    answer_text text,
    success_criteria jsonb,
    teaching_note text,
    canvas_description text,
    selected_answer text,
    work_shown text,
    understanding text,
    approach text,
    accuracy text,
    creativity text,
    feedback_praise text,
    feedback_guidance text,
    feedback_encouragement text,
    feedback_next_steps text,
    score double precision,
    evaluation_justification text,
    cosmos_rid character varying(100),
    cosmos_ts bigint,
    raw_data jsonb,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.problem_reviews OWNER TO postgres;

--
-- TOC entry 226 (class 1259 OID 16984)
-- Name: problem_reviews_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.problem_reviews_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.problem_reviews_id_seq OWNER TO postgres;

--
-- TOC entry 4975 (class 0 OID 0)
-- Dependencies: 226
-- Name: problem_reviews_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.problem_reviews_id_seq OWNED BY public.problem_reviews.id;


--
-- TOC entry 223 (class 1259 OID 16816)
-- Name: students; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.students (
    student_id integer NOT NULL,
    name character varying(255),
    grade character varying(50)
);


ALTER TABLE public.students OWNER TO postgres;

--
-- TOC entry 224 (class 1259 OID 16819)
-- Name: subskill_learning_paths; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.subskill_learning_paths (
    id integer NOT NULL,
    current_subskill_id character varying(100) NOT NULL,
    next_subskill_id character varying(100)
);


ALTER TABLE public.subskill_learning_paths OWNER TO postgres;

--
-- TOC entry 225 (class 1259 OID 16822)
-- Name: subskill_learning_paths_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.subskill_learning_paths_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.subskill_learning_paths_id_seq OWNER TO postgres;

--
-- TOC entry 4976 (class 0 OID 0)
-- Dependencies: 225
-- Name: subskill_learning_paths_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.subskill_learning_paths_id_seq OWNED BY public.subskill_learning_paths.id;


--
-- TOC entry 4772 (class 2604 OID 16823)
-- Name: attempts attempt_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.attempts ALTER COLUMN attempt_id SET DEFAULT nextval('public.attempts_attempt_id_seq'::regclass);


--
-- TOC entry 4774 (class 2604 OID 16824)
-- Name: curriculum id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.curriculum ALTER COLUMN id SET DEFAULT nextval('public.curriculum_id_seq'::regclass);


--
-- TOC entry 4775 (class 2604 OID 16825)
-- Name: learning_paths id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.learning_paths ALTER COLUMN id SET DEFAULT nextval('public.learning_paths_id_seq'::regclass);


--
-- TOC entry 4779 (class 2604 OID 16988)
-- Name: problem_reviews id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.problem_reviews ALTER COLUMN id SET DEFAULT nextval('public.problem_reviews_id_seq'::regclass);


--
-- TOC entry 4778 (class 2604 OID 16826)
-- Name: subskill_learning_paths id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.subskill_learning_paths ALTER COLUMN id SET DEFAULT nextval('public.subskill_learning_paths_id_seq'::regclass);


--
-- TOC entry 4784 (class 2606 OID 16828)
-- Name: attempts attempts_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.attempts
    ADD CONSTRAINT attempts_pkey PRIMARY KEY (attempt_id);


--
-- TOC entry 4790 (class 2606 OID 16830)
-- Name: curriculum curriculum_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.curriculum
    ADD CONSTRAINT curriculum_pkey PRIMARY KEY (id);


--
-- TOC entry 4792 (class 2606 OID 16832)
-- Name: curriculum curriculum_subskill_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.curriculum
    ADD CONSTRAINT curriculum_subskill_id_key UNIQUE (subskill_id);


--
-- TOC entry 4797 (class 2606 OID 16834)
-- Name: learning_paths learning_paths_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.learning_paths
    ADD CONSTRAINT learning_paths_pkey PRIMARY KEY (id);


--
-- TOC entry 4799 (class 2606 OID 16836)
-- Name: learning_paths learning_paths_prerequisite_skill_id_unlocks_skill_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.learning_paths
    ADD CONSTRAINT learning_paths_prerequisite_skill_id_unlocks_skill_id_key UNIQUE (prerequisite_skill_id, unlocks_skill_id);


--
-- TOC entry 4813 (class 2606 OID 16994)
-- Name: problem_reviews problem_reviews_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.problem_reviews
    ADD CONSTRAINT problem_reviews_pkey PRIMARY KEY (id);


--
-- TOC entry 4815 (class 2606 OID 16996)
-- Name: problem_reviews problem_reviews_review_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.problem_reviews
    ADD CONSTRAINT problem_reviews_review_id_key UNIQUE (review_id);


--
-- TOC entry 4801 (class 2606 OID 16840)
-- Name: students students_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.students
    ADD CONSTRAINT students_pkey PRIMARY KEY (student_id);


--
-- TOC entry 4805 (class 2606 OID 16842)
-- Name: subskill_learning_paths subskill_learning_paths_current_subskill_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.subskill_learning_paths
    ADD CONSTRAINT subskill_learning_paths_current_subskill_id_key UNIQUE (current_subskill_id);


--
-- TOC entry 4807 (class 2606 OID 16844)
-- Name: subskill_learning_paths subskill_learning_paths_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.subskill_learning_paths
    ADD CONSTRAINT subskill_learning_paths_pkey PRIMARY KEY (id);


--
-- TOC entry 4785 (class 1259 OID 16845)
-- Name: idx_attempts_student; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_attempts_student ON public.attempts USING btree (student_id);


--
-- TOC entry 4786 (class 1259 OID 16846)
-- Name: idx_attempts_student_subject; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_attempts_student_subject ON public.attempts USING btree (student_id, subject);


--
-- TOC entry 4787 (class 1259 OID 16847)
-- Name: idx_attempts_subskill; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_attempts_subskill ON public.attempts USING btree (subskill_id);


--
-- TOC entry 4788 (class 1259 OID 16848)
-- Name: idx_attempts_timestamp; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_attempts_timestamp ON public.attempts USING btree ("timestamp");


--
-- TOC entry 4793 (class 1259 OID 16849)
-- Name: idx_curriculum_skill; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_curriculum_skill ON public.curriculum USING btree (skill_id);


--
-- TOC entry 4794 (class 1259 OID 16850)
-- Name: idx_curriculum_subject; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_curriculum_subject ON public.curriculum USING btree (subject);


--
-- TOC entry 4795 (class 1259 OID 16851)
-- Name: idx_curriculum_subskill; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_curriculum_subskill ON public.curriculum USING btree (subskill_id);


--
-- TOC entry 4808 (class 1259 OID 17003)
-- Name: idx_problem_reviews_skill_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_problem_reviews_skill_id ON public.problem_reviews USING btree (skill_id);


--
-- TOC entry 4809 (class 1259 OID 17002)
-- Name: idx_problem_reviews_student_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_problem_reviews_student_id ON public.problem_reviews USING btree (student_id);


--
-- TOC entry 4810 (class 1259 OID 17004)
-- Name: idx_problem_reviews_subskill_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_problem_reviews_subskill_id ON public.problem_reviews USING btree (subskill_id);


--
-- TOC entry 4811 (class 1259 OID 17005)
-- Name: idx_problem_reviews_timestamp; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_problem_reviews_timestamp ON public.problem_reviews USING btree ("timestamp");


--
-- TOC entry 4802 (class 1259 OID 16857)
-- Name: idx_subskill_paths_current; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_subskill_paths_current ON public.subskill_learning_paths USING btree (current_subskill_id);


--
-- TOC entry 4803 (class 1259 OID 16858)
-- Name: idx_subskill_paths_next; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_subskill_paths_next ON public.subskill_learning_paths USING btree (next_subskill_id);


--
-- TOC entry 4816 (class 2606 OID 16859)
-- Name: attempts attempts_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.attempts
    ADD CONSTRAINT attempts_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(student_id);


--
-- TOC entry 4817 (class 2606 OID 16864)
-- Name: attempts attempts_subskill_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.attempts
    ADD CONSTRAINT attempts_subskill_id_fkey FOREIGN KEY (subskill_id) REFERENCES public.curriculum(subskill_id);


--
-- TOC entry 4820 (class 2606 OID 16997)
-- Name: problem_reviews problem_reviews_subskill_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.problem_reviews
    ADD CONSTRAINT problem_reviews_subskill_id_fkey FOREIGN KEY (subskill_id) REFERENCES public.curriculum(subskill_id);


--
-- TOC entry 4818 (class 2606 OID 16879)
-- Name: subskill_learning_paths subskill_learning_paths_current_subskill_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.subskill_learning_paths
    ADD CONSTRAINT subskill_learning_paths_current_subskill_id_fkey FOREIGN KEY (current_subskill_id) REFERENCES public.curriculum(subskill_id);


--
-- TOC entry 4819 (class 2606 OID 16884)
-- Name: subskill_learning_paths subskill_learning_paths_next_subskill_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.subskill_learning_paths
    ADD CONSTRAINT subskill_learning_paths_next_subskill_id_fkey FOREIGN KEY (next_subskill_id) REFERENCES public.curriculum(subskill_id);


-- Completed on 2025-04-15 23:00:56

--
-- PostgreSQL database dump complete
--

