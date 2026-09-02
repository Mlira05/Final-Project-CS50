// CS50 Final Project — src/pages/Settings.tsx: Feature page and its user-interface state.
// AI assistance citation: OpenAI Codex helped migrate, document, and review this file for the CS50 final project; product decisions and final responsibility remain with Matheus Lira.
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ChevronLeft,
  ChevronRight,
  FolderKanban,
  KeyRound,
  LogOut,
  Moon,
  Palette,
  PlugZap,
  Plus,
  RefreshCw,
  ShieldCheck,
  Sun,
  Trash2,
  UserRound,
  WandSparkles,
} from 'lucide-react'
import { api } from '../lib/api'
import { accentOptions } from '../lib/theme'
import type {
  Category,
  CategoryRule,
  CategoryRuleMatchType,
  OpenFinanceConnection,
  OpenFinanceSyncStateResponse,
  Profile,
  ThemeMode,
} from '../types/finance'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { Input } from '../components/ui/Input'
import { Modal } from '../components/ui/Modal'
import { Select } from '../components/ui/Select'

interface SettingsProps {
  profiles: Profile[]
  categories: Category[]
  selectedProfileId: number
  sessionProfileId: number | null
  mode: ThemeMode
  accent: string
  onProfilesChange: (profiles: Profile[]) => void
  onProfileChange: (profileId: number) => void
  onModeChange: (mode: ThemeMode) => void
  onAccentChange: (accent: string) => void
  onDataChange: () => void
  onLogout: () => void
}

interface CategoryFormState {
  name: string
  color: string
}

interface RuleFormState {
  match_type: CategoryRuleMatchType
  pattern: string
  category: string
  priority: string
  is_active: boolean
}

interface ConnectionFormState {
  profileId: number
  holderName: string
  document: string
  accessToken: string
  refreshToken: string
  clientId: string
  tokenUrl: string
  mcpUrl: string
  tokenExpiresAt: string
  consentStatus: string
}

const categoryMatchTypeOptions: Array<{ label: string; value: CategoryRuleMatchType }> = [
  { label: 'Estabelecimento', value: 'merchant' },
  { label: 'Descrição', value: 'description' },
  { label: 'Categoria original', value: 'original_category' },
  { label: 'Buscar em tudo', value: 'contains' },
]

const emptyCategoryForm = (): CategoryFormState => ({
  name: '',
  color: '#94a3b8',
})

const emptyRuleForm = (category = ''): RuleFormState => ({
  match_type: 'merchant',
  pattern: '',
  category,
  priority: '100',
  is_active: true,
})

const emptyConnectionForm = (profileId: number): ConnectionFormState => ({
  profileId,
  holderName: '',
  document: '',
  accessToken: '',
  refreshToken: '',
  clientId: '',
  tokenUrl: '',
  mcpUrl: '',
  tokenExpiresAt: '',
  consentStatus: 'active',
})

