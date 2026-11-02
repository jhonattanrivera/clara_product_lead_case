// Text of the mobile app (employee and independent), in the language of the people who use it.
// In this app we say "dólares digitales". The words for the underlying rails stay out of it.
import { APP_NAME, COMPANY } from './config'

export const DISCLAIMER = 'Los dólares digitales son activos virtuales respaldados 1:1, no moneda fiduciaria.'

export const COPY = {
  invite: {
    emailSubject: `${COMPANY.name} creó una cuenta en dólares digitales para ti`,
    emailBody: `${COMPANY.name} te enviará pagos de contratista, reembolsos y beneficios a tu propia cuenta. Recibes una tarjeta y puedes retirar a tu banco local. Sin abrir una cuenta en el exterior.`,
    cta: 'Aceptar invitación',
    deepLinkHint: 'Abierto desde un enlace en un mensaje',
  },
  consent: {
    title: 'Antes de empezar',
    intro: `${COMPANY.name} te invitó a recibir pagos en dólares digitales con ${APP_NAME}.`,
    introIndie: 'Dos confirmaciones rápidas antes de verificar tu identidad.',
    laborNote: 'Tu salario regular sigue en moneda local donde la ley lo exige. Los dólares digitales cubren pagos de contratista, reembolsos, beneficios y bonos. Salario, solo donde esté permitido y si tú lo eliges.',
    rateNote: 'Al convertir verás siempre la tasa real del mercado y el spread antes de confirmar.',
    terms: 'Acepto los Términos y la Política de privacidad',
    kyc: 'Acepto la verificación de identidad y los controles contra el lavado de activos',
    optIn: `Elijo recibir pagos de ${COMPANY.name} en dólares digitales`,
    cta: 'Aceptar y continuar',
  },
  kyc: {
    title: 'Verifica tu identidad',
    intro: 'La regulación nos exige verificar a todas las personas. Tus documentos van directo a nuestro proveedor de identidad. Solo conservamos lo que la regulación pide.',
    unreadableTitle: 'No pudimos leer tu documento',
    unreadableBody: 'La foto salió borrosa o con reflejos. Ponlo sobre una superficie plana y bien iluminada y tómala de nuevo. Tu selfie y tu avance siguen guardados.',
    reviewTitle: 'Revisión manual en curso',
    reviewBody: 'Una persona debe revisar algunos datos. Suele tomar hasta un día hábil. Te avisaremos y abriremos tu cuenta apenas se apruebe.',
    rejectedTitle: 'No pudimos verificar tu identidad',
    rejectedBody: `No podemos abrir tu cuenta con esta información, así que ningún dinero llegó a ella. Si ${COMPANY.name} te envió un pago, sigue en ${COMPANY.name}. Escríbeles para acordar otra forma de pago.`,
    steps: ['Leyendo tu documento', 'Comparando tu selfie', 'Consultando listas de control'],
  },
  account: {
    title: 'Tu cuenta y tu tarjeta están listas',
    body: 'Los pagos entran primero como Pendientes mientras terminamos las revisiones y luego pasan a Disponibles. Solo lo Disponible se puede gastar o retirar.',
  },
  dollars: {
    title: '¿Qué son los dólares digitales?',
    body: 'Son dólares en formato digital que se mueven en minutos. Tú solo ves un saldo y una tarjeta: no necesitas instalar nada ni administrar llaves.',
    notBank: `${APP_NAME} no es un banco y tu saldo no es un depósito bancario.`,
  },
  pendingExplainer: 'El saldo pendiente aún no se puede gastar ni retirar. Normalmente queda disponible en minutos.',
  holdExplainer: 'Este pago está en revisión. No tienes que hacer nada. Te avisaremos cuando se libere.',
  owedExplainer: 'Un comercio cobró más de lo autorizado y tu saldo no alcanzó. Lo descontaremos de tu próximo pago.',
  payTypes: { 'Contractor payment': 'Pago de contratista', Reimbursement: 'Reembolso', Benefit: 'Beneficio', Bonus: 'Bono', Salary: 'Salario' } as Record<string, string>,
  card: {
    lockedByCompany: `Tu empresa bloqueó esta tarjeta. Escríbele a ${COMPANY.name} para reactivarla.`,
    canceled: 'Tarjeta cancelada. Puedes pedir una nueva.',
    replaced: 'Tu nueva tarjeta virtual está lista',
    needsInfoTitle: 'Nuestro aliado de tarjetas necesita un dato más',
    needsInfoBody: 'Tu identidad está aprobada. Para emitir la tarjeta falta confirmar tu dirección.',
    deniedTitle: 'No pudimos emitir tu tarjeta',
    deniedBody: 'Tu cuenta sigue activa: puedes recibir pagos y retirar a tu banco. Nuestro equipo te escribirá si algo cambia.',
  },
  declines: {
    insufficient_funds: 'No tienes saldo disponible suficiente. Prueba con un monto menor o espera tu próximo pago.',
    funds_pending: 'Tu dinero sigue pendiente, así que aún no se puede gastar. Inténtalo cuando aparezca como Disponible.',
    funds_on_hold: 'Este dinero está en revisión y aún no se puede gastar. Te avisaremos cuando se libere.',
    mcc_blocked: 'Tu tarjeta no permite esta categoría de comercio.',
    card_frozen: 'Tu tarjeta está bloqueada. Desbloquéala para pagar.',
    card_canceled: 'Esta tarjeta está cancelada. Pide una nueva en la pestaña Tarjeta.',
    limit_per_payment: 'Este pago supera tu límite por compra. Puedes cambiarlo en la pestaña Tarjeta.',
    limit_daily: 'Llegaste a tu límite diario. Se reinicia mañana, o puedes subirlo en la pestaña Tarjeta.',
    country_blocked: 'Tu tarjeta no permite pagos en este país.',
    international_off: 'Tienes apagados los pagos internacionales. Actívalos en la pestaña Tarjeta.',
    online_off: 'Tienes apagados los pagos en línea. Actívalos en la pestaña Tarjeta.',
    cvv_3ds_failed: 'El comercio no pudo validar el código de seguridad. Revísalo e inténtalo de nuevo.',
    fraud_suspected: 'Detuvimos este pago por seguridad. Si fuiste tú, escríbenos a soporte.',
    timeout_declined: 'No alcanzamos a confirmar este pago a tiempo. Inténtalo de nuevo.',
    unknown: 'La compra fue rechazada. Inténtalo de nuevo o escríbenos a soporte.',
  } as Record<string, string>,
  withdraw: {
    quoteExpired: 'Esta cotización venció. Las tasas se mueven, por eso nunca cobramos con una tasa vieja. Pide una nueva.',
    bankRejected: 'Tu banco rechazó los datos de la cuenta. Tu dinero volvió a tu saldo disponible. Revisa los datos y pide una nueva cotización.',
    balanceChanged: 'Tu saldo disponible cambió después de cotizar. Pide una nueva cotización.',
  },
}
