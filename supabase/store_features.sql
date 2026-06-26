-- Store features: menu PDF upload + custom CTA button per vendor

alter table public.vendors
  add column if not exists menu_pdf_url text,
  add column if not exists cta_button jsonb default null;

-- cta_button shape: { enabled: boolean, label: string, link_type: 'url'|'form', url: string, form_fields: string[] }
