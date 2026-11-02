// Mock login. Credentials live in config.ts (DEMO_USERS) and are listed in the README.
import { DEMO_USERS, EMPLOYEES, LIVE_EMPLOYEE_ID, type Role } from '../config'
import { state, toast, update } from './state'

const PERMS: Record<string, string[]> = {
  admin: ['view', 'fund', 'pay', 'schedule', 'invite', 'pricing', 'approve', 'team'],
  finance: ['view', 'fund', 'pay', 'schedule', 'invite'],
  approver: ['view', 'approve', 'onboard_approve'],
}
export const can = (action: string) => !!PERMS[state.auth?.role ?? '']?.includes(action)
export function guard(action: string): boolean {
  if (can(action)) return true
  toast(`Your role (${state.auth?.role ?? 'none'}) is not allowed to do this`, 'error', 'company')
  return false
}

const isOrgRole = (r: Role) => r === 'admin' || r === 'finance' || r === 'approver'

function applyIndiePersona() {
  const me = EMPLOYEES.find((e) => e.id === LIVE_EMPLOYEE_ID)!
  const u = DEMO_USERS.find((d) => d.role === 'independent')!
  me.name = u.name
  state.mode = 'indie'
  state.step = 'signup'
  state.withdraw.bank.holder = u.name
}

/** Called once at startup. ?as=<role> signs in directly (used when switching between segments). */
export function initFromUrl() {
  const q = new URLSearchParams(location.search)
  const as = q.get('as') ?? (q.get('view') === 'admin' ? 'admin' : null)
  const u = DEMO_USERS.find((d) => d.role === as)
  if (u?.role === 'independent') applyIndiePersona()
  if (u) state.auth = { email: u.email, name: u.name, role: u.role }
  else if (q.get('preset')) {
    const e = DEMO_USERS.find((d) => d.role === 'employee')!
    state.auth = { email: e.email, name: e.name, role: 'employee' }
  }
}

function switchSegment(u: (typeof DEMO_USERS)[number]) {
  const needsReload = (u.role === 'independent') !== (state.mode === 'indie')
  if (needsReload) {
    location.search = `?as=${u.role}`
    return true
  }
  return false
}

export function login(email: string, password: string): string | null {
  const u = DEMO_USERS.find((d) => d.email.toLowerCase() === email.trim().toLowerCase())
  if (!u || u.password !== password) return 'Incorrect email or password. Use one of the test users listed on this page.'
  return enterAs(u.role)
}

export function enterAs(role: Role | 'checkout'): string | null {
  if (role === 'checkout') { update((s) => { s.checkoutOpen = true }); return null }
  const u = DEMO_USERS.find((d) => d.role === role)!
  if (switchSegment(u)) return null
  const wasCompany = !!state.auth && isOrgRole(state.auth.role)
  update((s) => { s.checkoutOpen = false; s.auth = { email: u.email, name: u.name, role: u.role }; if (isOrgRole(u.role) && !wasCompany) s.companyPage = 'overview'; if (u.role === 'employee' || u.role === 'independent') s.tab = 'home' })
  return null
}

export const logout = () => update((s) => { s.auth = null })
export { isOrgRole }
