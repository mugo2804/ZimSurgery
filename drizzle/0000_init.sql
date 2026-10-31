CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"password" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "appointments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"patient_id" uuid NOT NULL,
	"doctor_id" text,
	"start_at" timestamp with time zone NOT NULL,
	"duration_min" integer DEFAULT 15 NOT NULL,
	"reason" text,
	"status" text DEFAULT 'booked' NOT NULL,
	"confirmation_sent_at" timestamp with time zone,
	"reminder_sent_at" timestamp with time zone,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"seq" bigserial PRIMARY KEY NOT NULL,
	"at" timestamp with time zone NOT NULL,
	"user_id" text,
	"username" text,
	"role" text,
	"action" text NOT NULL,
	"entity" text,
	"entity_id" text,
	"patient_id" uuid,
	"details" jsonb,
	"ip" text,
	"prev_hash" text NOT NULL,
	"hash" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cashups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"day" date NOT NULL,
	"cashier_id" text,
	"expected" jsonb NOT NULL,
	"declared_usd_cents" integer DEFAULT 0 NOT NULL,
	"declared_zig_cents" integer DEFAULT 0 NOT NULL,
	"variance" jsonb NOT NULL,
	"notes" text,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "claim_batches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"batch_no" text NOT NULL,
	"medical_aid_id" uuid NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"total_cents" integer DEFAULT 0 NOT NULL,
	"paid_cents" integer DEFAULT 0 NOT NULL,
	"notes" text,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"emailed_at" timestamp with time zone,
	"submitted_at" timestamp with time zone,
	"paid_at" timestamp with time zone,
	CONSTRAINT "claim_batches_batchNo_unique" UNIQUE("batch_no")
);
--> statement-breakpoint
CREATE TABLE "consultation_addenda" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"consultation_id" uuid NOT NULL,
	"author_id" text NOT NULL,
	"text" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "consultations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"visit_id" uuid NOT NULL,
	"patient_id" uuid NOT NULL,
	"doctor_id" text NOT NULL,
	"subjective" text,
	"objective" text,
	"assessment" text,
	"plan" text,
	"follow_up_date" date,
	"status" text DEFAULT 'draft' NOT NULL,
	"signed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "consultations_visitId_unique" UNIQUE("visit_id")
);
--> statement-breakpoint
CREATE TABLE "diagnoses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"consultation_id" uuid NOT NULL,
	"patient_id" uuid NOT NULL,
	"code" text NOT NULL,
	"description" text NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "exchange_rates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"zig_per_usd" numeric(12, 4) NOT NULL,
	"source" text,
	"effective_at" timestamp with time zone DEFAULT now() NOT NULL,
	"set_by" text
);
--> statement-breakpoint
CREATE TABLE "idempotency_keys" (
	"key" text PRIMARY KEY NOT NULL,
	"user_id" text,
	"status" integer NOT NULL,
	"body" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invoice_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invoice_id" uuid NOT NULL,
	"tariff_id" uuid,
	"code" text,
	"description" text NOT NULL,
	"icd10" text,
	"qty" integer DEFAULT 1 NOT NULL,
	"unit_cents" integer NOT NULL,
	"aid_unit_cents" integer DEFAULT 0 NOT NULL,
	"total_cents" integer NOT NULL,
	"aid_total_cents" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invoices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invoice_no" text NOT NULL,
	"visit_id" uuid,
	"patient_id" uuid NOT NULL,
	"payer_type" text NOT NULL,
	"medical_aid_id" uuid,
	"member_no" text,
	"dependant_code" text,
	"total_cents" integer DEFAULT 0 NOT NULL,
	"aid_cents" integer DEFAULT 0 NOT NULL,
	"patient_cents" integer DEFAULT 0 NOT NULL,
	"paid_cents" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"claim_status" text DEFAULT 'none' NOT NULL,
	"claim_batch_id" uuid,
	"claim_paid_cents" integer DEFAULT 0 NOT NULL,
	"claim_note" text,
	"void_reason" text,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "invoices_invoiceNo_unique" UNIQUE("invoice_no")
);
--> statement-breakpoint
CREATE TABLE "lab_orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_no" text NOT NULL,
	"consultation_id" uuid,
	"visit_id" uuid,
	"patient_id" uuid NOT NULL,
	"doctor_id" text NOT NULL,
	"lab" text NOT NULL,
	"tests" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"clinical_info" text,
	"urgency" text DEFAULT 'routine' NOT NULL,
	"status" text DEFAULT 'ordered' NOT NULL,
	"result" text,
	"resulted_at" timestamp with time zone,
	"resulted_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "lab_orders_orderNo_unique" UNIQUE("order_no")
);
--> statement-breakpoint
CREATE TABLE "medical_aids" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"code" text,
	"claims_email" text,
	"phone" text,
	"active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "medical_aids_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"patient_id" uuid,
	"appointment_id" uuid,
	"channel" text NOT NULL,
	"to_number" text,
	"kind" text NOT NULL,
	"body" text NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"provider" text,
	"provider_ref" text,
	"error" text,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"sent_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "patients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"file_no" text NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"dob" date,
	"sex" text,
	"national_id" text,
	"phone" text,
	"whatsapp" text,
	"email" text,
	"address" text,
	"city" text,
	"occupation" text,
	"nok_name" text,
	"nok_phone" text,
	"nok_relation" text,
	"medical_aid_id" uuid,
	"ma_member_no" text,
	"ma_principal_name" text,
	"ma_dependant_code" text,
	"ma_verified_at" timestamp with time zone,
	"ma_verified_by" text,
	"ma_verified_method" text,
	"allergy_status" text DEFAULT 'unknown' NOT NULL,
	"allergies" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"chronic_conditions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"recall_interval_months" integer DEFAULT 0 NOT NULL,
	"last_recall_at" timestamp with time zone,
	"comms_consent" boolean DEFAULT true NOT NULL,
	"preferred_channel" text DEFAULT 'whatsapp' NOT NULL,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "patients_fileNo_unique" UNIQUE("file_no")
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"receipt_no" text NOT NULL,
	"invoice_id" uuid NOT NULL,
	"patient_id" uuid NOT NULL,
	"method" text NOT NULL,
	"currency" text NOT NULL,
	"amount_minor" integer NOT NULL,
	"zig_rate" numeric(12, 4),
	"usd_cents" integer NOT NULL,
	"reference" text,
	"received_by" text,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "prescription_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"prescription_id" uuid NOT NULL,
	"medicine" text NOT NULL,
	"strength" text,
	"form" text,
	"dose" text,
	"frequency" text,
	"duration" text,
	"quantity" text,
	"instructions" text
);
--> statement-breakpoint
CREATE TABLE "prescriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"rx_no" text NOT NULL,
	"consultation_id" uuid,
	"visit_id" uuid,
	"patient_id" uuid NOT NULL,
	"doctor_id" text NOT NULL,
	"notes" text,
	"allergy_override_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "prescriptions_rxNo_unique" UNIQUE("rx_no")
);
--> statement-breakpoint
CREATE TABLE "procedures" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"visit_id" uuid,
	"patient_id" uuid NOT NULL,
	"item" text NOT NULL,
	"dose" text,
	"route" text,
	"site" text,
	"batch_no" text,
	"stock_item_id" uuid,
	"notes" text,
	"given_by" text,
	"given_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "referrals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ref_no" text NOT NULL,
	"consultation_id" uuid,
	"patient_id" uuid NOT NULL,
	"doctor_id" text NOT NULL,
	"to_name" text,
	"to_specialty" text,
	"to_facility" text,
	"urgency" text DEFAULT 'routine' NOT NULL,
	"letter" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "referrals_refNo_unique" UNIQUE("ref_no")
);
--> statement-breakpoint
CREATE TABLE "sequences" (
	"name" text PRIMARY KEY NOT NULL,
	"value" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"token" text NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" text
);
--> statement-breakpoint
CREATE TABLE "stock_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"category" text,
	"unit" text,
	"qty" integer DEFAULT 0 NOT NULL,
	"reorder_level" integer DEFAULT 0 NOT NULL,
	"batch_no" text,
	"expiry_date" date,
	"cost_cents" integer,
	"active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stock_movements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"item_id" uuid NOT NULL,
	"change" integer NOT NULL,
	"reason" text NOT NULL,
	"note" text,
	"visit_id" uuid,
	"user_id" text,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tariff_aid_rates" (
	"tariff_id" uuid NOT NULL,
	"medical_aid_id" uuid NOT NULL,
	"aid_cents" integer NOT NULL,
	CONSTRAINT "tariff_aid_rates_tariff_id_medical_aid_id_pk" PRIMARY KEY("tariff_id","medical_aid_id")
);
--> statement-breakpoint
CREATE TABLE "tariffs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"description" text NOT NULL,
	"category" text,
	"cash_cents" integer DEFAULT 0 NOT NULL,
	"aid_cents" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "tariffs_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "two_factor" (
	"id" text PRIMARY KEY NOT NULL,
	"secret" text NOT NULL,
	"backup_codes" text NOT NULL,
	"user_id" text NOT NULL,
	"verified" boolean DEFAULT true,
	"failed_verification_count" integer DEFAULT 0,
	"locked_until" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"username" text,
	"display_username" text,
	"two_factor_enabled" boolean DEFAULT false,
	"role" text DEFAULT 'reception' NOT NULL,
	"title" text,
	"qualification" text,
	"hpz_number" text,
	"phone" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email"),
	CONSTRAINT "user_username_unique" UNIQUE("username")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "visit_status_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"visit_id" uuid NOT NULL,
	"status" text NOT NULL,
	"user_id" text,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "visits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"patient_id" uuid NOT NULL,
	"doctor_id" text,
	"appointment_id" uuid,
	"status" text DEFAULT 'checked_in' NOT NULL,
	"priority" text DEFAULT 'normal' NOT NULL,
	"payer_type" text DEFAULT 'cash' NOT NULL,
	"complaint" text,
	"checked_in_at" timestamp with time zone DEFAULT now() NOT NULL,
	"status_changed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"created_by" text
);
--> statement-breakpoint
CREATE TABLE "vitals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"visit_id" uuid,
	"patient_id" uuid NOT NULL,
	"bp_sys" integer,
	"bp_dia" integer,
	"pulse" integer,
	"resp_rate" integer,
	"temp_c" real,
	"spo2" integer,
	"weight_kg" real,
	"height_cm" real,
	"bmi" real,
	"glucose" real,
	"pain_score" integer,
	"notes" text,
	"recorded_by" text,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_doctor_id_user_id_fk" FOREIGN KEY ("doctor_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cashups" ADD CONSTRAINT "cashups_cashier_id_user_id_fk" FOREIGN KEY ("cashier_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cashups" ADD CONSTRAINT "cashups_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "claim_batches" ADD CONSTRAINT "claim_batches_medical_aid_id_medical_aids_id_fk" FOREIGN KEY ("medical_aid_id") REFERENCES "public"."medical_aids"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "claim_batches" ADD CONSTRAINT "claim_batches_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consultation_addenda" ADD CONSTRAINT "consultation_addenda_consultation_id_consultations_id_fk" FOREIGN KEY ("consultation_id") REFERENCES "public"."consultations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consultation_addenda" ADD CONSTRAINT "consultation_addenda_author_id_user_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consultations" ADD CONSTRAINT "consultations_visit_id_visits_id_fk" FOREIGN KEY ("visit_id") REFERENCES "public"."visits"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consultations" ADD CONSTRAINT "consultations_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consultations" ADD CONSTRAINT "consultations_doctor_id_user_id_fk" FOREIGN KEY ("doctor_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "diagnoses" ADD CONSTRAINT "diagnoses_consultation_id_consultations_id_fk" FOREIGN KEY ("consultation_id") REFERENCES "public"."consultations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "diagnoses" ADD CONSTRAINT "diagnoses_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exchange_rates" ADD CONSTRAINT "exchange_rates_set_by_user_id_fk" FOREIGN KEY ("set_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_items" ADD CONSTRAINT "invoice_items_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_items" ADD CONSTRAINT "invoice_items_tariff_id_tariffs_id_fk" FOREIGN KEY ("tariff_id") REFERENCES "public"."tariffs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_visit_id_visits_id_fk" FOREIGN KEY ("visit_id") REFERENCES "public"."visits"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_medical_aid_id_medical_aids_id_fk" FOREIGN KEY ("medical_aid_id") REFERENCES "public"."medical_aids"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lab_orders" ADD CONSTRAINT "lab_orders_consultation_id_consultations_id_fk" FOREIGN KEY ("consultation_id") REFERENCES "public"."consultations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lab_orders" ADD CONSTRAINT "lab_orders_visit_id_visits_id_fk" FOREIGN KEY ("visit_id") REFERENCES "public"."visits"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lab_orders" ADD CONSTRAINT "lab_orders_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lab_orders" ADD CONSTRAINT "lab_orders_doctor_id_user_id_fk" FOREIGN KEY ("doctor_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lab_orders" ADD CONSTRAINT "lab_orders_resulted_by_user_id_fk" FOREIGN KEY ("resulted_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "patients" ADD CONSTRAINT "patients_medical_aid_id_medical_aids_id_fk" FOREIGN KEY ("medical_aid_id") REFERENCES "public"."medical_aids"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "patients" ADD CONSTRAINT "patients_ma_verified_by_user_id_fk" FOREIGN KEY ("ma_verified_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "patients" ADD CONSTRAINT "patients_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_received_by_user_id_fk" FOREIGN KEY ("received_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prescription_items" ADD CONSTRAINT "prescription_items_prescription_id_prescriptions_id_fk" FOREIGN KEY ("prescription_id") REFERENCES "public"."prescriptions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prescriptions" ADD CONSTRAINT "prescriptions_consultation_id_consultations_id_fk" FOREIGN KEY ("consultation_id") REFERENCES "public"."consultations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prescriptions" ADD CONSTRAINT "prescriptions_visit_id_visits_id_fk" FOREIGN KEY ("visit_id") REFERENCES "public"."visits"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prescriptions" ADD CONSTRAINT "prescriptions_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prescriptions" ADD CONSTRAINT "prescriptions_doctor_id_user_id_fk" FOREIGN KEY ("doctor_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "procedures" ADD CONSTRAINT "procedures_visit_id_visits_id_fk" FOREIGN KEY ("visit_id") REFERENCES "public"."visits"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "procedures" ADD CONSTRAINT "procedures_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "procedures" ADD CONSTRAINT "procedures_stock_item_id_stock_items_id_fk" FOREIGN KEY ("stock_item_id") REFERENCES "public"."stock_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "procedures" ADD CONSTRAINT "procedures_given_by_user_id_fk" FOREIGN KEY ("given_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_consultation_id_consultations_id_fk" FOREIGN KEY ("consultation_id") REFERENCES "public"."consultations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_doctor_id_user_id_fk" FOREIGN KEY ("doctor_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_item_id_stock_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."stock_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tariff_aid_rates" ADD CONSTRAINT "tariff_aid_rates_tariff_id_tariffs_id_fk" FOREIGN KEY ("tariff_id") REFERENCES "public"."tariffs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tariff_aid_rates" ADD CONSTRAINT "tariff_aid_rates_medical_aid_id_medical_aids_id_fk" FOREIGN KEY ("medical_aid_id") REFERENCES "public"."medical_aids"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "two_factor" ADD CONSTRAINT "two_factor_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visit_status_log" ADD CONSTRAINT "visit_status_log_visit_id_visits_id_fk" FOREIGN KEY ("visit_id") REFERENCES "public"."visits"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visit_status_log" ADD CONSTRAINT "visit_status_log_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visits" ADD CONSTRAINT "visits_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visits" ADD CONSTRAINT "visits_doctor_id_user_id_fk" FOREIGN KEY ("doctor_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visits" ADD CONSTRAINT "visits_appointment_id_appointments_id_fk" FOREIGN KEY ("appointment_id") REFERENCES "public"."appointments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visits" ADD CONSTRAINT "visits_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vitals" ADD CONSTRAINT "vitals_visit_id_visits_id_fk" FOREIGN KEY ("visit_id") REFERENCES "public"."visits"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vitals" ADD CONSTRAINT "vitals_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vitals" ADD CONSTRAINT "vitals_recorded_by_user_id_fk" FOREIGN KEY ("recorded_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "account_user_id_index" ON "account" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "appointments_start_at_index" ON "appointments" USING btree ("start_at");--> statement-breakpoint
CREATE INDEX "appointments_patient_id_index" ON "appointments" USING btree ("patient_id");--> statement-breakpoint
CREATE INDEX "audit_log_patient_id_index" ON "audit_log" USING btree ("patient_id");--> statement-breakpoint
CREATE INDEX "audit_log_user_id_index" ON "audit_log" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "audit_log_at_index" ON "audit_log" USING btree ("at");--> statement-breakpoint
CREATE INDEX "consultations_patient_id_index" ON "consultations" USING btree ("patient_id");--> statement-breakpoint
CREATE INDEX "diagnoses_code_index" ON "diagnoses" USING btree ("code");--> statement-breakpoint
CREATE INDEX "diagnoses_patient_id_index" ON "diagnoses" USING btree ("patient_id");--> statement-breakpoint
CREATE INDEX "invoice_items_invoice_id_index" ON "invoice_items" USING btree ("invoice_id");--> statement-breakpoint
CREATE INDEX "invoices_created_at_index" ON "invoices" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "invoices_patient_id_index" ON "invoices" USING btree ("patient_id");--> statement-breakpoint
CREATE UNIQUE INDEX "invoices_visit_id_index" ON "invoices" USING btree ("visit_id");--> statement-breakpoint
CREATE INDEX "lab_orders_patient_id_index" ON "lab_orders" USING btree ("patient_id");--> statement-breakpoint
CREATE INDEX "lab_orders_status_index" ON "lab_orders" USING btree ("status");--> statement-breakpoint
CREATE INDEX "messages_patient_id_index" ON "messages" USING btree ("patient_id");--> statement-breakpoint
CREATE INDEX "messages_created_at_index" ON "messages" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "patients_last_name_first_name_index" ON "patients" USING btree ("last_name","first_name");--> statement-breakpoint
CREATE INDEX "patients_national_id_index" ON "patients" USING btree ("national_id");--> statement-breakpoint
CREATE INDEX "patients_phone_index" ON "patients" USING btree ("phone");--> statement-breakpoint
CREATE INDEX "patients_ma_member_no_index" ON "patients" USING btree ("ma_member_no");--> statement-breakpoint
CREATE INDEX "payments_received_at_index" ON "payments" USING btree ("received_at");--> statement-breakpoint
CREATE INDEX "payments_invoice_id_index" ON "payments" USING btree ("invoice_id");--> statement-breakpoint
CREATE INDEX "prescriptions_patient_id_index" ON "prescriptions" USING btree ("patient_id");--> statement-breakpoint
CREATE INDEX "procedures_patient_id_index" ON "procedures" USING btree ("patient_id");--> statement-breakpoint
CREATE INDEX "session_user_id_index" ON "session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "stock_movements_item_id_index" ON "stock_movements" USING btree ("item_id");--> statement-breakpoint
CREATE INDEX "two_factor_user_id_index" ON "two_factor" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "two_factor_secret_index" ON "two_factor" USING btree ("secret");--> statement-breakpoint
CREATE INDEX "verification_identifier_index" ON "verification" USING btree ("identifier");--> statement-breakpoint
CREATE INDEX "visit_status_log_visit_id_index" ON "visit_status_log" USING btree ("visit_id");--> statement-breakpoint
CREATE INDEX "visits_checked_in_at_index" ON "visits" USING btree ("checked_in_at");--> statement-breakpoint
CREATE INDEX "visits_patient_id_index" ON "visits" USING btree ("patient_id");--> statement-breakpoint
CREATE INDEX "vitals_patient_id_recorded_at_index" ON "vitals" USING btree ("patient_id","recorded_at");