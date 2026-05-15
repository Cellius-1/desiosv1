import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ensureChecklistCompletion,
  evaluateAlerts,
  fetchComplianceReport,
  getCurrentAppUser,
  insertWasteEntry,
  loadGuidedResumeState,
  loadSnapshot,
  loadTempItemIdMap,
  logTemperatureEntry,
  onAuthChange,
  setChecklistCompletionStatus,
  setTempLogStatus,
  signIn,
  signOut,
  subscribeToAlerts,
  toCsv,
  upsertTaskCompletion,
  type AppUser,
  type ComplianceReportRow,
} from './services/desios'
import { isSupabaseConfigured } from './lib/supabase'
import SopViewer from './components/SopViewer'

type ModuleKey = 'home' | 'checklists' | 'temps' | 'waste' | 'data' | 'profile'
type ChecklistKey = 'opening' | 'midday' | 'closing'
type TaskKind = 'checkbox' | 'numeric' | 'dualNumeric' | 'multi'
type DataTabKey = 'import' | 'sales' | 'forecast' | 'profit'
type TempRangeKey = 'today' | '7days' | '30days' | 'all'

type DraftConflict = {
  openingDelta: number
  tempDelta: number
  hasUnsyncedInput: boolean
  isSignificant: boolean
}

type ChecklistTask = {
  title: string
  description: string
  kind: TaskKind
  min?: number
  max?: number
  subItems?: string[]
  requiresPhoto?: boolean
  sopUrl?: string
}

type TempItem = {
  name: string
  type: 'hot' | 'cold'
  min?: number
  max?: number
}

const openingTasks: ChecklistTask[] = [
  { title: 'Hand wash + PPE', description: 'Verify gloves, apron, and hygiene readiness.', kind: 'checkbox', sopUrl: 'https://desi-sop.vercel.app/#07' },
  {
    title: 'Thermometer calibration',
    description: 'Target 32F plus/minus 2F with image proof.',
    kind: 'numeric',
    min: 30,
    max: 34,
    requiresPhoto: true,
    sopUrl: 'https://desi-sop.vercel.app/#07',
  },
  { title: 'Equipment verification', description: 'Confirm prep station and probe kits are ready.', kind: 'checkbox', sopUrl: 'https://desi-sop.vercel.app/#07' },
  { title: 'Cold storage pull + date check', description: 'Inspect labels and discard-by dates.', kind: 'checkbox', sopUrl: 'https://desi-sop.vercel.app/#07' },
  { title: 'Oven preheat + chicken load', description: 'Validate 400F preheat and initial batch load.', kind: 'checkbox', sopUrl: 'https://desi-sop.vercel.app/#07' },
  {
    title: 'Protein reheat (Keema + Chole)',
    description: 'Both proteins must be at or above 165F.',
    kind: 'dualNumeric',
    min: 165,
    requiresPhoto: true,
    sopUrl: 'https://desi-sop.vercel.app/#07',
  },
  {
    title: 'Sauce reheat (BM + Palak)',
    description: 'Both sauces must be at or above 165F.',
    kind: 'dualNumeric',
    min: 165,
    requiresPhoto: true,
    sopUrl: 'https://desi-sop.vercel.app/#07',
  },
  {
    title: 'Final verification',
    description: 'All five opening standards must be confirmed.',
    kind: 'multi',
    subItems: [
      'Hot items verified at 140F+',
      'Utensils dedicated and staged',
      'Allergen chart visible',
      'Opening stock minimum met',
      'Lead operator quality check passed',
    ],
    sopUrl: 'https://desi-sop.vercel.app/#07',
  },
]

const checklistMeta = {
  opening: { label: 'Opening Inspection', total: 8, due: 'Due 11:30 AM' },
  midday: { label: 'Safe Food Intervals', total: 5, due: 'Due 4:00 PM' },
  closing: { label: 'Closing Procedure', total: 9, due: 'Unlocks 9:00 PM' },
}

const tempItems: TempItem[] = [
  { name: 'Walk-in Refrigerator', type: 'cold', max: 40 },
  { name: 'Freezer', type: 'cold', max: 0 },
  { name: 'Hot Hold - Butter Chicken', type: 'hot', min: 140 },
  { name: 'Hot Hold - Keema', type: 'hot', min: 140 },
  { name: 'Hot Hold - Chole', type: 'hot', min: 140 },
  { name: 'Hot Hold - Paneer', type: 'hot', min: 140 },
  { name: 'Hot Hold - Butter Masala', type: 'hot', min: 140 },
  { name: 'Hot Hold - Palak Sauce', type: 'hot', min: 140 },
  { name: 'Hot Hold - Basmati Rice', type: 'hot', min: 140 },
]

const yieldsByItem: Record<string, number> = {
  'Butter Chicken': 35,
  Keema: 35,
  Chole: 40,
  'Butter Masala': 30,
  'Palak Sauce': 35,
  Paneer: 40,
}

const salesSeed: Record<string, Record<string, number[]>> = {
  'Butter Chicken': { Mon: [72, 68, 64], Tue: [64, 61, 58], Wed: [70, 66, 62], Thu: [76, 70, 68], Fri: [85, 80, 74] },
  Keema: { Mon: [58, 52, 48], Tue: [50, 47, 45], Wed: [55, 52, 50], Thu: [57, 54, 49], Fri: [62, 60, 55] },
  Chole: { Mon: [41, 39, 37], Tue: [34, 33, 32], Wed: [40, 38, 36], Thu: [42, 40, 38], Fri: [49, 46, 42] },
}

const tempItemGroups = ['All', 'Freezer', 'Hot Hold - Keema', 'Hot Hold - Chicken', 'Hot Hold - Chole', 'Hot Hold - Paneer', 'Sauce Pan #1', 'Sauce Pan #2']

