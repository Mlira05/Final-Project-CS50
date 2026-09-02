// CS50 Final Project — src/App.tsx: Project entry point, styling, or build configuration.
// AI assistance citation: OpenAI Codex helped migrate, document, and review this file for the CS50 final project; product decisions and final responsibility remain with Matheus Lira.
import type { ReactNode } from 'react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  BarChart3,
  CreditCard,
  Landmark,
  PiggyBank,
  ReceiptText,
  Save,
  Settings as SettingsIcon,
  Target,
} from 'lucide-react'
import { BottomNav } from './components/layout/BottomNav'
import { LoginScreen } from './components/layout/LoginScreen'
import { Button } from './components/ui/Button'
import { ErrorState } from './components/ui/ErrorState'
import { Input, Textarea } from './components/ui/Input'
import { LoadingState } from './components/ui/LoadingState'
import { Modal } from './components/ui/Modal'
import { Select } from './components/ui/Select'
import { Tabs } from './components/ui/Tabs'
import { useTheme } from './hooks/useTheme'
import { api } from './lib/api'
import { currentMonthYear } from './lib/format'
import { Dashboard } from './pages/Dashboard'
import { Expenses } from './pages/Expenses'
import { Goals } from './pages/Goals'
import { Income } from './pages/Income'
import { Reserve } from './pages/Reserve'
import { Settings } from './pages/Settings'
import { Transactions } from './pages/Transactions'
import type { AppTab, AuthStatus, Category, Profile } from './types/finance'

const navItems = [
  { id: 'dashboard', label: 'Início', icon: <BarChart3 size={19} /> },
  { id: 'transactions', label: 'Transações', icon: <ReceiptText size={19} /> },
  { id: 'expenses', label: 'Despesas', icon: <CreditCard size={19} /> },
  { id: 'income', label: 'Renda', icon: <Landmark size={19} /> },
  { id: 'goals', label: 'Metas', icon: <Target size={19} /> },
  { id: 'reserve', label: 'Cofrinhos', icon: <PiggyBank size={19} /> },
  { id: 'settings', label: 'Mais', icon: <SettingsIcon size={19} /> },
] satisfies Array<{ id: AppTab; label: string; icon: ReactNode }>

