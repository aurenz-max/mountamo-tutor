PGDMP      .                }           education_analytics    17.4    17.4 C    o           0    0    ENCODING    ENCODING     !   SET client_encoding = 'WIN1252';
                           false            p           0    0 
   STDSTRINGS 
   STDSTRINGS     (   SET standard_conforming_strings = 'on';
                           false            q           0    0 
   SEARCHPATH 
   SEARCHPATH     8   SELECT pg_catalog.set_config('search_path', '', false);
                           false            r           1262    16621    education_analytics    DATABASE     �   CREATE DATABASE education_analytics WITH TEMPLATE = template0 ENCODING = 'WIN1252' LOCALE_PROVIDER = libc LOCALE = 'English_United States.1252';
 #   DROP DATABASE education_analytics;
                     postgres    false            �            1255    16675 b   calculate_coverage(integer, character varying, timestamp with time zone, timestamp with time zone)    FUNCTION     �  CREATE FUNCTION public.calculate_coverage(p_student_id integer, p_subject character varying, p_start_date timestamp with time zone DEFAULT NULL::timestamp with time zone, p_end_date timestamp with time zone DEFAULT NULL::timestamp with time zone) RETURNS TABLE(coverage_percentage numeric, attempted_items integer, total_curriculum_items integer)
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
 �   DROP FUNCTION public.calculate_coverage(p_student_id integer, p_subject character varying, p_start_date timestamp with time zone, p_end_date timestamp with time zone);
       public               postgres    false            �            1255    16674 a   calculate_mastery(integer, character varying, timestamp with time zone, timestamp with time zone)    FUNCTION     �  CREATE FUNCTION public.calculate_mastery(p_student_id integer, p_subject character varying, p_start_date timestamp with time zone DEFAULT NULL::timestamp with time zone, p_end_date timestamp with time zone DEFAULT NULL::timestamp with time zone) RETURNS TABLE(mastery_score numeric, mastery_level character varying, attempted_items integer, total_curriculum_items integer)
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
 �   DROP FUNCTION public.calculate_mastery(p_student_id integer, p_subject character varying, p_start_date timestamp with time zone, p_end_date timestamp with time zone);
       public               postgres    false            �            1255    16676 e   calculate_proficiency(integer, character varying, timestamp with time zone, timestamp with time zone)    FUNCTION     �  CREATE FUNCTION public.calculate_proficiency(p_student_id integer, p_subject character varying, p_start_date timestamp with time zone DEFAULT NULL::timestamp with time zone, p_end_date timestamp with time zone DEFAULT NULL::timestamp with time zone) RETURNS TABLE(proficiency_score numeric, attempted_ready_items integer, total_ready_items integer)
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
 �   DROP FUNCTION public.calculate_proficiency(p_student_id integer, p_subject character varying, p_start_date timestamp with time zone, p_end_date timestamp with time zone);
       public               postgres    false            �            1255    16677 _   get_all_metrics(integer, character varying, timestamp with time zone, timestamp with time zone)    FUNCTION       CREATE FUNCTION public.get_all_metrics(p_student_id integer, p_subject character varying, p_start_date timestamp with time zone DEFAULT NULL::timestamp with time zone, p_end_date timestamp with time zone DEFAULT NULL::timestamp with time zone) RETURNS TABLE(mastery_score numeric, mastery_level character varying, coverage_percentage numeric, proficiency_score numeric, attempted_items integer, total_curriculum_items integer, attempted_ready_items integer, total_ready_items integer)
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
 �   DROP FUNCTION public.get_all_metrics(p_student_id integer, p_subject character varying, p_start_date timestamp with time zone, p_end_date timestamp with time zone);
       public               postgres    false            �            1255    16678 )   identify_gaps(integer, character varying)    FUNCTION     �  CREATE FUNCTION public.identify_gaps(p_student_id integer, p_subject character varying) RETURNS TABLE(unit_id character varying, unit_title character varying, skill_id character varying, skill_description text, subskill_id character varying, subskill_description text, gap_type character varying, is_ready boolean)
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
 W   DROP FUNCTION public.identify_gaps(p_student_id integer, p_subject character varying);
       public               postgres    false            �            1255    16679    import_learning_path(jsonb)    FUNCTION     �  CREATE FUNCTION public.import_learning_path(data jsonb) RETURNS void
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
 7   DROP FUNCTION public.import_learning_path(data jsonb);
       public               postgres    false            �            1259    16652    attempts    TABLE     �  CREATE TABLE public.attempts (
    attempt_id integer NOT NULL,
    student_id integer NOT NULL,
    subject character varying(100) NOT NULL,
    skill_id character varying(100) NOT NULL,
    subskill_id character varying(100) NOT NULL,
    score numeric(5,2) NOT NULL,
    "timestamp" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT attempts_score_check CHECK (((score >= (0)::numeric) AND (score <= (10)::numeric)))
);
    DROP TABLE public.attempts;
       public         heap r       postgres    false            �            1259    16651    attempts_attempt_id_seq    SEQUENCE     �   CREATE SEQUENCE public.attempts_attempt_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
 .   DROP SEQUENCE public.attempts_attempt_id_seq;
       public               postgres    false    223            s           0    0    attempts_attempt_id_seq    SEQUENCE OWNED BY     S   ALTER SEQUENCE public.attempts_attempt_id_seq OWNED BY public.attempts.attempt_id;
          public               postgres    false    222            �            1259    16628 
   curriculum    TABLE     �  CREATE TABLE public.curriculum (
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
    DROP TABLE public.curriculum;
       public         heap r       postgres    false            �            1259    16627    curriculum_id_seq    SEQUENCE     �   CREATE SEQUENCE public.curriculum_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
 (   DROP SEQUENCE public.curriculum_id_seq;
       public               postgres    false    219            t           0    0    curriculum_id_seq    SEQUENCE OWNED BY     G   ALTER SEQUENCE public.curriculum_id_seq OWNED BY public.curriculum.id;
          public               postgres    false    218            �            1259    16642    learning_paths    TABLE     �   CREATE TABLE public.learning_paths (
    id integer NOT NULL,
    prerequisite_skill_id character varying(100) NOT NULL,
    unlocks_skill_id character varying(100) NOT NULL,
    min_score_threshold numeric(5,2) DEFAULT 6.0
);
 "   DROP TABLE public.learning_paths;
       public         heap r       postgres    false            �            1259    16641    learning_paths_id_seq    SEQUENCE     �   CREATE SEQUENCE public.learning_paths_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
 ,   DROP SEQUENCE public.learning_paths_id_seq;
       public               postgres    false    221            u           0    0    learning_paths_id_seq    SEQUENCE OWNED BY     O   ALTER SEQUENCE public.learning_paths_id_seq OWNED BY public.learning_paths.id;
          public               postgres    false    220            �            1259    16725    problem_reviews    TABLE     �  CREATE TABLE public.problem_reviews (
    review_id character varying(255) NOT NULL,
    student_id integer NOT NULL,
    subject character varying(100) NOT NULL,
    skill_id character varying(100) NOT NULL,
    subskill_id character varying(100) NOT NULL,
    problem_id character varying(255) NOT NULL,
    "timestamp" timestamp with time zone NOT NULL,
    unit_id character varying(100),
    unit_title character varying(255),
    canvas_description text,
    selected_answer text,
    work_shown text,
    understanding text,
    approach text,
    accuracy text,
    creativity text,
    score numeric(5,2) NOT NULL,
    evaluation_justification text,
    feedback_praise text,
    feedback_guidance text,
    feedback_encouragement text,
    feedback_next_steps text,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    problem_type character varying(255),
    problem_text text,
    correct_answer text,
    success_criteria jsonb,
    teaching_note text,
    cosmos_rid character varying(255),
    cosmos_ts bigint,
    analysis text,
    feedback text
);
 #   DROP TABLE public.problem_reviews;
       public         heap r       postgres    false            �            1259    16622    students    TABLE     �   CREATE TABLE public.students (
    student_id integer NOT NULL,
    name character varying(255),
    grade character varying(50)
);
    DROP TABLE public.students;
       public         heap r       postgres    false            �            1259    16693    subskill_learning_paths    TABLE     �   CREATE TABLE public.subskill_learning_paths (
    id integer NOT NULL,
    current_subskill_id character varying(100) NOT NULL,
    next_subskill_id character varying(100)
);
 +   DROP TABLE public.subskill_learning_paths;
       public         heap r       postgres    false            �            1259    16692    subskill_learning_paths_id_seq    SEQUENCE     �   CREATE SEQUENCE public.subskill_learning_paths_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
 5   DROP SEQUENCE public.subskill_learning_paths_id_seq;
       public               postgres    false    225            v           0    0    subskill_learning_paths_id_seq    SEQUENCE OWNED BY     a   ALTER SEQUENCE public.subskill_learning_paths_id_seq OWNED BY public.subskill_learning_paths.id;
          public               postgres    false    224            �           2604    16655    attempts attempt_id    DEFAULT     z   ALTER TABLE ONLY public.attempts ALTER COLUMN attempt_id SET DEFAULT nextval('public.attempts_attempt_id_seq'::regclass);
 B   ALTER TABLE public.attempts ALTER COLUMN attempt_id DROP DEFAULT;
       public               postgres    false    223    222    223            �           2604    16631    curriculum id    DEFAULT     n   ALTER TABLE ONLY public.curriculum ALTER COLUMN id SET DEFAULT nextval('public.curriculum_id_seq'::regclass);
 <   ALTER TABLE public.curriculum ALTER COLUMN id DROP DEFAULT;
       public               postgres    false    219    218    219            �           2604    16645    learning_paths id    DEFAULT     v   ALTER TABLE ONLY public.learning_paths ALTER COLUMN id SET DEFAULT nextval('public.learning_paths_id_seq'::regclass);
 @   ALTER TABLE public.learning_paths ALTER COLUMN id DROP DEFAULT;
       public               postgres    false    221    220    221            �           2604    16696    subskill_learning_paths id    DEFAULT     �   ALTER TABLE ONLY public.subskill_learning_paths ALTER COLUMN id SET DEFAULT nextval('public.subskill_learning_paths_id_seq'::regclass);
 I   ALTER TABLE public.subskill_learning_paths ALTER COLUMN id DROP DEFAULT;
       public               postgres    false    225    224    225            i          0    16652    attempts 
   TABLE DATA           n   COPY public.attempts (attempt_id, student_id, subject, skill_id, subskill_id, score, "timestamp") FROM stdin;
    public               postgres    false    223   ��       e          0    16628 
   curriculum 
   TABLE DATA           �   COPY public.curriculum (id, subject, grade, unit_id, unit_title, skill_id, skill_description, subskill_id, subskill_description, difficulty_start, difficulty_end, target_difficulty) FROM stdin;
    public               postgres    false    219   ��       g          0    16642    learning_paths 
   TABLE DATA           j   COPY public.learning_paths (id, prerequisite_skill_id, unlocks_skill_id, min_score_threshold) FROM stdin;
    public               postgres    false    221   ��       l          0    16725    problem_reviews 
   TABLE DATA           �  COPY public.problem_reviews (review_id, student_id, subject, skill_id, subskill_id, problem_id, "timestamp", unit_id, unit_title, canvas_description, selected_answer, work_shown, understanding, approach, accuracy, creativity, score, evaluation_justification, feedback_praise, feedback_guidance, feedback_encouragement, feedback_next_steps, created_at, updated_at, problem_type, problem_text, correct_answer, success_criteria, teaching_note, cosmos_rid, cosmos_ts, analysis, feedback) FROM stdin;
    public               postgres    false    226   ^�       c          0    16622    students 
   TABLE DATA           ;   COPY public.students (student_id, name, grade) FROM stdin;
    public               postgres    false    217   "      k          0    16693    subskill_learning_paths 
   TABLE DATA           \   COPY public.subskill_learning_paths (id, current_subskill_id, next_subskill_id) FROM stdin;
    public               postgres    false    225   S      w           0    0    attempts_attempt_id_seq    SEQUENCE SET     G   SELECT pg_catalog.setval('public.attempts_attempt_id_seq', 511, true);
          public               postgres    false    222            x           0    0    curriculum_id_seq    SEQUENCE SET     B   SELECT pg_catalog.setval('public.curriculum_id_seq', 6504, true);
          public               postgres    false    218            y           0    0    learning_paths_id_seq    SEQUENCE SET     E   SELECT pg_catalog.setval('public.learning_paths_id_seq', 748, true);
          public               postgres    false    220            z           0    0    subskill_learning_paths_id_seq    SEQUENCE SET     N   SELECT pg_catalog.setval('public.subskill_learning_paths_id_seq', 664, true);
          public               postgres    false    224            �           2606    16659    attempts attempts_pkey 
   CONSTRAINT     \   ALTER TABLE ONLY public.attempts
    ADD CONSTRAINT attempts_pkey PRIMARY KEY (attempt_id);
 @   ALTER TABLE ONLY public.attempts DROP CONSTRAINT attempts_pkey;
       public                 postgres    false    223            �           2606    16635    curriculum curriculum_pkey 
   CONSTRAINT     X   ALTER TABLE ONLY public.curriculum
    ADD CONSTRAINT curriculum_pkey PRIMARY KEY (id);
 D   ALTER TABLE ONLY public.curriculum DROP CONSTRAINT curriculum_pkey;
       public                 postgres    false    219            �           2606    16637 %   curriculum curriculum_subskill_id_key 
   CONSTRAINT     g   ALTER TABLE ONLY public.curriculum
    ADD CONSTRAINT curriculum_subskill_id_key UNIQUE (subskill_id);
 O   ALTER TABLE ONLY public.curriculum DROP CONSTRAINT curriculum_subskill_id_key;
       public                 postgres    false    219            �           2606    16648 "   learning_paths learning_paths_pkey 
   CONSTRAINT     `   ALTER TABLE ONLY public.learning_paths
    ADD CONSTRAINT learning_paths_pkey PRIMARY KEY (id);
 L   ALTER TABLE ONLY public.learning_paths DROP CONSTRAINT learning_paths_pkey;
       public                 postgres    false    221            �           2606    16650 H   learning_paths learning_paths_prerequisite_skill_id_unlocks_skill_id_key 
   CONSTRAINT     �   ALTER TABLE ONLY public.learning_paths
    ADD CONSTRAINT learning_paths_prerequisite_skill_id_unlocks_skill_id_key UNIQUE (prerequisite_skill_id, unlocks_skill_id);
 r   ALTER TABLE ONLY public.learning_paths DROP CONSTRAINT learning_paths_prerequisite_skill_id_unlocks_skill_id_key;
       public                 postgres    false    221    221            �           2606    16733 $   problem_reviews problem_reviews_pkey 
   CONSTRAINT     i   ALTER TABLE ONLY public.problem_reviews
    ADD CONSTRAINT problem_reviews_pkey PRIMARY KEY (review_id);
 N   ALTER TABLE ONLY public.problem_reviews DROP CONSTRAINT problem_reviews_pkey;
       public                 postgres    false    226            �           2606    16626    students students_pkey 
   CONSTRAINT     \   ALTER TABLE ONLY public.students
    ADD CONSTRAINT students_pkey PRIMARY KEY (student_id);
 @   ALTER TABLE ONLY public.students DROP CONSTRAINT students_pkey;
       public                 postgres    false    217            �           2606    16700 G   subskill_learning_paths subskill_learning_paths_current_subskill_id_key 
   CONSTRAINT     �   ALTER TABLE ONLY public.subskill_learning_paths
    ADD CONSTRAINT subskill_learning_paths_current_subskill_id_key UNIQUE (current_subskill_id);
 q   ALTER TABLE ONLY public.subskill_learning_paths DROP CONSTRAINT subskill_learning_paths_current_subskill_id_key;
       public                 postgres    false    225            �           2606    16698 4   subskill_learning_paths subskill_learning_paths_pkey 
   CONSTRAINT     r   ALTER TABLE ONLY public.subskill_learning_paths
    ADD CONSTRAINT subskill_learning_paths_pkey PRIMARY KEY (id);
 ^   ALTER TABLE ONLY public.subskill_learning_paths DROP CONSTRAINT subskill_learning_paths_pkey;
       public                 postgres    false    225            �           1259    16670    idx_attempts_student    INDEX     O   CREATE INDEX idx_attempts_student ON public.attempts USING btree (student_id);
 (   DROP INDEX public.idx_attempts_student;
       public                 postgres    false    223            �           1259    16673    idx_attempts_student_subject    INDEX     `   CREATE INDEX idx_attempts_student_subject ON public.attempts USING btree (student_id, subject);
 0   DROP INDEX public.idx_attempts_student_subject;
       public                 postgres    false    223    223            �           1259    16671    idx_attempts_subskill    INDEX     Q   CREATE INDEX idx_attempts_subskill ON public.attempts USING btree (subskill_id);
 )   DROP INDEX public.idx_attempts_subskill;
       public                 postgres    false    223            �           1259    16672    idx_attempts_timestamp    INDEX     R   CREATE INDEX idx_attempts_timestamp ON public.attempts USING btree ("timestamp");
 *   DROP INDEX public.idx_attempts_timestamp;
       public                 postgres    false    223            �           1259    16640    idx_curriculum_skill    INDEX     O   CREATE INDEX idx_curriculum_skill ON public.curriculum USING btree (skill_id);
 (   DROP INDEX public.idx_curriculum_skill;
       public                 postgres    false    219            �           1259    16638    idx_curriculum_subject    INDEX     P   CREATE INDEX idx_curriculum_subject ON public.curriculum USING btree (subject);
 *   DROP INDEX public.idx_curriculum_subject;
       public                 postgres    false    219            �           1259    16639    idx_curriculum_subskill    INDEX     U   CREATE INDEX idx_curriculum_subskill ON public.curriculum USING btree (subskill_id);
 +   DROP INDEX public.idx_curriculum_subskill;
       public                 postgres    false    219            �           1259    16760    idx_problem_reviews_cosmos_ts    INDEX     ^   CREATE INDEX idx_problem_reviews_cosmos_ts ON public.problem_reviews USING btree (cosmos_ts);
 1   DROP INDEX public.idx_problem_reviews_cosmos_ts;
       public                 postgres    false    226            �           1259    16747    idx_problem_reviews_score    INDEX     V   CREATE INDEX idx_problem_reviews_score ON public.problem_reviews USING btree (score);
 -   DROP INDEX public.idx_problem_reviews_score;
       public                 postgres    false    226            �           1259    16744    idx_problem_reviews_student    INDEX     ]   CREATE INDEX idx_problem_reviews_student ON public.problem_reviews USING btree (student_id);
 /   DROP INDEX public.idx_problem_reviews_student;
       public                 postgres    false    226            �           1259    16745    idx_problem_reviews_subskill    INDEX     _   CREATE INDEX idx_problem_reviews_subskill ON public.problem_reviews USING btree (subskill_id);
 0   DROP INDEX public.idx_problem_reviews_subskill;
       public                 postgres    false    226            �           1259    16746    idx_problem_reviews_timestamp    INDEX     `   CREATE INDEX idx_problem_reviews_timestamp ON public.problem_reviews USING btree ("timestamp");
 1   DROP INDEX public.idx_problem_reviews_timestamp;
       public                 postgres    false    226            �           1259    16711    idx_subskill_paths_current    INDEX     m   CREATE INDEX idx_subskill_paths_current ON public.subskill_learning_paths USING btree (current_subskill_id);
 .   DROP INDEX public.idx_subskill_paths_current;
       public                 postgres    false    225            �           1259    16712    idx_subskill_paths_next    INDEX     g   CREATE INDEX idx_subskill_paths_next ON public.subskill_learning_paths USING btree (next_subskill_id);
 +   DROP INDEX public.idx_subskill_paths_next;
       public                 postgres    false    225            �           2606    16660 !   attempts attempts_student_id_fkey    FK CONSTRAINT     �   ALTER TABLE ONLY public.attempts
    ADD CONSTRAINT attempts_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(student_id);
 K   ALTER TABLE ONLY public.attempts DROP CONSTRAINT attempts_student_id_fkey;
       public               postgres    false    4781    217    223            �           2606    16665 "   attempts attempts_subskill_id_fkey    FK CONSTRAINT     �   ALTER TABLE ONLY public.attempts
    ADD CONSTRAINT attempts_subskill_id_fkey FOREIGN KEY (subskill_id) REFERENCES public.curriculum(subskill_id);
 L   ALTER TABLE ONLY public.attempts DROP CONSTRAINT attempts_subskill_id_fkey;
       public               postgres    false    223    219    4785            �           2606    16734 /   problem_reviews problem_reviews_student_id_fkey    FK CONSTRAINT     �   ALTER TABLE ONLY public.problem_reviews
    ADD CONSTRAINT problem_reviews_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(student_id);
 Y   ALTER TABLE ONLY public.problem_reviews DROP CONSTRAINT problem_reviews_student_id_fkey;
       public               postgres    false    217    226    4781            �           2606    16739 0   problem_reviews problem_reviews_subskill_id_fkey    FK CONSTRAINT     �   ALTER TABLE ONLY public.problem_reviews
    ADD CONSTRAINT problem_reviews_subskill_id_fkey FOREIGN KEY (subskill_id) REFERENCES public.curriculum(subskill_id);
 Z   ALTER TABLE ONLY public.problem_reviews DROP CONSTRAINT problem_reviews_subskill_id_fkey;
       public               postgres    false    219    226    4785            �           2606    16701 H   subskill_learning_paths subskill_learning_paths_current_subskill_id_fkey    FK CONSTRAINT     �   ALTER TABLE ONLY public.subskill_learning_paths
    ADD CONSTRAINT subskill_learning_paths_current_subskill_id_fkey FOREIGN KEY (current_subskill_id) REFERENCES public.curriculum(subskill_id);
 r   ALTER TABLE ONLY public.subskill_learning_paths DROP CONSTRAINT subskill_learning_paths_current_subskill_id_fkey;
       public               postgres    false    4785    225    219            �           2606    16706 E   subskill_learning_paths subskill_learning_paths_next_subskill_id_fkey    FK CONSTRAINT     �   ALTER TABLE ONLY public.subskill_learning_paths
    ADD CONSTRAINT subskill_learning_paths_next_subskill_id_fkey FOREIGN KEY (next_subskill_id) REFERENCES public.curriculum(subskill_id);
 o   ALTER TABLE ONLY public.subskill_learning_paths DROP CONSTRAINT subskill_learning_paths_next_subskill_id_fkey;
       public               postgres    false    219    4785    225            i   �  x����nT1@�ݯ���<=��d�R� M����"�/��&�އp���u�:��[�xxxz�����󏯿����?�ty�n ���v(�IH	 �W9��0.o�P�2Cn8�!�yHE-0�L�xq�Ǘ��/��J������Ǉ���t�n����rF�FK�������U��iJa��d)5X��B�T
�F�����9�RQ
1���I�0+"�)�$��(^����L�[�>!���Ò�� -��KK?�I�崁.�}|����Q�.\Gv^g
X��jH�1w޾�������4X�^���񁜪X��_꼥�������L��5�R��t;Oj�,Y��{�w�-A7L��R�盉�
�7��y'U���sÍZ�����D�_����^�ql�S &�7j�vk]�%e��ڷ�Qym��BE�񍚱��	}�c!
�1�ge܌M�р�j=�q5l'��*MaT���s�����T�5ܨ���D�^�>������0�.z�!��^(�����Z�tsԞ�+̸�ټ�`
*��Py�j�緣�/eÆ7��p�Hq�=��zt�b�^��|�\Z�ޚ�qnT��v�X�yT-����Z\�Tη@���y��^\���=�������b��8��xm�ø����bFy�/�x<���      e      x�ͽyo�ֶ'��Χ�3�(WN��ƻ��<�s2T�*'ݍ4(��S������ߚ�@n��)9n�ޓ�DIk�a�뷆�Q��,���W��d�%�u�^?��:��ת�E��׍7��l*�w~�l�'��u���7��w����K��<���O��;��gߏ��`��?ʺa<� ���˲`���<�e7֛��.o��wg+ -��;;�L�F�?���o���΍�
�^���i�"��B3�z?�v7I<��y�3�k���N�4���H�y0#�-^���d?^��ȇ��u�f��z��S�k�d������b�b��4BY�x��ɓ7��n6~����,�����f��0y�9G��?}����8��<��� ��%�Ű|���l��8�c���qr��G~��$���}0�o��u�/#X�.P�] ���R}V~�t�Ro�u㈮G���� ��5^|
����~�X��p|�v�ߘ��o���,	�>��z���8Y3'�x��/�>��C|v��o��m����b�����0�� �R��H%f�8��`���9�w�'�D��Uw	/�s�4܏ qӸ�v��u�'?͂%���Y������x�{�e�~'�S�#[�����՜�Xގ���x�}	�����ͼE���uӕ��Zb�}��"�X�ҕ��8��A�E�76�@(���7>��b�����l����`]��y��R-?н�����7JT*�A<�� ���QJ��W��2�Q�;�����U�����z�˳�"j+1�:�a��������Īb��ްDBA�[�>n��Y�s`	?�U����:�b������u���#}8���b��p�6qJ��+wa?�簡]>e���J��/��7��=��nf�Z( n�d��/.sw���f/����=T��>|"��9�Db~c"��E�Evn�e� ��ې�o�l�a���xտ���z8�5UǊ�h�G�g��;*�XtÒ8^w3/���[Sf�|2:�� �.�@�}B�������f�������"�G��^|Y�Q0�������~
.�-y��?��S�O(�{��W+	��&F�P��nD{L/��'��g?tl��	#|�;�%@U��p�$�<��~��qN/��-?������)�,W!'%+�8Z��ҏ�� $�b���& �E�H˫hM�5"mM��[�'h��4�v>m6p��ҝxd|v�6y4�r&�����?r�N����<����+��g6q W�E�X�K���o��D ����Vw
L͉V0��]�6�m�Y���>�3/�
������uH�8A㚴�,��Ĝ���|�=�1�r�E\%^$��sd,=�e�7��ė��/���|CAD�=�� }61�'|l���)�E�#p�A��B���7&�t�����(�aC_��aβ��tubN��Y&xQg�F��D�U�ء�����%I��-!�[Q�gI����Nc+�)x���X&�L��owQg���;}�8( $Q(\�$��R� �T<W�;�Q`Sx��?���S��Ë:��0��k�B }Ɛ�����;x=|әxA ��:� ��x�]F���0�����c4�OwW~�5��%8F�lɢk�+����rzlT��@)�e?��b�h��:��g�4�d۽�xC��ޤ!�Q?�^�d��c����9�����M&����n�PDۏ��Ï�`�q�/A:,�����,��?q���K�Wq����4�(M���ha�{���/�OH�I0CW	4������{�(���5/]�<Zx� @�^)9K@u��Қ�+� ���Kd����{3�-�!�/[y6#��V��<�s��j:%�T�F��Қ���8�73j[�n6�-�_pkх�q蟂8ؖݼ���#���f%����o�Z\�ݟ�R> 
�F?���_,x�����d���%��� ��C$�r��=��X$�yѶ��+R_�op�����+u��7v�$�AmNt��y����I'(�'��AB��pm�L�H�Q$�n��/%��6ß�g+EY��?J�R��|t	�v<`˿f9�XKr�+q<)��FVz�����O�B�b9|b�:O��4��6S0��0@�g$�(d��Dݚ;sB(�獖�X{���t+/v��<D���?z�J8�%FZL�<Ч>�X�b�T�\��EX��OA��?I:����`ރ�{�1r�f]�Ӱ��f�g�����๳��@`��]���xV��@{����;7Jk�����x��Y���o�?W��H�8ŀ�y@�8P�_��?��}�*���3}��=y����K�`Ț�����(�g3J��� ςd�J�D�X�4#�b����^��Jp�͟+t'4r�GV�p¾j�'�B�[�����Z���H2%R�J�$����0��3���LHl������6f^)ƕ⃍k�h��%05��Q�g�����`��xT���������ǧ�9�rOg�)ɲk*d�����g	:`IDr��!�tda�A]������b�]	Ë7����1�)�����zp"#���1���~C�5X�󨋁p�-n����rO�Q���u�q�C"]�m�*Z��I��}��@�iW�̄�nE@$4ˊ�¶��mc���ƍ���[	����b�Q/Bo����<�C �*��X��N����r�F�|;&W�G��P+���S�փ)�	�������2�P�Ý���<q������t'fЄ�0 -�C��1�Kc�=�곂�U~7$-������/ވ�b��إ�6��6�|���c���������U��Gf5�Io�h#���8�ܹ�rr��OM@Zd��=V&�E�z����0�,���6�>���[��qR��K�cpn�%Hj�`�9��F�0��w�',U����䇵�D�Eو��R���B}��EgD�=Y�bB:�J2���6*����P�"��T��gE]�+K�������p��ԃ��<t�N $>�-������L���C�=���es�vo�o˫?3�r�_2�6bw���1l�7/�CosHN�E(�z��t��{�)���s��с_���u���TO�a-?�BS�u��6s n���lH|\J� l��6�?:P�������ɜlk�Ո1�`��(�ñr�N�ږ����I�7|P�^��:�;_�_Xmt�H!+#���u��DE�0]�Nꌾ�l��n�����,X��*�����`�
s)")Ѝ�����vD�Z\ܑ�G䒂�^wퟕ�������py+�Μ��ե� .֓�E)Nn� �tB��axv~տkKOT�5ש�{`�\@s��$x=$�����wO�6�]���z9<4��ͬ]���V�gT«�!�5��4��b��<�NG�+��z1{�␔���F`)�
�fZ���&[V!��z1S7��?3�y�t�(2�&VՆ�i�'m3M�:����@1��s��Y	���/U��_�+o%ge9����@%�����G'�TȔx1�w�Of��ԙ��Z�ʆ�E��@vċ��O���3�V��	ެ�!�Ax
χs�C����dD��Xa&��a3��'!������!�8�J�����"�}^��p�D{�<���Y���
ԗ���GX$��ۄ���zzQ*��(��|]�7>�i�zƮ�㶴b��[�{�<���ʡX�� �8�Ց����<e\瀟�
:q��Y�mX)���PV/���i�s����&P;�Q�âq�qp6�D��4񒭛t��B�f�Z�!7=nY=_�Vw��x�i�*P�w������6�y����m"}I��5��޳��t���P�;M@����j�o;_t؛*��O1K���y�UO����\1u ���b�sK�7~�$����4�Jdn�	�]�傹\#��>�c��qx=w��ܑn˝c��ox=ww�O��'�� H�'�6�����    g����l�q�o�Y��a��d�^�h\e�w�Yρ�aQ�V�I��}w��p�{�O���hI�a��}���5����J��y�r�g�L�j�&���Q�nɿ��d*��O���wa�W�˸���/O���"��r[�r��t�UR�ob���Cy�L�S��oS">�;3_8L��P/\�+�s�P��V]���kNjܑC�zS�X�:���E��mH��
�7߂�Pe3e�:�qI�ҭIe`ՠ���.Y�.�2N1�n)�g����I�rN�����DH�a���#��"��j�St
���O
�rĤ���W��=ukz���髄T���\�]�վ7�+����6��`��>~K��}XM��U�{s�@��-�y6y�_�oQ=�*���.�冑�������a�;��w0zTH�R~k��h��[�ɧ!�#?�������L|��tU��m.^},�+�����Tf͟�Z�8� ���n��?��߂�rϚ,��M��eT���_~j�#V�x%��Tc@��7���SQ=	���ܳ?��b#�)>u�����ʘl�߭�d��0Z��bG6ZZ0�c:*���VFc{fv��j�b)�&�J�c��#!�K'�I,���L�����I��8L�*<�7�슪��Xf��~�r��5���O$����I���x���D#�Ɣq�3��Q7����S�`���A�W����ȏ�4�Z�����<[�����.�5��eL�]�y�����F��-]�-c8$�˰ڈ��ͧ��
�``�(�U�0��2� �b9���ҿ����W.���D�8.����٭±|�?�I���Q��57�]��M��Q�w�k'֯:}�{ ?VV��5>�,��.!�u
5B��8�P
���8)�����B��sT�e���.kqKFX2�rK�@Q�v���ju����C�D^̨~���e���.��O?X&�P
Z�G���R��z-R�± CoZe�\�x����=ns���G��}��C@�:�/ ��H��ʆ�e����P�Bx1���S6�;tb��Z���)f)֙��j��2����5\��}&Ɣ�������4c�ñ��\e��]�R���XQu�5bhy�����L�:����+^J�-��m(�ˢc�t���=B؎��ϫ ���K�R�#�)����m"���;��G�,�zS�¥�ѭJ���?F�K*mp��z)����� �[�"�!�_QKc{�ˇB)}v��[/;���keo����V{b�����A1�'�U������x!�Vl��6���BJ,9�nfp��Nnf��<f1(��]�oV��B_�t�A�nR�������]�m{����*�g{+�f��7tC?Zf+�KG�T3�h=V��^������q���xh3#"�FLk�#F��k���Q��������������bHx4)�+iT��H%H\I��Bm��V���=�anAQ�҇HPl�g9��t�@�����8�������ˁ���ޚ���;E�p�0N���c��2L�=c��X1g�'�yR����6�m�wh���{�o��<OD��j}���7�h��J�n�D6(W�5��mK�:�?����Na'Yϔ���%b���`lsl�3��2���ճ:X���eH�=)�v�-mDL:B�W�eٵg0R�4���p�6�����il����B}�q=<�SnO�U��S1-B�Z�[���X����%��@���#w��n�~p�;�˂C���T��X@�su/"pm3ml8��@u�-y���s�N
���B�c��YO|�5��)��ܟysӁR�D�{[�/��W"ϷԲM��x��CkK5�@eH8�������0&���
�J|pL���Y���*�B�-Ǆ9���~'ƌ)�G�N�_��\Y�*��o�s��u�2&�*���(._�.?�ێ�>��7cTX�ZĂ ����hB}@\�&��^�r)����P7���foD�G���7���+_��h�b�Hj�
At`�I����ؓ;k�;��9���5 e��`K7�����E#.��Be;)f���\��� _��m�NQ����1���D��X;÷6�/�s�{o3���j0��Q�	e&@+
2�{0h�G\s��C��c1�C�a SȂqpL.�n 8�����aS*�!1Qπ$Gޓ�)��v�j�+�#^vB���eby΄��I%D�x�n���b�ƀ�����Y��'ԕA��sk�%J/T��ެ�G`Ԍ�2�B�߶�7��~��xD>c���G8'�}�1\\3�ͧk4�	M�,��������С����FEƨ�����˳���ƙa��D�� ������I)�ݔ���8+d���!m( ���w���b�C�_�����gu���6�����P�U��>����W����`����L* ��� ���~�L�Q�	�ZM}�礡) �&	�%"R���9����x��ׁH�'���2ʇM�E�ۈ��Q�����pc�����i���v�^��,4o� g��r�FnU ��,F��"6��
�v�&�o��Q�)�B���M����"۽��>��K�H��Eὑ�@�qbѸ�oo���1vl=��Rl.){��ɠ��Z1<al�tE ��pp߱�{'+�X�8���Գ���~����?_��g�"E����RB�F��G���g�s��Ao����mZ>����"�z°�"�
So�7J��P8ӵ�*��G?�sֹHr�T�#����:&o�F�8����V�,�b��Gf���Ι���L8H3�dVE�m�
��#Z��c� #��(�m]U�@��:Ɩ�V������.D�#�طl;��K�\|�j��o�~[�!�5F�R�*O�qwd�`o���M�W`���Ƅ�S*���L�@yqɀL(t��`o���m��,°_���R�'k��^�9��T}Ґ\s��[m5sc썙~�hmX|�N��TsQL8("��ޚ것wT�	����`b|!�$]1� ^$�)��h�.pT%6�ǌ����`���1/{+�F��.R��vC��BVQ#P#.��C����PiMG 쭔�6V���+Omc�F"�t��Ε-`أ�Plm��*��U�=��=���N�)o��?�V��m slV�g�1�{�?Y�-(
u"p=~(F�A�q�%��Ś$�mv-��S��`)ĨigI�%m<�5겉���;J��?Ʀ)���`��a�0���[�6�S0�Cx�ꂨtM񞱾\f�Ҍb�~W��"'���5���<!u��5'N�%�����o?�"7d�q�4�Q��w�ė�@��z�g!��b��F��'�g!�ػ�
�>���TWq�/�*m[�G���R��x�HGͅlgbU����9���>���3���nV|Ya�z�ⳅB0�# 	c Pz3/U�/S�SN߸�?ݽa5h�j�w����2��w��λ2��w����2��B��&:?��|:��|(�y~�.�~�D�����B迚��Ch�]����B�B�M����>J�&Br}��s�?;���Z��D�����K������:l�U;U������{�c-���5{ 47�|,�*�C(�<�����sZ�b��Ve�� !S������vGE7OfhI��5.6~���HQ`��.�h�f�8�I������ƴm?@���U�D�K&�ƙS���p�[4�b]a��~��$�@�P2���� �ZG>ƪ"�\*��!8G�'�����r�Q&��S~f�:��-Mb,[?�Ŧ��<�D%��
���!�ƊĻ�~@�H^�+<VTM�<M}l��)D�{j&�>����ԕ���2ҕ~�t�1�*41	�㟽����ᠮD���!X��:�i~;��ټ�qJ�W9�(X{�%/�4h0v؞�~$Y��|̟cZ/�
�=���A]i�+i�q�1�gE�E�x�,    �R���C3Q�ٽ���/-M�v�2uE�$�V7 RՎ�!E��R���N�qO�dFz�ThI\us�_I�]	�Hh���zٹ��@�����p~�.G�}��$H�%���R)���Pz��n��Cc"���ó���j�%���~�.�^]T�|Z�'~���T�Hw�f���E�q���K�3�Y�����(#�Ɋ6[LYy�rk��޹ökpU����a�I9MG���[�e@�?HEU�r��b�c�E����+"ʔ�BilM�"3��: V����B.�NC���F�b�ju�� G�������20��޹ȶ�ݪ"�ӑ��Rv�[���p'l\읚l��]ᶪ�5]���H�gE�kMTӳ�(+�2_��T�j�K3���P~�[�}����:��ϝ_��r�4	��h��?]�o�E$�<�v|��\O������HN��(�����j6�Y#L�	��r"T{�\�$,���p�q�Ө��|�)�/�KUS�s�0�QG,�	�q�v:i�H���^wϲ89�0�S��-��{O}k��N��T�s��$�]�SZ �f�����"�o��������:f���0�M�KR�<��բ�wcϋ��{G4��0�N��S#����k�sG���{�꼈��2`�Ty�p7}��BƩ l �?�z��=�^�y�
��\sT��8�[� E#�P�+y��5�a�A�ׇq^A+�7�W��Kų`5�4_s�k��^4�+�!��^ZnS�n?�� ��z�ŀ��8v��;_7~*Uz��k������j?lᗵ5PAh��}�ܹ��c�p5PED����ޒ���o�/�sl��!8�+d��4���peX���+�0�P'[�*�o͋��k�wXF�M0�T
��X�
ð"x>bâ�y�
��=n��<%܇5H�������U��A���an����rYn����qS�O[qy����3���F#G��b%R��)ĉ���[�
�p�Ge:���Q���+��8��׵���O��3�$�W��Y�5�'����|<t��kp�P|B��b�	o����2��=�i�u�Kw�(�������6����Q�֐:���+P�(dS>ˑB�g����|�ҋ(bu�>�@�A=��;��~��b�x�9ZcH���8��[j;�?3y	9I�����roI�J�����p+�1�K��i�����U��XX83�&��ɬsqmb-��Ֆ6 �l����{����,�c�O.'��Ƒ���S�2"�a�:��(�u�:�YXx&��]����VAh��9��lt��m竀+u������d�=�Cf���f'�3�{F��b���ѣ80�w��hE�E��!;ƼE&��j�j�@R�Q��
jR��-i�>��b��'.����z�.�װ�����a��	4�K��1m@�E��g'6;{��d3da�Dm��xF����:�򬸙V#��R!CX���ұ0�h|;���&C�
mf�mH8dS�� �h��o(hi�.���z\-9���ټ�]�����Y�҂���V.N��t+P&k.˓�ʃD�����z���fM����8k�=ZprM�\�J��gOx��PG��DLȦM�3F0��瞜(�1����8V��Y�т��YU��\��0|��2VE �bn���A@#Ji��W��VYDg��D^8�#�����N����8O�v�l3��C�������Y��Ђ�;I���1S� ,���K�S;s�М%�>=OL���Н(��Y�UЂ��R���ĨLe�ǩm�}a�TU&���Fe߂������,��	/#�"�(h�o��p� ��\!lJ�+#�jV��Q�����i��Y��~W�8��!��z<h[m3?D�.���8oT�-(���(@�3|PU�����+ҟ�g�dDm���+K6/��B���E��{��;b-��|J��m��r𜴱S�{q�����(kZZ��mK�@������L�	;�{��67��k����d�#�Ҏyah-��L8om&����C��J�E�R��Ħ���06�.�6I	��i[�|*�omԓ�r�B�)�ƒ5	�P���(A͉�q�n�<@L�#1
��6�	��|�$�U�S�z��:m�R�cg�8>�p��ǣ
{漵aP��N�,|�d,oi�3�]:%�A��7�( ��PO�m��|^��n��K��19��rgk�_Oj�.�
�҄%�j�9��F��C��J�}�J��p��֚��Bf#�P6��9����H�E�����`�	����qTm���m%�M�z>k�Ea �v�N�U�1�VӼɜ˲3�A�uk��U0�|	Ñ/�'�"��A�7A5�ЧăR�݄�m�6|��<�J�~k렉�,\?!�\�a��G��@�R��Z�6��D�M�B������i*	��� ��Nm"���f���y�Vԑ��P��v�;;%{��fm"��R-i½/�Y]w;��cu�xC+�{��
m����[��k�����YO����9�%g����ڳ��2B��F��"7r�E��c8P�Ų8�Hr
��Z�6���>��J_+�x�@�|W����P��W��26J�iq�\Qg�o�t�E�\>�����s�ͷc.�o�d~@�n�X�z�-�k�T�~<�P�3UPF@}km3���X�G������B�q�8��M%�X �O7P8:}�Z��&�KFt��L�U�-qÝȍR�aU ��V6�9P�]�?Ã^jt>�l���,�����njo��s����}�-�M��*~>O�6
��S�� ����M��
A�2�$?��H��X��Z�TZ|�֪e7���a�AV&L���OS3P�N-���騙ak�m7���O��W��U��z0�O�uŸ���'CW�1Vp��b�0��S����n�;���=P�"���4~�?�4���6 ���
��9M��vj䀕v��Y�"E�Q�`�̓��cpz��R��rdW�ƚ&�F� =��+}��TM�qk��0^�朡+$��smY�i�4�C�sbçD<>vSK��ΛA1^����,%�X�e�tu���7�+0s�b����I=�Cr;�L3V�k�gF$�f���dz�\�T�6�K�z������.2?k�il�S2��yu�v�j ���J��KN�b(̪�nm������[�B��M���� 5z�#u&K@����"�[{1jm��;�� ?:���L]�Q�I�U�x�'��l��j����	H����l�qӎ��p쟿�����5h�S������(*��	4Rט`�_���zg�af�����0_�j�:�9���i���6���g�fU�N�(%B��)�QM�{�|k�=�ٚf�e�@5��`���QM�{0>�hK�r���~�W���?\���g*/cQ�MS9����u^�!v+�, /83���^�2'-ׂF5��f{й�J�����@�"kd������gl������P�w�+��X 8���R�j��ߚ�+ΰ�Oi�5�%����%UӢ6_V�n�QM��[3�|~IٗQ�p�Ʈ��\ʑB<��Nxk�n��k��H�-rtFZ�[3r��JJ�(#]8R�������?���z��)���N.׀r�5O��@IuF�"�F:�P��Y��H�ʉ<�O��:>���oq ���8f�,=N5`>f�b��m�d�̩��S�{�	�(�׸��7+�D����o����@�FrHմ&���Y��!�φ�:@��GV��쏿��{���G�����/����P@�����$�A�Iy��E؄(&�d,$ň��F2@N��Ǒ�A��]�����>�anm -� hsp��?�n�E��&�c�x�\*��p0N��t 4�͛Ҏ��R)
�d`�ըJ	�Q��H��i,���K�=]x�a�I�/���g_��
�5,��H�b��`���bC�9(�f�v�y�	��O08+�d����<�b=9h�W��i��n��p    �*^�j�)���H�St;5#��c�a޲I��q�S�L���B�b�V���lW��ǣf`�vl�w~�z��A+ "�QM�L��|�γ��EG����ѕ�u�H� W��A�Q�,c5�ו���gd�L^9��a�x듪�w���Mƙ�P�ؘ��ɂ�_Ř[�	
�2	���Q+����un>|o��Ͱ�{�[�k/;$�(����ʹ���̗��]�g I-���ʪ�p��I��n#bM� [�e�rg�A���A����Q�_Tq���wܒk�%���3j���8�X�� �(ƾl���Xy����3�5]b�q�f�z@tAʒ��e���cx���{Rs��h�y[��`
��qgǇ������w��訊i����~��Ѓ�Z���5O��n���T�xF��@o�W|z���g�=�BFy`��ިO�S´��=�b�\-����cڋ�;Ԭ�jZR���&�M4��fݙ�Y� �P��U������O�B�.$��x��M{���h�C}�z�X̉X��h롿����IMd9�8����	�)���F�Z�~�2�+X��H������5�7!���}So�/�� �p�8�<�F|Y���`\}��ퟮ�ˋ�����+?k�oB�}����(��"����p����w�%ly�d0X����
[6�>Q����إ�ԫ��1�xI���<��&vy0��
��F�J�&y�3�$��ܩa�*��{:�Q��]����8Tv�E:?m�wF���'{��}�D��`�A����"����N4�O?ݰ�qPN��/ ��ȕj����PHUt6�\�K����$������g�p�sr4�gt���h�D�y>�F:�D�����G�XO���0�z�k �\0jU�J����Q몽jW�FU^�ؓ�V�?^��\nI-�꫆��jԺH��hU�*�M��[&>�=.��u\�K��'nc��u�[5�w�%�(|�b"�����*_��ͧ��Tq�j��/�|q��<�u�
�kG�ɤ��{�OS�d��.���i���j˽��FnĔ%��߀4D��h9��+�z�S,Sr�P����F�M�����Ni<J�1�e(�!�D��p�f��ͬF�ol�3�1�,�p�c*��_���b�hy��6%�Ɠ.g�ȸ���b�9��Ӂ�u�л��n�w��hV������w���'m5J�HN'y�1��2����ẋq���j���#�:�˳��`]\̐� 1&*��S[:n]#[M�C��kwE���8JNn�̊��n][M����I�g<<�Xv�G��'k���~:u��ƺ�Q�������xCYz/M���4�܈�:v�����!�h4��er+�SO=�`���P1��bܘqj˗�|;Q��tݿ�n>V#VαkǍ)���0"�V0c 3b��]y)�����y���A盜_zH�_|�s��÷W�6�yq�������!#�hg���uYSgy0����RUH�����	"�.O(Q�VNK����=�e�H�{ (?#��f�i|l�`w�%���:��e�]{0&T�Ǻ��=���#��r+�Q��c�`�޲l�SY�n�a��M�u~�L�#���eF�]G��T/��ٌ,��v#v�_G��j�����qW�r�����v��������|�v��k��-寥�%[y�I�`�n-�ē�V�:�����i����27`�`,+��V�< ��C���(�g�cËy��|��[�e\�*�<t�-�Ŷ��e��r��:�8,?�k�3]��Gؽ����a�m��#���Q�_�0~ifY/p����}tf� �,)�ImS� w
��.x���z?]�'{[�}1���kli�/k��l �`���.xQ9SW7���m3�WRѡ�\&!ts�hMIV��YA��Rh'�e�2g�)���8����c�N��y�`k��˃[�"�$�/J��T�+��<M�訢��yVk��F���d]�$������dM0'V9%�(+h�[���A�\��!I0����b�Y`�����CgN0�yLV����z��{%�u�S	::�RO_PV)Xn��D�����#h��
W�y��~|��-�0�v���^��tSI��V���[��~]�:��K�A��P�s�>�I�E�ˏ`JWQ�w�z��Ԛ��c�ݐ�`�����?���x�i?~�i?^E��J���[�V�/��j�uk����d) ���K�L�y��~ėՕr�X=�S��4�#U\�+�%���=���-a3@�U�ƭ��/���gpO�Vѹ��2�
���RlM�)���~=SqkWr��}�]�Z����\Y�m�Kݳƥ��&������ǻ�n
|�"Y�����o]��,���dn>5en>�37�w���+'�45�V�k�lL�g��p�Cj2maU0��M�����Ԅ���w�����0&T{so�qhI�AZ�������?[E4��b(�x�\�۪|ߩo�j��"�8͕:%a��؜��6���WO�<�5����[K��¡j�Cǭ�ϩn�c6�h";�9�&B/�"��=�"'���%�����L��	h���R�<:�QnY;^�@�������eH�N��b��g/|��i���)w��%��Ҡs��n �&K��P�ߤ��!p�����݃�x4�C��w���q��"�T��Ɫ=�Uwj�ݸ*ߍ�7�z��/E�aR�V*���Q���f��D�J]� ��Ad�8�tS��Sܬ���akP�ݶ��Vp�/B��2�"b�1�"���U���58��ֽ~��>��8�y�(�:q�͘�Z�����[� �b�JA�I��.�.qL
�W������/9�o�J��ќ�V��/��[�[����t	 �h�j3A!��,Wk{�)�������,hJ9�k�W��]��2?�"�~N`	/�sBV�n�Uk�EML�zq��:>�,������N��kUs���T��{���Uf$��{�%l�*����/��mU�mO�*�1���Xr���/�U̫�h�܎؛B������;	���	�㘴��u���U8��s��1rK!R鈠������2�!� �n�t�x�9q.�{���IW��
W�4��"T�>(o���tr����. cC��չ\�{Ƕ��i�WJ�Tx�p��z�\���C���C���/߅ЯM�~uBg�B�&B�9��O��&Bu}�(ο���C��4��D�o��w!�6�?BG�B��j"�9��߅���D��v�T�ӯ?"�?1T�M$�SG�7�'k���w�U��K���wȪ�:�%kwC��5(�5��1�%�lr�:dUk�Òu�D��!�Z���&��Y���d��$9dM��u�a���DօCV�&8,YMd]��A�o��PY
�˧��������d���?��r3��Y��>��`pCL�$�ʏ����Õ�JEj�
�@�n���ԫ���\N�ف�be2a�;��(���Q���U�\�5����ң^�4,U �����Gk��ܚb��qp9Rqy���f庣���`��N D�0+�G�J��i����zp�H���*��ú�Ȯ4ϠC��U<ߚa�`K&�B��O��4��,*��"s5�P��
�s��wظ�@/ə/I W�ZM~V��m�#C\pK�2TMK���c��c����'�Jm�"�»rN�����%�V�O1Q�J��Y�Ѷ��*Nz�
��	v(0�|�'���Uo���Z�ݩh��?E@`?=��S�?���5��k���������'�I��4W�3ÿǂ�o�rs?��-���Mjc:�%���o �yu)�(F��
`���V��� 6��S������IF-).�B�0�����,�.���I��Z��/�8R�ՒM1F�zjtdK�;]qW�3A� B�Sp�i�[)bua�'��O��M�
t�^)`s��s�>��7�e S�_���ײ1R��E�&)�0'̀�a薾D��V 9N	�Q�2Ab�As��ٗ�>���v�wE_J�]1��X����@2F(    &))��$W��V8^�ΊK"���4f!b1�f�&��,a�7�/��>s�6;u�� 9O�b9��'��ԁ��\4i�k9+��tAyZ��r�(?����|���П�M�<_�E�i̔ ��}F�T�E���x�/�v���)���Ta	���a�(�Z[�ִijiھl�� W{+ݙ] @�g�ª5��H��o��{p� 8Zs����ĸ�*�R���ρR��/q�h�Y��0��E�
���#�b���b4�ev��f��J�1H�F#�Ҫ5#(�hxi�`�M� L�M��y�����|zy�(�Z��\�G_�׫U��12�1��T]�r�m�B��5Ţ�0��Vev�X`��z!�|AaL���PO��C�F_�H�U��R�D9�1P�����Ƒgf�h��h��+�[[���J������}C@u�|�r�>C�u����%$
��Tоo����k��£o�m7γ�&(�%Qo���>0G���ԩ#���)J�f��y�=�<I��N1�dV\����!x
"&��KD���5��?���74��U��'�}n��cĘR1�HW����tǽ�!=���W�������YA'�m�؊�@��'5>��*��A������Q6c�s���b�AK�Ia�cu�I!�K�͕�RP��70|���3��z�����}�`��ZAc��{dk0<�֊EaVaduQX��{� �	�W���3��T�R����5�|�ս��*Z�o*�-{xaL�H���740>���a�&9���F$�����@���tprf9+5g�ͤ�f�����L�́Ĩ#GA|,�����ꙁ#�����n|��P��L��OK�y��=3p�ś�1rʀb�
��	V4W���E�ǂ3�鿩����'V5#Y�j9�w�U�l�I�q�[��l�[��g��a��JO$�������f�!���KAQ�$~�?y4�m�1�_bM=�fT27��\2I�*�<QK_��'��S?ň���""eʙ�[g	
]� B�G�*
�Ho��҇�ט�S>�W��in�e�+����x�d"
�+���;/L�P{j�3��j2�+&�M���d���@e�w��w;�to��d�.��5LBz4�(3�+���r���Nh1bu��ywZ�3�l�ܛԞ�r�G����±����<�Y�!�-��m�E�)����@��3��������>��8q4�x2yC��0'�*���K?��7f�/Yb6/�'Qޣ�^y�����3�c��NZ�z1;
�h�]�,�ǿy)�s�?`�G���u�x�#�$e��
-<py���{Ѽ���4�pP�#�Aĝ���1l�2qwD�/m��#1șN
:ч+�y'�����g-;��J7��\j<��� �I�D-`�^�@�|S�=�R�2��n�9E-B[25OHk���&~����ʆ��o>.�[�2�u&Ue�N��|�h�sB�I�1�c���5��;���� ����-���E:�,����m�@G�^4w�����3��:����U#��VpKB�~�[�-,��}�ݭ�Ý�ز���)+ 2��$�N���SL��wU���MQ���nu^�P���
���k��e�䲿ox@����T�x��m:Ɉ\I�)*�����UM'�X=�Y!�]�r�}���,hl'1�4����Sg_&��xf8ְ��}#��ץ����?�O~��~�ʰT�[�5�^v����=��3�����i�j�~�݄��v��E.tj*5
L웒md��Rl��KЊ��x��u�Hѽ%�F�.{�&kٳf�r8 ͱA~���+���TL��6k��b�b��Dbߤm#C�d����p��QΪP["U6���,웻md��Xe�A��4�W��2tZL�傌��|�,n#��kے�ʬ��b�����/��q'���7�;J��@�D��b��&���ba|Oe:O�� ��Veީ��B���o���έN%�;��=�=�?C���y�Dq���D0��NI�J��8��`����j4W]ղ�G@u���3[��88'U�ɦ*�M²[SjƇ˲ِ�:����U�ӛ�ڑ~��E�Z%��j��������4��U��y�M;boK!XU�R��Ŏuw�w	n�gӎ��O^��X��\Ì�O�s]'��K.ܳ�<Ħ��Y�B)���@�XN���y�ݩ�R�h����s��Qs��@�����]����.�%|о�.�r%y><���49�|Q�'�nJ��ŉJ�H�7�=������qa���mʨ��xD1�n�a�c�@pГ�#�k�]����|f�� ���t7Ϩ�$D�5�S�����<Q�O�k	^��J��Mw~��|\U!�K�/��%��=SE�L�k�=t�&u����9�������M��W�	��K�l��/,�����|z�.����)�v>���g�4<�k�ڟ���7_"�3m�	?.�"�M,��!>�-��ܣ���q����@q\�2q��x=��&3��#ƁCٞI1�g�G����>)W3qZ�_nA.�@�0��`}�q�i<>��ߥ� 5$KQ����My�/��W1+�Y�����N>^�!���_l�ŋL��L��Ds>�$�bFi^;\�2�]�Qs����8�ά#|й���y�vS4�7����lק��f.N��QUWq��S�8��!� eW|mA�!�*�C[-]A��sJ�r��-���ױu�7y�Y^������4��d6�z��������@�Ϭx�#a�X0VW8-����z�?q$��J� Y�����Na�y�5jx=�Ϣ�/�\�'�z
����J�YL+��Ŏm��+8�-hb>����g���p��`\E�r3z`����t�~[\A���.��T&���Q&����gO�8�KJdY9ҽ�V�V�J󶰓H��a��Z.�r�
u�)�';3�������mukşK,{
䣓*'�xD�+ߧ�A2��@\p9�'�h�p=�BjNpd{�N��E.!�ZB��61�e�Q�Ѓ��h�'�������ՖO�R}�k�VV`.ZO� ky���'�"C߼k��e�9��Z[�&��uoh�nj��J`25*����.�P3����S��^@�lb� �Y���"ܲu��#P�9,z��Ǖ�v�r��j��m�g: bgƳ�qv��#~�r�*r�]����i�X���[�l`ٲ�6�Sc-9a9��9�̻@�q���Gm�GZ0�8Gd�`	-}��,���u�u��%+2|#d(T��7�
�+o��/����5D���i��̷��D��x������G�e����
9���0�6ԧJ��Xv�]��7���7�03�rS�1�i�]<�;��X�<�E�P���Du�>o	�8:-�95��p�xH�5$�lA�T�+I�*N�e/ц�/��+��NvL��d�ví�m�,vk�O!�=vaK��Ze������y���[�8$��C���yYUi�p�f#v�P�іR(V�e�� 7�(�Zx��f�,�h�y1�QAw#c�֤L
�Dj�.��`P�ԏ�f�ڛ	��lP�XkAG-ی��A�i/.`��i@]�s���A����-A�tq� у��<���zm��L��A����� "q��b�~�-�:9[%E����q�{j����?���*�oc�����&����K"s��Y���NRj��UW���:� s7>���"e�,U���d���yB���������}zr�z���KFuV�x���)����t��J���%s�.�đ�Wθ��̞�rmy:j�*�g]en�������r��_��@�m�G5y���7�����Y�๸���Ϥ��k�^��(Ps��z�:5v ��l4�ߩmK����/�>�uG1Gw?�N�x�{�5��mX��&>�z�� 1΁��,��hQt5��dz��@8"l��5��ʝ)XG�[mD�������VV�/��ܯ�M���9q��eR��ʈv-�%f��bI�y�S�[cⰥs�&{�q���g���Kۿp*H�I��ͤ�����C��]E�    ��{t��:Q5��FK��DI�o�V^t6ͩ���1A���45�nĦYj rqB��a�DV��ڭ��[Ui���,?�7���؛�~�n�z[M������Į�	;,ZLM�\�xM�q�����z�BCw���E��k7�2u�g�G��{���B�_ج��k ��҃Oܡ%ɖ@D���+�)���3?B當�H8��z��
�z]i�ȶNB8l.�?�7:�C�8�F�p��.ii�O�^�V�`�k��U���57��-���} I�iK��}�VMȺ�KtbI���5�N��袹�� L�?�"t���B/�N�z�p
�1��#���E�U�@�ҷ.�F��.����`��U�T:?X�P��U�b3�t��MSN!~Ȃưz�F�mra�s�uCi"�Ne45k����3�q7���c]6w���FP5�܂�1�4#��y�8MKM����*���
��������:=Nx��4���G5|���;�]�Q��N���y�mC}x;��Bf�~��,�3�4�1��ҡ=�WE�YMI䁟�ۊѓg{�A��5�v�b��H�d���u�9����~br���hM?�[�U����'4�XOd�y%��3��0lv��b���Ӏ"�\M�$'����Z5N�y����
�����m<�C�$�l�����Rl��!��&�C"�;�fN�Ӑ��f�E�qL0h;y4����?�[P��}e��0a��R���)s���|o�SG�u1��++ |x�uy�+�ln+ރNi
t�#w��4cl�٠�Vw쒒�u��m�ב�1�*:��qL������*_ܲ�����z��e���^)|>� _��r��ｲ#�	�o}a���kb~R?�d�킱�D�j��x͵�CQ�8�U:K]��qo��"V��� �xg��!ެ���F\C�YsR�5��X�B�M��id�7OH��M��A�!40�u�#~Dz���b�D�h=���;�D�jpR	���~��|3��}U�k'�Zʉp3s�`',@Z�Q�(��f��:�w�|��x�tP!w�]�U���l���{���Y�����z�s em�sߔ��J?�\��N)��/�^9�}�A�z}�e�(b�B�M�ƅ�D|��Nl}Et)f��t����ҩb�|��%�Ī��؉*1��a�_vߑ=IՇ��g�|�+�t~�a�X�MY������/UKY����ݢ����H�s�{���4	�X6Kb�����d9��a
V��ޞS`�b��x�s��E���RY]���Dl��nVq˘B�0�B6ޔ�D�!3I W\�qD�:�����O��*|������"�[Űc�8��c�@a��ՒGze���Jғ�HH�0+o�j����j���[lo|����T���8��?.�2�dU�� J���4�C�zy�<S�.JIP��:��p:�"�S'�5�[�=l��Uǅ��Rx|`�𩍟#>	r�%~/9�%E��R�O����U��w>I�����K�}�����j`�Km�m���xX�-�?cUW�,�#�����D9�l3ԭVt�[H��a�����>~.ҥ+�X��z A�^�!ή�B��]��I��5i'a5����/�4�O�]�:cZ��g���,��l� fO��iK<_���CpjS��pS��UqPW�~�U<O+aժ�
�Aq�z\��uDkh�۬*�&ٱ=��n!����vtﲅ௣���B
e�gq�}	�pe�0(v;u�@m L���;��6Uo��G}��
�Tq��AM��zqوn�n����="�ʡ��8��C���K�<kU�!<�u���e#xQ;z�QP�&CGzꌓ���d|抳豂�F\�v���I�ۭ�k��b5nT��1�@:����6ⰴ#�_N$���n�F����ǜ2�"������pRW�w���DՔ�N�Zʺ�E�F6B�
D�Gl��Zy���ug+�-����i��g��E�z�laK֊�1P�Xլ���ä*�ݺ�?�Z��Ꞡ�=%�sY�)i���������[K���$P^G����V�[�a�g-,�Z�nmC�5� j���&R��
_qr��F���X�b���V�pi�t��5k�*&�e�fp��jΚ�Q�p�����8Գ�c-��+ǞWT>�t���Y�a�(�_�����=��V~zF��d������!	v���6c�X�ǔ�[q���ý�����P�c)��Q�,�j‮Ҡ�"�W��Z܋��*L� �J$�^��?)�j�A�ڋ���[����1j�f�]�E��K����u��ÖtL-�8�<)L��p�d�;���F�6ۋ�V�A����Q鏾!ؑ</(,؋�{snd
�)�T*V���8{�l��������0��HQ<�{ 017��br�Z0L�V7�̓lC����K�b|��/���m9������w���rw�o���z�R�b��!�6m���u:{�P��ߊ��n�aЬT*Rr�Ҝת�Z?��PhJ�ߓ�l���pVP�d鉹Y2'�S�9�Vi�P}U�æu�M�<�d-���[���o@Pz@��UTBZe�_@��ɛ�*�St_@V|�'�E��RsK��Ž�}_�����V9�P|���i��jk-4AL�u�Oc�Ux��6S�����T�fuN5�t�}$s��t{�9�3*���YN:��A.?qFr|�?���*X�GRĐBh�~p'�vE#��˹�
F>��z����>t��~	�Y^�&4"�!��	����Nv-�`�k�0�
./y�3EX�T�&�o:�=�z��^{lv�R�I�<���I��Zn$7hd$P��G��+�`��\�B������5[����R�
���+H��(\�$�vD�qV�jy#�ԍ�Օ�c��<К��sMUj���iRѣ&e}R*J�&�N-�ضH�7�E	8p���3I�|A�@6���3�����@xs�{�!��c��0��)6xsɧ*B����V�`ߑ5_��\{��ro^@\�9��|r3�b�a�X1�f��D�Bo[�׻��}'o���������@D�J���~�EnȒ��)+�F��pS����Q�.�$.H�� ��1,-q��%�T�tA8����q&u�*�d馌
/	=�6��%�P��>�5��P��\��.�:��:ĕC�SDjP5�B�� I�8:M�0M,��1�D�h���t	|�A	�Cd9$w A���da�e�\l��U�=���-@�h�U;�/�(C��I��!����>yan6��g��nKr�T�[>�x��<�(�w�w�)��)G�\�a=��ϝ�_��Nu�I�f����pq,�^b�W�Ѫ�xr�T�\Y'jsXP�u���w���Ք�V��*s6�i���Π��yA^�M�.��ED�a,F����2�~}}/��G^
�����C���ע��c�nX@U�K�y��r��Ja���z��������Uyp#KeU����t��!��sY�k�L�� �q�����ea�G�"�E�����M3/�]R��Q,O�`�{y@���ܯ���d��.T���l �%��p
G�I��w<�I�E-r�u4+�k�I�`�)�k�M1��27C��$L�iN+��_Ќ�*�%E��ɭpTS5��^�����k�AXv�����|��6D�IZWv]�H�ב[�Q��{2/��9Ɨ!�����B`#9��$���]��6bd�D��v��_�(����+.�_�B��h� x�*�TW��k����R�V}�A�X���'qͩ3�B�<5*F -�F�#f����ʧ�I%J����o�3�3�<4�=�'��&L��F9
Y\j5��z��}�f�'ʝU�%r��Q���)��Ԋ���@-��#�:Ψu~M��<����V����Z��DNht�3�}�z^��8d�|q�SG�-�ߛ���#��`3�cl���{1l��yZR�rj1��³�KG��Dz�����?Q 2	  �������OX)l��f����`�O�NX��P>�$j�w��卼P��y���o?}E^%��-�(y��So��eC���
��O�qU֢�;:Z�\nݪ&*��Q�ZJwop^#�^F���+������
���c=���䴿�pm}��TiAC�wީ"�����
1^{o��ּ�,���Q3p�����^�J�u5����a�.��`x���?o|�X�S��� ��o+�
&b��X�]o�i<��z����<�z�|���t5��<Ep�F;n>M*Xj4vk��5��d?������%v�`O{̬"Q8(�D�:���J��`8��j-�g>��[�����e(NYb�|�i�?����A�9�\#0��PBF4ň�v��M#rz8���n��M,%�?�3rށe�ل8�Cz��CvZk|}��e !h6�d .jD�o��D�z�)����	�7ifU`௫~��z�FE�q�A��/4�R!<�T��N�E����E�8>�w�OlJv�����m]HnMx��&I�r��d�?g�k뷇o��������;�SE1g�8�S��O[(4z��!��=�%��E1�	a��B>v��d��H����̀��"���o��ջ�b	�I�4�;�)�K�mU��s-���$�V=0��s�5����m��U��/�S��.c�R���{1�;S��Zoq�~���ӇQ��4�1+c1&���H���ib�1���6�T.;S_[>�5Ru_�;_pB
n��D�kg1���.��V#=��M��8y�+��	o6w5F��2 �R�>���A�r��6%,d�c4�	WՃ��!t/�$�<Χ���K���U�euP珿���@%n
-4L�I�,�U�����ȸ1*|=a�x���=��o��S5�� �iT�|{�<��
�����
�m*�a�l_����mU����㿸��,�F5��=������Uv�h��M�	;�q���2�\�9�МBV�65?pk���~�2S���9��2.�5��M(���3�bY~�'�4�{��y	CE��,	�yf�	8���8��1O�,�l��۟ԤU��E��
��q��Ƭ�pNFpQ3��������r�����˺���L!��ߗ���;scj5��6l�t~�����Dc��!�J�<z<a.J�<��uj��۰t� 	�qjOȩ rao������(��4"y�/�ױ+����:ɫ�t����<2��S�}B�QAr#�G{�M�������@h��Z���y���r��ўȇ�uզl"'��h�ϼ<��*�m�h w�A"�w8�_v;��q�(�=Y���q�m� >b5ѥ;g�F��� �/k�h���{X{�����f�A�� �t$aC�O�&T�Pe�a'�X .�Ľg�/������]�Q㍫e��]/$y�_Bp����Aſ��ȩ�У����*Ս�:�Y9�.���!R*9��v��ƛ׎t���8(�7�A���'��^%|��ԣIf�#N���U��ܚ����'�����q�u��x��>�o�ǃ�V��a�~����8�/_�/�[zFՓ���͌X�I���B@�l��Av��1��g\���<���E���ެ����Ii�4�L�٢��J�{�o%��L��rSf <��2+	��L��6/��+��pߞ��_ۡ�qmCVp����^��}��vw���W�q�a[(�����V4�m$�I�
�
)RJ�UG�M�s��_*:<_���W��!H�4[�(<�U�&-�y�
D�򁝜��Rϙ�	��2��ݮ�9"��ζ����%�Rj܀���s����j wU�X�c�A�����beo�zVn��&0�xS{��4��V*S]{<)��Uzo�zn�v�˚�N!"Ae����d��s w���g���^{?�Q.�	�25�<�~ۋb�J�k��a+���Ys8��.������Q�?�f"�げ�x�w�K���as�s;Z�K�D��β��E,Lwf�z�M�}������]�ƹx�����3�7�Ģ��¤��3�_@񃅔�u�1BH��b�J�Щ�N�-<�K�������z�f��ڂg�1������%�X�����B?�v<����.��v)ﴂ����ϗ�� �� q��
Z�mR�I��r���ퟬH�ӽ�]���*Vd�>�I��"
�Z[10�Àt�x�@����p���N�i<������)E�4�"&�t�(�[@L�V���6����|��@����Y>��k�#�·�T(�p�{ A��2
MK"����������3      g   j  x�uչn�0�9~���c,�r�u���st0i�ԯ-��i'^n���B�Q�N�zaK����˂�`2�z�����{�~jmF���]k7�LU�s�1,�ˎ����Ț�r�M9s�p�M��O��b�iƆy0wþ�U%@嶓�?�d�0u��MMǋ�s�42}שv]�UBw�R�PO|�9�Gg͜6GU�K�0�jv��?�r���f�
�'���ڡ� ��z^
�\�n��\"T�\��)�y&-P%�^7�R�
�oSizؓv�����c�3� ��F�<!JP9/e�~W�@厈t�SU��m��I�V���@ȳ�����=�qk�*�3T�l��_c%n:[��MgT9k����۶����      l   �  x��Zm����,���'ـ$��7 0\�-ҤN�\b�P���DE�\���wf���x�ݵ��n����y�yf��� J&A4	wa�N��8��bE�p�O^ŉW�V���뇻 'A����/��1#n���&Ab�u^����|���r��<K�������Q0Y�;�Wl'NE.��WB�CQ�X��D)+x�{����i#J&ŗZ�[1�U�+r1��	�������0�
�:|{d[^��K�V0v��	�qI��m�28�`�TOo+�/Jz[;�>�R2y,.ycu�c!�	5cQW�޾�2�V�ѠA��ϵԏ��j�1YFa$-݆��b+���A���]�u�Ȑ}*j�Kw��C)x�>g��
�+Ы���ui6��9+J0?|���I�YU^����a#)D>�ul��j$a�9n�<�̬����88*ۈmq�S����,ʊ��� Oك�y�����¦��t.��\<��A��O!:s\�9e}���V�͸�eQ�����������VCd6�",��j.���*X�⯌Zx�?�����?�m~g��� n�X-B@$=�ʁ6���p��'I�@�#n�5�^ |i���R�Yq�� ���m�4� FS���t_j?TWE�}*��(�?�1�,*:6Q����;o^��ޮzn����įo@:.�R�}�����1̈́�$���k���l̒1[�+�%{m|�S���+��G8�Uчޗ��H>�g�(s8�Xp��4�Ii���]P4���n���\\ ��6�����>|��wz��p��jIk�})�C��0l9�s�������60#F/�O�1�|p�!�:`i��>��`O��㟦?�R����c#�kD,�3B��OpT��H�W�)��&��6ǯ�1t3���U'�^v�����k�� ��`w�a~��(Z��i��h����n�7�ZC/��#���y*0�l����ĳL@�xq^g@�	�'p
�=l��0��T�|�fE�T��hN�eG>H�b&;g�<KY�R��~��.uj/��c?e�M�W�c�Y4�P��-���1�GF)=���4�T��)Ɓ��C�>�Dp���;8���2=+��8H[/��.G���7��7$q/�<!����r�Ƙ��=��J<t��2���h�6�2\P��8�1b�2d��'P�����PtpC�(7�s��4*�>�Gө�NV���M��8-�T��G-��`������:|0��,����. ���d6��%H���A׈b��˅�8�y��M���ɣ!F��y���մR�z�H���� `��F�܂uLQ� xM`u_����uU��[c�P�e|��ɮN��������%��,����F�7�j(�̫�7�n��8g�N\��Ai �4~b�Q�����2��&l" �A0�QW8zU����Ǘ�JÁ�d�@�q3#���%!��pxN���Q�ռ�,��p�G�q����p�n�tyI5A�������k�������W�#�պ6�,�i*/۴L�Hn"\;��!��:�XIC�F���g��%(U��Ҳ�����A��6'�L�<Sϭ�k`�p��!�^`s��&'��}��AlS�-_1�����x��wKy�����~@4je��Y?^l>�	�����>�Ǆ����6��%�z�(���d���(Ķ�Ͼ[��L��:J ��G'ܨ�J0,0\�������]�.���[�� F����w���+c�����x�*���
�U�OV��\������,�Ǿ������h�
��?_�t�@Ry>�}#-�{C� �u��nT��� ՛����5n�!fs�[��"���v�fl�v`�L�qd��SQ
*��n���� ��T��AI��XكƵ^Y��]q�ň�HM*��1����D��g� 	�ߙ��CoȰv�@�"���m��ﱝ��Kyu�L\��dk��+}k�**�=�a��|Al���=)�G�3$���*�1��7���b�$ޜ�9�4A����h2s��o�y�m6� ����hJU	;	8%�T넆Ma�W�w��p|kcb��+�;խ5XK>:r�b�ZZq~P�����e���n.xjO�l���X�R�v���j,��ˌ��׿o���V�A�rP̖�����i��7���[��2ݶ����j�RD���8�)$;���x:`����~Q4$m�z7�J!ymQ�%m��S�S�����w����<;��sj�DQ���������`v
��z]��kj��}�P�>��o'r� M%�W�
��;�����Q�ܩ�tS�H�^�@=ߑ&��O$�zb�֯���K�w
j�����[U�{�?����R@�!c�	ͦ�[M��/Z���KK��kK���X%�O�2�t\}Je5���=��~��[X_EA�3��]�g!�
��x�x2�oqC�5���W��/7W[G�Ry��դ��Rx|�V��*�ol�2��f�'†}���yD<�N�fI��}F�(��>��%�����P�������r|�˒C
;�N�<ì���G�B�	�a�\�7w��$QC%Ӊf�_[��MJ�ӽ��ޣ�XpUߗ��腘F 
ĉvT�@�T,�j��*��%i7ɚ��h<����O%��������w����P<B����йƵ.��,��H��튨��'�����4�"÷�g8F�،$aE�ed���a���
;��&��,A9���� \AQ����|���{7�xl�z� �UzQ��.�ĵ���o�W�$}O\*t�>^8I�W��R�EY)�GP�l|�`pUD? 6�?��x9Ha��Gu��m?h(���|(��$K�<�D��+-�y4����x}���iouׯ�R��m2��{��hY7e���kT���@!ܒT�ܖ�J;�V(��/\u$��y�v��Bp�m�������0���R�t��S�]�ߵ��� i���a�M�Q�=�iЗ��ާ��m�Vq-۽O�q&I�xzq�H����S���9q��NB�6���A8�������/B��%��Qu� ����O[Y u�}��+KWN(v�K���SB�qv�~L�g
�e�T���R��L�rd*����_��먀^7�D���֘��]�:�%F�8�JpLOJ���O��Pd!P� �U�1ڨ1��
]>��Xa���~6��b�Y���uM���9�ЛFZl����~�q�F�����`Y^+�T�������ݵ`q͝���D�º���Rr`�޶�����lծu+	��ʝ<�SU2��)�Nǡ�pe�6ڜ��'9}��)��V��6Ȣ�/}���r���B�(�ϖ`B��R��#�Q�p[�si?ac׶��[���"�َx���y\k��X`��Hz�#^��#�h?����4�G�>}����      c   !   x�3�.)MI�+Q0�����/������ d�      k   �  x�U��n9��һd1�'��-	9���[��9�Ea3�>��B�PCv��k]^?���:��-�^L�o/�v$�����q�|��Y������~{��j+�)����eu�S���S��N�S��.�S�� 8��n8��n�|�����뿟��H�����E������ׇ5� �x� �x6� ���7� N�;���sN 8����$8��	Χ�J�Tv�*���; ��ʝ ~@�. ��V ?�Q[��f ?ܪ- .T[�諶�Pm��P� ���;|0�. ��z ��DiM�mn�e�67�k����� |�T�|�� *���[���7��m���.b�-�@�6`U\H0��+	�Q~#1��uS;�� �V�	�-w�@�� h�	�G6��g �p���j+��6 Y�v � >��� .T��B�z�����<���j3��j��Xը 6�j�\ۼ��m���>�Z�p��, �h< �y& �yf �
u. .ԹxT����s;�G�: �� $z�p������H�2�3	RF~!A�D�J�_�)��N�1�� ��R��!�Z��M�:��en�.R�-��!u�uw��xH��uw���!�Z�����"���- Q���N�+���Z�9!���ڝ�Zw�}R�a)��zj�YJ���z���穅\�z�ZwZR��A��u�(������j3�ǁ������j���F� +�z� +�Od��E�,��(	TԗD��x?�@�!�R�J�q�����ǉ�������
����D��
���l
ⱸ��l
��]�fS ����=�S�w���~�0�������Ipb����'B�"�����4�	�E|�|�� �4���E����=Tawm{����>�n���T�rm��..�[ry�x`�����n���ݒ������������p9�     