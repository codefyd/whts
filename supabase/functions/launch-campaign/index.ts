// ============================================================
// supabase/functions/launch-campaign/index.ts
// Sends template messages to all campaign recipients
// ============================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL     = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ACCESS_TOKEN     = Deno.env.get("WHATSAPP_ACCESS_TOKEN")!;

// Rate limit: WhatsApp allows ~80 messages/sec on most tiers
// We use a conservative delay to avoid throttling
const DELAY_MS = 100;

const corsHeaders = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  // Authenticate user
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "Unauthorized" }, 401);

  const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } }
  });

  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return json({ error: "Unauthorized" }, 401);

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE);

  const { campaign_id } = await req.json();
  if (!campaign_id) return json({ error: "campaign_id required" }, 400);

  // ---- Load campaign ---- //
  const { data: campaign, error: campErr } = await supabase
    .from("campaigns")
    .select("*")
    .eq("id", campaign_id)
    .eq("user_id", user.id)
    .single();

  if (campErr || !campaign) return json({ error: "Campaign not found" }, 404);

  if (!["draft", "launching"].includes(campaign.status)) {
    return json({ error: "Campaign already launched or in invalid state" }, 400);
  }

  // ---- Load integration settings ---- //
  const { data: settings } = await supabase
    .from("integration_settings")
    .select("phone_number_id, api_version")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!settings?.phone_number_id) {
    return json({ error: "WhatsApp Phone Number ID not configured" }, 400);
  }

  if (!ACCESS_TOKEN) {
    return json({ error: "WHATSAPP_ACCESS_TOKEN not configured" }, 500);
  }

  // ---- Mark campaign as launching ---- //
  await supabase
    .from("campaigns")
    .update({ status: "launching", launched_at: new Date().toISOString() })
    .eq("id", campaign_id);

  // ---- Load recipients ---- //
  const { data: recipients, error: recErr } = await supabase
    .from("campaign_recipients")
    .select("id, contact_id, contacts(phone_e164, name)")
    .eq("campaign_id", campaign_id)
    .eq("status", "queued");

  if (recErr) {
    await markCampaignFailed(supabase, campaign_id);
    return json({ error: "Failed to load recipients" }, 500);
  }

  if (!recipients || recipients.length === 0) {
    await supabase
      .from("campaigns")
      .update({ status: "completed" })
      .eq("id", campaign_id);
    return json({ success: true, sent: 0 });
  }

  // ---- Send messages ---- //
  let sentCount   = 0;
  let failedCount = 0;

  for (const recipient of recipients) {
    const contact = (recipient as any).contacts;
    if (!contact?.phone_e164) {
      await markRecipientFailed(supabase, recipient.id, "Missing phone number");
      failedCount++;
      continue;
    }

    const phone = contact.phone_e164.replace("+", "");

    try {
      const result = await sendTemplateMessage(
        settings.phone_number_id,
        settings.api_version || "v19.0",
        phone,
        campaign.template_name,
        campaign.template_language
        // Phase 2: pass template_components here for dynamic content
      );

      if (result.success && result.message_id) {
        await supabase
          .from("campaign_recipients")
          .update({
            status:        "sent",
            wa_message_id: result.message_id,
            sent_at:       new Date().toISOString(),
          })
          .eq("id", recipient.id);
        sentCount++;
      } else {
        await markRecipientFailed(supabase, recipient.id, result.error || "Unknown error");
        failedCount++;
      }
    } catch (err: any) {
      await markRecipientFailed(supabase, recipient.id, err.message || "Exception");
      failedCount++;
    }

    // Rate limiting delay
    await sleep(DELAY_MS);
  }

  // ---- Finalize campaign ---- //
  const finalStatus = failedCount === recipients.length ? "failed" : "completed";
  await supabase
    .from("campaigns")
    .update({ status: finalStatus })
    .eq("id", campaign_id);

  return json({
    success: true,
    sent:    sentCount,
    failed:  failedCount,
    total:   recipients.length,
    status:  finalStatus,
  });
});

// ---- Send Single Template Message ---- //

async function sendTemplateMessage(
  phoneNumberId: string,
  apiVersion: string,
  toPhone: string,
  templateName: string,
  language: string
  // Phase 2: add components: any[] parameter for dynamic variables
): Promise<{ success: boolean; message_id?: string; error?: string }> {

  const body: any = {
    messaging_product: "whatsapp",
    to:                toPhone,
    type:              "template",
    template: {
      name:     templateName,
      language: { code: language },
      // Phase 2: uncomment and pass components for dynamic content
      // components: components || [],
    },
  };

  const res = await fetch(
    `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`,
    {
      method:  "POST",
      headers: {
        Authorization:  `Bearer ${ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    }
  );

  const data = await res.json();

  if (res.ok && data?.messages?.[0]?.id) {
    return { success: true, message_id: data.messages[0].id };
  }

  return {
    success: false,
    error:   data?.error?.message || `HTTP ${res.status}`,
  };
}

// ---- Helpers ---- //

async function markRecipientFailed(supabase: any, id: string, error: string) {
  await supabase
    .from("campaign_recipients")
    .update({
      status:        "failed",
      error_message: error,
      failed_at:     new Date().toISOString(),
    })
    .eq("id", id);
}

async function markCampaignFailed(supabase: any, campaignId: string) {
  await supabase
    .from("campaigns")
    .update({ status: "failed" })
    .eq("id", campaignId);
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