function App() {
  const { mode, accent, setMode, setAccent } = useTheme()
  const [authStatus, setAuthStatus] = useState<AuthStatus | null>(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [selectedProfileId, setSelectedProfileId] = useState<number>(() =>
    Number(localStorage.getItem('finance-selected-profile')) || 1,
  )
  const initialMonthYear = currentMonthYear()
  const [month, setMonth] = useState(initialMonthYear.month)
  const [year, setYear] = useState(initialMonthYear.year)
  const [activeTab, setActiveTab] = useState<AppTab>('dashboard')
  const [quickActionOpen, setQuickActionOpen] = useState(false)
  const [quickKind, setQuickKind] = useState<'expense' | 'income'>('expense')
  const [quickForm, setQuickForm] = useState({
    amount: '',
    description: '',
    category: '',
    date: new Date().toISOString().slice(0, 10),
    isRecurring: false,
    notes: '',
  })
  const [quickSaving, setQuickSaving] = useState(false)
  const [quickError, setQuickError] = useState('')
  const [dataVersion, setDataVersion] = useState(0)
  const [appError, setAppError] = useState('')
  const [openFinanceSync, setOpenFinanceSync] = useState({
    connected: false,
    error: '',
    lastSuccessAt: '',
    loading: false,
    message: '',
    stateLoaded: false,
  })

  const selectedProfile = useMemo(
    () => profiles.find((profile) => profile.id === selectedProfileId) ?? profiles[0] ?? null,
    [profiles, selectedProfileId],
  )
  const quickCategoryOptions = useMemo(
    () =>
      categories.length
        ? categories.map((category) => ({ label: category.name, value: category.name }))
        : [{ label: 'Outros', value: 'Outros' }],
    [categories],
  )

  const loadCategories = useCallback(async (profileId: number) => {
    const categoryResponse = await api.categories(profileId)
    setCategories(categoryResponse.categories)
  }, [])

  const loadOpenFinanceState = useCallback(async (profileId: number) => {
    try {
      const response = await api.openFinanceSyncState(profileId)
      setOpenFinanceSync((current) => ({
        ...current,
        connected: response.connected,
        error: '',
        lastSuccessAt: response.lastSuccessAt ?? '',
        stateLoaded: true,
      }))
      return response
    } catch {
      setOpenFinanceSync((current) => ({
        ...current,
        connected: false,
        error: 'Nao foi possivel verificar a conexao Open Finance.',
        stateLoaded: true,
      }))
      return null
    }
  }, [])

  const loadAuth = useCallback(async () => {
    setAuthLoading(true)

    try {
      const response = await api.authStatus()
      setAuthStatus(response)
    } catch {
      setAuthStatus({
        authenticated: false,
        configured: false,
        mode: 'locked',
        profileId: null,
        profileName: null,
        user: null,
      })
    } finally {
      setAuthLoading(false)
    }
  }, [])

  const loadAppData = useCallback(async () => {
    setAppError('')

    try {
      const profileResponse = await api.profiles()
      setProfiles(profileResponse.profiles)

      const activeProfile =
        profileResponse.profiles.find((profile) => profile.id === selectedProfileId) ?? profileResponse.profiles[0]

      if (activeProfile) {
        setSelectedProfileId(activeProfile.id)
        localStorage.setItem('finance-selected-profile', String(activeProfile.id))
        await Promise.all([loadCategories(activeProfile.id), loadOpenFinanceState(activeProfile.id)])
      }
    } catch (requestError) {
      setAppError(requestError instanceof Error ? requestError.message : 'Não foi possível carregar o app.')
    }
  }, [loadCategories, loadOpenFinanceState, selectedProfileId])

  useEffect(() => {
    void loadAuth()
  }, [loadAuth])

  useEffect(() => {
    if (authStatus?.authenticated) {
      void loadAppData()
    }
  }, [authStatus?.authenticated, loadAppData])

  useEffect(() => {
    if (selectedProfileId) {
      localStorage.setItem('finance-selected-profile', String(selectedProfileId))
      if (authStatus?.authenticated) {
        void Promise.all([loadCategories(selectedProfileId), loadOpenFinanceState(selectedProfileId)])
      }
    }
  }, [selectedProfileId, authStatus?.authenticated, loadCategories, loadOpenFinanceState])

  function bumpDataVersion() {
    setDataVersion((current) => current + 1)
  }

  function handleProfilesChange(nextProfiles: Profile[]) {
    setProfiles(nextProfiles)
    bumpDataVersion()
  }

  function handleLogout() {
    setAuthStatus(null)
    setProfiles([])
    setCategories([])
    void loadAuth()
  }

  const syncOpenFinanceData = useCallback(
    async (mode: 'auto' | 'manual' = 'manual') => {
      if (!selectedProfile || openFinanceSync.loading) {
        return
      }

      let connected = openFinanceSync.connected
      if (!openFinanceSync.stateLoaded) {
        const state = await loadOpenFinanceState(selectedProfile.id)
        connected = Boolean(state?.connected)
      }

      if (connected === false) {
        setOpenFinanceSync((current) => ({
          ...current,
          error: 'Configure uma conexao Open Finance em Mais para atualizar os dados.',
          message: '',
        }))
        return
      }

      setOpenFinanceSync((current) => ({
        ...current,
        error: '',
        loading: true,
        message: mode === 'auto' ? 'Atualizando dados em segundo plano...' : 'Atualizando dados...',
      }))

      try {
        const result = await api.syncOpenFinance(selectedProfile.id)
        setOpenFinanceSync((current) => ({
          ...current,
          connected: true,
          error: '',
          lastSuccessAt: result.lastSuccessAt,
          loading: false,
          message: result.inserted ? `${result.inserted} novas transacoes importadas.` : 'Dados ja estavam atualizados.',
        }))
        bumpDataVersion()
      } catch (requestError) {
        setOpenFinanceSync((current) => ({
          ...current,
          error: requestError instanceof Error ? requestError.message : 'Nao foi possivel atualizar o Open Finance.',
          loading: false,
          message: '',
        }))
      }
    },
    [loadOpenFinanceState, openFinanceSync.connected, openFinanceSync.loading, openFinanceSync.stateLoaded, selectedProfile],
  )

  function resetQuickForm() {
    setQuickForm({
      amount: '',
      description: '',
      category: categories[0]?.name ?? '',
      date: new Date().toISOString().slice(0, 10),
      isRecurring: false,
      notes: '',
    })
    setQuickError('')
  }

  function openQuickAction(kind: 'expense' | 'income' = quickKind) {
    setQuickKind(kind)
    resetQuickForm()
    setQuickActionOpen(true)
  }

  function closeQuickAction() {
    setQuickActionOpen(false)
    setQuickSaving(false)
    setQuickError('')
  }

  async function saveQuickTransaction(event: React.FormEvent) {
    event.preventDefault()

    if (!selectedProfile) {
      setQuickError('Selecione um perfil antes de salvar.')
      return
    }

    const amount = Number(quickForm.amount)
    const description = quickForm.description.trim()
    const category = quickForm.category || categories[0]?.name || 'Outros'

    if (!Number.isFinite(amount) || amount <= 0) {
      setQuickError('Informe um valor maior que zero.')
      return
    }

    if (!description) {
      setQuickError('Adicione uma descricao para a transacao.')
      return
    }

    setQuickSaving(true)
    setQuickError('')

    try {
      if (quickKind === 'expense') {
        await api.createExpense({
          profileId: selectedProfile.id,
          name: description,
          category,
          amount,
          date: quickForm.date,
          paymentMethod: 'Outro',
          isRecurring: quickForm.isRecurring,
          recurrenceEndDate: `${new Date(quickForm.date).getFullYear()}-12-31`,
          applyToFuture: true,
          notes: quickForm.notes,
        })
        setActiveTab('expenses')
      } else {
        const incomePayload = {
          profileId: selectedProfile.id,
          month,
          year,
          amount,
          notes: [description, quickForm.notes].filter(Boolean).join(' - '),
          isRecurring: quickForm.isRecurring,
          recurrenceEndMonth: 12,
          recurrenceEndYear: year,
          applyToFuture: true,
        }
        const currentIncome = await api.monthlyIncome(selectedProfile.id, month, year)
        if (currentIncome.income) {
          await api.updateMonthlyIncome({ ...incomePayload, id: currentIncome.income.id })
        } else {
          await api.saveMonthlyIncome(incomePayload)
        }
        setActiveTab('income')
      }

      bumpDataVersion()
      closeQuickAction()
    } catch (requestError) {
      setQuickError(requestError instanceof Error ? requestError.message : 'Nao foi possivel salvar a transacao.')
    } finally {
      setQuickSaving(false)
    }
  }

  if (authLoading) {
    return (
      <main className="grid min-h-screen place-items-center px-4">
        <LoadingState label="Verificando proteção" />
      </main>
    )
  }

  if (!authStatus?.authenticated) {
    return <LoginScreen onAuthenticated={loadAuth} status={authStatus} />
  }

  if (appError) {
    return (
      <main className="grid min-h-screen place-items-center px-4">
        <div className="w-full max-w-xl">
          <ErrorState message={appError} onRetry={loadAppData} />
        </div>
      </main>
    )
  }

  if (!selectedProfile) {
    return (
      <main className="grid min-h-screen place-items-center px-4">
        <LoadingState label="Carregando perfis" />
      </main>
    )
  }

  return (
    <div className="min-h-dvh bg-[var(--bg)] text-[var(--text)]">
      <div className="mx-auto grid w-full max-w-md gap-4 px-5 pb-28 pt-5 lg:max-w-6xl lg:grid-cols-[14rem_1fr] lg:px-6 lg:pb-10 lg:pt-6">
        <aside className="glass-panel sticky top-6 hidden h-fit rounded-[1.35rem] p-2 lg:block">
          <Tabs active={activeTab} items={navItems} onChange={setActiveTab} />
        </aside>

        <main className="min-w-0">
          {activeTab === 'dashboard' ? (
            <Dashboard
              accent={accent}
              dataVersion={dataVersion}
              month={month}
              onOpenFinanceSync={() => void syncOpenFinanceData('manual')}
              onMonthChange={setMonth}
              onNavigate={setActiveTab}
              onQuickAction={openQuickAction}
              onYearChange={setYear}
              openFinanceSync={openFinanceSync}
              profile={selectedProfile}
              year={year}
            />
          ) : null}
          {activeTab === 'transactions' ? (
            <Transactions
              categories={categories}
              dataVersion={dataVersion}
              month={month}
              onDataChange={bumpDataVersion}
              profile={selectedProfile}
              year={year}
            />
          ) : null}
          {activeTab === 'expenses' ? (
            <Expenses
              categories={categories}
              dataVersion={dataVersion}
              month={month}
              onDataChange={bumpDataVersion}
              profile={selectedProfile}
              year={year}
            />
          ) : null}
          {activeTab === 'income' ? (
            <Income dataVersion={dataVersion} month={month} onDataChange={bumpDataVersion} profile={selectedProfile} year={year} />
          ) : null}
          {activeTab === 'goals' ? (
            <Goals dataVersion={dataVersion} onDataChange={bumpDataVersion} profile={selectedProfile} profiles={profiles} />
          ) : null}
          {activeTab === 'reserve' ? (
            <Reserve dataVersion={dataVersion} onDataChange={bumpDataVersion} profile={selectedProfile} />
          ) : null}
          {activeTab === 'settings' ? (
            <Settings
              accent={accent}
              categories={categories}
              mode={mode}
              onAccentChange={setAccent}
              onDataChange={bumpDataVersion}
              onLogout={handleLogout}
              onModeChange={setMode}
              onProfileChange={setSelectedProfileId}
              onProfilesChange={handleProfilesChange}
              profiles={profiles}
              selectedProfileId={selectedProfile.id}
              sessionProfileId={authStatus.profileId}
            />
          ) : null}
        </main>
      </div>

      <BottomNav active={activeTab} onChange={setActiveTab} />

      <Modal
        description={`${selectedProfile.name} - ${month}/${year}`}
        onClose={closeQuickAction}
        open={quickActionOpen}
        title="Nova transacao"
      >
        <form className="grid gap-3" onSubmit={saveQuickTransaction}>
          <div className="grid grid-cols-2 gap-1 rounded-[1rem] border border-[var(--border)] bg-[var(--surface-strong)] p-1">
            <button
              className={`focus-ring rounded-xl px-4 py-3 text-sm font-semibold transition ${
                quickKind === 'expense' ? 'bg-red-500/20 text-red-100 shadow-inner' : 'text-[var(--muted)]'
              }`}
              onClick={() => setQuickKind('expense')}
              type="button"
            >
              Despesa
            </button>
            <button
              className={`focus-ring rounded-xl px-4 py-3 text-sm font-semibold transition ${
                quickKind === 'income' ? 'bg-emerald-500/20 text-emerald-100 shadow-inner' : 'text-[var(--muted)]'
              }`}
              onClick={() => setQuickKind('income')}
              type="button"
            >
              Receita
            </button>
          </div>

          <Input
            inputMode="decimal"
            label="Valor"
            onChange={(event) => setQuickForm({ ...quickForm, amount: event.target.value })}
            placeholder="R$ 0,00"
            value={quickForm.amount}
          />
          <Input
            label="Descricao"
            maxLength={120}
            onChange={(event) => setQuickForm({ ...quickForm, description: event.target.value })}
            placeholder={quickKind === 'expense' ? 'Ex.: Almoco com cliente' : 'Ex.: Salario'}
            value={quickForm.description}
          />
          {quickKind === 'expense' ? (
            <Select
              label="Categoria"
              onChange={(event) => setQuickForm({ ...quickForm, category: event.target.value })}
              options={quickCategoryOptions}
              value={quickForm.category || categories[0]?.name || 'Outros'}
            />
          ) : null}
          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              label="Data"
              onChange={(event) => setQuickForm({ ...quickForm, date: event.target.value })}
              type="date"
              value={quickForm.date}
            />
            <label className="grid gap-2 text-sm text-[var(--muted)]">
              <span>Recorrente</span>
              <span className="flex h-10 items-center justify-between rounded-[1rem] border border-[var(--border)] bg-[var(--surface-strong)] px-3">
                <span>{quickForm.isRecurring ? 'Sim' : 'Nao'}</span>
                <input
                  checked={quickForm.isRecurring}
                  className="h-5 w-5 accent-[var(--accent)]"
                  onChange={(event) => setQuickForm({ ...quickForm, isRecurring: event.target.checked })}
                  type="checkbox"
                />
              </span>
            </label>
          </div>
          <Textarea
            label="Notas"
            maxLength={250}
            onChange={(event) => setQuickForm({ ...quickForm, notes: event.target.value })}
            placeholder="Opcional"
            value={quickForm.notes}
          />
          {quickError ? <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-100">{quickError}</div> : null}
          <Button disabled={quickSaving} icon={<Save size={16} />} type="submit">
            {quickSaving ? 'Salvando...' : 'Salvar transacao'}
          </Button>
        </form>
      </Modal>
    </div>
  )
}

export default App
