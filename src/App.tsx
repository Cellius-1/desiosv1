import { useEffect, useMemo, useRef, useState } from 'react'
import heroImg from './assets/hero.png'
import {
  evaluateAlerts,
  fetchAdminDashboard,
  fetchComplianceReport,
  getCurrentAppUser,
  insertWasteEntry,
  loadGuidedResumeState,
  loadSnapshot,
  loadTempItemIdMap,
  logTemperatureEntry,
  onAuthChange,
  signIn,
  signOut,
  subscribeToAlerts,
  toCsv,
  type AdminStaffRow,
  type AppUser,
  type ComplianceReportRow,
} from './services/desios'
import { isSupabaseConfigured } from './lib/supabase'
import SopViewer from './components/SopViewer'

type ModuleKey = 'home' | 'checklists' | 'temps' | 'waste' | 'data' | 'profile' | 'admin'
type ChecklistKey = 'opening' | 'midday' | 'closing'
type TaskKind = 'checkbox' | 'numeric' | 'dualNumeric' | 'multi'
type DataTabKey = 'import' | 'reports'

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
  displayName: string
  type: 'hot' | 'cold'
  min?: number
  max?: number
  frequency: string
  section: 'hothold' | 'cold'
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
  opening: { label: 'Opening Inspection', total: 9, due: 'Due 11:30 AM' },
  midday:  { label: 'Safe Food Intervals', total: 5, due: 'Due 4:00 PM' },
  closing: { label: 'Closing Procedure',  total: 8, due: 'End of service' },
}

// ── Accordion checklist data ─────────────────────────────────
type CLItem = { id: string; label: string; note?: string }
type CLGroup = { id: string; title: string; subtitle: string; items: CLItem[]; kind?: 'temp-link' | 'waste-link' }

const CL_OPENING: CLGroup[] = [
  {
    id: 'pre', title: 'Preliminary setup', subtitle: '10:00 – 10:10 AM',
    items: [
      { id: 'pre-1', label: 'Wash hands thoroughly' },
      { id: 'pre-2', label: 'Put on apron and gloves' },
      { id: 'pre-3', label: 'Review today\'s schedule and station assignments' },
      { id: 'pre-4', label: 'Set out thermometer and sanitize wipes' },
    ],
  },
  {
    id: 'cs', title: 'Cold storage pull', subtitle: '10:10 – 10:25 AM',
    items: [
      { id: 'cs-1', label: 'Pull Chicken Marinade from refrigeration' },
      { id: 'cs-2', label: 'Pull Keema (Ground Pork) from refrigeration' },
      { id: 'cs-3', label: 'Pull Chole (Chickpeas) from refrigeration' },
      { id: 'cs-4', label: 'Pull Butter Masala (orange sauce) from refrigeration' },
      { id: 'cs-5', label: 'Pull Palak Masala (green sauce) from refrigeration' },
    ],
  },
  {
    id: 'pc', title: 'Protein cook & reheat', subtitle: '10:25 – 10:50 AM',
    items: [
      { id: 'pc-1', label: 'Place Chicken on heat — target 165°F internal temp' },
      { id: 'pc-2', label: 'Reheat Keema to 165°F internal temp' },
      { id: 'pc-3', label: 'Reheat Paneer — confirm no pink center' },
    ],
  },
  {
    id: 'sr', title: 'Sauce reheat & hydration', subtitle: '10:50 – 11:05 AM',
    items: [
      { id: 'sr-1', label: 'Reheat Butter Masala to 165°F — add water to consistency' },
      { id: 'sr-2', label: 'Reheat Palak Masala to 165°F — add water to consistency' },
    ],
  },
  {
    id: 'cl', title: 'Cold line setup', subtitle: '11:05 – 11:15 AM',
    items: [
      { id: 'cl-1', label: 'Set cold line sixth pans with ice' },
      { id: 'cl-2', label: 'Portion Cilantro into cold line' },
      { id: 'cl-3', label: 'Portion Romaine Lettuce into cold line' },
      { id: 'cl-4', label: 'Portion Cucumber Slaw into cold line' },
      { id: 'cl-5', label: 'Portion Pickled Onions into cold line' },
      { id: 'cl-6', label: 'Portion Roasted Corn into cold line' },
    ],
  },
  {
    id: 'fl', title: 'Final line check', subtitle: '11:15 – 11:25 AM',
    items: [
      { id: 'fl-1', label: 'Confirm all hot items above 135°F' },
      { id: 'fl-2', label: 'Confirm all cold toppings below 41°F' },
      { id: 'fl-3', label: 'Sauces in correct dispensing containers' },
      { id: 'fl-4', label: 'Rice level and steam table water checked' },
      { id: 'fl-5', label: 'Utensils, scoops, and ladles at station' },
    ],
  },
  {
    id: 'san', title: 'Sanitation & wipe-down', subtitle: '11:25 – 11:30 AM',
    items: [
      { id: 'san-1', label: 'Sanitize bucket mixed to correct concentration' },
      { id: 'san-2', label: 'Wipe down hot line surfaces' },
      { id: 'san-3', label: 'Wipe down counter and cold line surfaces' },
    ],
  },
  {
    id: 'open-temp', title: 'Temperature log', subtitle: 'Before service — log all hot hold items',
    items: [], kind: 'temp-link',
  },
  {
    id: 'cf', title: 'Customer-facing setup', subtitle: '11:30 AM — GO',
    items: [
      { id: 'cf-1', label: 'Lamps turned on?' },
      { id: 'cf-2', label: 'Roti wraps stocked at counter?' },
      { id: 'cf-3', label: 'DesiEats stickers out?' },
      { id: 'cf-4', label: 'Loyalty cards out?' },
      { id: 'cf-5', label: 'Bowls and lids stocked?' },
      { id: 'cf-6', label: 'Mango chutney + red chili powder portion cups out?' },
    ],
  },
]

