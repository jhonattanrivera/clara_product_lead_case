// Independent user: three ways to add money. Local currency and a US payment are the main ones;
// sending digital dollars from another wallet is there for people who already have them.
import { useState } from 'react'
import { useBus } from '../bus'
import { CURRENCIES, LIVE_EMPLOYEE_ID } from '../config'
import { ledger } from '../core/ledger'
import { DIGITAL_NETWORKS, depositDigital, quoteTopUp, receiveFromUs, topUpLocal } from '../core/services'
import { state } from '../core/state'
import { flags } from '../mocks/demoControls'
import { local, parseAmount, usd } from '../format'
import { Banner, Button, DigitalNote, Field, Screen, inputClass } from '../ui/Primitives'
import { Icon } from '../ui/Icon'

const METHODS = [
  { id: 'local', label: 'Moneda local', icon: 'bank' },
  { id: 'us', label: 'Desde EE. UU.', icon: 'globe' },
  { id: 'digital', label: 'Otra billetera', icon: 'send' },
] as const

const digits = (seed: string, n: number) => {
  let h = 7
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return Array.from({ length: n }, (_, i) => String((h >>> (i % 24)) % 10 ^ (i % 7) % 10).slice(-1)).join('')
}
const hexAddress = (seed: string) => {
  let h = 11
  for (const ch of seed) h = (h * 33 + ch.charCodeAt(0)) >>> 0
  return '0x' + Array.from({ length: 40 }, (_, i) => ((h * (i + 3) + i * 40503) >>> 0).toString(16).slice(-1)).join('')
}

function CopyRow({ k, v }: { k: string; v: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <div className="flex items-center justify-between gap-2 py-1.5">
      <div className="min-w-0"><dt className="text-xs text-slate-500">{k}</dt><dd className="break-all font-semibold">{v}</dd></div>
      <button aria-label={`Copiar ${k}`} onClick={() => { void navigator.clipboard?.writeText(v); setCopied(true); setTimeout(() => setCopied(false), 1200) }} className="press grid size-8 shrink-0 place-items-center rounded-lg text-slate-500 hover:bg-slate-100"><Icon name={copied ? 'check' : 'copy'} className="size-4" /></button>
    </div>
  )
}

function LocalTopUp() {
  const currency = state.withdraw.currency
  const [amount, setAmount] = useState(String(Math.round(150 * { PEN: 3.5, CLP: 930, ARS: 1400 }[currency])))
  const [busy, setBusy] = useState(false)
  const cents = parseAmount(amount)
  const q = quoteTopUp(cents ?? 0)
  const send = async () => { if (!cents) return; setBusy(true); await topUpLocal(cents); setBusy(false) }
  return (
    <>
      <Field label={`Monto a recargar (${currency})`}><input className={inputClass} inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} /></Field>
      <dl className="space-y-1.5 rounded-xl bg-slate-50 p-3.5 text-sm">
        <div className="flex justify-between gap-3"><dt className="text-slate-500">Tasa real del mercado</dt><dd className="font-medium">1 USD = {q.mid.toLocaleString('en-US', { maximumFractionDigits: 2 })} {currency}</dd></div>
        <div className="flex justify-between gap-3"><dt className="text-slate-500">Spread ({(q.spreadPct * 100).toFixed(2)}%)</dt><dd className="font-medium">{usd(q.spreadUsd)}</dd></div>
        <div className="my-1 border-t border-slate-200" />
        <div className="flex justify-between gap-3"><dt className="text-slate-500">Recibes aprox.</dt><dd className="text-lg font-bold">{usd(q.usdNet)}</dd></div>
      </dl>
      <div className="rounded-xl border border-slate-200 p-3.5 text-sm">
        <div className="mb-1 text-xs font-bold uppercase tracking-wide text-slate-500">Transfiere desde tu banco a</div>
        <dl className="divide-y divide-slate-100">
          <CopyRow k="Beneficiario" v="Clara Dollar, recaudo" />
          <CopyRow k={CURRENCIES[currency].accountLabel} v={digits('recaudo' + currency, currency === 'PEN' ? 20 : currency === 'ARS' ? 22 : 12)} />
          <CopyRow k="Referencia" v={state.accountId || 'USD-00000000'} />
        </dl>
      </div>
      <p className="text-xs text-slate-500">La tasa se fija cuando llega tu dinero, por eso el monto es aproximado.</p>
      <Button variant="dark" busy={busy} disabled={!cents} onClick={() => void send()}>Ya hice la transferencia de {cents ? local(cents / 100, currency) : '…'}</Button>
    </>
  )
}

