import { corsHeaders } from '../_shared/cors.ts'

type AlertPayload = {
  id: string
  location_id: string
  alert_type: string
  severity: 'reminder' | 'critical'
  module: string
  title: string
  message: string
  created_at: string
  is_escalated: boolean
}

type DatabaseWebhookBody = {
  type?: string
  table?: string
  schema?: string
  record?: AlertPayload
  old_record?: AlertPayload | null
}

async function deliverWebhook(alert: AlertPayload) {
  const webhookUrl = Deno.env.get('ESCALATION_WEBHOOK_URL')
  if (!webhookUrl) {
    return { ok: false, detail: 'ESCALATION_WEBHOOK_URL is not configured.' }
  }

  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      source: 'desios-alert-escalation',
      alert,
    }),
  })

  if (!response.ok) {
    const body = await response.text()
    return { ok: false, detail: `Webhook failed (${response.status}): ${body}` }
  }

  return { ok: true, detail: 'Webhook delivered.' }
}

async function deliverResendEmail(alert: AlertPayload) {
  const resendApiKey = Deno.env.get('RESEND_API_KEY')
  const escalationEmailTo = Deno.env.get('ESCALATION_EMAIL_TO')
  const escalationEmailFrom = Deno.env.get('ESCALATION_EMAIL_FROM')

  if (!resendApiKey || !escalationEmailTo || !escalationEmailFrom) {
    return { ok: false, detail: 'Resend email env vars are not fully configured.' }
  }

  const subject = `[DesiOS][CRITICAL] ${alert.title}`
  const html = `
    <h2>Critical DesiOS Alert</h2>
    <p><strong>Module:</strong> ${alert.module}</p>
    <p><strong>Type:</strong> ${alert.alert_type}</p>
    <p><strong>Message:</strong> ${alert.message}</p>
    <p><strong>Location:</strong> ${alert.location_id}</p>
    <p><strong>Created:</strong> ${alert.created_at}</p>
    <p><strong>Alert ID:</strong> ${alert.id}</p>
  `

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: escalationEmailFrom,
      to: [escalationEmailTo],
      subject,
      html,
    }),
  })

  if (!response.ok) {
    const body = await response.text()
    return { ok: false, detail: `Email failed (${response.status}): ${body}` }
  }

  return { ok: true, detail: 'Email delivered.' }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body = (await req.json()) as DatabaseWebhookBody | AlertPayload
    const alert = 'record' in body ? body.record : (body as AlertPayload)

    if (!alert) {
      return new Response(JSON.stringify({ ok: false, error: 'No alert payload provided.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (alert.severity !== 'critical' || !alert.is_escalated) {
      return new Response(JSON.stringify({ ok: true, skipped: true, reason: 'Not a critical escalated alert.' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const [webhookResult, emailResult] = await Promise.all([
      deliverWebhook(alert),
      deliverResendEmail(alert),
    ])

    return new Response(JSON.stringify({
      ok: webhookResult.ok || emailResult.ok,
      webhook: webhookResult,
      email: emailResult,
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    return new Response(JSON.stringify({
      ok: false,
      error: error instanceof Error ? error.message : 'Unknown escalation error',
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
