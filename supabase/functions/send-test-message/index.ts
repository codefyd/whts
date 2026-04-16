// ============================================================
// supabase/functions/send-test-message/index.ts
// Sends a test WhatsApp message or validates connection
// ============================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL     = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ACCESS_TOKEN     = Deno.env.get("WHATSAPP_ACCESS_TOKEN")!;

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

  // Verify user is authenticated
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return json({ error: "Unauthorized" }, 401);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE);
  const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } }
  });

  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return json({ error: "Unauthorized" }, 401);

  const body = await req.json();
  const { phone, test_only, phone_number_id: bodyPhoneId } = body;

  // Get settings from DB
  const { data: settings } = await supabase
    .from("integration_settings")
    .select("phone_number_id, api_version")
    .eq("user_id", user.id)
    .maybeSingle();

  const phoneNumberId = settings?.phone_number_id || bodyPhoneId;
  const apiVersion    = settings?.api_version || "v19.0";

  if (!phoneNumberId) {
    return json({ error: "Phone Number ID not configured" }, 400);
  }

  if (!ACCESS_TOKEN) {
    return json({ error: "WHATSAPP_ACCESS_TOKEN secret not configured" }, 500);
  }

  // Test-only mode: just verify token works by fetching phone number info
  if (test_only) {
    const testRes = await fetch(
      `https://graph.facebook.com/${apiVersion}/${phoneNumberId}`,
      { headers: { Authorization: `Bearer ${ACCESS_TOKEN}` } }
    );

    if (testRes.ok) {
      return json({ ok: true });
    } else {
      const err = await testRes.json();
      return json({ ok: false, error: err?.error?.message || "API error" });
    }
  }

  // Send actual test message
  if (!phone) {
    return json({ error: "Phone number required" }, 400);
  }

  const waPhone = phone.replace("+", "");

  const messageBody = {
    messaging_product: "whatsapp",
    to:                waPhone,
    type:              "template",
    template: {
      name:     "hello_world",  // Default Meta test template
      language: { code: "en_US" },
    },
  };

  const waRes = await fetch(
    `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`,
    {
      method:  "POST",
      headers: {
        Authorization:  `Bearer ${ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(messageBody),
    }
  );

  const waData = await waRes.json();

  if (waRes.ok && waData?.messages?.[0]?.id) {
    return json({
      success:    true,
      message_id: waData.messages[0].id,
    });
  } else {
    return json({
      success: false,
      error:   waData?.error?.message || "WhatsApp API error",
      details: waData,
    });
  }
});

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
