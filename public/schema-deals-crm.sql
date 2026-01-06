-- =====================================================
-- DEALS / CRM PIPELINE TABLE
-- Run this in Supabase SQL Editor
-- =====================================================

-- Create deals table for CRM pipeline
CREATE TABLE IF NOT EXISTS deals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    value DECIMAL(12,2) DEFAULT 0,
    stage VARCHAR(50) DEFAULT 'lead',
    pipeline_id VARCHAR(50) DEFAULT 'default',
    contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
    organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
    owner_id UUID REFERENCES users(id) ON DELETE SET NULL,
    expected_close_date DATE,
    probability INTEGER DEFAULT 50,
    source VARCHAR(100),
    notes TEXT,
    lost_reason TEXT,
    closed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_deals_stage ON deals(stage);
CREATE INDEX IF NOT EXISTS idx_deals_pipeline ON deals(pipeline_id);
CREATE INDEX IF NOT EXISTS idx_deals_contact ON deals(contact_id);
CREATE INDEX IF NOT EXISTS idx_deals_organization ON deals(organization_id);

-- Add some sample deals
INSERT INTO deals (name, value, stage, probability) VALUES
    ('IT-Infrastruktur Upgrade', 25000, 'qualified', 60),
    ('Cloud Migration Projekt', 45000, 'proposal', 75),
    ('Support-Vertrag Erweiterung', 12000, 'negotiation', 85),
    ('Managed Services Paket', 8500, 'lead', 30)
ON CONFLICT DO NOTHING;

-- Add lead_status and source columns to contacts if not exists
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'contacts' AND column_name = 'lead_status') THEN
        ALTER TABLE contacts ADD COLUMN lead_status VARCHAR(50) DEFAULT 'new';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'contacts' AND column_name = 'source') THEN
        ALTER TABLE contacts ADD COLUMN source VARCHAR(100);
    END IF;
END $$;

-- Create conversations table for Chatwoot sync
CREATE TABLE IF NOT EXISTS conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chatwoot_conversation_id VARCHAR(100) UNIQUE,
    contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
    organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
    channel VARCHAR(50) DEFAULT 'web',
    status VARCHAR(50) DEFAULT 'open',
    last_message_at TIMESTAMPTZ,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_conversations_chatwoot ON conversations(chatwoot_conversation_id);
CREATE INDEX IF NOT EXISTS idx_conversations_contact ON conversations(contact_id);

-- Enable RLS
ALTER TABLE deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;

-- Create policies
DROP POLICY IF EXISTS "Allow all for deals" ON deals;
CREATE POLICY "Allow all for deals" ON deals FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all for conversations" ON conversations;
CREATE POLICY "Allow all for conversations" ON conversations FOR ALL USING (true) WITH CHECK (true);

SELECT 'Deals and Conversations tables created successfully!' as result;
