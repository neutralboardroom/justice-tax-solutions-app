-- Justice Tax Solutions v0.1.5 PostgreSQL starter schema.
-- This file is intended for Render PostgreSQL or another managed Postgres database.
-- The app still supports local JSON for development, but these tables match the platform collections.

create table if not exists users (
  id text primary key,
  email text unique not null,
  password_hash text,
  name text,
  role text default 'client',
  staff_status text,
  referral_code text unique,
  referred_by_code text,
  email_verified boolean default false,
  permissions jsonb default '[]'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  deleted_at timestamptz
);

create table if not exists tax_cases (
  id text primary key,
  user_id text references users(id),
  email text,
  pathway text,
  selected_tier text,
  status text,
  risk_level text,
  risk_score integer,
  agency text,
  tax_years text,
  flags jsonb default '[]'::jsonb,
  missing_items jsonb default '[]'::jsonb,
  review_plan jsonb default '{}'::jsonb,
  payment_status text,
  release_status text,
  assigned_professional_id text,
  compliance_completed_keys jsonb default '[]'::jsonb,
  client_final_approval_at timestamptz,
  referral_code text,
  field_fill_plan jsonb default '{}'::jsonb,
  document_binder jsonb default '[]'::jsonb,
  document_readiness_score integer,
  client_done_uploading boolean default false,
  client_done_uploading_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  deleted_at timestamptz
);

create table if not exists documents (
  id text primary key,
  case_id text references tax_cases(id),
  original_name text,
  stored_name text,
  mime_type text,
  size_bytes bigint,
  sha256 text,
  encrypted boolean default true,
  storage_provider text,
  storage_path text,
  classification jsonb default '{}'::jsonb,
  document_workflow text,
  classifier text,
  retention_status text default 'active',
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  deleted_at timestamptz
);

create table if not exists professionals (
  id text primary key,
  name text not null,
  email text,
  role_key text,
  status text default 'pending_verification',
  credential_status text,
  ptin_last4 text,
  ptin_status text,
  ny_tprin text,
  ny_preparer_registration_status text,
  license_jurisdiction text,
  license_number text,
  ea_number text,
  identity_verified boolean default false,
  background_review_status text,
  engagement_scope text,
  compliance_score integer default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  deleted_at timestamptz
);

create table if not exists review_requests (
  id text primary key,
  case_id text references tax_cases(id),
  user_id text references users(id),
  status text,
  recommended_product text,
  tier_key text,
  readiness_score integer,
  client_consent boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  deleted_at timestamptz
);

create table if not exists payments (
  id text primary key,
  case_id text references tax_cases(id),
  email text,
  product_type text,
  amount_total_cents integer,
  status text,
  stripe_checkout_session_id text,
  stripe_payment_intent_id text,
  referral_code text,
  field_fill_plan jsonb default '{}'::jsonb,
  document_binder jsonb default '[]'::jsonb,
  document_readiness_score integer,
  client_done_uploading boolean default false,
  client_done_uploading_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  deleted_at timestamptz
);

create table if not exists access_logs (
  id text primary key,
  action text,
  payload jsonb default '{}'::jsonb,
  path text,
  ip_hash text,
  user_agent_summary text,
  created_at timestamptz default now()
);

create table if not exists generic_events (
  id text primary key,
  type text,
  payload jsonb default '{}'::jsonb,
  path text,
  ip_hash text,
  user_agent_summary text,
  created_at timestamptz default now()
);

create index if not exists idx_tax_cases_user_id on tax_cases(user_id);
create index if not exists idx_documents_case_id on documents(case_id);
create index if not exists idx_payments_case_id on payments(case_id);
create index if not exists idx_access_logs_created_at on access_logs(created_at desc);


create table if not exists field_fill_events (
  id text primary key,
  case_id text references tax_cases(id),
  document_id text,
  target_key text,
  status text,
  value_summary text,
  note text,
  actor_user_id text,
  actor_role text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  deleted_at timestamptz
);

create table if not exists competitor_notes (
  id text primary key,
  competitor_group text,
  feature text,
  decision text,
  status text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  deleted_at timestamptz
);

create index if not exists idx_tax_cases_document_readiness on tax_cases(document_readiness_score desc);
create index if not exists idx_documents_workflow on documents(document_workflow);

