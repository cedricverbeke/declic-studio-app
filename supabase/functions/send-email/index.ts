import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const RESEND_API = "https://api.resend.com/emails";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { type, orderId } = await req.json();

    if (!type || !orderId) {
      return new Response(
        JSON.stringify({ error: "Missing type or orderId" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (!resendKey) {
      return new Response(
        JSON.stringify({ error: "Resend API key not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { data: order, error } = await supabase
      .from("orders")
      .select(`
        id, customer_email, amount, delivery_status, payment_status, session_id,
        sessions ( code )
      `)
      .eq("id", orderId)
      .maybeSingle();

    if (error || !order) {
      return new Response(
        JSON.stringify({ error: "Order not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const sessionCode = (order.sessions as { code: string }).code;
    const fromEmail = Deno.env.get("FROM_EMAIL") || "studio@declic-photo.com";
    const baseUrl = Deno.env.get("PUBLIC_BASE_URL") || "";

    let subject = "";
    let html = "";

    if (type === "receipt") {
      subject = `Reçu de votre commande — ${sessionCode}`;
      html = `
        <div style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 0 auto; background: #0a0a0a; color: #f5f5f5; padding: 32px;">
          <h1 style="font-size: 22px; margin-bottom: 8px;">Déclic Studio</h1>
          <p style="color: #a0a0a0; font-size: 14px;">Merci pour votre achat !</p>
          <div style="background: #1a1a1a; border-radius: 12px; padding: 20px; margin: 24px 0;">
            <p style="font-size: 14px; color: #a0a0a0;">Session</p>
            <p style="font-size: 18px; margin: 4px 0 16px;">${sessionCode}</p>
            <p style="font-size: 14px; color: #a0a0a0;">Montant payé</p>
            <p style="font-size: 22px; font-weight: bold; margin: 4px 0 0;">${Number(order.amount).toFixed(2)} €</p>
          </div>
          <p style="font-size: 13px; color: #707070;">Vos photos haute définition seront envoyées à cette adresse dès qu'elles seront prêtes.</p>
        </div>
      `;
    } else if (type === "delivery") {
      const token = crypto.randomUUID();
      await supabase
        .from("orders")
        .update({
          delivery_status: "delivered",
          delivered_at: new Date().toISOString(),
        })
        .eq("id", orderId);

      const downloadUrl = `${baseUrl}/d/${orderId}?token=${token}`;

      subject = `Vos photos HD sont prêtes — ${sessionCode}`;
      html = `
        <div style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 0 auto; background: #0a0a0a; color: #f5f5f5; padding: 32px;">
          <h1 style="font-size: 22px; margin-bottom: 8px;">Déclic Studio</h1>
          <p style="color: #a0a0a0; font-size: 14px;">Vos photos sont prêtes à être téléchargées !</p>
          <div style="background: #1a1a1a; border-radius: 12px; padding: 20px; margin: 24px 0;">
            <p style="font-size: 14px; color: #a0a0a0;">Session</p>
            <p style="font-size: 18px; margin: 4px 0 16px;">${sessionCode}</p>
          </div>
          <a href="${downloadUrl}" style="display: inline-block; background: #f5f5f5; color: #0a0a0a; text-decoration: none; font-weight: 600; padding: 14px 28px; border-radius: 10px; font-size: 15px;">Télécharger mes photos</a>
          <p style="font-size: 13px; color: #707070; margin-top: 24px;">Ce lien est personnel. Ne le partagez pas.</p>
        </div>
      `;
    } else {
      return new Response(
        JSON.stringify({ error: "Unknown email type" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const res = await fetch(RESEND_API, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: `Déclic Studio <${fromEmail}>`,
        to: [order.customer_email],
        subject,
        html,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      return new Response(
        JSON.stringify({ error: "Resend failed", detail: errText }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
