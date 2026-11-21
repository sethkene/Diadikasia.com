-- Diadikasia Phase 1: Initial Catalog Seed (Idempotent)
-- Run once after 20261120_001_initial_schema.sql and 20261120_002_rls_and_rpcs.sql.
-- Safe to re-run without creating duplicates.

do $$
begin
  if not exists (select 1 from public.procedures limit 1) then
    insert into public.procedures (
      discipline, category, title, instructor_display, organization, region, duration, steps, hue, views_count, likes_count, created_at
    ) values
      (
        'nursing', 'IV Therapy', 'Peripheral IV catheter insertion',
        'Amina Garba, RN, Nurse Educator', 'Northern Skills Lab', 'African', '07:20',
        '["Verify the order and identify the patient","Perform hand hygiene and gather equipment","Select the site and apply the tourniquet","Insert the catheter and confirm flashback","Secure the dressing and document"]'::jsonb,
        190, 300, 12, now() - interval '1 day'
      ),
      (
        'nursing', 'Wound Care', 'Aseptic wound dressing change',
        'Sofia Lindqvist, RN, Wound Care Specialist', 'Nordic Wound Care Academy', 'European', '08:30',
        '["Explain the procedure and perform hand hygiene","Set up the sterile field","Remove the old dressing and assess the wound","Clean the wound using aseptic technique","Apply the new dressing and document"]'::jsonb,
        150, 1237, 65, now() - interval '6 days'
      ),
      (
        'nursing', 'Renal & Urinary', 'Female urinary catheterization',
        'Priya Nair, RN, MSc', 'Lakeview College of Nursing', 'Asian', '09:40',
        '["Explain the procedure and ensure privacy","Perform hand hygiene and open the sterile set","Clean the urethral area","Insert the catheter and confirm urine flow","Secure the catheter and document"]'::jsonb,
        280, 2174, 118, now() - interval '11 days'
      ),
      (
        'nursing', 'Medication', 'Giving an intramuscular injection',
        'Chidi Okafor, RN, BNSc', 'Lagos Nursing Simulation Hub', 'African', '07:12',
        '["Check the order and the five rights","Perform hand hygiene and prepare the medication","Select and clean the injection site","Inject and withdraw the needle","Dispose of the sharps and document"]'::jsonb,
        12, 3111, 171, now() - interval '16 days'
      ),
      (
        'nursing', 'Fundamentals', 'Measuring blood pressure manually',
        'Lena Hartmann, RN, MSc', 'Rhine Clinical Training Centre', 'European', '06:05',
        '["Position the patient and select the cuff size","Place the cuff on the bare upper arm","Inflate and listen with the stethoscope","Deflate slowly and note the readings","Record the result"]'::jsonb,
        215, 4048, 64, now() - interval '21 days'
      ),
      (
        'nursing', 'Emergency & Trauma', 'Adult CPR (basic life support)',
        'Kenji Mori, RN, BLS Instructor', 'Sakura Simulation Centre', 'Asian', '06:50',
        '["Check the scene and responsiveness","Call for help and an AED","Start chest compressions","Give rescue breaths if trained","Use the AED when it arrives"]'::jsonb,
        350, 1085, 117, now() - interval '26 days'
      ),
      (
        'surgical', 'Perioperative & Aseptic', 'Surgical hand scrub and gowning',
        'Dr. Tobias Wagner, MD, Consultant Surgeon', 'Rhine Teaching Hospital', 'European', '06:48',
        '["Remove jewelry and wet hands and forearms","Scrub nails, fingers and forearms in sequence","Rinse from fingertips to elbows","Dry with a sterile towel","Put on the sterile gown and gloves"]'::jsonb,
        205, 2022, 170, now() - interval '31 days'
      ),
      (
        'surgical', 'General Surgery', 'Simple interrupted suturing',
        'Dr. Fatima Bello, MBBS, FWACS', 'Savannah Surgical Training Unit', 'African', '05:15',
        '["Select instruments and suture material","Grip the needle driver correctly","Pass the needle through both wound edges","Tie the knot and check tension","Cut the suture and inspect the closure"]'::jsonb,
        170, 2959, 63, now() - interval '36 days'
      ),
      (
        'surgical', 'Perioperative & Aseptic', 'Draping the sterile field',
        'Dr. Wei Chen, MD', 'Pearl River Surgical Institute', 'Asian', '04:50',
        '["Open the sterile pack without touching the inside","Prepare the patient''s skin","Place the drapes around the surgical site","Secure the drapes","Maintain the sterile field"]'::jsonb,
        260, 3896, 116, now() - interval '1 day'
      ),
      (
        'surgical', 'Orthopedic', 'Applying a forearm cast',
        'Dr. Ioana Pop, MD', 'Carpathian Orthopedic Centre', 'European', '08:05',
        '["Assess the limb and explain the procedure","Apply padding smoothly","Wrap the casting material evenly","Mold and check circulation","Give cast care instructions"]'::jsonb,
        40, 933, 169, now() - interval '6 days'
      ),
      (
        'surgical', 'Cardiothoracic', 'Chest drain: setup and assisting',
        'Dr. Ngozi Eze, MD, FWACS', 'Lagos Surgical Training Hub', 'African', '09:30',
        '["Confirm the indication and gather equipment","Position the patient and prepare the field","Assist with insertion under sterile conditions","Connect the drainage system","Secure the tube and monitor"]'::jsonb,
        320, 1870, 62, now() - interval '11 days'
      );
  end if;
end $$;

-- =====================================================================
-- Initial Supreme Admin Provisioning (Manual, Secure, SQL-Editor Only)
-- =====================================================================
-- 1. First register your admin user through the app Sign Up screen
--    (which creates an auth.users record + 'learner' row in public.profiles).
-- 2. Replace YOUR_ADMIN_EMAIL@example.com below and run in Supabase SQL Editor.
--    Note: profiles.approved_at is TEXT (e.g. 'Nov 2026'), matching the UI.
--
--   update public.profiles
--   set
--     role = 'admin',
--     qualifications = 'Supreme Admin · Clinical Director',
--     approved_at = to_char(now(), 'Mon YYYY'),
--     can_review_videos = true,
--     can_moderate_posts = true,
--     updated_at = now()
--   where lower(email) = lower('YOUR_ADMIN_EMAIL@example.com');