export function Settings({
  profiles,
  categories,
  selectedProfileId,
  sessionProfileId,
  mode,
  accent,
  onProfilesChange,
  onProfileChange,
  onModeChange,
  onAccentChange,
  onDataChange,
  onLogout,
}: SettingsProps) {
  const [newProfileName, setNewProfileName] = useState('')
  const [editingNames, setEditingNames] = useState<Record<number, string>>(() =>
    Object.fromEntries(profiles.map((profile) => [profile.id, profile.name])),
  )
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [pinForm, setPinForm] = useState({ currentPin: '', newPin: '', confirmPin: '' })
  const [pinMessage, setPinMessage] = useState('')
  const [managedCategories, setManagedCategories] = useState<Category[]>(categories)
  const [categoryForm, setCategoryForm] = useState<CategoryFormState>(emptyCategoryForm)
  const [editingCategories, setEditingCategories] = useState<Record<number, CategoryFormState>>({})
  const [rules, setRules] = useState<CategoryRule[]>([])
  const [ruleForm, setRuleForm] = useState<RuleFormState>(() => emptyRuleForm(categories[0]?.name ?? ''))
  const [editingRules, setEditingRules] = useState<Record<number, RuleFormState>>({})
  const [connections, setConnections] = useState<OpenFinanceConnection[]>([])
  const [openFinanceStates, setOpenFinanceStates] = useState<Record<number, OpenFinanceSyncStateResponse>>({})
  const [connectionModalOpen, setConnectionModalOpen] = useState(false)
  const [connectionForm, setConnectionForm] = useState<ConnectionFormState>(() => emptyConnectionForm(selectedProfileId))
  const [busySection, setBusySection] = useState<string | null>(null)
  const [settingsPanel, setSettingsPanel] = useState<
    null | 'profiles' | 'appearance' | 'pin' | 'openFinance' | 'data' | 'categories' | 'rules'
  >(null)
  const sessionProfileName = profiles.find((profile) => profile.id === sessionProfileId)?.name ?? null
  const selectedProfile = profiles.find((profile) => profile.id === selectedProfileId)

  const categoryOptions = useMemo(
    () => managedCategories.map((category) => ({ label: category.name, value: category.name })),
    [managedCategories],
  )

  const profileOptions = useMemo(
    () => profiles.map((profile) => ({ label: profile.name, value: profile.id })),
    [profiles],
  )

  const activeConnectionsByProfile = useMemo(() => {
    const map = new Map<number, OpenFinanceConnection>()
    for (const connection of connections) {
      if (connection.status === 'active' && !map.has(connection.profile_id)) {
        map.set(connection.profile_id, connection)
      }
    }
    return map
  }, [connections])

  function primeEditableCategories(nextCategories: Category[]) {
    setEditingCategories(
      Object.fromEntries(
        nextCategories.map((category) => [
          category.id,
          {
            name: category.name,
            color: category.color,
          },
        ]),
      ),
    )
  }

  function primeEditableRules(nextRules: CategoryRule[]) {
    setEditingRules(
      Object.fromEntries(
        nextRules.map((rule) => [
          rule.id,
          {
            match_type: rule.match_type,
            pattern: rule.pattern,
            category: rule.category,
            priority: String(rule.priority),
            is_active: rule.is_active === 1,
          },
        ]),
      ),
    )
  }

  async function refreshProfiles(preferredId?: number) {
    const response = await api.profiles()
    onProfilesChange(response.profiles)
    setEditingNames(Object.fromEntries(response.profiles.map((profile) => [profile.id, profile.name])))

    if (preferredId && response.profiles.some((profile) => profile.id === preferredId)) {
      onProfileChange(preferredId)
    } else if (!response.profiles.some((profile) => profile.id === selectedProfileId) && response.profiles[0]) {
      onProfileChange(response.profiles[0].id)
    }
  }

  const refreshConfigData = useCallback(async () => {
    const [categoryResponse, ruleResponse] = await Promise.all([
      api.categories(selectedProfileId),
      api.categoryRules(selectedProfileId),
    ])
    setManagedCategories(categoryResponse.categories)
    primeEditableCategories(categoryResponse.categories)
    setRules(ruleResponse.rules)
    primeEditableRules(ruleResponse.rules)
    setRuleForm((current) => ({
      ...current,
      category: current.category || categoryResponse.categories[0]?.name || '',
    }))
  }, [selectedProfileId])

  const refreshOpenFinanceConnections = useCallback(async () => {
    const [connectionResponse, stateResults] = await Promise.all([
      api.openFinanceConnections(),
      Promise.allSettled(profiles.map((profile) => api.openFinanceSyncState(profile.id))),
    ])
    setConnections(connectionResponse.connections)
    setOpenFinanceStates(
      Object.fromEntries(
        stateResults.flatMap((result, index) =>
          result.status === 'fulfilled' ? [[profiles[index].id, result.value] as const] : [],
        ),
      ),
    )
  }, [profiles])

  useEffect(() => {
    setManagedCategories(categories)
    primeEditableCategories(categories)
  }, [categories])

  useEffect(() => {
    void refreshConfigData()
  }, [refreshConfigData])

  useEffect(() => {
    void refreshOpenFinanceConnections()
  }, [refreshOpenFinanceConnections])

  async function addProfile(event: React.FormEvent) {
    event.preventDefault()
    setError('')
    setMessage('')

    if (!newProfileName.trim()) {
      setError('O nome do perfil é obrigatório.')
      return
    }

    try {
      const response = await api.createProfile(newProfileName.trim())
      setNewProfileName('')
      await refreshProfiles(response.profile.id)
      setMessage('Perfil criado com sucesso.')
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Não foi possível adicionar o perfil.')
    }
  }

  async function renameProfile(profile: Profile) {
    setError('')
    setMessage('')
    const name = editingNames[profile.id]?.trim()

    if (!name) {
      setError('O nome do perfil é obrigatório.')
      return
    }

    try {
      await api.updateProfile(profile.id, name)
      await refreshProfiles(profile.id)
      setMessage('Perfil atualizado.')
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Não foi possível renomear o perfil.')
    }
  }

  async function deleteProfile(profile: Profile) {
    if (!window.confirm(`Excluir o perfil "${profile.name}" e todos os dados dele?`)) {
      return
    }

    try {
      await api.deleteProfile(profile.id)
      await refreshProfiles()
      setMessage('Perfil excluído.')
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Não foi possível excluir o perfil.')
    }
  }

  function resetLocalPreferences() {
    localStorage.removeItem('finance-theme-mode')
    localStorage.removeItem('finance-accent-color')
    onModeChange('dark')
    onAccentChange(accentOptions[0].value)
    setMessage('Preferências locais redefinidas.')
  }

  async function logout() {
    await api.logout()
    onLogout()
  }

  async function changePin(event: React.FormEvent) {
    event.preventDefault()
    setError('')
    setPinMessage('')

    if (pinForm.newPin.length < 4) {
      setError('O novo PIN precisa ter pelo menos 4 caracteres.')
      return
    }

    if (pinForm.newPin !== pinForm.confirmPin) {
      setError('A confirmação do PIN não confere.')
      return
    }

    try {
      await api.updateProfilePin(selectedProfileId, pinForm.currentPin, pinForm.newPin)
      setPinForm({ currentPin: '', newPin: '', confirmPin: '' })
      setPinMessage('PIN atualizado com sucesso.')
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Não foi possível alterar o PIN.')
    }
  }

  async function createCategory(event: React.FormEvent) {
    event.preventDefault()
    setError('')
    setMessage('')
    setBusySection('create-category')

    try {
      await api.createCategory({
        profileId: selectedProfileId,
        name: categoryForm.name.trim(),
        color: categoryForm.color,
      })
      setCategoryForm(emptyCategoryForm())
      await refreshConfigData()
      onDataChange()
      setMessage('Categoria criada.')
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Não foi possível criar a categoria.')
    } finally {
      setBusySection(null)
    }
  }

  async function saveCategory(category: Category) {
    const draft = editingCategories[category.id]
    if (!draft) {
      return
    }

    setError('')
    setMessage('')
    setBusySection(`category-${category.id}`)

    try {
      await api.updateCategory({
        id: category.id,
        name: draft.name.trim(),
        color: draft.color,
      })
      await refreshConfigData()
      onDataChange()
      setMessage(`Categoria ${draft.name} atualizada.`)
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Não foi possível atualizar a categoria.')
    } finally {
      setBusySection(null)
    }
  }

  async function removeCategory(category: Category) {
    const wantsDelete = window.confirm(`Excluir a categoria "${category.name}"?`)
    if (!wantsDelete) {
      return
    }

    setError('')
    setMessage('')
    setBusySection(`delete-category-${category.id}`)

    try {
      await api.deleteCategory(category.id)
      await refreshConfigData()
      onDataChange()
      setMessage(`Categoria ${category.name} excluída.`)
    } catch (requestError) {
      if (requestError instanceof Error && requestError.message.includes('substituta')) {
        const replacementCategory = window.prompt(
          `A categoria "${category.name}" está em uso. Informe a categoria substituta exatamente como aparece na lista.`,
          managedCategories.find((item) => item.name !== category.name)?.name ?? '',
        )

        if (!replacementCategory) {
          setError('A exclusão foi cancelada porque a categoria está em uso e faltou substituição.')
          return
        }

        try {
          await api.deleteCategory(category.id, replacementCategory)
          await refreshConfigData()
          onDataChange()
          setMessage(`Categoria ${category.name} substituída por ${replacementCategory} e removida.`)
        } catch (replacementError) {
          setError(
            replacementError instanceof Error
              ? replacementError.message
              : 'Não foi possível excluir a categoria com substituição.',
          )
        }
      } else {
        setError(requestError instanceof Error ? requestError.message : 'Não foi possível excluir a categoria.')
      }
    } finally {
      setBusySection(null)
    }
  }

  async function createRule(event: React.FormEvent) {
    event.preventDefault()
    setError('')
    setMessage('')
    setBusySection('create-rule')

    try {
      await api.createCategoryRule({
        profileId: selectedProfileId,
        matchType: ruleForm.match_type,
        pattern: ruleForm.pattern.trim(),
        category: ruleForm.category,
        priority: Number(ruleForm.priority),
        isActive: ruleForm.is_active,
      })
      setRuleForm(emptyRuleForm(ruleForm.category))
      await refreshConfigData()
      setMessage('Regra automática criada.')
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Não foi possível criar a regra.')
    } finally {
      setBusySection(null)
    }
  }

  async function saveRule(rule: CategoryRule) {
    const draft = editingRules[rule.id]
    if (!draft) {
      return
    }

    setError('')
    setMessage('')
    setBusySection(`rule-${rule.id}`)

    try {
      await api.updateCategoryRule({
        id: rule.id,
        matchType: draft.match_type,
        pattern: draft.pattern.trim(),
        category: draft.category,
        priority: Number(draft.priority),
        isActive: draft.is_active,
      })
      await refreshConfigData()
      setMessage('Regra atualizada.')
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Não foi possível atualizar a regra.')
    } finally {
      setBusySection(null)
    }
  }

  async function deleteRule(rule: CategoryRule) {
    if (!window.confirm(`Excluir a regra "${rule.pattern}"?`)) {
      return
    }

    setError('')
    setMessage('')
    setBusySection(`delete-rule-${rule.id}`)

    try {
      await api.deleteCategoryRule(rule.id)
      await refreshConfigData()
      setMessage('Regra removida.')
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Não foi possível excluir a regra.')
    } finally {
      setBusySection(null)
    }
  }

  async function reprocessCategories() {
    setError('')
    setMessage('')
    setBusySection('reprocess')

    try {
      const response = await api.reprocessOpenFinanceCategories(selectedProfileId)
      onDataChange()
      setMessage(`Reprocessamento concluído. ${response.updated} de ${response.processed} transações foram atualizadas.`)
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Não foi possível reprocessar as categorias.')
    } finally {
      setBusySection(null)
    }
  }

  function openConnectionModal(profile: Profile) {
    const connection = activeConnectionsByProfile.get(profile.id)
    setConnectionForm({
      ...emptyConnectionForm(profile.id),
      holderName: connection?.holder_name ?? profile.name,
      tokenUrl: connection?.token_url ?? '',
      mcpUrl: connection?.mcp_url ?? '',
      tokenExpiresAt: connection?.token_expires_at ?? '',
      consentStatus: connection?.consent_status ?? 'active',
    })
    setConnectionModalOpen(true)
  }

  async function saveConnection(event: React.FormEvent) {
    event.preventDefault()
    setError('')
    setMessage('')
    setBusySection('save-connection')

    try {
      await api.saveOpenFinanceConnection({
        profileId: connectionForm.profileId,
        provider: 'cumbuca',
        holderName: connectionForm.holderName,
        document: connectionForm.document,
        accessToken: connectionForm.accessToken,
        refreshToken: connectionForm.refreshToken,
        clientId: connectionForm.clientId,
        tokenUrl: connectionForm.tokenUrl,
        mcpUrl: connectionForm.mcpUrl,
        tokenExpiresAt: connectionForm.tokenExpiresAt,
        consentStatus: connectionForm.consentStatus,
      })
      setConnectionForm((current) => ({
        ...current,
        document: '',
        accessToken: '',
        refreshToken: '',
        clientId: '',
      }))
      setConnectionModalOpen(false)
      await refreshOpenFinanceConnections()
      setMessage('Conexão Open Finance salva.')
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Não foi possível salvar a conexão Open Finance.')
    } finally {
      setBusySection(null)
    }
  }

  async function deactivateConnection(connection: OpenFinanceConnection) {
    if (!window.confirm('Desativar esta conexão Open Finance? As transações antigas serão preservadas.')) {
      return
    }

    setError('')
    setMessage('')
    setBusySection(`deactivate-connection-${connection.id}`)

    try {
      await api.deleteOpenFinanceConnection(connection.id)
      await refreshOpenFinanceConnections()
      setMessage('Conexão Open Finance desativada.')
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Não foi possível desativar a conexão.')
    } finally {
      setBusySection(null)
    }
  }

  async function syncProfile(profile: Profile) {
    setError('')
    setMessage('')
    setBusySection(`sync-profile-${profile.id}`)

    try {
      const result = await api.syncOpenFinance(profile.id)
      onDataChange()
      await refreshOpenFinanceConnections()
      setMessage(`Dados de ${profile.name} atualizados: ${result.inserted} novas transações.`)
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Não foi possível atualizar os dados Open Finance.')
    } finally {
      setBusySection(null)
    }
  }

  async function connectProfile(profile: Profile) {
    setError('')
    setMessage('')
    setBusySection(`connect-profile-${profile.id}`)

    try {
      const response = await api.createOpenFinanceConsentLink(profile.id)
      if (response.mode === 'external_link' && response.url) {
        window.open(response.url, '_blank', 'noopener,noreferrer')
        setMessage(response.message)
        return
      }

      openConnectionModal(profile)
      setMessage(response.message)
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Nao foi possivel iniciar a conexao Open Finance.')
    } finally {
      setBusySection(null)
    }
  }

  async function migrateLegacyConnection(profile: Profile) {
    setError('')
    setMessage('')
    setBusySection(`migrate-profile-${profile.id}`)

    try {
      await api.migrateLegacyOpenFinanceConnection(profile.id)
      await refreshOpenFinanceConnections()
      setMessage(`Conexao legada migrada para ${profile.name}.`)
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Nao foi possivel migrar a conexao legada.')
    } finally {
      setBusySection(null)
    }
  }

  async function reprocessProfileCategories(profile: Profile) {
    setError('')
    setMessage('')
    setBusySection(`reprocess-profile-${profile.id}`)

    try {
      const response = await api.reprocessOpenFinanceCategories(profile.id)
      onDataChange()
      setMessage(`${profile.name}: ${response.updated} de ${response.processed} transações foram recategorizadas.`)
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Não foi possível reprocessar categorias.')
    } finally {
      setBusySection(null)
    }
  }

  return (
    <div className="mx-auto grid max-w-md gap-4">
      <div className="flex items-center justify-between gap-3">
        <button
          className={`focus-ring grid h-9 w-9 place-items-center rounded-full text-[var(--muted)] transition ${
            settingsPanel ? 'bg-[var(--surface-strong)]' : 'pointer-events-none opacity-0'
          }`}
          onClick={() => setSettingsPanel(null)}
          type="button"
        >
          <ChevronLeft size={18} />
        </button>
        <h2 className="text-xl font-semibold text-[var(--text)]">{settingsPanel ? 'Configuracoes' : 'Mais'}</h2>
        <Button icon={<LogOut size={16} />} onClick={() => void logout()} size="icon" variant="ghost" />
      </div>

      <Card className="p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full border border-[var(--accent-border)] bg-[var(--accent-soft)] text-[var(--accent)]">
              <UserRound size={22} />
            </span>
            <div className="min-w-0">
              <p className="truncate text-base font-semibold text-[var(--text)]">{selectedProfile?.name ?? 'Perfil selecionado'}</p>
              <p className="text-xs text-[var(--muted)]">
                {sessionProfileName ? `Sessao: ${sessionProfileName}` : 'Preferencias, seguranca e conexoes'}
              </p>
            </div>
          </div>
          <ChevronRight size={18} className="text-[var(--muted)]" />
        </div>
      </Card>

      {!settingsPanel ? (
        <div className="grid gap-4">
          <div>
            <h3 className="mb-2 text-sm font-medium text-[var(--muted)]">Conta</h3>
            <Card className="overflow-hidden">
              {[
                { id: 'profiles' as const, icon: <UserRound size={17} />, title: 'Perfis', detail: 'Principal e compartilhado' },
                { id: 'pin' as const, icon: <KeyRound size={17} />, title: 'PIN do perfil', detail: 'Senha curta por pessoa' },
              ].map((item) => (
                <button
                  className="focus-ring flex w-full items-center justify-between gap-3 border-b border-[var(--border)] px-3 py-3 text-left last:border-b-0"
                  key={item.id}
                  onClick={() => setSettingsPanel(item.id)}
                  type="button"
                >
                  <span className="flex min-w-0 items-center gap-3">
                    <span className="grid h-9 w-9 place-items-center rounded-full bg-[var(--accent-soft)] text-[var(--accent)]">
                      {item.icon}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-[var(--text)]">{item.title}</span>
                      <span className="block truncate text-xs text-[var(--muted)]">{item.detail}</span>
                    </span>
                  </span>
                  <ChevronRight size={16} className="text-[var(--muted)]" />
                </button>
              ))}
            </Card>
          </div>

          <div>
            <h3 className="mb-2 text-sm font-medium text-[var(--muted)]">Preferencias</h3>
            <Card className="overflow-hidden">
              {[
                { id: 'appearance' as const, icon: <Palette size={17} />, title: 'Aparencia', detail: mode === 'dark' ? 'Escuro' : 'Claro' },
                { id: 'categories' as const, icon: <FolderKanban size={17} />, title: 'Categorias', detail: 'Catalogo e cores' },
                { id: 'rules' as const, icon: <WandSparkles size={17} />, title: 'Regras automaticas', detail: 'Classificacao por padrao' },
              ].map((item) => (
                <button
                  className="focus-ring flex w-full items-center justify-between gap-3 border-b border-[var(--border)] px-3 py-3 text-left last:border-b-0"
                  key={item.id}
                  onClick={() => setSettingsPanel(item.id)}
                  type="button"
                >
                  <span className="flex min-w-0 items-center gap-3">
                    <span className="grid h-9 w-9 place-items-center rounded-full bg-[var(--accent-soft)] text-[var(--accent)]">
                      {item.icon}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-[var(--text)]">{item.title}</span>
                      <span className="block truncate text-xs text-[var(--muted)]">{item.detail}</span>
                    </span>
                  </span>
                  <ChevronRight size={16} className="text-[var(--muted)]" />
                </button>
              ))}
            </Card>
          </div>

          <div>
            <h3 className="mb-2 text-sm font-medium text-[var(--muted)]">Open Finance</h3>
            <Card className="overflow-hidden">
              {[
                { id: 'openFinance' as const, icon: <PlugZap size={17} />, title: 'Open Finance e conexoes', detail: 'Cumbuca por perfil' },
                { id: 'data' as const, icon: <ShieldCheck size={17} />, title: 'Dados e app', detail: 'Preferencias locais' },
              ].map((item) => (
                <button
                  className="focus-ring flex w-full items-center justify-between gap-3 border-b border-[var(--border)] px-3 py-3 text-left last:border-b-0"
                  key={item.id}
                  onClick={() => setSettingsPanel(item.id)}
                  type="button"
                >
                  <span className="flex min-w-0 items-center gap-3">
                    <span className="grid h-9 w-9 place-items-center rounded-full bg-[var(--accent-soft)] text-[var(--accent)]">
                      {item.icon}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-[var(--text)]">{item.title}</span>
                      <span className="block truncate text-xs text-[var(--muted)]">{item.detail}</span>
                    </span>
                  </span>
                  <ChevronRight size={16} className="text-[var(--muted)]" />
                </button>
              ))}
            </Card>
          </div>
        </div>
      ) : null}

      {settingsPanel ? (
        <>
          <div>
            <p className="text-xs text-[var(--muted)]">
              {sessionProfileName ? `Sessao: ${sessionProfileName}` : 'Preferencias, seguranca e conexoes'}
            </p>
            <p className="text-base font-semibold text-[var(--text)]">
              {selectedProfile?.name ?? 'Perfil selecionado'}
            </p>
          </div>
        </>
      ) : null}

      {error ? <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">{error}</div> : null}
      {message ? <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-200">{message}</div> : null}

      {settingsPanel ? (
      <section className="grid gap-4">
        <Card className={`p-4 ${settingsPanel === 'profiles' ? '' : 'hidden'}`} id="settings-profiles">
          <div className="mb-4 flex items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-semibold text-[var(--text)]">Perfis</h3>
              <p className="text-sm text-[var(--muted)]">Os perfis autenticados têm acesso administrativo equivalente ao aplicativo.</p>
            </div>
          </div>

          <form className="grid gap-3 sm:grid-cols-[1fr_auto]" onSubmit={addProfile}>
            <Input label="Novo perfil" onChange={(event) => setNewProfileName(event.target.value)} value={newProfileName} />
            <div className="self-end">
              <Button icon={<Plus size={16} />} type="submit">
                Adicionar
              </Button>
            </div>
          </form>

          <div className="mt-5 grid gap-3">
            {profiles.map((profile) => (
              <div
                className="grid gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface-strong)] p-3 sm:grid-cols-[1fr_auto_auto]"
                key={profile.id}
              >
                <Input
                  label={`Perfil ${profile.id}`}
                  onChange={(event) => setEditingNames({ ...editingNames, [profile.id]: event.target.value })}
                  value={editingNames[profile.id] ?? profile.name}
                />
                <Button className="self-end" onClick={() => void renameProfile(profile)} variant="secondary">
                  Salvar
                </Button>
                <Button
                  className="self-end"
                  disabled={profiles.length <= 1}
                  icon={<Trash2 size={16} />}
                  onClick={() => void deleteProfile(profile)}
                  variant="ghost"
                >
                  Excluir
                </Button>
              </div>
            ))}
          </div>
        </Card>

        <div className="grid gap-5">
          <Card className={`p-4 ${settingsPanel === 'appearance' ? '' : 'hidden'}`} id="settings-appearance">
            <h3 className="text-lg font-semibold text-[var(--text)]">Tema</h3>
            <div className="mt-4 grid gap-3">
              <div className="grid grid-cols-2 gap-2">
                <Button
                  icon={<Moon size={16} />}
                  onClick={() => onModeChange('dark')}
                  variant={mode === 'dark' ? 'primary' : 'secondary'}
                >
                  Escuro
                </Button>
                <Button
                  icon={<Sun size={16} />}
                  onClick={() => onModeChange('light')}
                  variant={mode === 'light' ? 'primary' : 'secondary'}
                >
                  Claro
                </Button>
              </div>
              <div className="grid grid-cols-4 gap-2">
                {accentOptions.map((option) => (
                  <button
                    aria-label={option.label}
                    className={`focus-ring h-10 rounded-xl border transition ${
                      accent === option.value ? 'border-[var(--text)]' : 'border-[var(--border)]'
                    }`}
                    key={option.value}
                    onClick={() => onAccentChange(option.value)}
                    style={{ background: option.value }}
                    type="button"
                  />
                ))}
              </div>
            </div>
          </Card>

          <Card className={`p-4 ${settingsPanel === 'pin' ? '' : 'hidden'}`} id="settings-pin">
            <h3 className="flex items-center gap-2 text-lg font-semibold text-[var(--text)]">
              <KeyRound size={18} /> PIN do perfil
            </h3>
            <p className="mt-2 text-sm text-[var(--muted)]">
              Cada pessoa entra com o próprio PIN e pode administrar os dois perfis.
              {sessionProfileName ? ` Sessão atual: ${sessionProfileName}.` : ''}
            </p>
            <form className="mt-4 grid gap-3" onSubmit={changePin}>
              <Input
                label="Novo PIN"
                onChange={(event) => setPinForm({ ...pinForm, newPin: event.target.value })}
                type="password"
                value={pinForm.newPin}
              />
              <Input
                label="Confirmar novo PIN"
                onChange={(event) => setPinForm({ ...pinForm, confirmPin: event.target.value })}
                type="password"
                value={pinForm.confirmPin}
              />
              {pinMessage ? <p className="text-sm text-emerald-300">{pinMessage}</p> : null}
              <Button icon={<KeyRound size={16} />} type="submit">
                Alterar PIN
              </Button>
            </form>
          </Card>

          <Card className={`p-4 ${settingsPanel === 'openFinance' ? '' : 'hidden'}`} id="settings-open-finance">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h3 className="text-lg font-semibold text-[var(--text)]">Open Finance</h3>
                <p className="mt-2 text-sm text-[var(--muted)]">
                  Cada perfil usa sua própria conexão Cumbuca. Tokens ficam criptografados e o CPF completo não é salvo.
                </p>
              </div>
              <Button
                disabled={busySection === 'reprocess'}
                icon={<WandSparkles size={16} />}
                onClick={() => void reprocessCategories()}
                variant="secondary"
              >
                {busySection === 'reprocess' ? 'Reprocessando...' : 'Reprocessar perfil atual'}
              </Button>
            </div>
            <div className="mt-4 grid gap-3">
              {profiles.map((profile) => {
                const state = openFinanceStates[profile.id]
                const connection = state?.activeConnection ?? activeConnectionsByProfile.get(profile.id)
                const displayStatus = state?.connectionDisplayStatus
                const statusLabel =
                  displayStatus === 'legacy_connected'
                    ? 'conectado via conexao legada'
                    : displayStatus === 'profile_connected'
                      ? 'conectado'
                      : displayStatus === 'error'
                        ? 'erro'
                        : 'nao conectado'
                const canSync = Boolean(connection || state?.usingLegacyGlobalConnection)

                return (
                  <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-strong)] p-4" key={profile.id}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium text-[var(--text)]">{profile.name}</p>
                        <p className="mt-1 text-sm text-[var(--muted)]">Status: {statusLabel}</p>
                      </div>
                      <span className="rounded-full bg-[var(--accent-soft)] px-3 py-1 text-xs text-[var(--text)]">
                        {connection?.document_last4 ? `***${connection.document_last4}` : 'sem documento'}
                      </span>
                    </div>
                    <div className="mt-3 grid gap-1 text-sm text-[var(--muted)]">
                      <span>Titular: {connection?.holder_name ?? profile.name}</span>
                      <span>Ultima atualizacao: {state?.lastSuccessAt ?? connection?.last_success_at ?? 'nunca'}</span>
                      <span>
                        Tokens: acesso {connection?.has_access_token ? 'sim' : 'nao'}, refresh{' '}
                        {connection?.has_refresh_token ? 'sim' : 'nao'}, client id {connection?.has_client_id ? 'sim' : 'nao'}
                      </span>
                      {state?.usingLegacyGlobalConnection ? (
                        <span className="text-amber-200">Usando secrets globais legados ate migrar para o perfil.</span>
                      ) : null}
                      {state?.lastError || connection?.last_error ? (
                        <span className="text-red-300">Ultimo erro: {state?.lastError ?? connection?.last_error}</span>
                      ) : null}
                    </div>
                    <div className="mt-4 grid gap-2 sm:grid-cols-2">
                      <Button
                        className="min-w-[8.5rem] whitespace-nowrap rounded-full px-4"
                        disabled={busySection === `sync-profile-${profile.id}` || !canSync}
                        icon={<RefreshCw size={16} />}
                        onClick={() => void syncProfile(profile)}
                        size="sm"
                      >
                        Atualizar dados
                      </Button>
                      {canSync ? (
                        <Button icon={<PlugZap size={16} />} onClick={() => openConnectionModal(profile)} size="sm" variant="secondary">
                          Configurar conexao
                        </Button>
                      ) : (
                        <Button
                          disabled={busySection === `connect-profile-${profile.id}`}
                          icon={<PlugZap size={16} />}
                          onClick={() => void connectProfile(profile)}
                          size="sm"
                          variant="secondary"
                        >
                          Conectar Open Finance
                        </Button>
                      )}
                      {state?.usingLegacyGlobalConnection ? (
                        <Button
                          disabled={busySection === `migrate-profile-${profile.id}`}
                          icon={<PlugZap size={16} />}
                          onClick={() => void migrateLegacyConnection(profile)}
                          size="sm"
                          variant="secondary"
                        >
                          Migrar conexao legada
                        </Button>
                      ) : null}
                      <Button
                        disabled={busySection === `reprocess-profile-${profile.id}`}
                        icon={<WandSparkles size={16} />}
                        onClick={() => void reprocessProfileCategories(profile)}
                        size="sm"
                        variant="secondary"
                      >
                        Reprocessar categorias
                      </Button>
                      <Button
                        disabled={!connection || busySection === `deactivate-connection-${connection?.id}`}
                        icon={<Trash2 size={16} />}
                        onClick={() => connection && void deactivateConnection(connection)}
                        size="sm"
                        variant="ghost"
                      >
                        Desativar conexão
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          </Card>

          <Card className={`p-4 ${settingsPanel === 'data' ? '' : 'hidden'}`}>
            <h3 className="text-lg font-semibold text-[var(--text)]">Dados</h3>
            <p className="mt-2 text-sm text-[var(--muted)]">
              A redefinição do banco não aparece no app para evitar perdas acidentais. As preferências locais podem ser
              redefinidas aqui.
            </p>
            <Button className="mt-4" onClick={resetLocalPreferences} variant="secondary">
              Redefinir preferências locais
            </Button>
          </Card>

          <Card className={`p-4 ${settingsPanel === 'data' ? '' : 'hidden'}`}>
            <h3 className="text-lg font-semibold text-[var(--text)]">App</h3>
            <p className="mt-2 text-sm text-[var(--muted)]">
              React, Vite, TypeScript, Cloudflare Pages Functions e Cloudflare D1 usando serviços gratuitos.
            </p>
            <Button className="mt-4" icon={<LogOut size={16} />} onClick={() => void logout()} variant="secondary">
              Sair
            </Button>
          </Card>
        </div>
      </section>
      ) : null}

      {settingsPanel === 'categories' || settingsPanel === 'rules' ? (
      <section className="grid gap-4">
        <Card className={`p-4 ${settingsPanel === 'categories' ? '' : 'hidden'}`} id="settings-categories">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h3 className="text-lg font-semibold text-[var(--text)]">Categorias</h3>
              <p className="text-sm text-[var(--muted)]">Catálogo visível no perfil atual, com globais preservadas e locais editáveis.</p>
            </div>
            <Button icon={<RefreshCw size={16} />} onClick={() => void refreshConfigData()} variant="ghost">
              Atualizar
            </Button>
          </div>

          <form className="mt-4 grid gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface-strong)] p-4 sm:grid-cols-[1.3fr_0.7fr_auto]" onSubmit={createCategory}>
            <Input
              label="Nome da categoria"
              onChange={(event) => setCategoryForm({ ...categoryForm, name: event.target.value })}
              value={categoryForm.name}
            />
            <Input
              label="Cor"
              onChange={(event) => setCategoryForm({ ...categoryForm, color: event.target.value })}
              type="color"
              value={categoryForm.color}
            />
            <div className="self-end">
              <Button disabled={busySection === 'create-category'} icon={<Plus size={16} />} type="submit">
                Criar
              </Button>
            </div>
          </form>

          <div className="mt-4 grid gap-3">
            {managedCategories.map((category) => {
              const isGlobal = category.profile_id === null
              const draft = editingCategories[category.id] ?? { name: category.name, color: category.color }

              return (
                <div className="rounded-2xl border border-[var(--border)] p-4" key={category.id}>
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className="h-4 w-4 rounded-full border border-black/10" style={{ backgroundColor: draft.color }} />
                      <div>
                        <p className="font-medium text-[var(--text)]">{category.name}</p>
                        <p className="text-xs text-[var(--muted)]">{isGlobal ? 'Global' : 'Personalizada do perfil'}</p>
                      </div>
                    </div>
                    {isGlobal ? (
                      <span className="rounded-full bg-[var(--surface-strong)] px-3 py-1 text-xs text-[var(--muted)]">Base</span>
                    ) : null}
                  </div>
                  <div className="grid gap-3 sm:grid-cols-[1fr_8rem_auto_auto]">
                    <Input
                      disabled={isGlobal}
                      label="Nome"
                      onChange={(event) =>
                        setEditingCategories({
                          ...editingCategories,
                          [category.id]: { ...draft, name: event.target.value },
                        })
                      }
                      value={draft.name}
                    />
                    <Input
                      disabled={isGlobal}
                      label="Cor"
                      onChange={(event) =>
                        setEditingCategories({
                          ...editingCategories,
                          [category.id]: { ...draft, color: event.target.value },
                        })
                      }
                      type="color"
                      value={draft.color}
                    />
                    <div className="self-end">
                      <Button
                        disabled={isGlobal || busySection === `category-${category.id}`}
                        onClick={() => void saveCategory(category)}
                        variant="secondary"
                      >
                        Salvar
                      </Button>
                    </div>
                    <div className="self-end">
                      <Button
                        disabled={isGlobal || busySection === `delete-category-${category.id}`}
                        icon={<Trash2 size={16} />}
                        onClick={() => void removeCategory(category)}
                        variant="ghost"
                      >
                        Excluir
                      </Button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </Card>

        <Card className={`p-4 ${settingsPanel === 'rules' ? '' : 'hidden'}`} id="settings-rules">
          <div>
            <h3 className="text-lg font-semibold text-[var(--text)]">Regras automáticas</h3>
            <p className="text-sm text-[var(--muted)]">Crie atalhos por estabelecimento, descrição ou categoria original para acelerar a classificação.</p>
          </div>

          <form className="mt-4 grid gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface-strong)] p-4" onSubmit={createRule}>
            <div className="grid gap-3 sm:grid-cols-2">
              <Select
                label="Tipo de correspondência"
                onChange={(event) => setRuleForm({ ...ruleForm, match_type: event.target.value as CategoryRuleMatchType })}
                options={categoryMatchTypeOptions}
                value={ruleForm.match_type}
              />
              <Select
                label="Categoria destino"
                onChange={(event) => setRuleForm({ ...ruleForm, category: event.target.value })}
                options={categoryOptions}
                value={ruleForm.category}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-[1fr_8rem]">
              <Input
                label="Padrão"
                onChange={(event) => setRuleForm({ ...ruleForm, pattern: event.target.value })}
                placeholder="Ex.: ifood, uber, booking"
                value={ruleForm.pattern}
              />
              <Input
                label="Prioridade"
                min="0"
                onChange={(event) => setRuleForm({ ...ruleForm, priority: event.target.value })}
                type="number"
                value={ruleForm.priority}
              />
            </div>
            <label className="flex items-center gap-3 text-sm text-[var(--muted)]">
              <input
                checked={ruleForm.is_active}
                className="h-4 w-4 accent-[var(--accent)]"
                onChange={(event) => setRuleForm({ ...ruleForm, is_active: event.target.checked })}
                type="checkbox"
              />
              Ativar regra ao criar
            </label>
            <div className="flex justify-end">
              <Button disabled={busySection === 'create-rule'} icon={<Plus size={16} />} type="submit">
                Criar regra
              </Button>
            </div>
          </form>

          <div className="mt-4 grid gap-3">
            {rules.map((rule) => {
              const draft = editingRules[rule.id] ?? {
                match_type: rule.match_type,
                pattern: rule.pattern,
                category: rule.category,
                priority: String(rule.priority),
                is_active: rule.is_active === 1,
              }

              return (
                <div className="rounded-2xl border border-[var(--border)] p-4" key={rule.id}>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Select
                      label="Tipo"
                      onChange={(event) =>
                        setEditingRules({
                          ...editingRules,
                          [rule.id]: { ...draft, match_type: event.target.value as CategoryRuleMatchType },
                        })
                      }
                      options={categoryMatchTypeOptions}
                      value={draft.match_type}
                    />
                    <Select
                      label="Categoria"
                      onChange={(event) =>
                        setEditingRules({
                          ...editingRules,
                          [rule.id]: { ...draft, category: event.target.value },
                        })
                      }
                      options={categoryOptions}
                      value={draft.category}
                    />
                  </div>
                  <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_8rem]">
                    <Input
                      label="Padrão"
                      onChange={(event) =>
                        setEditingRules({
                          ...editingRules,
                          [rule.id]: { ...draft, pattern: event.target.value },
                        })
                      }
                      value={draft.pattern}
                    />
                    <Input
                      label="Prioridade"
                      min="0"
                      onChange={(event) =>
                        setEditingRules({
                          ...editingRules,
                          [rule.id]: { ...draft, priority: event.target.value },
                        })
                      }
                      type="number"
                      value={draft.priority}
                    />
                  </div>
                  <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <label className="flex items-center gap-3 text-sm text-[var(--muted)]">
                      <input
                        checked={draft.is_active}
                        className="h-4 w-4 accent-[var(--accent)]"
                        onChange={(event) =>
                          setEditingRules({
                            ...editingRules,
                            [rule.id]: { ...draft, is_active: event.target.checked },
                          })
                        }
                        type="checkbox"
                      />
                      Regra ativa
                    </label>
                    <div className="flex gap-2">
                      <Button disabled={busySection === `rule-${rule.id}`} onClick={() => void saveRule(rule)} size="sm" variant="secondary">
                        Salvar
                      </Button>
                      <Button
                        disabled={busySection === `delete-rule-${rule.id}`}
                        icon={<Trash2 size={16} />}
                        onClick={() => void deleteRule(rule)}
                        size="sm"
                        variant="ghost"
                      >
                        Excluir
                      </Button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </Card>
      </section>
      ) : null}

      <Modal
        description="Use este fluxo manual quando o link de consentimento Cumbuca ainda não estiver configurado. Tokens são criptografados e nunca voltam para o navegador."
        onClose={() => setConnectionModalOpen(false)}
        open={connectionModalOpen}
        title="Configurar conexão Open Finance"
      >
        <form className="grid gap-4" onSubmit={saveConnection}>
          <Select
            label="Perfil"
            onChange={(event) => setConnectionForm({ ...connectionForm, profileId: Number(event.target.value) })}
            options={profileOptions}
            value={connectionForm.profileId}
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              label="Nome do titular"
              onChange={(event) => setConnectionForm({ ...connectionForm, holderName: event.target.value })}
              value={connectionForm.holderName}
            />
            <Input
              label="CPF/documento"
              onChange={(event) => setConnectionForm({ ...connectionForm, document: event.target.value })}
              placeholder="não será salvo completo"
              value={connectionForm.document}
            />
          </div>
          <div className="grid gap-3">
            <Input
              label="Access token"
              onChange={(event) => setConnectionForm({ ...connectionForm, accessToken: event.target.value })}
              type="password"
              value={connectionForm.accessToken}
            />
            <Input
              label="Refresh token"
              onChange={(event) => setConnectionForm({ ...connectionForm, refreshToken: event.target.value })}
              type="password"
              value={connectionForm.refreshToken}
            />
            <Input
              label="Client ID"
              onChange={(event) => setConnectionForm({ ...connectionForm, clientId: event.target.value })}
              type="password"
              value={connectionForm.clientId}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              label="Token URL"
              onChange={(event) => setConnectionForm({ ...connectionForm, tokenUrl: event.target.value })}
              placeholder="opcional"
              value={connectionForm.tokenUrl}
            />
            <Input
              label="MCP URL"
              onChange={(event) => setConnectionForm({ ...connectionForm, mcpUrl: event.target.value })}
              placeholder="opcional"
              value={connectionForm.mcpUrl}
            />
            <Input
              label="Expiração"
              onChange={(event) => setConnectionForm({ ...connectionForm, tokenExpiresAt: event.target.value })}
              placeholder="ISO opcional"
              value={connectionForm.tokenExpiresAt}
            />
            <Input
              label="Status do consentimento"
              onChange={(event) => setConnectionForm({ ...connectionForm, consentStatus: event.target.value })}
              value={connectionForm.consentStatus}
            />
          </div>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button onClick={() => setConnectionModalOpen(false)} variant="ghost">
              Cancelar
            </Button>
            <Button disabled={busySection === 'save-connection'} icon={<PlugZap size={16} />} type="submit">
              {busySection === 'save-connection' ? 'Salvando...' : 'Salvar conexão'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