function UsAccount() {
  const [amount, setAmount] = useState('500')
  const [sender, setSender] = useState('Cliente en EE. UU.')
  const [busy, setBusy] = useState(false)
  const cents = parseAmount(amount)
  const send = async () => { if (!cents) return; setBusy(true); await receiveFromUs(cents, sender.trim() || 'Cliente en EE. UU.'); setBusy(false) }
  return (
    <>
      <div className="rounded-xl border border-slate-200 p-3.5 text-sm">
        <div className="mb-1 flex items-center justify-between text-xs font-bold uppercase tracking-wide text-slate-500">Tus datos para cobrar</div>
        <dl className="divide-y divide-slate-100">
          <CopyRow k="Titular" v={state.withdraw.bank.holder} />
          <CopyRow k="Banco" v="Banco aliado en EE. UU." />
          <CopyRow k="Routing (ACH)" v="000000000" />
          <CopyRow k="Número de cuenta" v={`9001${digits(state.accountId || 'cuenta', 8)}`} />
          <CopyRow k="Tipo de cuenta" v="Checking" />
        </dl>
      </div>
      <p className="text-xs text-slate-500">Tus clientes te pagan por ACH o wire, como a una cuenta en EE. UU. a tu nombre. Lo recibes como dólares digitales.</p>
      <div className="grid grid-cols-[1fr_6.5rem] gap-2">
        <Field label="Quién te paga"><input className={inputClass} value={sender} onChange={(e) => setSender(e.target.value)} /></Field>
        <Field label="USD"><input className={inputClass} inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} /></Field>
      </div>
      <Button variant="dark" busy={busy} disabled={!cents} onClick={() => void send()}>Ya recibí el pago de {cents ? usd(cents) : '…'}</Button>
    </>
  )
}

function DigitalDeposit() {
  const [network, setNetwork] = useState<string>(DIGITAL_NETWORKS[0])
  const [amount, setAmount] = useState('150')
  const [busy, setBusy] = useState(false)
  const cents = parseAmount(amount)
  const send = async () => { if (!cents) return; setBusy(true); await depositDigital(network, cents); setBusy(false) }
  return (
    <>
      <p className="text-sm text-slate-600">Úsalo solo si ya tienes dólares digitales en otra billetera.</p>
      <div className="flex gap-2">
        {DIGITAL_NETWORKS.map((n) => <button key={n} onClick={() => setNetwork(n)} className={`press flex-1 rounded-[10px] border py-2.5 text-sm font-bold ${network === n ? 'border-ink bg-ink text-white' : 'border-slate-200'}`}>{n}</button>)}
      </div>
      <div className="rounded-xl border border-slate-200 p-3.5 text-sm">
        <dl><CopyRow k={`Tu dirección en la red ${network}`} v={hexAddress(network + state.accountId)} /></dl>
        <p className="mt-1 text-xs text-amber-700">Envía únicamente por la red {network}. Si usas otra red, tu dinero no se acredita y recuperarlo puede tener costo.</p>
      </div>
      <Field label="Monto del envío (USD)"><input className={inputClass} inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} /></Field>
      <Button variant="dark" busy={busy} disabled={!cents} onClick={() => void send()}>Ya hice el envío de {cents ? usd(cents) : '…'}</Button>
    </>
  )
}

export function AddMoney() {
  useBus()
  const [method, setMethod] = useState<(typeof METHODS)[number]['id']>('local')
  const b = ledger.employee(LIVE_EMPLOYEE_ID)
  return (
    <Screen title="Recargar" subtitle="Lo que recargas entra como Pendiente hasta confirmarse y luego queda Disponible.">
      <div className="grid grid-cols-3 gap-2">
        {METHODS.map((m) => (
          <button key={m.id} onClick={() => setMethod(m.id)} className={`press flex flex-col items-center gap-1 rounded-xl border px-1 py-2.5 text-xs font-bold ${method === m.id ? 'border-ink bg-ink text-white' : 'border-slate-200'}`}><Icon name={m.icon} className="size-5" />{m.label}</button>
        ))}
      </div>
      <div key={method} className="page-in space-y-4">
        {method === 'local' && <LocalTopUp />}
        {method === 'us' && <UsAccount />}
        {method === 'digital' && <DigitalDeposit />}
      </div>
      {flags.custodyDown && <Banner tone="warn" title="Falla de un aliado">Nuestro aliado de custodia no responde. Detectamos tu recarga y la acreditamos cuando vuelva.</Banner>}
      {b.pending > 0 && <Banner tone="warn" title={`${usd(b.pending)} por confirmar`}>Aún no se puede gastar. Suele tomar unos minutos.</Banner>}
      <DigitalNote />
    </Screen>
  )
}
