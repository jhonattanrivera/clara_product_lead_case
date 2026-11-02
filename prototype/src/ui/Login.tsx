import { useState } from 'react'
import { DEMO_USERS } from '../config'
import { login } from '../core/auth'
import { signUpCompany } from '../core/services'
import { Banner, Button, Field, inputClass } from './Primitives'
import { companyCountries } from './countries'
import { Select } from './Select'
import { Logo } from './brand'

const segColor: Record<string, string> = { Company: 'bg-brand-100 text-brand-700', Employee: 'bg-emerald-100 text-emerald-700', Independent: 'bg-amber-100 text-amber-800', Partner: 'bg-violet-100 text-violet-700' }

function CompanySignup({ onBack }: { onBack: () => void }) {
  const [f, setF] = useState({ name: 'Nova Studio SAS', person: 'Laura Gómez', email: 'laura@novastudio.co', country: 'CO' })
  const [ubos, setUbos] = useState([{ name: 'Laura Gómez', share: 70 }, { name: 'Daniel Pardo', share: 30 }])
  const total = ubos.reduce((a, u) => a + u.share, 0)
  return (
    <div className="fade-up">
      <button onClick={onBack} className="mb-3 text-sm font-bold text-brand-700">Back</button>
      <h2 className="text-2xl font-bold">Create a company account</h2>
      <p className="mt-1 text-sm text-slate-500">You will verify the company (KYB) next. Nothing works until it is approved.</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <Field label="Company name"><input className={inputClass} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
        <Field label="Country"><Select value={f.country} onChange={(v) => setF({ ...f, country: v })} options={companyCountries()} /></Field>
        <Field label="Your name"><input className={inputClass} value={f.person} onChange={(e) => setF({ ...f, person: e.target.value })} /></Field>
        <Field label="Work email"><input className={inputClass} value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>
      </div>
      <div className="mt-4 text-xs font-bold uppercase tracking-wide text-slate-500">Owners (UBOs, 25% or more)</div>
      {ubos.map((u, i) => (
        <div key={i} className="mt-2 flex gap-2">
          <input className={inputClass} value={u.name} onChange={(e) => setUbos(ubos.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
          <input className={`${inputClass} w-24`} type="number" value={u.share} onChange={(e) => setUbos(ubos.map((x, j) => (j === i ? { ...x, share: Number(e.target.value) } : x)))} />
        </div>
      ))}
      {total !== 100 && <div className="mt-2"><Banner tone="warn">Ownership adds up to {total}%. It should be 100%.</Banner></div>}
      <div className="mt-5"><Button disabled={!f.name || !f.email || total !== 100} onClick={() => signUpCompany({ ...f, ubos })}>Create account</Button></div>
    </div>
  )
}

export function Login() {
  const [email, setEmail] = useState('admin@acme.co')
  const [pw, setPw] = useState('clara1234')
  const [err, setErr] = useState('')
  const [signup, setSignup] = useState(false)
  return (
    <div className="fade-up mx-auto grid min-h-[calc(100vh-3rem)] max-w-5xl overflow-hidden rounded-2xl bg-white shadow-xl md:grid-cols-[1fr_1.1fr]">
      <div className="hero-clara relative flex flex-col justify-between p-8 text-white">
        <Logo className="h-7 w-fit" />
        <div className="my-10">
          <div className="text-xs font-bold uppercase tracking-[.2em] text-lime">Clara Dollar</div>
          <h1 className="mt-3 text-4xl font-bold leading-[1.05]">Pay anyone in dollars. Let them spend it like cash.</h1>
          <p className="mt-4 max-w-sm text-sm text-sky-100">Company module, employee app in digital dollars, independent accounts and a partner API. Numbers are illustrative.</p>
        </div>
        <div className="text-xs text-sky-200">Clara Dollar</div>
      </div>
      <div className="p-8">
        {signup ? <CompanySignup onBack={() => setSignup(false)} /> : (
          <>
            <h2 className="text-2xl font-bold">Sign in</h2>
            <form className="mt-4 space-y-3" onSubmit={(e) => { e.preventDefault(); setErr(login(email, pw) ?? '') }}>
              <Field label="Email"><input className={inputClass} value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
              <Field label="Password"><input className={inputClass} type="password" value={pw} onChange={(e) => setPw(e.target.value)} /></Field>
              {err && <Banner tone="error">{err}</Banner>}
              <Button type="submit">Sign in</Button>
            </form>
            <button onClick={() => setSignup(true)} className="mt-3 w-full press rounded-[10px] border border-[#d0d5dd] py-3 text-sm font-bold hover:bg-slate-50">Create a company account (KYB)</button>
            <div className="mt-6 text-xs font-bold uppercase tracking-wide text-slate-500">Test users (click to fill). Password for all: <span className="normal-case">clara1234</span></div>
            <div className="mt-2 divide-y divide-slate-100 rounded-2xl border border-slate-200">
              {DEMO_USERS.map((u) => (
                <button key={u.email} onClick={() => { setEmail(u.email); setPw(u.password); setErr('') }} className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-slate-50">
                  <span className={`w-24 shrink-0 rounded-full px-2 py-0.5 text-center text-[11px] font-bold ${segColor[u.segment]}`}>{u.segment}</span>
                  <span className="min-w-0 flex-1"><span className="block truncate text-sm font-bold">{u.email}</span><span className="block text-xs text-slate-500">{u.blurb}</span></span>
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