function App() {
  const [appUser, setAppUser] = useState<AppUser | null>(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [authError, setAuthError] = useState('')
  const [setupError, setSetupError] = useState('')
  const [syncError, setSyncError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isHydrating, setIsHydrating] = useState(true)

  const [activeModule, setActiveModule] = useState<ModuleKey>('home')
  const [activeChecklist, setActiveChecklist] = useState<ChecklistKey>('opening')
  const [openingCompleted, setOpeningCompleted] = useState(0)
  const [criticalAlerts, setCriticalAlerts] = useState<string[]>([])
  const [openingChecklistCompletionId, setOpeningChecklistCompletionId] = useState<string | null>(null)
  const [activeTempLogId, setActiveTempLogId] = useState<string | null>(null)
  const [tempItemIdMap, setTempItemIdMap] = useState<Map<string, string>>(new Map())
  const [dataTab, setDataTab] = useState<DataTabKey>('forecast')
  const [tempHistoryRange, setTempHistoryRange] = useState<TempRangeKey>('7days')
  const [tempHistoryFilter, setTempHistoryFilter] = useState('All')
  const [sopViewerUrl, setSopViewerUrl] = useState<string | null>(null)

  const [taskInput, setTaskInput] = useState('')
  const [taskDualInput, setTaskDualInput] = useState({ first: '', second: '' })
  const [taskMultiInput, setTaskMultiInput] = useState<Record<string, boolean>>({})
  const [taskProofAttached, setTaskProofAttached] = useState(false)
  const [taskProofFile, setTaskProofFile] = useState<File | null>(null)

  const [tempCursor, setTempCursor] = useState(0)
  const [tempReading, setTempReading] = useState('')
  const [tempProofFile, setTempProofFile] = useState<File | null>(null)
  const [tempHistory, setTempHistory] = useState<Array<{ item: string; value: number; valid: boolean }>>([])

  const [wasteItem, setWasteItem] = useState('Butter Chicken')
  const [wasteBatch, setWasteBatch] = useState('B2')
  const [wasteQty, setWasteQty] = useState('')
  const [wasteReason, setWasteReason] = useState('time_limit')
  const [wasteNotes, setWasteNotes] = useState('')
  const [wasteEntries, setWasteEntries] = useState<Array<{ item: string; qty: number; reason: string }>>([])
  const [reportRows, setReportRows] = useState<ComplianceReportRow[]>([])
  const [reportFromDate, setReportFromDate] = useState(getDateOffset(-6))
  const [reportToDate, setReportToDate] = useState(getDateOffset(0))
  const [draftSaveState, setDraftSaveState] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [lastDraftSavedAt, setLastDraftSavedAt] = useState<number | null>(null)
  const [backendResumeBaseline, setBackendResumeBaseline] = useState({ openingCompleted: 0, tempLoggedCount: 0 })
  const [draftConflict, setDraftConflict] = useState<DraftConflict | null>(null)
  const draftSaveTimerRef = useRef<number | null>(null)

  useEffect(() => {
    const bootstrap = async () => {
      if (!isSupabaseConfigured) {
        setSetupError('Missing Supabase environment variables. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in a local .env file, then restart the dev server.')
        setAuthLoading(false)
        setIsHydrating(false)
        return
      }

      try {
        const user = await getCurrentAppUser()
        if (!user) {
          setAppUser(null)
          return
        }
        setAppUser(user)

        const [snapshot, itemMap, resumeState] = await Promise.all([
          loadSnapshot(user.location_id),
          loadTempItemIdMap(user.location_id),
          loadGuidedResumeState(user.location_id),
        ])

        const localDraft = readLocalDraft(user.id)
        const openingFromBackend = resumeState.openingCompletedOrders.length
        const openingFromSnapshot = snapshot.openingCompleted
        const openingFromLocal = localDraft?.openingCompleted ?? 0

        const mergedOpeningCount = Math.max(openingFromBackend, openingFromSnapshot, openingFromLocal)
        const backendTempCursor = resumeState.loggedTempItemIds.length % tempItems.length

        setOpeningCompleted(mergedOpeningCount)
        setOpeningChecklistCompletionId(resumeState.openingCompletionId)
        setActiveTempLogId(resumeState.activeTempLogId)
        setTempHistory(snapshot.tempHistory)
        setWasteEntries(snapshot.wasteEntries)
        setCriticalAlerts(snapshot.alerts)
        setTempItemIdMap(itemMap)
        setBackendResumeBaseline({
          openingCompleted: openingFromBackend,
          tempLoggedCount: resumeState.loggedTempItemIds.length,
        })

        if (localDraft?.tempCursor !== undefined) {
          setTempCursor(localDraft.tempCursor)
        } else {
          setTempCursor(backendTempCursor)
        }
        if (localDraft?.tempReading !== undefined) {
          setTempReading(localDraft.tempReading)
        }
        if (localDraft?.taskInput !== undefined) {
          setTaskInput(localDraft.taskInput)
        }
        if (localDraft?.taskDualInput) {
          setTaskDualInput(localDraft.taskDualInput)
        }
        if (localDraft?.taskMultiInput) {
          setTaskMultiInput(localDraft.taskMultiInput)
        }
      } catch (error) {
        setSyncError(error instanceof Error ? error.message : 'Failed to bootstrap session.')
      } finally {
        setAuthLoading(false)
        setIsHydrating(false)
      }
    }

    void bootstrap()

    const unsub = onAuthChange(() => {
      setAuthLoading(true)
      setIsHydrating(true)
      void bootstrap()
    })

    return () => {
      unsub()
    }
  }, [])

  useEffect(() => {
    if (!appUser) {
      return
    }

    const channelCleanup = subscribeToAlerts(appUser.location_id, (message) => {
      setCriticalAlerts((prev) => [message, ...prev].slice(0, 10))
    })

    return () => {
      channelCleanup()
    }
  }, [appUser])

  useEffect(() => {
    if (!appUser || isHydrating) {
      return
    }

    if (draftSaveTimerRef.current) {
      window.clearTimeout(draftSaveTimerRef.current)
    }

    setDraftSaveState('saving')
    draftSaveTimerRef.current = window.setTimeout(() => {
      writeLocalDraft(appUser.id, {
        openingCompleted,
        tempCursor,
        tempReading,
        taskInput,
        taskDualInput,
        taskMultiInput,
      })
      setDraftSaveState('saved')
      setLastDraftSavedAt(Date.now())
      draftSaveTimerRef.current = null
    }, 700)

    return () => {
      if (draftSaveTimerRef.current) {
        window.clearTimeout(draftSaveTimerRef.current)
      }
    }
  }, [appUser, isHydrating, openingCompleted, tempCursor, tempReading, taskInput, taskDualInput, taskMultiInput])

  useEffect(() => {
    if (!appUser) {
      setDraftConflict(null)
      return
    }

    const backendTempCursor = backendResumeBaseline.tempLoggedCount % tempItems.length
    const openingDelta = Math.abs(openingCompleted - backendResumeBaseline.openingCompleted)
    const tempDelta = circularDelta(tempCursor, backendTempCursor, tempItems.length)
    const hasUnsyncedInput =
      Boolean(tempReading.trim()) ||
      Boolean(taskInput.trim()) ||
      Boolean(taskDualInput.first.trim()) ||
      Boolean(taskDualInput.second.trim()) ||
      Object.values(taskMultiInput).some(Boolean)
    const isSignificant = openingDelta >= 2 || tempDelta >= 3 || (hasUnsyncedInput && (openingDelta >= 1 || tempDelta >= 1))

    if (!isSignificant) {
      setDraftConflict(null)
      return
    }

    setDraftConflict({
      openingDelta,
      tempDelta,
      hasUnsyncedInput,
      isSignificant,
    })
  }, [appUser, backendResumeBaseline, openingCompleted, taskDualInput.first, taskDualInput.second, taskInput, taskMultiInput, tempCursor, tempReading])

  const hour = new Date().getHours()
  const middayUnlocked = hour >= 12
  const closingUnlocked = hour >= 21
  const shiftLabel = hour >= 16 || hour < 5 ? 'Night shift' : 'Day shift'
  const openingPercent = Math.round((openingCompleted / checklistMeta.opening.total) * 100)

  const pendingChecklistCount =
    (openingCompleted < checklistMeta.opening.total ? 1 : 0) +
    (middayUnlocked ? 1 : 0) +
    (closingUnlocked ? 1 : 0)

  const complianceState = useMemo(() => {
    if (criticalAlerts.length > 0) {
      return { label: 'CRITICAL', tone: 'critical', percent: 64 }
    }
    if (pendingChecklistCount === 0) {
      return { label: 'ALL CLEAR', tone: 'clear', percent: 100 }
    }
    return { label: 'ATTENTION NEEDED', tone: 'attention', percent: 82 }
  }, [criticalAlerts.length, pendingChecklistCount])

  const filteredTempHistory = tempHistoryFilter === 'All' ? tempHistory : tempHistory.filter((entry) => entry.item === tempHistoryFilter)

  const nextStep = useMemo(() => {
    if (openingCompleted < openingTasks.length) {
      return {
        title: 'Start with Opening Checklist',
        detail: `You have ${openingTasks.length - openingCompleted} opening steps left.`,
        module: 'checklists' as ModuleKey,
        action: 'Open checklist',
      }
    }

    if (tempHistory.length === 0) {
      return {
        title: 'Log your first temperature',
        detail: 'Capture one temperature reading with a photo to begin safety tracking.',
        module: 'temps' as ModuleKey,
        action: 'Go to temperatures',
      }
    }

    if (wasteEntries.length === 0) {
      return {
        title: 'Add waste entry (if any)',
        detail: 'Record discarded ounces so inventory and forecasting stay accurate.',
        module: 'waste' as ModuleKey,
        action: 'Open waste log',
      }
    }

    return {
      title: 'Great progress this shift',
      detail: 'Review reports or export a summary when you are ready.',
      module: 'data' as ModuleKey,
      action: 'Open data hub',
    }
  }, [openingCompleted, tempHistory.length, wasteEntries.length])

  const currentTask = openingTasks[openingCompleted]
  const openingProgress = Math.round((openingCompleted / openingTasks.length) * 100)

  const taskCanAdvance = useMemo(() => {
    if (!currentTask) {
      return false
    }

    if (currentTask.kind === 'checkbox') {
      return taskInput === 'complete'
    }

    if (currentTask.kind === 'numeric') {
      const n = Number(taskInput)
      if (Number.isNaN(n)) {
        return false
      }
      const inRange = (currentTask.min === undefined || n >= currentTask.min) && (currentTask.max === undefined || n <= currentTask.max)
      return inRange && (!currentTask.requiresPhoto || taskProofAttached)
    }

    if (currentTask.kind === 'dualNumeric') {
      const a = Number(taskDualInput.first)
      const b = Number(taskDualInput.second)
      if (Number.isNaN(a) || Number.isNaN(b)) {
        return false
      }
      const min = currentTask.min ?? Number.NEGATIVE_INFINITY
      return a >= min && b >= min && (!currentTask.requiresPhoto || taskProofAttached)
    }

    if (!currentTask.subItems) {
      return false
    }
    return currentTask.subItems.every((item) => taskMultiInput[item])
  }, [currentTask, taskDualInput.first, taskDualInput.second, taskInput, taskMultiInput, taskProofAttached])

  const forecastRows = useMemo(() => {
    return Object.entries(salesSeed).map(([item, byDay]) => {
      const fridayData = byDay.Fri ?? []
      const estimate = fridayData.length >= 3 ? fridayData[0] * 0.5 + fridayData[1] * 0.3 + fridayData[2] * 0.2 : fridayData.reduce((a, b) => a + b, 0) / Math.max(fridayData.length, 1)
      const wasteAdjustment = wasteEntries.filter((entry) => entry.item === item).reduce((sum, entry) => sum + entry.qty, 0) / 5
      const adjusted = Math.max(0, estimate - wasteAdjustment)
      const yieldSize = yieldsByItem[item] ?? 35
      return {
        item,
        forecast: Math.round(adjusted),
        batches: Math.ceil(adjusted / yieldSize),
      }
    })
  }, [wasteEntries])

  const salesRows = useMemo(() => {
    return Object.entries(salesSeed).map(([item, byDay]) => {
      const weeklyTotal = Object.values(byDay).flat().reduce((sum, value) => sum + value, 0)
      const averagePerDay = weeklyTotal / 5
      return {
        item,
        weeklyTotal,
        averagePerDay: Math.round(averagePerDay),
      }
    })
  }, [])

  const profitRows = useMemo(() => {
    return salesRows.map((row) => {
      const forecastRow = forecastRows.find((forecast) => forecast.item === row.item)
      const estimatedCost = (forecastRow?.forecast ?? 0) * 2.4
      const estimatedRevenue = row.weeklyTotal * 4.2
      return {
        item: row.item,
        estimatedRevenue: Math.round(estimatedRevenue),
        estimatedCost: Math.round(estimatedCost),
        estimatedProfit: Math.round(estimatedRevenue - estimatedCost),
      }
    })
  }, [forecastRows, salesRows])

  const completeTask = async () => {
    if (!taskCanAdvance || !appUser || !currentTask) {
      return
    }

    try {
      setIsSubmitting(true)
      const completionId =
        openingChecklistCompletionId ??
        (await ensureChecklistCompletion(appUser.location_id, 'opening'))

      if (!openingChecklistCompletionId) {
        setOpeningChecklistCompletionId(completionId)
      }

      const nextTaskOrder = openingCompleted + 1
      let payload: Record<string, unknown> = {}

      if (currentTask.kind === 'checkbox') {
        payload = { complete: true }
      } else if (currentTask.kind === 'numeric') {
        payload = { temperature: Number(taskInput), photo_attached: taskProofAttached }
      } else if (currentTask.kind === 'dualNumeric') {
        payload = { first: Number(taskDualInput.first), second: Number(taskDualInput.second), photo_attached: taskProofAttached }
      } else {
        payload = { checks: taskMultiInput }
      }

      await upsertTaskCompletion(completionId, 'opening', nextTaskOrder, payload)

      if (nextTaskOrder >= openingTasks.length) {
        await setChecklistCompletionStatus(completionId, 'completed')
      } else {
        await setChecklistCompletionStatus(completionId, 'in_progress')
      }

      await evaluateAlerts(appUser.location_id)
    } catch (error) {
      setSyncError(error instanceof Error ? error.message : 'Failed to sync checklist task.')
      return
    } finally {
      setIsSubmitting(false)
    }

    setOpeningCompleted((prev) => Math.min(prev + 1, openingTasks.length))
    setBackendResumeBaseline((prev) => ({
      ...prev,
      openingCompleted: Math.min(prev.openingCompleted + 1, openingTasks.length),
    }))
    setTaskInput('')
    setTaskDualInput({ first: '', second: '' })
    setTaskProofAttached(false)
    setTaskProofFile(null)
  }

  const logTemp = async () => {
    const current = tempItems[tempCursor]
    if (!current || !appUser || !tempProofFile) {
      return
    }

    const value = Number(tempReading)
    if (Number.isNaN(value)) {
      return
    }

    const tempItemId = tempItemIdMap.get(current.name)
    if (!tempItemId) {
      setSyncError(`Temp item missing in database: ${current.name}`)
      return
    }

    const valid = (current.min === undefined || value >= current.min) && (current.max === undefined || value <= current.max)

    try {
      setIsSubmitting(true)
      const tempLogId = await logTemperatureEntry({
        locationId: appUser.location_id,
        scheduledTime: nearestScheduledTime(),
        tempItemId,
        reading: value,
        isValid: valid,
        proofFile: tempProofFile,
      })

      setActiveTempLogId(tempLogId)

      if (tempCursor + 1 >= tempItems.length) {
        await setTempLogStatus(tempLogId, valid ? 'completed' : 'failed')
      }

      await evaluateAlerts(appUser.location_id)
    } catch (error) {
      setSyncError(error instanceof Error ? error.message : 'Failed to sync temperature log.')
      return
    } finally {
      setIsSubmitting(false)
    }

    setTempHistory((prev) => [{ item: current.name, value, valid }, ...prev].slice(0, 8))
    setBackendResumeBaseline((prev) => ({
      ...prev,
      tempLoggedCount: prev.tempLoggedCount + 1,
    }))

    if (!valid) {
      setCriticalAlerts((prev) => [`Unsafe temperature: ${current.name} at ${value}F`, ...prev])
    }

    setTempReading('')
    setTempProofFile(null)
    setTempCursor((prev) => (prev + 1) % tempItems.length)
  }

  const addWasteEntry = async () => {
    const qty = Number(wasteQty)
    if (Number.isNaN(qty) || qty <= 0 || !appUser) {
      return
    }

    try {
      setIsSubmitting(true)
      await insertWasteEntry({
        locationId: appUser.location_id,
        itemName: wasteItem,
        batchNumber: wasteBatch,
        quantityOunces: qty,
        reason: wasteReason,
        notes: wasteNotes,
      })
      await evaluateAlerts(appUser.location_id)
    } catch (error) {
      setSyncError(error instanceof Error ? error.message : 'Failed to sync waste entry.')
      return
    } finally {
      setIsSubmitting(false)
    }

    setWasteEntries((prev) => [{ item: wasteItem, qty, reason: wasteReason }, ...prev])
    setWasteQty('')
    setWasteNotes('')
    setWasteBatch(`B${Math.floor(Math.random() * 8) + 1}`)
  }

  const handleAuthLogin = async () => {
    try {
      setAuthError('')
      setIsSubmitting(true)
      await signIn(email, password)
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'Sign in failed.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSignOut = async () => {
    try {
      setIsSubmitting(true)
      await signOut()
      setAppUser(null)
      setOpeningChecklistCompletionId(null)
      setActiveTempLogId(null)
      setTempItemIdMap(new Map())
      setReportRows([])
      setDraftSaveState('idle')
      setLastDraftSavedAt(null)
      setBackendResumeBaseline({ openingCompleted: 0, tempLoggedCount: 0 })
      setDraftConflict(null)
    } catch (error) {
      setSyncError(error instanceof Error ? error.message : 'Sign out failed.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const loadReport = async () => {
    if (!appUser) {
      return
    }

    try {
      setIsSubmitting(true)
      const rows = await fetchComplianceReport(appUser.location_id, reportFromDate, reportToDate)
      setReportRows(rows)
    } catch (error) {
      setSyncError(error instanceof Error ? error.message : 'Failed to load compliance report.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const exportReportCsv = () => {
    const csv = toCsv(
      reportRows.map((row) => ({
        service_date: row.service_date,
        checklist_completed: row.checklist_completed,
        checklist_total: row.checklist_total,
        unresolved_critical_alerts: row.unresolved_critical_alerts,
        waste_portions: row.waste_portions,
      })),
    )

    downloadCsv(csv, `desios-compliance-${reportFromDate}-to-${reportToDate}.csv`)
  }

  const exportCurrentSessionCsv = () => {
    const csv = toCsv([
      {
        date: getDateOffset(0),
        opening_completed: openingCompleted,
        opening_total: openingTasks.length,
        temp_logs_captured: tempHistory.length,
        waste_entries_count: wasteEntries.length,
        unresolved_alerts: criticalAlerts.length,
      },
    ])

    downloadCsv(csv, `desios-session-${getDateOffset(0)}.csv`)
  }

  const exportReportPdf = () => {
    setDataTab('profit')
    window.setTimeout(() => window.print(), 80)
  }

  const resolveWithLocalDraft = () => {
    if (!appUser) {
      return
    }

    writeLocalDraft(appUser.id, {
      openingCompleted,
      tempCursor,
      tempReading,
      taskInput,
      taskDualInput,
      taskMultiInput,
    })
    setBackendResumeBaseline({
      openingCompleted,
      tempLoggedCount: tempCursor,
    })
    setDraftSaveState('saved')
    setLastDraftSavedAt(Date.now())
  }

  const resolveWithBackendState = () => {
    if (!appUser) {
      return
    }

    const backendTempCursor = backendResumeBaseline.tempLoggedCount % tempItems.length
    setOpeningCompleted(backendResumeBaseline.openingCompleted)
    setTempCursor(backendTempCursor)
    setTempReading('')
    setTaskInput('')
    setTaskDualInput({ first: '', second: '' })
    setTaskMultiInput({})
    setTaskProofAttached(false)
    setTaskProofFile(null)

    writeLocalDraft(appUser.id, {
      openingCompleted: backendResumeBaseline.openingCompleted,
      tempCursor: backendTempCursor,
      tempReading: '',
      taskInput: '',
      taskDualInput: { first: '', second: '' },
      taskMultiInput: {},
    })

    setDraftSaveState('saved')
    setLastDraftSavedAt(Date.now())
  }

  const draftSaveLabel =
    draftSaveState === 'saving'
      ? 'Draft saving...'
      : lastDraftSavedAt
        ? `Draft saved ${new Date(lastDraftSavedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
        : 'Draft sync idle'

  if (authLoading) {
    return (
      <div className="authPage">
        <div className="authCard">
          <h2>Setting up your shift workspace</h2>
          <p className="muted">Connecting your account and loading today&apos;s kitchen tasks.</p>
        </div>
      </div>
    )
  }

  if (!appUser) {
    return (
      <div className="authPage">
        <div className="authCard" role="form" aria-label="Sign in form">
          <h2>Welcome to your shift guide</h2>
          <p className="muted">Sign in to see step-by-step tasks for today.</p>
          {setupError ? <p className="criticalText">{setupError}</p> : null}
          <label htmlFor="emailInput" className="fieldLabel">Email</label>
          <input id="emailInput" className="fieldInput" aria-label="Email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Email" />
          <label htmlFor="passwordInput" className="fieldLabel">Password</label>
          <input id="passwordInput" className="fieldInput" aria-label="Password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Password" />
          {authError ? <p className="criticalText">{authError}</p> : null}
          <button className="cta" onClick={handleAuthLogin} disabled={isSubmitting || !email || !password}>
            Start shift
          </button>
        </div>
      </div>
    )
  }

  const renderGuidedTaskInput = () => {
    if (!currentTask) {
      return <p>Nice work. Opening checklist is complete. Midday checks will unlock automatically.</p>
    }

    if (currentTask.kind === 'checkbox') {
      return (
        <button className="pillToggle" onClick={() => setTaskInput(taskInput === 'complete' ? '' : 'complete')}>
          {taskInput === 'complete' ? 'Done for this step' : 'Tap to mark done'}
        </button>
      )
    }

    if (currentTask.kind === 'numeric') {
      return (
        <>
          <label className="fieldLabel">Temperature (F)</label>
          <input className="fieldInput" value={taskInput} onChange={(event) => setTaskInput(event.target.value)} placeholder="Enter value" />
          <div className="attachRow">
            <label className="attachButton">
              <input
                type="file"
                accept="image/*"
                onChange={(event) => {
                  const file = event.target.files?.[0] ?? null
                  setTaskProofFile(file)
                  setTaskProofAttached(Boolean(file))
                }}
              />
              {taskProofFile ? 'Change photo' : 'Attach proof photo'}
            </label>
            <span className="attachName">{taskProofFile ? taskProofFile.name : 'No photo attached yet'}</span>
          </div>
        </>
      )
    }

    if (currentTask.kind === 'dualNumeric') {
      return (
        <>
          <div className="fieldSplit">
            <input className="fieldInput" value={taskDualInput.first} onChange={(event) => setTaskDualInput((prev) => ({ ...prev, first: event.target.value }))} placeholder="First item" />
            <input className="fieldInput" value={taskDualInput.second} onChange={(event) => setTaskDualInput((prev) => ({ ...prev, second: event.target.value }))} placeholder="Second item" />
          </div>
          <div className="attachRow">
            <label className="attachButton">
              <input
                type="file"
                accept="image/*"
                onChange={(event) => {
                  const file = event.target.files?.[0] ?? null
                  setTaskProofFile(file)
                  setTaskProofAttached(Boolean(file))
                }}
              />
              {taskProofFile ? 'Change photo' : 'Attach proof photo'}
            </label>
            <span className="attachName">{taskProofFile ? taskProofFile.name : 'No photo attached yet'}</span>
          </div>
        </>
      )
    }

    return (
      <div className="checklistGrid">
        {currentTask.subItems?.map((item) => (
          <label key={item} className="proofRow">
            <input
              type="checkbox"
              checked={Boolean(taskMultiInput[item])}
              onChange={(event) => setTaskMultiInput((prev) => ({ ...prev, [item]: event.target.checked }))}
            />
            {item}
          </label>
        ))}
      </div>
    )
  }

  return (
    <div className="appShell">
      <a href="#mainContent" className="skipLink">Skip to main content</a>
      <aside className="sideRail" aria-label="Primary navigation">
        <div>
          <p className="brandKicker">DesiEats</p>
          <h1>DesiOS V1</h1>
          <p className="brandSub">Easy shift-by-shift kitchen guide</p>
        </div>

        <nav className="navStack" role="navigation" aria-label="Operations modules">
          {[
            { key: 'home', label: 'Today' },
            { key: 'checklists', label: 'Tasks' },
            { key: 'temps', label: 'Temps' },
            { key: 'waste', label: 'Waste' },
            { key: 'data', label: 'Reports' },
            { key: 'profile', label: 'Profile' },
          ].map((item) => (
            <button
              key={item.key}
              className={`navButton ${activeModule === item.key ? 'active' : ''}`}
              aria-pressed={activeModule === item.key}
              onClick={() => setActiveModule(item.key as ModuleKey)}
            >
              {item.label}
              {(item.key === 'checklists' && openingCompleted < checklistMeta.opening.total) || (item.key === 'temps' && tempHistory.some((entry) => !entry.valid)) ? (
                <span className="signalDot" />
              ) : null}
            </button>
          ))}
        </nav>
      </aside>

      <main id="mainContent" className="mainSurface" role="main">
        <header className="topBar" aria-label="Operations summary">
          <div>
            <p className="muted">{new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}</p>
            <h2>{shiftLabel}, {appUser.display_name}</h2>
          </div>
          <div className="topBarActions">
            <div className="statusRow" aria-live="polite">
              <span className={`statusBadge ${draftSaveState === 'saving' ? 'alertInfo' : 'alertSuccess'}`}>{draftSaveLabel}</span>
              {draftConflict?.isSignificant ? (
                <span className="statusBadge alertWarning">
                  Conflict: {draftConflict.openingDelta} checklist and {draftConflict.tempDelta} temp-step delta (wrap-aware)
                </span>
              ) : null}
            </div>
            <button className="ghostBtn" onClick={handleSignOut} disabled={isSubmitting}>End session</button>
            <div className={`ring ${complianceState.tone}`}>
              <strong>{complianceState.percent}%</strong>
              <span>{complianceState.label}</span>
            </div>
          </div>
        </header>

        <section className="coachBanner" aria-label="Suggested next action">
          <div>
            <h3>{nextStep.title}</h3>
            <p>{nextStep.detail}</p>
          </div>
          <button className="cta" onClick={() => setActiveModule(nextStep.module)}>{nextStep.action}</button>
        </section>

        <button className="quickPhotoButton" onClick={() => setActiveModule('temps')}>
          <span className="quickPhotoIcon">📷</span>
          <span>Quick Photo</span>
        </button>

        {syncError ? (
          <section className="alertBanner alertWarning" role="status">
            <span>Sync Warning</span>
            <p>{syncError}</p>
            <button onClick={() => setSyncError('')}>Dismiss</button>
          </section>
        ) : null}

        {criticalAlerts.length > 0 ? (
          <section className="alertBanner alertCritical" aria-live="polite">
            <span>Critical Escalation</span>
            <p>{criticalAlerts[0]}</p>
            <button onClick={() => setActiveModule('temps')}>Fix this now</button>
          </section>
        ) : null}

        {draftConflict?.isSignificant ? (
          <section className="alertBanner alertWarning" role="status" aria-live="polite">
            <span>Draft Divergence</span>
            <p>
              Local draft differs from backend baseline. Checklist delta: {draftConflict.openingDelta}, temperature step delta: {draftConflict.tempDelta}
              {draftConflict.hasUnsyncedInput ? ', with unsynced field input present.' : '.'}
            </p>
            <div className="alertActions">
              <button onClick={() => setActiveModule('checklists')}>Review draft</button>
              <button onClick={resolveWithLocalDraft}>Use local draft</button>
              <button onClick={resolveWithBackendState}>Use backend state</button>
            </div>
          </section>
        ) : null}

        {isHydrating ? (
          <section className="panelGrid" aria-label="Loading content">
            <article className="card largeCard skeletonCard" />
            <article className="card skeletonCard" />
            <article className="card skeletonCard" />
          </section>
        ) : null}

        {!isHydrating && activeModule === 'home' ? (
          <section className="homeStack">
            <article className={`statusSummary ${complianceState.tone}`}>
              <div>
                <p className="statusEyebrow">Current status</p>
                <h3>{complianceState.label}</h3>
                <p>{criticalAlerts.length > 0 ? 'Please resolve highlighted safety items first.' : 'Kitchen is running smoothly.'}</p>
              </div>
              <div className="statusMiniOrb">{complianceState.percent}%</div>
            </article>

            <article className="card immediateCard">
              <div className="cardTop">
                <p className="muted">IMMEDIATE</p>
                <span className="statusBadge alertWarning">ACTION NEEDED</span>
              </div>
              <div className="immediateRow">
                <div>
                  <h3>Checklists</h3>
                  <p className="muted">{openingCompleted < checklistMeta.opening.total ? 'Tasks pending' : 'Opening checklist complete'}</p>
                </div>
                <button className="cta" onClick={() => setActiveModule('checklists')}>Resume</button>
              </div>
              <div className="progressTrack" aria-label="Opening progress">
                <div className="progressFill" style={{ width: `${openingPercent}%` }} />
              </div>
              <p className="muted">Progress {openingPercent}%</p>
            </article>

            <article className="card largeCard rhythmCard">
              <h3>Today&apos;s Rhythm</h3>
              <div className="timeline">
                <button className="timelineRow rhythmButton" onClick={() => setActiveModule('checklists')}>
                  <strong>Opening Checks</strong>
                  <p>{openingPercent}% complete</p>
                  <span>Open</span>
                </button>
                <button className="timelineRow rhythmButton" onClick={() => setActiveModule('temps')}>
                  <strong>4-Hour Safety</strong>
                  <p>{middayUnlocked ? 'Active now' : 'Starts at noon'}</p>
                  <span>{middayUnlocked ? 'ACTIVE' : 'WAITING'}</span>
                </button>
                <div className="timelineRow mutedRow">
                  <strong>Closing Duties</strong>
                  <p>Unlocks at 9:00 PM</p>
                  <span>{closingUnlocked ? 'OPEN' : 'LOCKED'}</span>
                </div>
              </div>
            </article>

            <section className="quickLogGrid" aria-label="Quick log actions">
              <button className="quickLogTile" onClick={() => setActiveModule('temps')}>
                <h4>Log Temp</h4>
                <p>{tempHistory.length === 0 ? 'No temperatures logged yet' : `${tempHistory.length} readings today`}</p>
              </button>
              <button className="quickLogTile" onClick={() => setActiveModule('waste')}>
                <h4>Log Waste</h4>
                <p>{wasteEntries.length === 0 ? 'No recent activity' : `${wasteEntries.length} entries today`}</p>
              </button>
            </section>
          </section>
        ) : null}

        {!isHydrating && activeModule === 'checklists' ? (
          <section className="panelGrid">
            <article className="card">
              <h3>Task List</h3>
              <div className="stackedList">
                {(Object.keys(checklistMeta) as ChecklistKey[]).map((key) => {
                  const meta = checklistMeta[key]
                  const locked = (key === 'midday' && !middayUnlocked) || (key === 'closing' && !closingUnlocked)
                  const progress = key === 'opening' ? openingCompleted : 0
                  return (
                    <button key={key} className={`listButton ${activeChecklist === key ? 'selected' : ''}`} onClick={() => setActiveChecklist(key)}>
                      <div>
                        <strong>{meta.label}</strong>
                        <p>{meta.due}</p>
                      </div>
                      <span>{locked ? 'LOCKED' : `${progress}/${meta.total}`}</span>
                    </button>
                  )
                })}
              </div>
            </article>

            <article className="card largeCard">
              <h3>Step-by-step guide</h3>
              {activeChecklist === 'opening' ? (
                <div className="checklistFlow">
                  <div className="checklistProgressHeader">
                    <div>
                      <p className="muted">Opening checklist</p>
                      <h4>{openingCompleted}/{openingTasks.length} steps done</h4>
                    </div>
                    <span className="statusBadge alertInfo">{openingProgress}%</span>
                  </div>

                  <div className="openingStepList">
                    {openingTasks.map((task, index) => {
                      const done = index < openingCompleted
                      const active = index === openingCompleted
                      return (
                        <div key={task.title} className={`openingStep ${done ? 'done' : ''} ${active ? 'active' : ''}`}>
                          <div className="openingStepCircle">{done ? '✓' : index + 1}</div>
                          <div className="openingStepBody">
                            <strong>{task.title}</strong>
                            <p>{task.description}</p>
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  <div className="taskBox">
                    <p className="muted">Current step</p>
                    <h4>{currentTask?.title ?? 'Opening complete'}</h4>
                    <p>{currentTask?.description ?? 'No pending opening tasks.'}</p>
                    {currentTask?.sopUrl ? (
                      <button className="ghostBtn" onClick={() => setSopViewerUrl(currentTask.sopUrl!)}>
                        Learn more
                      </button>
                    ) : null}
                    {renderGuidedTaskInput()}
                  </div>

                  <div className="checklistStickyBar">
                    <button className="cta checklistStickyButton" disabled={!taskCanAdvance || openingCompleted >= openingTasks.length || isSubmitting} onClick={completeTask}>
                      {openingCompleted >= openingTasks.length ? 'All steps complete' : 'Complete this step'}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="taskBox">
                  <h4>{checklistMeta[activeChecklist].label}</h4>
                  <p>
                    {activeChecklist === 'midday'
                      ? 'Includes temp check workflow, quality validation, smell check, inventory confidence, and 3:30 PM rotation confirmation.'
                      : 'Includes final temperature pass, 4-hour discard enforcement, sanitation wrap-up, and waste review signoff.'}
                  </p>
                </div>
              )}
            </article>
          </section>
        ) : null}

        {!isHydrating && activeModule === 'temps' ? (
          <section className="panelGrid">
            <article className="card largeCard">
              <div className="cardTop">
                <div>
                  <p className="muted">Temperature History</p>
                  <h3>Kitchen Thermal Trend</h3>
                </div>
                <button className="ghostBtn" onClick={() => setTempHistoryRange('7days')}>7 Days</button>
              </div>

              <div className="tabRow tempRangeTabs" role="tablist" aria-label="Temperature ranges">
                {([
                  ['today', 'Today'],
                  ['7days', '7 Days'],
                  ['30days', '30 Days'],
                  ['all', 'All'],
                ] as Array<[TempRangeKey, string]>).map(([range, label]) => (
                  <button key={range} role="tab" aria-selected={tempHistoryRange === range} className={`tabButton ${tempHistoryRange === range ? 'active' : ''}`} onClick={() => setTempHistoryRange(range)}>{label}</button>
                ))}
              </div>

              <div className="trendCard">
                <p className="trendLabel">KITCHEN THERMAL TREND</p>
                <h4>{filteredTempHistory.length === 0 ? 'No Data' : `${filteredTempHistory.length} recent checks`}</h4>
                <p className="muted">{tempHistoryRange === 'today' ? 'Today' : tempHistoryRange === '7days' ? 'Last 7 Days' : tempHistoryRange === '30days' ? 'Last 30 Days' : 'All readings'}</p>
                <div className="trendLineWrap">
                  {filteredTempHistory.length === 0 ? (
                    <div className="trendEmpty">No temperature points yet</div>
                  ) : (
                    <div className="trendBars" aria-label="Temperature points">
                      {filteredTempHistory.slice(0, 12).map((entry, index) => (
                        <div key={entry.item + index} className={`trendBar ${entry.valid ? 'ok' : 'bad'}`} title={`${entry.item}: ${entry.value}F`} />
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="tabRow tempFilterTabs" role="tablist" aria-label="Temperature filters">
                {tempItemGroups.map((group) => (
                  <button key={group} role="tab" aria-selected={tempHistoryFilter === group} className={`tabButton ${tempHistoryFilter === group ? 'active' : ''}`} onClick={() => setTempHistoryFilter(group)}>{group}</button>
                ))}
              </div>

              <div className="emptyStateCard">
                {filteredTempHistory.length === 0 ? (
                  <>
                    <div className="emptyStateIcon">🌡</div>
                    <h4>No Temperature Logs</h4>
                    <p>Start logging temperatures from the dashboard to build your compliance history.</p>
                  </>
                ) : (
                  <div className="stackedList compact">
                    {filteredTempHistory.map((entry, idx) => (
                      <div key={entry.item + idx} className="entryRow">
                        <span>{entry.item}</span>
                        <strong className={entry.valid ? 'okText' : 'criticalText'}>{entry.value}F</strong>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </article>

            <article className="card largeCard">
              <h3>Log a Temperature</h3>
              {activeTempLogId ? <p className="muted">Resumed backend temp session: {activeTempLogId}</p> : null}
              <div className="taskBox">
                <h4>{tempItems[tempCursor].name}</h4>
                <p>{tempItems[tempCursor].min ? `Must be >= ${tempItems[tempCursor].min}F` : `Must be <= ${tempItems[tempCursor].max}F`}</p>
                <input className="fieldInput" value={tempReading} onChange={(event) => setTempReading(event.target.value)} placeholder="Enter measured temperature" />
                <label className="proofRow">
                  <input type="file" accept="image/*" onChange={(event) => setTempProofFile(event.target.files?.[0] ?? null)} />
                  {tempProofFile ? `Proof selected: ${tempProofFile.name}` : 'Attach proof photo'}
                </label>
              </div>
              <button className="cta" onClick={logTemp} disabled={!tempProofFile || tempReading.length === 0 || isSubmitting}>
                Save and next item
              </button>
            </article>
          </section>
        ) : null}

        {!isHydrating && activeModule === 'waste' ? (
          <section className="panelGrid">
            <article className="card largeCard">
              <h3>Waste Entry</h3>
              <div className="fieldSplit">
                <select className="fieldInput" value={wasteItem} onChange={(event) => setWasteItem(event.target.value)}>
                  {['Butter Chicken', 'Keema', 'Chole', 'Paneer', 'Butter Masala', 'Palak Sauce', 'Rice', 'Roti'].map((item) => (
                    <option key={item} value={item}>{item}</option>
                  ))}
                </select>
                <input className="fieldInput" value={wasteBatch} onChange={(event) => setWasteBatch(event.target.value)} placeholder="Batch id" />
              </div>
              <div className="fieldSplit">
                <input className="fieldInput" value={wasteQty} onChange={(event) => setWasteQty(event.target.value)} placeholder="Quantity ounces" />
                <select className="fieldInput" value={wasteReason} onChange={(event) => setWasteReason(event.target.value)}>
                  <option value="time_limit">Time Limit</option>
                  <option value="quality_fail">Quality Fail</option>
                  <option value="temp_fail">Temp Fail</option>
                  <option value="overproduction">Overproduction</option>
                </select>
              </div>
              <textarea className="fieldInput" value={wasteNotes} onChange={(event) => setWasteNotes(event.target.value)} placeholder="Notes" rows={3} />
              <button className="cta" onClick={addWasteEntry} disabled={isSubmitting}>Add waste entry</button>
            </article>

            <article className="card">
              <h3>Entries Today</h3>
              <div className="stackedList compact">
                {wasteEntries.length === 0 ? <p className="muted">No waste logged yet.</p> : null}
                {wasteEntries.map((entry, idx) => (
                  <div key={entry.item + idx} className="entryRow">
                    <span>{entry.item} · {entry.reason}</span>
                    <strong>{entry.qty} ounces</strong>
                  </div>
                ))}
              </div>
            </article>
          </section>
        ) : null}

        {!isHydrating && activeModule === 'data' ? (
          <section className="panelGrid">
            <article className="card largeCard">
              <h3>Data Hub</h3>
              <div className="tabRow" role="tablist" aria-label="Data tabs">
                <button role="tab" aria-selected={dataTab === 'import'} className={`tabButton ${dataTab === 'import' ? 'active' : ''}`} onClick={() => setDataTab('import')}>Import</button>
                <button role="tab" aria-selected={dataTab === 'sales'} className={`tabButton ${dataTab === 'sales' ? 'active' : ''}`} onClick={() => setDataTab('sales')}>Sales</button>
                <button role="tab" aria-selected={dataTab === 'forecast'} className={`tabButton ${dataTab === 'forecast' ? 'active' : ''}`} onClick={() => setDataTab('forecast')}>Forecast</button>
                <button role="tab" aria-selected={dataTab === 'profit'} className={`tabButton ${dataTab === 'profit' ? 'active' : ''}`} onClick={() => setDataTab('profit')}>Profit</button>
              </div>

              {dataTab === 'import' ? (
                <>
                  <p className="muted">Smart multi-format import supports POS PDFs, CSVs, and Excel files.</p>
                  <div className="dropZone">
                    <div>
                      <p>Drop file here</p>
                      <span>PDF, CSV, or Excel · click to browse</span>
                    </div>
                    <button className="cta">Select File</button>
                  </div>
                  <div className="infoBanner">
                    <strong>Smart Multi-Format Import</strong>
                    <p>Supports Boost POS PDF reports, CSV, and Excel files</p>
                    <div className="miniTags"><span>.pdf</span><span>.csv</span><span>.xlsx</span></div>
                  </div>
                </>
              ) : null}

              {dataTab === 'sales' ? (
                <>
                  <p className="muted">Weekly sales snapshot with simple totals to keep the team aware of demand.</p>
                  <table className="dataTable">
                    <caption className="srOnly">Sales totals</caption>
                    <thead>
                      <tr>
                        <th>Item</th>
                        <th>Weekly Total</th>
                        <th>Daily Avg.</th>
                      </tr>
                    </thead>
                    <tbody>
                      {salesRows.map((row) => (
                        <tr key={row.item}>
                          <td>{row.item}</td>
                          <td>{row.weeklyTotal}</td>
                          <td>{row.averagePerDay}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              ) : null}

              {dataTab === 'forecast' ? (
                <>
                  <p className="muted">Forecast based on weighted moving average (0.5, 0.3, 0.2) with waste adjustment from recent entries.</p>
                  <table className="dataTable">
                    <caption className="srOnly">Forecast recommendations</caption>
                    <thead>
                      <tr>
                        <th>Item</th>
                        <th>Forecast Ounces</th>
                        <th>Recommended Batches</th>
                      </tr>
                    </thead>
                    <tbody>
                      {forecastRows.map((row) => (
                        <tr key={row.item}>
                          <td>{row.item}</td>
                          <td>{row.forecast}</td>
                          <td>{row.batches}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              ) : null}

              {dataTab === 'profit' ? (
                <>
                  <p className="muted">Profit view combines sales with forecasted cost to keep the team aware of margin trends.</p>
                  <table className="dataTable">
                    <caption className="srOnly">Profit snapshot</caption>
                    <thead>
                      <tr>
                        <th>Item</th>
                        <th>Revenue</th>
                        <th>Cost</th>
                        <th>Profit</th>
                      </tr>
                    </thead>
                    <tbody>
                      {profitRows.map((row) => (
                        <tr key={row.item}>
                          <td>{row.item}</td>
                          <td>{row.estimatedRevenue}</td>
                          <td>{row.estimatedCost}</td>
                          <td>{row.estimatedProfit}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  <div className="reportMiniPanel">
                    <div className="fieldSplit">
                      <div>
                        <label className="fieldLabel" htmlFor="reportFrom">From</label>
                        <input id="reportFrom" className="fieldInput" type="date" value={reportFromDate} onChange={(event) => setReportFromDate(event.target.value)} />
                      </div>
                      <div>
                        <label className="fieldLabel" htmlFor="reportTo">To</label>
                        <input id="reportTo" className="fieldInput" type="date" value={reportToDate} onChange={(event) => setReportToDate(event.target.value)} />
                      </div>
                    </div>
                    <button className="cta" onClick={loadReport} disabled={isSubmitting}>Load report</button>
                  </div>

                  <table className="dataTable">
                    <caption className="srOnly">Compliance report table</caption>
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Checklists Completed</th>
                        <th>Unresolved Critical</th>
                        <th>Waste Ounces</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reportRows.length === 0 ? (
                        <tr>
                          <td colSpan={4}>No report rows loaded yet.</td>
                        </tr>
                      ) : reportRows.map((row) => (
                        <tr key={row.service_date}>
                          <td>{row.service_date}</td>
                          <td>{row.checklist_completed}/{row.checklist_total}</td>
                          <td>{row.unresolved_critical_alerts}</td>
                          <td>{row.waste_portions}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  <div className="stackedList compact">
                    <button className="cta" onClick={exportCurrentSessionCsv}>Export current session CSV</button>
                    <button className="cta" onClick={exportReportCsv} disabled={reportRows.length === 0}>Export loaded report CSV</button>
                    <button className="ghostBtn" onClick={exportReportPdf}>One-click PDF report export</button>
                  </div>
                </>
              ) : null}
            </article>
          </section>
        ) : null}

        {!isHydrating && activeModule === 'profile' ? (
          <section className="panelGrid">
            <article className="card largeCard">
              <div className="profileHero">
                <div className="profileAvatar">{appUser.display_name.slice(0, 1).toUpperCase()}</div>
                <h3>{appUser.display_name}</h3>
                <p>{appUser.email}</p>
                <span className="profileChip">{appUser.role}</span>
              </div>

              <div className="stackedList profileList">
                <button className="listButton profileItem" onClick={() => setSyncError('Notifications will appear here when alerts arrive.') }>
                  <div>
                    <strong>Notifications</strong>
                    <p>View safety alerts and reminders</p>
                  </div>
                  <span>›</span>
                </button>
                <button className="listButton profileItem" onClick={() => setSyncError('Settings are ready for future preferences.') }>
                  <div>
                    <strong>Settings</strong>
                    <p>Adjust your shift preferences</p>
                  </div>
                  <span>›</span>
                </button>
              </div>

              <button className="ghostBtn profileSignOut" onClick={handleSignOut} disabled={isSubmitting}>Sign Out</button>
            </article>
          </section>
        ) : null}

        <section className="printReportView" aria-label="Printable compliance report">
          <h1>DesiOS Compliance Report</h1>
          <p>Location: {appUser.display_name} | Range: {reportFromDate} to {reportToDate}</p>
          <p>Generated: {new Date().toLocaleString()}</p>
          <table className="dataTable">
            <thead>
              <tr>
                <th>Date</th>
                <th>Checklists Completed</th>
                <th>Unresolved Critical</th>
                <th>Waste Portions</th>
              </tr>
            </thead>
            <tbody>
              {reportRows.length === 0 ? (
                <tr>
                  <td colSpan={4}>No loaded report data. Load a report before printing.</td>
                </tr>
              ) : reportRows.map((row) => (
                <tr key={`print-${row.service_date}`}>
                  <td>{row.service_date}</td>
                  <td>{row.checklist_completed}/{row.checklist_total}</td>
                  <td>{row.unresolved_critical_alerts}</td>
                  <td>{row.waste_portions}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        {sopViewerUrl ? (
          <SopViewer url={sopViewerUrl} onClose={() => setSopViewerUrl(null)} />
        ) : null}
      </main>
    </div>
  )
}

function nearestScheduledTime() {
  const schedule = ['11:30', '13:30', '15:30', '17:30', '19:30', '21:00']
  const now = new Date()
  const nowMinutes = now.getHours() * 60 + now.getMinutes()

  let closest = schedule[0]
  let closestDelta = Number.POSITIVE_INFINITY

  for (const slot of schedule) {
    const [h, m] = slot.split(':').map(Number)
    const slotMinutes = h * 60 + m
    const delta = Math.abs(slotMinutes - nowMinutes)
    if (delta < closestDelta) {
      closest = slot
      closestDelta = delta
    }
  }

  return closest
}

function getDateOffset(offset: number) {
  const base = new Date()
  base.setDate(base.getDate() + offset)
  return base.toISOString().slice(0, 10)
}

function circularDelta(a: number, b: number, total: number) {
  if (total <= 0) {
    return 0
  }

  const raw = Math.abs(a - b)
  return Math.min(raw, total - raw)
}

type LocalDraft = {
  openingCompleted?: number
  tempCursor?: number
  tempReading?: string
  taskInput?: string
  taskDualInput?: { first: string; second: string }
  taskMultiInput?: Record<string, boolean>
}

function readLocalDraft(userId: string): LocalDraft | null {
  try {
    const raw = localStorage.getItem(`desios:draft:${userId}`)
    if (!raw) {
      return null
    }
    return JSON.parse(raw) as LocalDraft
  } catch {
    return null
  }
}

function writeLocalDraft(userId: string, draft: LocalDraft) {
  try {
    localStorage.setItem(`desios:draft:${userId}`, JSON.stringify(draft))
  } catch {
    // Ignore quota/private mode storage issues.
  }
}

function downloadCsv(csv: string, fileName: string) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  document.body.append(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}

export default App