-- v0.1.5 document extraction / verification layer
alter table tax_cases add column if not exists extraction_summary jsonb default '{}'::jsonb;
alter table documents add column if not exists extraction_profile jsonb default '{}'::jsonb;
alter table documents add column if not exists extraction_status text;
alter table documents add column if not exists extraction_method text;
alter table documents add column if not exists extraction_confidence_score integer;
alter table documents add column if not exists extraction_confidence_label text;
alter table documents add column if not exists extracted_fields jsonb default '[]'::jsonb;
alter table documents add column if not exists extracted_text_preview text;
alter table documents add column if not exists ocr_required boolean default false;

create table if not exists extraction_jobs (
  id text primary key,
  case_id text references tax_cases(id),
  document_id text references documents(id),
  status text,
  method text,
  provider text,
  confidence_score integer,
  confidence_label text,
  warnings jsonb default '[]'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  deleted_at timestamptz
);

create table if not exists document_verifications (
  id text primary key,
  case_id text references tax_cases(id),
  document_id text references documents(id),
  field_key text,
  status text,
  corrected_value text,
  note text,
  actor_user_id text,
  actor_role text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  deleted_at timestamptz
);

create table if not exists field_value_verifications (
  id text primary key,
  case_id text references tax_cases(id),
  document_id text references documents(id),
  field_key text,
  source_value text,
  corrected_value text,
  confidence_score integer,
  verification_status text,
  verified_by text,
  verified_role text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  deleted_at timestamptz
);

create index if not exists idx_documents_extraction_status on documents(extraction_status);
create index if not exists idx_documents_ocr_required on documents(ocr_required);
create index if not exists idx_extraction_jobs_case_id on extraction_jobs(case_id);
create index if not exists idx_document_verifications_doc on document_verifications(document_id);

-- v0.1.6 official IRS/NYS/NYC form library ingestion and mapping layer
create table if not exists official_form_packages (
  id text primary key,
  original_name text,
  mime_type text,
  size_bytes bigint,
  sha256 text unique,
  agency_hint text,
  tax_year_hint text,
  source_url text,
  notes text,
  upload_status text,
  pdf_count integer default 0,
  skipped_count integer default 0,
  skipped_entries jsonb default '[]'::jsonb,
  priority_summary jsonb default '{}'::jsonb,
  processed_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  deleted_at timestamptz
);

create table if not exists official_forms (
  id text primary key,
  package_id text references official_form_packages(id),
  agency text,
  tax_year text,
  form_number text,
  doc_type text,
  file_name text,
  original_entry_name text,
  mime_type text,
  size_bytes bigint,
  sha256 text,
  source_url text,
  official_source_status text,
  official_source_note text,
  mapping_priority integer,
  mapping_wave text,
  mapping_status text default 'not_started',
  field_map_status text default 'not_started',
  fillable_pdf_status text default 'unknown',
  requires_staff_source_review boolean default true,
  requires_field_mapping boolean default true,
  can_drive_client_output boolean default false,
  release_status text,
  mapping_notes text,
  source_verified_by text,
  source_verified_at timestamptz,
  storage_provider text,
  storage_path text,
  stored_name text,
  public_use_note text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  deleted_at timestamptz
);

create table if not exists official_form_mappings (
  id text primary key,
  official_form_id text references official_forms(id),
  mapping_status text,
  field_map_status text,
  fillable_pdf_status text,
  notes text,
  staff_id text,
  policy_snapshot jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  deleted_at timestamptz
);

create table if not exists official_form_field_maps (
  id text primary key,
  official_form_id text references official_forms(id),
  official_field_name text,
  plain_english_question text,
  source_document_types jsonb default '[]'::jsonb,
  verification_required boolean default true,
  calculation_rule text,
  mapping_status text default 'draft',
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  deleted_at timestamptz
);

create index if not exists idx_official_forms_agency_year on official_forms(agency, tax_year);
create index if not exists idx_official_forms_priority on official_forms(mapping_priority, mapping_status);
create index if not exists idx_official_forms_number on official_forms(form_number);
create index if not exists idx_official_form_mappings_form on official_form_mappings(official_form_id);

-- v0.1.7 tax-problem action plans, staff tasks, and form-upload preparation
create table if not exists tasks (
  id text primary key,
  case_id text references cases(id),
  lane text,
  label text,
  status text default 'open',
  priority text default 'normal',
  assigned_to text,
  staff_note text,
  created_by text,
  updated_by text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  deleted_at timestamptz
);

create table if not exists client_checklist_events (
  id text primary key,
  case_id text references cases(id),
  checklist_key text,
  status text,
  note text,
  user_id text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  deleted_at timestamptz
);

