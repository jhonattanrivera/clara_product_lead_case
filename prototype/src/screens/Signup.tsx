// Independent user: signs up alone, with no employer.
import { useState } from 'react'
import { useBus } from '../bus'
import { signUpIndependent } from '../core/services'
import { Banner, Button, DigitalNote, Field, Screen, inputClass } from '../ui/Primitives'
import { payeeCountries } from '../ui/countries'
import { Select } from '../ui/Select'
import { Logo } from '../ui/brand'

export function Signup() {
  useBus()
  const [email, setEmail] = useState('mateo@mail.com')
  const [pw, setPw] = useState('clara1234')
  const [country, setCountry] = useState('PE')
  const [err, setErr] = useState('')
  return (
    <Screen footer={<Button onClick={() => setErr(signUpIndependent(email, pw, country) ?? '')}>Crear mi cuenta</Button>}>
      <div className="hero-clara -mx-5 -mt-3 px-5 pb-8 pt-8 text-white">
        <Logo className="h-6" />
        <h1 className="mt-6 text-[28px] font-bold leading-tight">Una cuenta en dólares digitales y una tarjeta, para ti</h1>
        <p className="mt-2 text-sm text-sky-100">Cobra a clientes en EE. UU., paga con tu tarjeta virtual y retira a tu banco local.</p>
      </div>
      <Field label="Correo"><input className={inputClass} value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
      <Field label="Contraseña"><input className={inputClass} type="password" value={pw} onChange={(e) => setPw(e.target.value)} /></Field>
      <Field label="País">
        <Select value={country} onChange={setCountry} options={payeeCountries('es')} />
      </Field>
      {err && <Banner tone="error">{err}</Banner>}
      <p className="text-xs text-slate-500">No necesitas empleador. Primero verificas tu identidad y luego recargas en moneda local o recibes un pago desde EE. UU.</p>
      <DigitalNote />
    </Screen>
  )
}