const CL_MIDDAY: CLGroup[] = [
  {
    id: 'tc', title: 'Temperature check & log', subtitle: 'Every 2 hours — log all hot hold items',
    items: [], kind: 'temp-link',
  },
  {
    id: 'sb', title: 'Sanitize bucket refresh', subtitle: 'Every 2 hours',
    items: [
      { id: 'sb-1', label: 'Dump old sanitize bucket solution' },
      { id: 'sb-2', label: 'Mix fresh sanitize bucket (correct concentration)' },
      { id: 'sb-3', label: 'Replace sanitize wipes' },
      { id: 'sb-4', label: 'Wipe down hot line surfaces' },
      { id: 'sb-5', label: 'Wipe down cold line surfaces' },
    ],
  },
  {
    id: 'shl', title: 'Stock check — hot line', subtitle: 'Mid-service',
    items: [
      { id: 'shl-1', label: 'Confirm Chicken supply — restock if below ¼ pan' },
      { id: 'shl-2', label: 'Confirm Keema supply — restock if below ¼ pan' },
      { id: 'shl-3', label: 'Confirm Chole supply — restock if below ¼ pan' },
      { id: 'shl-4', label: 'Confirm Butter Masala level — add water if needed' },
      { id: 'shl-5', label: 'Confirm Palak Masala level — add water if needed' },
      { id: 'shl-6', label: 'Confirm Rice level — restock if below half pan' },
      { id: 'shl-7', label: 'Check fryer oil level' },
    ],
  },
  {
    id: 'scl', title: 'Stock check — cold line', subtitle: 'Mid-service',
    items: [
      { id: 'scl-1', label: 'Confirm Cilantro supply' },
      { id: 'scl-2', label: 'Confirm Romaine Lettuce supply' },
      { id: 'scl-3', label: 'Confirm Cucumber Slaw supply' },
      { id: 'scl-4', label: 'Confirm Pickled Onions supply' },
      { id: 'scl-5', label: 'Confirm Roasted Corn supply' },
      { id: 'scl-6', label: 'Replace ice under cold pans if needed' },
    ],
  },
  {
    id: 'sfh', title: 'Stock check — front of house', subtitle: 'Mid-service',
    items: [
      { id: 'sfh-1', label: 'Roti wraps fully stocked at counter' },
      { id: 'sfh-2', label: 'Bowls and lids stocked' },
      { id: 'sfh-3', label: 'Napkins restocked' },
      { id: 'sfh-4', label: 'DesiEats stickers out' },
      { id: 'sfh-5', label: 'Loyalty cards stocked' },
      { id: 'sfh-6', label: 'Chutney and chili powder portion cups stocked' },
    ],
  },
]

const CL_CLOSING: CLGroup[] = [
  {
    id: 'et', title: 'End-of-service temp check', subtitle: 'Before touching any food',
    items: [
      { id: 'et-1', label: 'Log final temp: Chicken', note: 'If below 135°F and has been so for unknown time, discard. Do not store.' },
      { id: 'et-2', label: 'Log final temp: Keema', note: 'If below 135°F and has been so for unknown time, discard. Do not store.' },
      { id: 'et-3', label: 'Log final temp: Chole', note: 'If below 135°F and has been so for unknown time, discard. Do not store.' },
      { id: 'et-4', label: 'Log final temp: Butter Masala', note: 'If below 135°F and has been so for unknown time, discard. Do not store.' },
      { id: 'et-5', label: 'Log final temp: Palak Sauce', note: 'If below 135°F and has been so for unknown time, discard. Do not store.' },
    ],
  },
  {
    id: 'close-waste', title: 'Waste log', subtitle: 'Log all discarded food before closing',
    items: [], kind: 'waste-link',
  },
  {
    id: 'sdh', title: 'Shut down heat sources', subtitle: 'Immediately after temp check',
    items: [
      { id: 'sdh-1', label: 'Extinguish all 3 Sternos under rice station' },
      { id: 'sdh-2', label: 'Discard all leftover rice', note: 'Rice is never stored — discard every service.' },
      { id: 'sdh-3', label: 'Dump water from rice steam table' },
      { id: 'sdh-4', label: 'Turn off fryer' },
      { id: 'sdh-5', label: 'Dump water from protein double-boiler hotel pan' },
      { id: 'sdh-6', label: 'Extinguish double-boiler saucepot burners' },
    ],
  },
  {
    id: 'spr', title: 'Store leftover proteins', subtitle: 'Hot line breakdown',
    items: [
      { id: 'spr-1', label: 'Transfer leftover Chicken into labeled lexon or cambro' },
      { id: 'spr-2', label: 'Transfer leftover Keema into labeled cambro' },
      { id: 'spr-3', label: 'Transfer leftover Chole into labeled cambro' },
      { id: 'spr-4', label: 'Transfer leftover Paneer into labeled lexon' },
    ],
  },
  {
    id: 'ssc', title: 'Store leftover sauces', subtitle: 'Hot line breakdown',
    items: [
      { id: 'ssc-1', label: 'Transfer leftover Butter Masala into labeled container', note: 'Label: item name + date. Store in refrigeration.' },
      { id: 'ssc-2', label: 'Transfer leftover Palak Masala into labeled container', note: 'Label: item name + date. Store in refrigeration.' },
    ],
  },
  {
    id: 'blt', title: 'Bag leftover cold toppings', subtitle: 'Cold line breakdown',
    items: [
      { id: 'blt-1', label: 'Bag and label leftover Cilantro', note: 'Label: item name + date.' },
      { id: 'blt-2', label: 'Bag and label leftover Romaine Lettuce', note: 'Label: item name + date.' },
      { id: 'blt-3', label: 'Bag and label leftover Cucumber Slaw', note: 'Label: item name + date.' },
      { id: 'blt-4', label: 'Bag and label leftover Pickled Onions', note: 'Label: item name + date.' },
      { id: 'blt-5', label: 'Bag and label leftover Roasted Corn', note: 'Label: item name + date.' },
      { id: 'blt-6', label: 'Discard used Limes' },
      { id: 'blt-7', label: 'Return all bagged toppings to refrigeration' },
    ],
  },
  {
    id: 'lcp', title: 'Load cart for dish pit', subtitle: 'Equipment breakdown',
    items: [
      { id: 'lcp-1', label: 'Load hotel pans onto cart' },
      { id: 'lcp-2', label: 'Load third pans onto cart' },
      { id: 'lcp-3', label: 'Load double-boiler saucepots onto cart' },
      { id: 'lcp-4', label: 'Load sauté pan (paneer) onto cart' },
      { id: 'lcp-5', label: 'Load ladles, scoops, and utensils onto cart' },
      { id: 'lcp-6', label: 'Load cold line sixth/ninth pans onto cart' },
      { id: 'lcp-7', label: 'Confirm all DesiEats equipment is on the cart — nothing left behind', note: 'Check against equipment list before leaving.' },
      { id: 'lcp-8', label: 'Transport cart to dining hall dish pit' },
    ],
  },
  {
    id: 'fcs', title: 'Final clean & sanitize', subtitle: 'Last step before leaving',
    items: [
      { id: 'fcs-1', label: 'Wipe down entire hot line surface' },
      { id: 'fcs-2', label: 'Wipe down entire cold line surface' },
      { id: 'fcs-3', label: 'Wipe down counter and customer-facing surfaces' },
      { id: 'fcs-4', label: 'Dispose of sanitize bucket solution' },
      { id: 'fcs-5', label: 'Take out any trash bags from the line' },
      { id: 'fcs-6', label: 'Confirm no food left out unlabeled or uncovered' },
      { id: 'fcs-7', label: 'Turn off lamps' },
    ],
  },
]

