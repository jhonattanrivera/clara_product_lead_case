# Clara Dollar: prototipo del caso (v2)

Prototipo interactivo de una cuenta en dólares y tarjeta virtual para empresas, empleados, independientes y partners. Todos los proveedores (KYC/KYB, custodio, emisor, banco, FX) son **mocks fáciles de editar**. La única parte real es una transferencia opcional de USDC en una testnet, con enlace al explorador.

## Cómo correrlo

```bash
npm install && npm run dev
```

Abre http://localhost:5173. No hay Docker ni otros servicios. `npm run build` valida tipos y compila.

## Usuarios de demo

Contraseña de todos: `clara1234`. La pantalla de login los lista y los rellena con un clic. En la cabecera, "View as" cambia de rol sin volver a escribir credenciales.

| Correo | Rol | Qué muestra |
|---|---|---|
| admin@acme.co | Empresa, admin (Valentina Ortiz) | Fondea, paga, configura el spread de FX, aprueba, ve ingresos |
| finance@acme.co | Empresa, finanzas (Andrés Mejía) | Fondea y paga. No cambia precios ni aprueba retenciones |
| approver@acme.co | Empresa, aprobador (Paula Reyes) | Solo aprueba o rechaza lo que está en revisión |
| camila@acme.co | Empleada (Camila Torres) | Invitación, activación, KYC, saldo pendiente y disponible, tarjeta |
| mateo@mail.com | Independiente (Mateo Vargas) | Se registra solo, deposita su propio dinero, tarjeta |
| dev@payrollco.com | Partner por API (PayrollCo) | Llaves de API (mock), sandbox, webhooks, rev share |

Flujos clave:

- **Empresa nueva:** en el login, "Create a company account (KYB)" lleva al registro, KYB, representantes e invitaciones (por correo o CSV).
- **Pagos programados:** Payments, asignar saldo por persona y programarlo por fecha, con repetición mensual opcional. "Advance the demo clock" lo ejecuta.
- **Spread de FX:** Pricing and FX. Rango 0,5% a 3%, por defecto 1%. El 0,5% inferior es el piso de la plataforma y el resto es la ganancia de la empresa, que la persona ve al cotizar.
- **Independiente:** en Recargar, moneda local con tasa real y spread, datos de cuenta propios en EE. UU. (simulados) y envío desde otra billetera.
- **Ingresos:** Revenue, por fuente (comisión por pago, FX, interchange, retiros) y la parte de la empresa.

## Idioma y lenguaje

La app móvil (empleado e independiente) está en español y dice **dólares digitales**, con la nota "Los dólares digitales son activos virtuales respaldados 1:1, no moneda fiduciaria". No dice cripto ni USDC. Al convertir muestra la **tasa real del mercado** y el **spread explícito**. El módulo de empresa y el panel de demo siguen en inglés. Textos en `src/copy.ts`.

## Cómo simular cada caso

Panel derecho de la demo, pestañas **Failures**, **Card events**, **Core** y **Journal**. Cada falla se dispara una vez y se apaga sola. El botón "Hide demo panel" lo oculta.

| Caso | Dónde |
|---|---|
| KYC ilegible (reintentable), revisión manual o rechazo final | Failures, sección Identity |
| El emisor pide un dato más o niega la tarjeta, con KYC aprobado | Failures, "Issuer asks..." o "Issuer denies..." |
| KYB de la empresa en revisión o rechazado | Failures, "Company KYB". Se resuelve en Company o Compliance |
| Pago en revisión | Failures, "Next payment goes into review". Se decide en Compliance |
| Saldo pendiente | Failures, "Keep balance pending". "Release pending funds now" lo libera |
| Depósito en red equivocada | Failures, "Next deposit on the wrong network". Queda en Exceptions |
| Caída del custodio | Failures, "Custodian outage". Los depósitos quedan en cola y se acreditan al restaurar |
| Conciliación con diferencia | Failures, "Custodian statement differs", luego Treasury |
| Evento duplicado, con firma inválida o que sigue fallando | Failures, "Provider events". Los fallidos se reencolan en Compliance |
| Cotización vencida o banco que rechaza | Failures, sección Card and withdrawals, luego Retirar |
| Tarjeta declinada | Failures, "Next card payment is declined for". También por saldo pendiente, bloqueo, límites, país o controles |
| Timeout de autorización (stand-in) | Failures, "Authorization timeout". El emisor aprueba solo hasta $25 |
| Pre-autorización, aumento, reverso parcial o total, vencimiento, clearing, reembolso | Card events |
| Clearing sin autorización; evento tardío, temprano o de tipo desconocido | Card events, "Edge cases" |
| Liquidación y conciliación diarias | Card events |
| Máquinas de estado, retenciones y transiciones en vivo | Core |
| Historial precargado | Failures, "Load a month of history" |

