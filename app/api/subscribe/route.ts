import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";

export async function POST(req: NextRequest) {
  const { email } = await req.json();

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Invalid email" }, { status: 400 });
  }

  const apiKey = process.env.RESEND_API_KEY;
  const audienceId = process.env.RESEND_AUDIENCE_ID;

  if (!apiKey) {
    return NextResponse.json(
      { error: "Newsletter not configured" },
      { status: 500 }
    );
  }

  const resend = new Resend(apiKey);

  // Save to Resend Audience
  if (audienceId) {
    const { error: contactError } = await resend.contacts.create({
      audienceId,
      email,
      unsubscribed: false,
    });
    if (contactError) {
      console.error("Resend contact create failed:", contactError);
    }
  } else {
    console.warn("RESEND_AUDIENCE_ID not set — subscriber not saved to audience");
  }

  // Send welcome email
  const { error } = await resend.emails.send({
    from: "AI Daily <newsletter@aidaily.now>",
    to: [email],
    subject: "You're subscribed to AI TLDR!",
    html: `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f3f4f6;">
  <div style="max-width:600px;margin:0 auto;padding:32px 16px;">
    <div style="background:#ffffff;border-radius:12px;padding:40px 36px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
      <p style="color:#7c3aed;font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;margin:0 0 20px;">AI TLDR</p>
      <h1 style="font-size:24px;font-weight:800;color:#111827;margin:0 0 16px;line-height:1.3;">You're in.</h1>
      <p style="color:#374151;font-size:16px;line-height:1.75;margin:0 0 12px;">
        Thanks for subscribing to AI TLDR. Every weekday morning you'll get the 6 most important AI stories — model releases, breakthroughs, and industry moves — in a 5-minute read.
      </p>
      <p style="color:#374151;font-size:16px;line-height:1.75;margin:0 0 32px;">
        No fluff. No spam. Just the signal that matters.
      </p>
      <div style="padding-top:24px;border-top:1px solid #e5e7eb;text-align:center;">
        <p style="color:#9ca3af;font-size:13px;margin:0;">
          You subscribed with ${email}. Reply to this email to get in touch.
        </p>
      </div>
    </div>
  </div>
</body>
</html>`,
  });

  if (error) {
    console.error("Resend welcome email failed:", error);
    return NextResponse.json({ error: "Failed to send confirmation" }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}