create table if not exists form_upload_sessions (
  id text primary key,
  agency text,
  tax_year text,
  source_url text,
  notes text,
  status text default 'planned',
  created_by text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  deleted_at timestamptz
);

create table if not exists staff_notifications (
  id text primary key,
  case_id text references cases(id),
  type text,
  status text default 'open',
  message text,
  assigned_to text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  deleted_at timestamptz
);

create index if not exists idx_tasks_case_status on tasks(case_id, status);
create index if not exists idx_tasks_lane_status on tasks(lane, status);
create index if not exists idx_client_checklist_case on client_checklist_events(case_id);
create index if not exists idx_form_upload_sessions_status on form_upload_sessions(status);
create index if not exists idx_staff_notifications_status on staff_notifications(status);

-- v0.1.8 live paying-user readiness and consent gates
create table if not exists client_acknowledgments (
  id text primary key,
  case_id text references cases(id),
  user_id text references users(id),
  terms_accepted boolean default false,
  not_government_acknowledged boolean default false,
  no_guarantee_acknowledged boolean default false,
  ai_limitations_acknowledged boolean default false,
  document_upload_acknowledged boolean default false,
  not_emergency_acknowledged boolean default false,
  accepted_at timestamptz default now(),
  ip_hash text,
  user_agent_summary text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  deleted_at timestamptz
);

create table if not exists live_readiness_events (
  id text primary key,
  readiness_snapshot jsonb default '{}'::jsonb,
  required_passed int default 0,
  required_total int default 0,
  ready_for_live_paying_users boolean default false,
  created_by text,
  created_at timestamptz default now(),
  deleted_at timestamptz
);

create index if not exists idx_client_ack_case on client_acknowledgments(case_id);
create index if not exists idx_live_readiness_created on live_readiness_events(created_at);

-- v0.1.11 live client journey, service-fit, SLA board, and contact operations
create table if not exists contact_attempts (
  id text primary key,
  case_id text references cases(id),
  staff_user_id text references users(id),
  staff_email text,
  method text,
  outcome text,
  note text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  deleted_at timestamptz
);

create table if not exists service_fit_events (
  id text primary key,
  case_id text references cases(id),
  recommended_service_key text,
  reason text,
  intake_quality_score int default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  deleted_at timestamptz
);

