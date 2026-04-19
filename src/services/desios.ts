import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

export type AppUser = {
  id: string
  email: string
  display_name: string
  role: 'staff' | 'admin'
  location_id: string
}

export type TempHistoryEntry = {
  item: string
  value: number
  valid: boolean
}

export type WasteEntry = {
  item: string
  qty: number
  reason: string
}

export type GuidedResumeState = {
  openingCompletionId: string | null
  openingCompletedOrders: number[]
  activeTempLogId: string | null
  loggedTempItemIds: string[]
}

export type ComplianceReportRow = {
  service_date: string
  checklist_completed: number
  checklist_total: number
  unresolved_critical_alerts: number
  waste_portions: number
}

export async function signIn(email: string, password: string) {
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) {
    throw error
  }
}

export async function signOut() {
  const { error } = await supabase.auth.signOut()
  if (error) {
    throw error
  }
}

export async function getSession() {
  const { data, error } = await supabase.auth.getSession()
  if (error) {
    throw error
  }
  return data.session
}

export function onAuthChange(callback: (session: Session | null) => void) {
  const { data } = supabase.auth.onAuthStateChange((_event, session) => callback(session))
  return () => data.subscription.unsubscribe()
}

export async function getCurrentAppUser() {
  const session = await getSession()
  const userId = session?.user.id
  if (!userId) {
    return null
  }

  const { data, error } = await supabase
    .from('users')
    .select('id,email,display_name,role,location_id')
    .eq('id', userId)
    .single()

  if (error) {
    throw error
  }

  return data as AppUser
}

export async function loadSnapshot(locationId: string) {
  const serviceDate = new Date().toISOString().slice(0, 10)

  const [tasksRes, tempsRes, wasteRes, alertsRes] = await Promise.all([
    supabase
      .from('task_completions')
      .select('id, checklist_completions!inner(location_id,service_date)')
      .eq('checklist_completions.location_id', locationId)
      .eq('checklist_completions.service_date', serviceDate),
    supabase
      .from('temp_log_entries')
      .select('temperature,is_valid,temp_items(name),temp_logs!inner(location_id,service_date)')
      .eq('temp_logs.location_id', locationId)
      .eq('temp_logs.service_date', serviceDate)
      .order('logged_at', { ascending: false })
      .limit(8),
    supabase
      .from('waste_entries')
      .select('item_name,quantity_portions,reason')
      .eq('location_id', locationId)
      .eq('service_date', serviceDate)
      .order('logged_at', { ascending: false })
      .limit(12),
    supabase
      .from('alerts')
      .select('message,is_read')
      .eq('location_id', locationId)
      .eq('is_read', false)
      .order('created_at', { ascending: false })
      .limit(10),
  ])

  if (tasksRes.error) {
    throw tasksRes.error
  }
  if (tempsRes.error) {
    throw tempsRes.error
  }
  if (wasteRes.error) {
    throw wasteRes.error
  }
  if (alertsRes.error) {
    throw alertsRes.error
  }

  const tempHistory: TempHistoryEntry[] = (tempsRes.data ?? []).map((row) => ({
    item: (row.temp_items as { name?: string } | null)?.name ?? 'Unknown Item',
    value: Number(row.temperature ?? 0),
    valid: Boolean(row.is_valid),
  }))

  const wasteEntries: WasteEntry[] = (wasteRes.data ?? []).map((row) => ({
    item: row.item_name,
    qty: Number(row.quantity_portions),
    reason: row.reason,
  }))

  const alerts = (alertsRes.data ?? []).map((row) => row.message)

  return {
    openingCompleted: tasksRes.data?.length ?? 0,
    tempHistory,
    wasteEntries,
    alerts,
  }
}

export async function ensureChecklistCompletion(locationId: string, checklistSlug: 'opening' | 'midday' | 'closing') {
  const serviceDate = new Date().toISOString().slice(0, 10)
  const session = await getSession()
  const userId = session?.user.id
  if (!userId) {
    throw new Error('Session required.')
  }

  const { data: definition, error: definitionError } = await supabase
    .from('checklist_definitions')
    .select('id')
    .eq('slug', checklistSlug)
    .eq('location_id', locationId)
    .single()

  if (definitionError) {
    throw definitionError
  }

  const { data, error } = await supabase
    .from('checklist_completions')
    .upsert(
      {
        checklist_definition_id: definition.id,
        location_id: locationId,
        service_date: serviceDate,
        status: 'in_progress',
        started_at: new Date().toISOString(),
        completed_by: userId,
      },
      { onConflict: 'checklist_definition_id,location_id,service_date' },
    )
    .select('id')
    .single()

  if (error) {
    throw error
  }

  return data.id as string
}