type SalesMixRow = { name: string; quantity: number; totalSales: number }
type ParsedSalesMix = { reportDate: string; items: SalesMixRow[]; modifiers: SalesMixRow[] }

function parseSalesMix(text: string): ParsedSalesMix {
  const lines = text.split(/\r?\n/)
  const sep = lines.some((l) => l.includes('\t')) ? '\t' : ','
  let section: 'none' | 'items' | 'modifiers' = 'none'
  let skipHeader = false
  let reportDate = ''
  const items: SalesMixRow[] = []
  const modifiers: SalesMixRow[] = []

  for (const rawLine of lines) {
    const line = rawLine.trim()
    if (!line) continue

    if (/reporting date/i.test(line)) {
      const m = line.match(/reporting date is (\w+)/i)
      reportDate = m?.[1] ?? ''
      continue
    }

    const first = line.split(sep)[0].trim().replace(/"/g, '').toLowerCase()
    if (first === 'items') { section = 'items'; skipHeader = true; continue }
    if (first === 'add-ons & modifiers' || first === 'add-ons') { section = 'modifiers'; skipHeader = true; continue }
    if (first === 'item sales by category' || first === 'item sales by station' || first === 'totals') { section = 'none'; continue }
    if (skipHeader) { skipHeader = false; continue }
    if (section === 'none') continue

    const cols = line.split(sep).map((c) => c.trim().replace(/^"+|"+$/g, ''))
    if (cols.length < 2) continue

    const name = cols[0]
    const quantity = parseInt(cols[1].replace(/,/g, '')) || 0
    const totalSales = parseFloat((cols[2] ?? '0').replace(/[$,]/g, '')) || 0
    if (!name || name === 'Item' || quantity === 0) continue

    if (section === 'items') items.push({ name, quantity, totalSales })
    else if (section === 'modifiers') modifiers.push({ name, quantity, totalSales })
  }

  return { reportDate, items, modifiers }
}

const CL_MAP: Record<ChecklistKey, CLGroup[]> = {
  opening: CL_OPENING,
  midday:  CL_MIDDAY,
  closing: CL_CLOSING,
}

const tempItems: TempItem[] = [
  { name: 'Hot Hold - Butter Chicken', displayName: 'Chicken',       type: 'hot',  min: 135, frequency: 'Every 2 hours', section: 'hothold' },
  { name: 'Hot Hold - Keema',          displayName: 'Keema',         type: 'hot',  min: 135, frequency: 'Every 2 hours', section: 'hothold' },
  { name: 'Hot Hold - Chole',          displayName: 'Chole',         type: 'hot',  min: 135, frequency: 'Every 2 hours', section: 'hothold' },
  { name: 'Hot Hold - Paneer',         displayName: 'Paneer',        type: 'hot',  min: 135, frequency: 'Every 2 hours', section: 'hothold' },
  { name: 'Hot Hold - Butter Masala',  displayName: 'Butter Masala', type: 'hot',  min: 135, frequency: 'Every 2 hours', section: 'hothold' },
  { name: 'Hot Hold - Palak Sauce',    displayName: 'Palak Sauce',   type: 'hot',  min: 135, frequency: 'Every 2 hours', section: 'hothold' },
  { name: 'Hot Hold - Basmati Rice',   displayName: 'Basmati Rice',  type: 'hot',  min: 135, frequency: 'Every 2 hours', section: 'hothold' },
  { name: 'Walk-in Refrigerator',      displayName: 'Walk-in Fridge',type: 'cold', max: 40,  frequency: 'Twice daily',   section: 'cold' },
  { name: 'Freezer',                   displayName: 'Freezer',       type: 'cold', max: 0,   frequency: 'Daily',         section: 'cold' },
]


function App() {
  const [appUser, setAppUser] = useState<AppUser | null>(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [authError, setAuthError] = useState('')
  const [setupError, setSetupError] = useState('')
  const [syncError, setSyncError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [checklistDetailOpen, setChecklistDetailOpen] = useState(false)
  const [adminRows, setAdminRows] = useState<AdminStaffRow[]>([])
  const [adminLoading, setAdminLoading] = useState(false)
  const [checkedItems, setCheckedItems] = useState<Record<ChecklistKey, Set<string>>>({
    opening: new Set(),
    midday: new Set(),
    closing: new Set(),
  })
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())
  const [isHydrating, setIsHydrating] = useState(true)

  const [activeModule, setActiveModule] = useState<ModuleKey>('home')
  const [activeChecklist, setActiveChecklist] = useState<ChecklistKey>('opening')
  const [openingCompleted, setOpeningCompleted] = useState(0)
  const [criticalAlerts, setCriticalAlerts] = useState<string[]>([])
  const [tempItemIdMap, setTempItemIdMap] = useState<Map<string, string>>(new Map())
  const [dataTab, setDataTab] = useState<DataTabKey>('import')
  const [parsedSalesData, setParsedSalesData] = useState<ParsedSalesMix | null>(null)
  const [salesImportError, setSalesImportError] = useState('')
  const [sopViewerUrl, setSopViewerUrl] = useState<string | null>(null)

  const [taskInput, setTaskInput] = useState('')
  const [taskDualInput, setTaskDualInput] = useState({ first: '', second: '' })
  const [taskMultiInput, setTaskMultiInput] = useState<Record<string, boolean>>({})

  const [tempCursor, setTempCursor] = useState(0)
  const [tempInputs, setTempInputs] = useState<Record<string, string>>({})
  const [tempSubmitting, setTempSubmitting] = useState<Record<string, boolean>>({})
  const [tempReading, setTempReading] = useState('')
  const [tempHistory, setTempHistory] = useState<Array<{ item: string; value: number; valid: boolean }>>([])

  const [wasteItem, setWasteItem] = useState('Butter Chicken')
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
      // eslint-disable-next-line react-hooks/set-state-in-effect
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

  const loadAdminData = async () => {
    if (!appUser) return
    setAdminLoading(true)
    try {
      const rows = await fetchAdminDashboard(appUser.location_id)
      setAdminRows(rows)
    } catch {
      // non-critical — leave empty
    } finally {
      setAdminLoading(false)
    }
  }

  useEffect(() => {
    if (activeModule === 'admin' && appUser) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      void loadAdminData()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeModule])

  const hour = new Date().getHours()
  const middayUnlocked = true
  const closingUnlocked = true
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




  const logTempFor = async (item: TempItem) => {
    const raw = tempInputs[item.name] ?? ''
    const value = Number(raw)
    if (!appUser || !raw.trim() || Number.isNaN(value)) return

    const tempItemId = tempItemIdMap.get(item.name)
    if (!tempItemId) {
      setSyncError(`Temp item not found in database: ${item.name}`)
      return
    }

    const valid = (item.min === undefined || value >= item.min) && (item.max === undefined || value <= item.max)

    setTempSubmitting((prev) => ({ ...prev, [item.name]: true }))
    try {
      await logTemperatureEntry({
        locationId: appUser.location_id,
        scheduledTime: nearestScheduledTime(),
        tempItemId,
        reading: value,
        isValid: valid,
      })
      if (!valid) {
        setCriticalAlerts((prev) => [`Unsafe temp: ${item.displayName} at ${value}°F`, ...prev])
      }
    } catch (error) {
      setSyncError(error instanceof Error ? error.message : 'Failed to save temperature.')
      return
    } finally {
      setTempSubmitting((prev) => ({ ...prev, [item.name]: false }))
    }

    setTempHistory((prev) => [{ item: item.name, value, valid }, ...prev].slice(0, 50))
    setTempInputs((prev) => ({ ...prev, [item.name]: '' }))
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

  const toggleItem = (ckey: ChecklistKey, itemId: string) => {
    setCheckedItems((prev) => {
      const next = { ...prev }
      const s = new Set(next[ckey])
      if (s.has(itemId)) s.delete(itemId)
      else s.add(itemId)
      next[ckey] = s
      return next
    })
  }

  const toggleGroup = (groupId: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(groupId)) next.delete(groupId)
      else next.add(groupId)
      return next
    })
  }

  const allHotItemsLogged = useMemo(() => {
    const hotNames = new Set(tempItems.filter((i) => i.section === 'hothold').map((i) => i.name))
    const loggedNames = new Set(tempHistory.map((e) => e.item))
    return [...hotNames].every((n) => loggedNames.has(n))
  }, [tempHistory])

  const completedGroupCount = (ckey: ChecklistKey) =>
    CL_MAP[ckey].filter((g) => {
      if (g.kind === 'temp-link') return allHotItemsLogged
      if (g.kind === 'waste-link') return wasteEntries.length > 0
      return g.items.every((i) => checkedItems[ckey].has(i.id))
    }).length

  const handleSignOut = async () => {
    try {
      setIsSubmitting(true)
      await signOut()
      setAppUser(null)
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
    setDataTab('reports')
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
        <img className="authDecorLeft" src={heroImg} alt="" aria-hidden="true" />
        <img className="authDecorRight" src={heroImg} alt="" aria-hidden="true" />
        <div className="authContent">
          <div className="authLogo" aria-hidden="true">
            <span className="authLogoOuter">
              <span className="authLogoInner">Desi<br />Eats</span>
            </span>
          </div>
          <h2 className="authTitle">Setting up your <span className="authTitleAccent">workspace</span></h2>
          <p className="authSubtitle">Loading today&apos;s kitchen tasks&hellip;</p>
        </div>
      </div>
    )
  }

  if (!appUser) {
    return (
      <div className="authPage">
        <img className="authDecorLeft" src={heroImg} alt="" aria-hidden="true" />
        <img className="authDecorRight" src={heroImg} alt="" aria-hidden="true" />
        <div className="authContent" role="form" aria-label="Sign in form">
          <div className="authLogo" aria-hidden="true">
            <span className="authLogoOuter">
              <span className="authLogoInner">Desi<br />Eats</span>
            </span>
          </div>
          <h2 className="authTitle">Welcome Back, <span className="authTitleAccent">Chef</span></h2>
          <p className="authSubtitle">Ready for service?</p>
          {setupError ? <p className="criticalText">{setupError}</p> : null}
          {authError ? <p className="criticalText authErrorMsg">{authError}</p> : null}
          <div className="authForm">
            <label htmlFor="emailInput" className="authFieldLabel">Email / Staff ID</label>
            <input
              id="emailInput"
              className="authFieldInput"
              aria-label="Email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="chef@desieats.com"
              onKeyDown={(e) => e.key === 'Enter' && handleAuthLogin()}
            />
            <label htmlFor="passwordInput" className="authFieldLabel">Password</label>
            <div className="authPasswordWrapper">
              <input
                id="passwordInput"
                className="authFieldInput"
                aria-label="Password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="••••••••"
                onKeyDown={(e) => e.key === 'Enter' && handleAuthLogin()}
              />
              <button
                type="button"
                className="authPasswordToggle"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
                    <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
                    <line x1="1" y1="1" x2="23" y2="23"/>
                  </svg>
                ) : (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                    <circle cx="12" cy="12" r="3"/>
                  </svg>
                )}
              </button>
            </div>
            <a href="#" className="authForgotLink" onClick={(e) => e.preventDefault()}>Forgot password?</a>
            <button
              className="authCta"
              onClick={handleAuthLogin}
              disabled={isSubmitting || !email || !password}
            >
              Let&apos;s Cook &rarr;
            </button>
          </div>
          <div className="authScrollHint" aria-hidden="true">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="appShell">
      <a href="#mainContent" className="skipLink">Skip to main content</a>
      <aside className="sideRail" aria-label="Primary navigation">
        <div className="sideRailTop">
          <div className="sideRailBrand">
            <div className="sideRailAvatar">{appUser.display_name.slice(0, 1).toUpperCase()}</div>
            <div>
              <p className="brandKicker">DesiEats</p>
              <p className="brandSub">Kitchen Manager</p>
            </div>
          </div>

          <nav className="navStack" role="navigation" aria-label="Operations modules">
            {([
              { key: 'home', label: 'Home', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg> },
              { key: 'checklists', label: 'Tasks', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg> },
              { key: 'temps', label: 'Temps', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z"/></svg> },
              { key: 'waste', label: 'Waste', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg> },
              { key: 'data', label: 'Reports', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg> },
              { key: 'profile', label: 'Profile', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg> },
              ...(appUser.role === 'admin' ? [{ key: 'admin', label: 'Admin', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg> }] : []),
            ] as Array<{ key: string; label: string; icon: React.ReactNode }>).map((item) => (
              <button
                key={item.key}
                className={`navButton ${activeModule === item.key ? 'active' : ''}`}
                aria-pressed={activeModule === item.key}
                onClick={() => setActiveModule(item.key as ModuleKey)}
              >
                <span className="navButtonIcon">{item.icon}</span>
                <span>{item.label}</span>
                {(item.key === 'checklists' && openingCompleted < checklistMeta.opening.total) || (item.key === 'temps' && tempHistory.some((entry) => !entry.valid)) ? (
                  <span className="signalDot" />
                ) : null}
              </button>
            ))}
          </nav>
        </div>

        <div className="sideRailBottom">
          <button className="sideQuickPhoto" onClick={() => setActiveModule('temps')}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
            <span>Quick Photo</span>
          </button>
        </div>
      </aside>

      <main id="mainContent" className="mainSurface" role="main">
        <header className="topBar" aria-label="Operations summary">
          <div>
            <p className="muted">{new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}</p>
            <h2>{shiftLabel}, {appUser.display_name}</h2>
          </div>
          <div className="topBarActions">
            {draftSaveState === 'saving' ? <span className="statusBadge alertInfo">{draftSaveLabel}</span> : null}
            <button className="topBarAvatar" onClick={() => setActiveModule('profile')} aria-label="Profile">
              {appUser.display_name.slice(0, 1).toUpperCase()}
              <span className="topBarAvatarDot" />
            </button>
          </div>
        </header>

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
            <div className={`homeOrbWrap ${complianceState.tone}`}>
              <div className={`homeOrb ${complianceState.tone}`}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
                <strong>{complianceState.label.toUpperCase()}</strong>
                <span className="homeOrbSub">{complianceState.percent}%</span>
              </div>
            </div>
            <p className="homeOrbCaption">{criticalAlerts.length > 0 ? 'Please resolve highlighted safety items.' : 'Kitchen is running smoothly'}</p>

            <article className="homeImmediateCard">
              <div className="homeImmediateTop">
                <p className="homeImmediateLabel">IMMEDIATE</p>
                {openingCompleted < checklistMeta.opening.total ? <span className="homeBadgeAction">ACTION NEEDED</span> : <span className="homeBadgeOk">ON TRACK</span>}
              </div>
              <div className="homeImmediateRow">
                <div className="homeImmediateIcon">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
                </div>
                <div className="homeImmediateInfo">
                  <strong>Checklists</strong>
                  <p>{openingCompleted < checklistMeta.opening.total ? 'Tasks pending' : 'Opening checklist complete'}</p>
                </div>
                <button className="homeResumeBtn" onClick={() => { setActiveModule('checklists'); setChecklistDetailOpen(false); }}>Resume</button>
              </div>
              <div className="progressTrack" aria-label="Opening progress">
                <div className="progressFill" style={{ width: `${openingPercent}%` }} />
              </div>
              <p className="homeProgressLabel">Progress {openingPercent}%</p>
            </article>

            <div className="homeQuickGrid">
              <button className="homeQuickTile" onClick={() => setActiveModule('temps')}>
                <div className="homeQuickTileIcon">
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z"/></svg>
                </div>
                <strong>Log Temp</strong>
                <p>{tempHistory.length === 0 ? 'No readings yet' : `${tempHistory.length} today`}</p>
              </button>
              <button className="homeQuickTile" onClick={() => setActiveModule('waste')}>
                <div className="homeQuickTileIcon">
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
                </div>
                <strong>Log Waste</strong>
                <p>{wasteEntries.length === 0 ? 'No entries yet' : `${wasteEntries.length} today`}</p>
              </button>
            </div>
          </section>
        ) : null}

        {!isHydrating && activeModule === 'checklists' && !checklistDetailOpen ? (
          <section className="taskOverviewPage">
            <div className="taskOverviewHeader">
              <h2 className="taskOverviewTitle">Checklists</h2>
              <div className="taskOverviewProgress">
                <div className="taskOverviewCircle">
                  <span>{openingPercent}%</span>
                </div>
                <div className="taskOverviewBars">
                  <div className="taskOverviewBarGroup">
                    <div className="taskOverviewBarTrack"><div className="taskOverviewBarFill" style={{ width: `${openingPercent}%` }} /></div>
                    <span>Open</span>
                  </div>
                  <div className="taskOverviewBarGroup">
                    <div className="taskOverviewBarTrack"><div className="taskOverviewBarFill" style={{ width: '0%' }} /></div>
                    <span>Int</span>
                  </div>
                  <div className="taskOverviewBarGroup">
                    <div className="taskOverviewBarTrack"><div className="taskOverviewBarFill" style={{ width: '0%' }} /></div>
                    <span>Close</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="taskTimelineList">
              <div className="taskTimelineConnectorLine" aria-hidden="true" />

              <button className="taskTimelineCard" onClick={() => { setActiveChecklist('opening'); setChecklistDetailOpen(true); }}>
                <div className="taskTimelineCardIcon taskTimelineCardIcon--open">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
                </div>
                <div className="taskTimelineCardBody">
                  <div className="taskTimelineCardMain">
                    <div>
                      <strong>{checklistMeta.opening.label}</strong>
                      <p className="taskTimelineCardTime">08:00 AM</p>
                      <p className="taskTimelineCardCount">{openingCompleted}/{checklistMeta.opening.total} Tasks</p>
                    </div>
                    <span className={`taskTimelineBadge ${openingCompleted >= checklistMeta.opening.total ? 'taskTimelineBadge--done' : 'taskTimelineBadge--pending'}`}>
                      {openingCompleted >= checklistMeta.opening.total ? 'DONE' : 'PENDING'}
                    </span>
                  </div>
                  {openingCompleted < checklistMeta.opening.total ? (
                    <span className="taskStartCta">Start Inspection &rarr;</span>
                  ) : null}
                </div>
              </button>

              <button className="taskTimelineCard" onClick={() => { setActiveChecklist('midday'); setChecklistDetailOpen(true); }}>
                <div className="taskTimelineCardIcon taskTimelineCardIcon--mid">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                </div>
                <div className="taskTimelineCardBody">
                  <div className="taskTimelineCardMain">
                    <div>
                      <strong>{checklistMeta.midday.label}</strong>
                      <p className="taskTimelineCardTime">12:00 PM – 4:00 PM</p>
                      <p className="taskTimelineCardCount taskTimelineCardCount--interval">INTERVAL CHECK</p>
                    </div>
                    <span className="taskTimelineBadge taskTimelineBadge--pending">PENDING</span>
                  </div>
                </div>
              </button>

              <button className="taskTimelineCard" onClick={() => { setActiveChecklist('closing'); setChecklistDetailOpen(true); }}>
                <div className="taskTimelineCardIcon taskTimelineCardIcon--close">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
                </div>
                <div className="taskTimelineCardBody">
                  <div className="taskTimelineCardMain">
                    <div>
                      <strong>{checklistMeta.closing.label}</strong>
                      <p className="taskTimelineCardTime">10:00 PM</p>
                    </div>
                    <span className="taskTimelineBadge taskTimelineBadge--pending">PENDING</span>
                  </div>
                </div>
              </button>
            </div>
          </section>
        ) : null}

        {!isHydrating && activeModule === 'checklists' && checklistDetailOpen ? (
          <section className="clDetailPage">
            <div className="clDetailHeader">
              <button className="clBackBtn" onClick={() => { setChecklistDetailOpen(false); setExpandedGroups(new Set()); }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
              </button>
              <div>
                <h2 className="clDetailTitle">{checklistMeta[activeChecklist].label}</h2>
                <p className="clDetailSub">
                  {completedGroupCount(activeChecklist)}/{CL_MAP[activeChecklist].length} sections complete
                </p>
              </div>
            </div>

            <div className="progressTrack" style={{ height: 6, borderRadius: 99, background: '#eef0f3' }}>
              <div
                className="progressFill"
                style={{ width: `${CL_MAP[activeChecklist].length > 0 ? Math.round((completedGroupCount(activeChecklist) / CL_MAP[activeChecklist].length) * 100) : 0}%`, borderRadius: 99 }}
              />
            </div>

            <div className="clGroupList">
              {CL_MAP[activeChecklist].map((group) => {
                const isTempLink = group.kind === 'temp-link'
                const isWasteLink = group.kind === 'waste-link'
                const hotItems = tempItems.filter((i) => i.section === 'hothold')
                const loggedHotCount = hotItems.filter((i) => tempHistory.some((e) => e.item === i.name)).length
                const checkedCount = isTempLink ? loggedHotCount : isWasteLink ? (wasteEntries.length > 0 ? 1 : 0) : group.items.filter((i) => checkedItems[activeChecklist].has(i.id)).length
                const groupTotal = isTempLink ? hotItems.length : isWasteLink ? 1 : group.items.length
                const allDone = isTempLink ? allHotItemsLogged : isWasteLink ? wasteEntries.length > 0 : checkedCount === group.items.length
                const isOpen = expandedGroups.has(group.id)
                return (
                  <div key={group.id} className={`clGroup ${allDone ? 'clGroup--done' : ''}`}>
                    <button className="clGroupHeader" onClick={() => toggleGroup(group.id)}>
                      <div className="clGroupHeaderLeft">
                        <div className={`clGroupCheck ${allDone ? 'clGroupCheck--done' : ''}`}>
                          {allDone ? <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg> : null}
                        </div>
                        <div className="clGroupHeaderText">
                          <strong className={allDone ? 'clGroupTitle--done' : ''}>{group.title}</strong>
                          <span className="clGroupSub">{group.subtitle}</span>
                        </div>
                      </div>
                      <div className="clGroupHeaderRight">
                        <span className={`clGroupBadge ${allDone ? 'clGroupBadge--done' : ''}`}>
                          {isTempLink ? `${checkedCount}/${groupTotal} logged` : isWasteLink ? (wasteEntries.length > 0 ? `${wasteEntries.length} entries` : 'Required') : `${checkedCount}/${groupTotal}`}
                        </span>
                        <svg className={`clGroupChevron ${isOpen ? 'clGroupChevron--open' : ''}`} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
                      </div>
                    </button>

                    {isOpen ? (
                      <div className="clGroupBody">
                        {isTempLink ? (
                          <div className="clLinkPanel">
                            <div className="clLinkPanelInfo">
                              <p className="clLinkPanelCount">{loggedHotCount} of {hotItems.length} items logged</p>
                              <div className="clLinkMiniList">
                                {hotItems.map((item) => {
                                  const logged = tempHistory.some((e) => e.item === item.name)
                                  const last = tempHistory.find((e) => e.item === item.name)
                                  return (
                                    <div key={item.name} className="clLinkMiniRow">
                                      <div className={`clLinkMiniDot ${logged ? (last?.valid ? 'clLinkMiniDot--ok' : 'clLinkMiniDot--fail') : 'clLinkMiniDot--idle'}`} />
                                      <span>{item.displayName}</span>
                                      {last ? <span className={last.valid ? 'tempValOk' : 'tempValFail'}>{last.value}°F</span> : <span className="clLinkMiniPending">–</span>}
                                    </div>
                                  )
                                })}
                              </div>
                            </div>
                            <button
                              className="clLinkBtn"
                              onClick={() => { setChecklistDetailOpen(false); setExpandedGroups(new Set()); setActiveModule('temps'); }}
                            >
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a5 5 0 0 0-5 5v6l-2 3h14l-2-3V7a5 5 0 0 0-5-5z"/><path d="M9 17v1a3 3 0 0 0 6 0v-1"/></svg>
                              Go to Temperature Log
                            </button>
                          </div>
                        ) : isWasteLink ? (
                          <div className="clLinkPanel">
                            <div className="clLinkPanelInfo">
                              <p className="clLinkPanelCount">{wasteEntries.length} waste {wasteEntries.length === 1 ? 'entry' : 'entries'} logged today</p>
                              {wasteEntries.length === 0 ? <p className="clLinkMiniPending">At least one entry required to complete this section</p> : null}
                              {wasteEntries.slice(0, 3).map((e, idx) => (
                                <div key={idx} className="clLinkMiniRow">
                                  <div className="clLinkMiniDot clLinkMiniDot--ok" />
                                  <span>{e.item}</span>
                                  <span className="clLinkMiniPending">{e.qty} oz</span>
                                </div>
                              ))}
                            </div>
                            <button
                              className="clLinkBtn"
                              onClick={() => { setChecklistDetailOpen(false); setExpandedGroups(new Set()); setActiveModule('waste'); }}
                            >
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
                              Go to Waste Log
                            </button>
                          </div>
                        ) : (
                          <>
                            <p className="clGroupBodyLabel">{group.subtitle.toUpperCase()}</p>
                            {group.items.map((item) => {
                              const checked = checkedItems[activeChecklist].has(item.id)
                              return (
                                <button
                                  key={item.id}
                                  className={`clItem ${checked ? 'clItem--checked' : ''}`}
                                  onClick={() => toggleItem(activeChecklist, item.id)}
                                >
                                  <div className={`clItemBox ${checked ? 'clItemBox--checked' : ''}`}>
                                    {checked ? <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg> : null}
                                  </div>
                                  <div className="clItemBody">
                                    <span className={checked ? 'clItemLabel--checked' : ''}>{item.label}</span>
                                    {item.note ? <p className="clItemNote">{item.note}</p> : null}
                                  </div>
                                </button>
                              )
                            })}
                          </>
                        )}
                      </div>
                    ) : null}
                  </div>
                )
              })}
            </div>
          </section>
        ) : null}

        {!isHydrating && activeModule === 'temps' ? (
          <section className="tempPage">
            <div className="tempPageHeader">
              <div>
                <h2 className="tempPageTitle">Temperature Log</h2>
                <p className="muted">{new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</p>
              </div>
              <div className="tempPageStats">
                <div className="tempStatPill tempStatPill--ok">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                  {tempHistory.filter((e) => e.valid).length} pass
                </div>
                {tempHistory.some((e) => !e.valid) ? (
                  <div className="tempStatPill tempStatPill--fail">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    {tempHistory.filter((e) => !e.valid).length} fail
                  </div>
                ) : null}
              </div>
            </div>

            <div className="tempSectionLabel">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a5 5 0 0 0-5 5v6l-2 3h14l-2-3V7a5 5 0 0 0-5-5z"/><path d="M9 17v1a3 3 0 0 0 6 0v-1"/></svg>
              Hot Hold Items
              <span className="tempSectionNote">Min 135°F · Check every 2 hours</span>
            </div>
            <div className="tempItemList">
              {tempItems.filter((i) => i.section === 'hothold').map((item) => {
                const last = tempHistory.find((e) => e.item === item.name)
                const inputVal = tempInputs[item.name] ?? ''
                const submitting = tempSubmitting[item.name] ?? false
                return (
                  <div key={item.name} className={`tempItemCard ${last ? (last.valid ? 'tempItemCard--ok' : 'tempItemCard--fail') : ''}`}>
                    <div className="tempItemCardLeft">
                      <div className={`tempItemDot ${last ? (last.valid ? 'tempItemDot--ok' : 'tempItemDot--fail') : 'tempItemDot--idle'}`} />
                      <div>
                        <strong className="tempItemName">{item.displayName}</strong>
                        <p className="tempItemTarget">
                          {last ? (
                            <span className={last.valid ? 'tempValOk' : 'tempValFail'}>
                              {last.valid ? '✓' : '✗'} Last: {last.value}°F
                            </span>
                          ) : 'Not logged yet'}
                        </p>
                      </div>
                    </div>
                    <div className="tempItemCardRight">
                      <input
                        className="tempInput"
                        type="number"
                        inputMode="decimal"
                        placeholder="°F"
                        value={inputVal}
                        onChange={(e) => setTempInputs((prev) => ({ ...prev, [item.name]: e.target.value }))}
                        onKeyDown={(e) => { if (e.key === 'Enter') void logTempFor(item) }}
                      />
                      <button
                        className={`tempLogBtn ${inputVal.trim() ? 'tempLogBtn--active' : ''}`}
                        disabled={!inputVal.trim() || submitting}
                        onClick={() => void logTempFor(item)}
                      >
                        {submitting ? '…' : 'Log'}
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="tempSectionLabel">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg>
              Cold Storage
              <span className="tempSectionNote">Must stay below threshold</span>
            </div>
            <div className="tempItemList">
              {tempItems.filter((i) => i.section === 'cold').map((item) => {
                const last = tempHistory.find((e) => e.item === item.name)
                const inputVal = tempInputs[item.name] ?? ''
                const submitting = tempSubmitting[item.name] ?? false
                return (
                  <div key={item.name} className={`tempItemCard ${last ? (last.valid ? 'tempItemCard--ok' : 'tempItemCard--fail') : ''}`}>
                    <div className="tempItemCardLeft">
                      <div className={`tempItemDot ${last ? (last.valid ? 'tempItemDot--ok' : 'tempItemDot--fail') : 'tempItemDot--idle'}`} />
                      <div>
                        <strong className="tempItemName">{item.displayName}</strong>
                        <p className="tempItemTarget">
                          Max {item.max}°F · {item.frequency}
                          {last ? (
                            <span className={`tempValInline ${last.valid ? 'tempValOk' : 'tempValFail'}`}>
                              {' '}· {last.valid ? '✓' : '✗'} {last.value}°F
                            </span>
                          ) : null}
                        </p>
                      </div>
                    </div>
                    <div className="tempItemCardRight">
                      <input
                        className="tempInput"
                        type="number"
                        inputMode="decimal"
                        placeholder="°F"
                        value={inputVal}
                        onChange={(e) => setTempInputs((prev) => ({ ...prev, [item.name]: e.target.value }))}
                        onKeyDown={(e) => { if (e.key === 'Enter') void logTempFor(item) }}
                      />
                      <button
                        className={`tempLogBtn ${inputVal.trim() ? 'tempLogBtn--active' : ''}`}
                        disabled={!inputVal.trim() || submitting}
                        onClick={() => void logTempFor(item)}
                      >
                        {submitting ? '…' : 'Log'}
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        ) : null}

        {!isHydrating && activeModule === 'waste' ? (
          <section className="panelGrid">
            <article className="card largeCard">
              <h3>Waste Entry</h3>
              <select className="fieldInput" value={wasteItem} onChange={(event) => setWasteItem(event.target.value)}>
                {['Butter Chicken', 'Keema', 'Chole', 'Paneer', 'Butter Masala', 'Palak Sauce', 'Rice', 'Roti'].map((item) => (
                  <option key={item} value={item}>{item}</option>
                ))}
              </select>
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
          <section className="dataPage">
            <div className="dataPageHeader">
              <h2 className="dataPageTitle">Data Hub</h2>
              <div className="tabRow" role="tablist" aria-label="Data tabs">
                <button role="tab" aria-selected={dataTab === 'import'} className={`tabButton ${dataTab === 'import' ? 'active' : ''}`} onClick={() => setDataTab('import')}>Sales Import</button>
                <button role="tab" aria-selected={dataTab === 'reports'} className={`tabButton ${dataTab === 'reports' ? 'active' : ''}`} onClick={() => setDataTab('reports')}>Compliance Reports</button>
              </div>
            </div>

            {dataTab === 'import' ? (
              <div className="dataImportSection">
                <label className="dataDropZone">
                  <input
                    type="file"
                    accept=".csv,.txt"
                    style={{ display: 'none' }}
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (!file) return
                      setSalesImportError('')
                      const reader = new FileReader()
                      reader.onload = (ev) => {
                        const text = ev.target?.result as string
                        try {
                          const parsed = parseSalesMix(text)
                          if (parsed.items.length === 0 && parsed.modifiers.length === 0) {
                            setSalesImportError('Could not parse file. Make sure it is the Boost POS Sales Mix CSV export.')
                          } else {
                            setParsedSalesData(parsed)
                          }
                        } catch {
                          setSalesImportError('Failed to parse file.')
                        }
                      }
                      reader.readAsText(file)
                      e.target.value = ''
                    }}
                  />
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#b8c4cf" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                  <p className="dataDropZoneTitle">Upload Boost POS Sales Mix CSV</p>
                  <p className="dataDropZoneHint">Click to browse · .csv or .txt export from Looker</p>
                </label>
                {salesImportError ? <p className="dataImportError">{salesImportError}</p> : null}

                {parsedSalesData ? (
                  <div className="dataSalesResult">
                    <div className="dataSalesSummary">
                      <div className="dataSumCard">
                        <span className="dataSumNumber">${parsedSalesData.items.reduce((s, r) => s + r.totalSales, 0).toFixed(2)}</span>
                        <span className="dataSumLabel">Total Revenue</span>
                      </div>
                      <div className="dataSumCard">
                        <span className="dataSumNumber">{parsedSalesData.items.reduce((s, r) => s + r.quantity, 0)}</span>
                        <span className="dataSumLabel">Items Sold</span>
                      </div>
                      {parsedSalesData.reportDate ? (
                        <div className="dataSumCard">
                          <span className="dataSumNumber" style={{ fontSize: 22 }}>{parsedSalesData.reportDate}</span>
                          <span className="dataSumLabel">Report Period</span>
                        </div>
                      ) : null}
                    </div>

                    <div className="dataTableCard">
                      <h4 className="dataTableCardTitle">Items</h4>
                      <table className="dataTable">
                        <thead><tr><th>Item</th><th>Qty</th><th>Revenue</th></tr></thead>
                        <tbody>
                          {parsedSalesData.items.map((row) => (
                            <tr key={row.name}>
                              <td>{row.name}</td>
                              <td>{row.quantity}</td>
                              <td>${row.totalSales.toFixed(2)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <div className="dataTableCard">
                      <h4 className="dataTableCardTitle">Add-ons & Modifiers</h4>
                      <div className="dataModList">
                        {parsedSalesData.modifiers.map((row) => {
                          const maxQty = Math.max(...parsedSalesData.modifiers.map((r) => r.quantity))
                          const pct = Math.round((row.quantity / maxQty) * 100)
                          return (
                            <div key={row.name} className="dataModRow">
                              <div className="dataModRowMeta">
                                <span>{row.name}</span>
                                <span className="dataModQty">{row.quantity}{row.totalSales > 0 ? ` · $${row.totalSales.toFixed(2)}` : ''}</span>
                              </div>
                              <div className="dataModBar"><div className="dataModBarFill" style={{ width: `${pct}%` }} /></div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}

            {dataTab === 'reports' ? (
              <div className="dataReportsSection">
                <article className="card largeCard">
                  <h3>Compliance Report</h3>
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
                    <caption className="srOnly">Compliance report</caption>
                    <thead>
                      <tr><th>Date</th><th>Checklists</th><th>Critical Alerts</th><th>Waste (oz)</th></tr>
                    </thead>
                    <tbody>
                      {reportRows.length === 0 ? (
                        <tr><td colSpan={4} style={{ textAlign: 'center', color: 'var(--text-soft)' }}>Select a date range and load.</td></tr>
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
                    <button className="cta" onClick={exportCurrentSessionCsv}>Export session CSV</button>
                    <button className="cta" onClick={exportReportCsv} disabled={reportRows.length === 0}>Export report CSV</button>
                    <button className="ghostBtn" onClick={exportReportPdf}>Export PDF</button>
                  </div>
                </article>
              </div>
            ) : null}
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

        {!isHydrating && activeModule === 'admin' ? (
          <section className="adminPage">
            <div className="adminHeader">
              <div>
                <h2 className="adminTitle">Staff Dashboard</h2>
                <p className="muted">{new Date().toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
              </div>
              <button className="adminRefreshBtn" onClick={loadAdminData} disabled={adminLoading}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
                {adminLoading ? 'Refreshing…' : 'Refresh'}
              </button>
            </div>

            {adminRows.length === 0 && !adminLoading ? (
              <div className="adminEmptyState">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#b8c4cf" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                <p>No staff data loaded yet.</p>
                <button className="homeResumeBtn" onClick={loadAdminData}>Load now</button>
              </div>
            ) : null}

            {adminRows.length > 0 ? (
              <>
                <div className="adminSummaryGrid">
                  <div className="adminSummaryCard">
                    <span className="adminSummaryNumber">{adminRows.length}</span>
                    <span className="adminSummaryLabel">Total Staff</span>
                  </div>
                  <div className="adminSummaryCard adminSummaryCard--green">
                    <span className="adminSummaryNumber">{adminRows.filter((r) => r.activeToday).length}</span>
                    <span className="adminSummaryLabel">Active Today</span>
                  </div>
                  <div className="adminSummaryCard adminSummaryCard--orange">
                    <span className="adminSummaryNumber">{adminRows.reduce((sum, r) => sum + r.tasksCompletedToday, 0)}</span>
                    <span className="adminSummaryLabel">Tasks Done</span>
                  </div>
                  <div className="adminSummaryCard adminSummaryCard--blue">
                    <span className="adminSummaryNumber">{adminRows.reduce((sum, r) => sum + r.checklistsCompleted, 0)}</span>
                    <span className="adminSummaryLabel">Checklists Completed</span>
                  </div>
                </div>

                <div className="adminStaffList">
                  {adminRows.map((row) => (
                    <div key={row.userId} className="adminStaffCard">
                      <div className="adminStaffAvatar">
                        {row.displayName.slice(0, 1).toUpperCase()}
                        <span className={`adminStaffDot ${row.activeToday ? 'adminStaffDot--online' : 'adminStaffDot--offline'}`} />
                      </div>
                      <div className="adminStaffInfo">
                        <strong>{row.displayName}</strong>
                        <p>{row.email}</p>
                      </div>
                      <span className={`adminRoleBadge adminRoleBadge--${row.role}`}>{row.role}</span>
                      <div className="adminStaffStats">
                        <div className="adminStatPill">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                          {row.tasksCompletedToday} tasks
                        </div>
                        <div className="adminStatPill">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
                          {row.checklistsCompleted}/{row.checklistsTotal} checklists
                        </div>
                      </div>
                      <div className="adminLastActive">
                        {row.lastActiveAt
                          ? <>Last active {new Date(row.lastActiveAt).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}</>
                          : <span className="adminNotActive">Not active today</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : null}
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