create table if not exists client_journey_events (
  id text primary key,
  case_id text references cases(id),
  current_step int default 0,
  blocker_count int default 0,
  warning_count int default 0,
  actor_user_id text references users(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  deleted_at timestamptz
);

create index if not exists idx_contact_attempts_case on contact_attempts(case_id, created_at);
create index if not exists idx_service_fit_events_case on service_fit_events(case_id);
create index if not exists idx_client_journey_events_case on client_journey_events(case_id, created_at);

-- v0.1.12 production-gap audit, pilot gate, WISP/security plan, and launch communications
create table if not exists security_plan_events (
  id text primary key,
  status_key text not null,
  status text default 'in_progress',
  note text,
  actor_user_id text references users(id),
  actor_email text,
  completed_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  deleted_at timestamptz
);

create table if not exists pilot_gate_events (
  id text primary key,
  selected_phase text,
  gate_snapshot jsonb default '{}'::jsonb,
  actor_user_id text references users(id),
  actor_email text,
  note text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  deleted_at timestamptz
);

create table if not exists email_template_events (
  id text primary key,
  template_key text,
  status text default 'draft_needed',
  subject text,
  body_preview text,
  actor_user_id text references users(id),
  actor_email text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  deleted_at timestamptz
);

create index if not exists idx_security_plan_status_key on security_plan_events(status_key);
create index if not exists idx_pilot_gate_created on pilot_gate_events(created_at);
create index if not exists idx_email_template_key on email_template_events(template_key);

-- v0.1.13 production configuration, storage scan events, live upload gate, and deployment checks
create table if not exists production_config_events (
  id text primary key,
  status_key text not null,
  status text default 'noted',
  note text,
  actor_user_id text references users(id),
  actor_email text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  deleted_at timestamptz
);

create table if not exists storage_scan_events (
  id text primary key,
  case_id text references cases(id),
  document_id text references documents(id),
  original_name text,
  size_bytes int default 0,
  mime_type text,
  scan_status text,
  scan_provider text,
  sha256 text,
  upload_mode text,
  live_sensitive_uploads_allowed boolean default false,
  note text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  deleted_at timestamptz
);

create table if not exists email_delivery_events (
  id text primary key,
  template_key text,
  recipient_hash text,
  delivery_provider text,
  status text default 'queued_or_stubbed',
  case_id text references cases(id),
  actor_user_id text references users(id),
  note text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  deleted_at timestamptz
);

create table if not exists deployment_check_events (
  id text primary key,
  check_key text,
  status text default 'noted',
  environment text,
  note text,
  actor_user_id text references users(id),
  actor_email text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  deleted_at timestamptz
);

create index if not exists idx_production_config_events_key on production_config_events(status_key, created_at);
create index if not exists idx_storage_scan_events_case on storage_scan_events(case_id, created_at);
create index if not exists idx_storage_scan_events_status on storage_scan_events(scan_status, created_at);
create index if not exists idx_email_delivery_events_template on email_delivery_events(template_key, created_at);
create index if not exists idx_deployment_check_events_key on deployment_check_events(check_key, created_at);


-- v0.1.63 deployment-safe persistence and save/resume continuity
create table if not exists work_progress_drafts (
  id text primary key,
  user_id text references users(id),
  user_email text,
  case_id text,
  title text,
  workflow text,
  page_path text,
  status text,
  last_completed_section text,
  progress_percent integer default 0,
  data jsonb default '{}'::jsonb,
  data_redaction_notice text,
  last_saved_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  deleted_at timestamptz
);

create table if not exists case_progress_saves (
  id text primary key,
  user_id text references users(id),
  user_email text,
  case_id text references tax_cases(id),
  title text,
  workflow text,
  page_path text,
  status text,
  last_completed_section text,
  progress_percent integer default 0,
  data jsonb default '{}'::jsonb,
  data_redaction_notice text,
  case_status_at_save text,
  payment_status_at_save text,
  assigned_professional_id_at_save text,
  last_saved_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  deleted_at timestamptz
);

create table if not exists deployment_data_checks (
  id text primary key,
  actor_id text,
  actor_role text,
  release_version text,
  status text,
  note text,
  readiness jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  deleted_at timestamptz
);

create table if not exists data_preservation_events (
  id text primary key,
  event_key text,
  payload jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  deleted_at timestamptz
);

alter table tax_cases add column if not exists last_progress_save_id text;
alter table tax_cases add column if not exists last_progress_saved_at timestamptz;
alter table tax_cases add column if not exists last_progress_section text;
alter table tax_cases add column if not exists progress_percent integer default 0;
alter table tax_cases add column if not exists save_resume_status text;

create index if not exists idx_work_progress_drafts_user on work_progress_drafts(user_id, updated_at desc);
create index if not exists idx_case_progress_saves_case on case_progress_saves(case_id, updated_at desc);
create index if not exists idx_deployment_data_checks_created on deployment_data_checks(created_at desc);

-- v0.1.64 release continuity, quote/payment preservation, and professional save/resume work drafts
create table if not exists professional_work_drafts (
  id text primary key,
  staff_id text,
  staff_email text,
  professional_role text,
  case_id text references tax_cases(id),
  title text,
  workflow text,
  status text,
  last_completed_section text,
  progress_percent integer default 0,
  note_summary text,
  private_sensitive_data_warning text,
  checklist_state jsonb default '{}'::jsonb,
  last_saved_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  deleted_at timestamptz
);

create table if not exists deployment_continuity_snapshots (
  id text primary key,
  release_version text,
  snapshot_type text,
  counts jsonb default '{}'::jsonb,
  storage_snapshot jsonb default '{}'::jsonb,
  note text,
  actor_id text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  deleted_at timestamptz
);

create table if not exists release_integrity_checks (
  id text primary key,
  release_version text,
  status text,
  actor_id text,
  actor_role text,
  actor_email text,
  checklist jsonb default '{}'::jsonb,
  note text,
  storage_snapshot jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  deleted_at timestamptz
);

create table if not exists quote_payment_preservation_checks (
  id text primary key,
  release_version text,
  actor_id text,
  actor_role text,
  actor_email text,
  status text,
  quotes_visible boolean default false,
  payments_visible boolean default false,
  stripe_webhook_checked boolean default false,
  referral_rewards_checked boolean default false,
  no_duplicate_payments_seen boolean default false,
  note text,
  snapshot_counts jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  deleted_at timestamptz
);

create index if not exists idx_professional_work_drafts_case on professional_work_drafts(case_id, updated_at);
create index if not exists idx_release_integrity_checks_version on release_integrity_checks(release_version, created_at);
create index if not exists idx_quote_payment_preservation_checks_version on quote_payment_preservation_checks(release_version, created_at);