export async function upsertTaskCompletion(completionId: string, checklistSlug: 'opening' | 'midday' | 'closing', sortOrder: number, inputValue: Record<string, unknown>) {
  const session = await getSession()
  const userId = session?.user.id
  if (!userId) {
    throw new Error('Session required.')
  }

  const { data: taskDef, error: taskDefError } = await supabase
    .from('checklist_task_definitions')
    .select('id, checklist_definitions!inner(slug)')
    .eq('checklist_definitions.slug', checklistSlug)
    .eq('sort_order', sortOrder)
    .single()

  if (taskDefError) {
    throw taskDefError
  }

  const { error } = await supabase
    .from('task_completions')
    .upsert(
      {
        checklist_completion_id: completionId,
        task_definition_id: taskDef.id,
        status: 'completed',
        input_value: inputValue,
        completed_at: new Date().toISOString(),
        completed_by: userId,
      },
      { onConflict: 'checklist_completion_id,task_definition_id' },
    )

  if (error) {
    throw error
  }
}

export async function loadTempItemIdMap(locationId: string) {
  const { data, error } = await supabase
    .from('temp_items')
    .select('id,name')
    .eq('location_id', locationId)
    .eq('is_active', true)

  if (error) {
    throw error
  }

  return new Map((data ?? []).map((row) => [row.name, row.id]))
}

export async function logTemperatureEntry(params: {
  locationId: string
  scheduledTime: string
  tempItemId: string
  reading: number
  isValid: boolean
  proofFile: File
}) {
  const serviceDate = new Date().toISOString().slice(0, 10)
  const session = await getSession()
  const userId = session?.user.id
  if (!userId) {
    throw new Error('Session required.')
  }

  const { data: tempLog, error: tempLogError } = await supabase
    .from('temp_logs')
    .upsert(
      {
        location_id: params.locationId,
        service_date: serviceDate,
        scheduled_time: params.scheduledTime,
        status: 'in_progress',
        started_at: new Date().toISOString(),
        completed_by: userId,
      },
      { onConflict: 'location_id,service_date,scheduled_time' },
    )
    .select('id')
    .single()

  if (tempLogError) {
    throw tempLogError
  }

  const fileExt = params.proofFile.name.split('.').pop() ?? 'jpg'
  const filePath = `${params.locationId}/${serviceDate}/${crypto.randomUUID()}.${fileExt}`

  const { error: uploadError } = await supabase.storage
    .from('temp-proofs')
    .upload(filePath, params.proofFile, { upsert: false })

  if (uploadError) {
    throw uploadError
  }

  const { error: entryError } = await supabase
    .from('temp_log_entries')
    .upsert(
      {
        temp_log_id: tempLog.id,
        temp_item_id: params.tempItemId,
        temperature: params.reading,
        is_valid: params.isValid,
        photo_url: filePath,
        logged_by: userId,
        logged_at: new Date().toISOString(),
      },
      { onConflict: 'temp_log_id,temp_item_id' },
    )

  if (entryError) {
    throw entryError
  }

  return tempLog.id as string
}

export async function setChecklistCompletionStatus(completionId: string, status: 'in_progress' | 'completed' | 'overdue') {
  const { error } = await supabase.rpc('transition_checklist_completion', {
    p_completion_id: completionId,
    p_target_status: status,
  })

  if (error) {
    throw error
  }
}

export async function setTempLogStatus(tempLogId: string, status: 'in_progress' | 'completed' | 'failed' | 'missed') {
  const { error } = await supabase
    .from('temp_logs')
    .update({ status, completed_at: status === 'completed' ? new Date().toISOString() : null })
    .eq('id', tempLogId)

  if (error) {
    throw error
  }
}

export async function loadGuidedResumeState(locationId: string): Promise<GuidedResumeState> {
  const serviceDate = new Date().toISOString().slice(0, 10)

  const { data: openingDefinition, error: openingDefinitionError } = await supabase
    .from('checklist_definitions')
    .select('id')
    .eq('location_id', locationId)
    .eq('slug', 'opening')
    .single()

  if (openingDefinitionError) {
    throw openingDefinitionError
  }

  const { data: openingCompletion, error: openingCompletionError } = await supabase
    .from('checklist_completions')
    .select('id,status')
    .eq('checklist_definition_id', openingDefinition.id)
    .eq('location_id', locationId)
    .eq('service_date', serviceDate)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (openingCompletionError) {
    throw openingCompletionError
  }

  let openingCompletedOrders: number[] = []
  if (openingCompletion?.id) {
    const { data: completedTasks, error: completedTasksError } = await supabase
      .from('task_completions')
      .select('task_definition_id, checklist_task_definitions!inner(sort_order)')
      .eq('checklist_completion_id', openingCompletion.id)

    if (completedTasksError) {
      throw completedTasksError
    }

    openingCompletedOrders = (completedTasks ?? [])
      .map((row) => (row.checklist_task_definitions as { sort_order?: number } | null)?.sort_order ?? 0)
      .filter((value) => value > 0)
      .sort((a, b) => a - b)
  }

  const { data: activeTempLog, error: tempLogError } = await supabase
    .from('temp_logs')
    .select('id,status')
    .eq('location_id', locationId)
    .eq('service_date', serviceDate)
    .in('status', ['in_progress', 'failed'])
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (tempLogError) {
    throw tempLogError
  }

  let loggedTempItemIds: string[] = []
  if (activeTempLog?.id) {
    const { data: entries, error: entriesError } = await supabase
      .from('temp_log_entries')
      .select('temp_item_id')
      .eq('temp_log_id', activeTempLog.id)

    if (entriesError) {
      throw entriesError
    }

    loggedTempItemIds = (entries ?? []).map((row) => row.temp_item_id)
  }

  return {
    openingCompletionId: openingCompletion?.id ?? null,
    openingCompletedOrders,
    activeTempLogId: activeTempLog?.id ?? null,
    loggedTempItemIds,
  }
}