Atajos por URL: `?as=<rol>` (`admin`, `finance`, `approver`, `employee`, `independent`, `partner`), `?preset=active` (cuenta ya activa con pagos; `&payments=0` los omite), `?tab=card|home|activity|add|move` y `?page=overview|people|payments|compliance|pricing|revenue|treasury|company`.

## Tarjeta virtual

Giro con animación, ver u ocultar número y CVV (se ocultan solos a los 15 s), límites por compra y por día, controles de pagos internacionales y en línea, bloquear y desbloquear (el titular no desbloquea lo que bloqueó la empresa), cancelar y reponer, y agregar a Apple Wallet o Google Wallet con animación (mock). Las autorizaciones pasan por un ledger de doble entrada y el emisor (mock) llama en tiempo real, estilo JIT.

## Testnet real (opcional)

Red: **Arc Testnet** (USDC es el token de gas, así que un solo faucet da todo). Sin fondos, la app corre en modo mock y lo indica en la interfaz.

```bash
npm run chain:wallet     # genera una wallet local en .env (nunca se sube a git)
npm run chain:balance    # muestra la dirección y el saldo
```

1. Copia la dirección que imprime `chain:wallet`.
2. Pide USDC de prueba en https://faucet.circle.com (red Arc Testnet, 20 USDC). Requiere captcha, por eso es un paso manual.
3. Reinicia `npm run dev`. El fondeo de la empresa y la liquidación diaria ahora envían una transferencia real. El enlace al explorador aparece en la página Treasury de la empresa.

Los montos en cadena son simbólicos (escala en `CHAIN.scale`, entre 0,01 y 1 USDC por transferencia). La clave privada solo la lee el servidor de Vite, nunca el navegador. Para cambiar de red, edita `CHAIN_RPC_URL` y `CHAIN_USDC` en `.env` (ver `.env.example`).

## Dónde cambiar cosas

| Qué | Dónde |
|---|---|
| Nombre, comisión, spread, tiempos, interchange, corredores, matriz laboral, usuarios | `src/config.ts` |
| Textos | `src/copy.ts` |
| Proveedores simulados (KYC, banco, emisor, custodio) | `src/mocks/*` |
| Casos de falla | `src/mocks/demoControls.ts` y `src/ui/DemoControls.tsx` |
| Ledger, reglas de negocio, roles | `src/core/*` (`ledger.ts`, `services.ts`, `auth.ts`, `pricing.ts`) |
| Máquinas de estado | `src/core/machines.ts` |
| Eventos de proveedores | `src/core/events.ts` |
| Códigos de rechazo | `src/core/declines.ts` |
| Módulo empresa | `src/company/*` |
| App móvil (empleado e independiente) | `src/screens/*` y `src/ui/*` |

## Supuestos

- Nombre de trabajo "Clara Dollar", 0,75% por pago, spread de 1% y partners con 30% de rev share. Todas las cifras son ilustrativas, no precios reales ni datos de mercado.
- La matriz de pagos por país es una hipótesis de demo, no asesoría legal. El salario queda bloqueado en los tres corredores hasta validarlo con abogados locales.
- Los datos de cuenta en EE. UU., la recarga local y "respaldados 1:1" son del producto simulado. En producción exigen banco aliado, reservas verificables y revisión legal.
- El logo y la marca de Clara son solo para esta demo privada. No publiques el repositorio.