export async function fetchComplianceReport(locationId: string, fromDate: string, toDate: string): Promise<ComplianceReportRow[]> {
  const [checklistsRes, alertsRes, wasteRes] = await Promise.all([
    supabase
      .from('checklist_completions')
      .select('service_date,status')
      .eq('location_id', locationId)
      .gte('service_date', fromDate)
      .lte('service_date', toDate),
    supabase
      .from('alerts')
      .select('created_at,is_read,severity')
      .eq('location_id', locationId)
      .eq('severity', 'critical')
      .eq('is_read', false),
    supabase
      .from('waste_entries')
      .select('service_date,quantity_portions')
      .eq('location_id', locationId)
      .gte('service_date', fromDate)
      .lte('service_date', toDate),
  ])

  if (checklistsRes.error) {
    throw checklistsRes.error
  }
  if (alertsRes.error) {
    throw alertsRes.error
  }
  if (wasteRes.error) {
    throw wasteRes.error
  }

  const byDate = new Map<string, ComplianceReportRow>()

  for (const row of checklistsRes.data ?? []) {
    const key = row.service_date
    if (!byDate.has(key)) {
      byDate.set(key, {
        service_date: key,
        checklist_completed: 0,
        checklist_total: 0,
        unresolved_critical_alerts: 0,
        waste_portions: 0,
      })
    }
    const item = byDate.get(key) as ComplianceReportRow
    item.checklist_total += 1
    if (row.status === 'completed') {
      item.checklist_completed += 1
    }
  }

  for (const row of wasteRes.data ?? []) {
    const key = row.service_date
    if (!byDate.has(key)) {
      byDate.set(key, {
        service_date: key,
        checklist_completed: 0,
        checklist_total: 0,
        unresolved_critical_alerts: 0,
        waste_portions: 0,
      })
    }
    const item = byDate.get(key) as ComplianceReportRow
    item.waste_portions += Number(row.quantity_portions ?? 0)
  }

  for (const row of alertsRes.data ?? []) {
    const key = row.created_at.slice(0, 10)
    if (!byDate.has(key)) {
      byDate.set(key, {
        service_date: key,
        checklist_completed: 0,
        checklist_total: 0,
        unresolved_critical_alerts: 0,
        waste_portions: 0,
      })
    }
    const item = byDate.get(key) as ComplianceReportRow
    item.unresolved_critical_alerts += 1
  }

  return Array.from(byDate.values()).sort((a, b) => a.service_date.localeCompare(b.service_date))
}

export function toCsv(rows: Record<string, string | number>[]) {
  if (rows.length === 0) {
    return ''
  }

  const headers = Object.keys(rows[0])
  const lines = [headers.join(',')]

  for (const row of rows) {
    const values = headers.map((header) => {
      const raw = String(row[header] ?? '')
      const escaped = raw.replaceAll('"', '""')
      return `"${escaped}"`
    })
    lines.push(values.join(','))
  }

  return lines.join('\n')
}

export async function insertWasteEntry(params: {
  locationId: string
  itemName: string
  batchNumber: string
  quantityPortions: number
  reason: string
  notes: string
}) {
  const serviceDate = new Date().toISOString().slice(0, 10)
  const session = await getSession()
  const userId = session?.user.id
  if (!userId) {
    throw new Error('Session required.')
  }

  const { error } = await supabase.from('waste_entries').insert({
    location_id: params.locationId,
    service_date: serviceDate,
    item_name: params.itemName,
    batch_number: params.batchNumber,
    quantity_portions: params.quantityPortions,
    reason: params.reason,
    notes: params.notes,
    logged_by: userId,
    logged_at: new Date().toISOString(),
  })

  if (error) {
    throw error
  }
}

export async function evaluateAlerts(locationId: string) {
  const serviceDate = new Date().toISOString().slice(0, 10)
  const { error } = await supabase.rpc('evaluate_alerts', {
    p_location_id: locationId,
    p_service_date: serviceDate,
  })

  if (error) {
    throw error
  }
}

export function subscribeToAlerts(locationId: string, onNewMessage: (message: string) => void) {
  const channel = supabase
    .channel(`alerts:${locationId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'alerts',
        filter: `location_id=eq.${locationId}`,
      },
      (payload) => {
        const message = (payload.new as { message?: string }).message
        if (message) {
          onNewMessage(message)
        }
      },
    )
    .subscribe()

  return () => {
    void supabase.removeChannel(channel)
  }
}
