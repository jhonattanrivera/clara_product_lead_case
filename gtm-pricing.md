# GTM y pricing: cuenta en dólares y tarjeta para empleados (LATAM)

**Regla de este documento:** todo número es un **supuesto [S]** para discutir, no un dato de mercado ni de Clara. Lo que viene de una fuente pública se marca **[F]** y va al final. Lo regulatorio se valida con legal antes de decidir.

## Tesis
La empresa paga una sola vez. La persona recibe dólares en minutos, con tarjeta, sin ver cripto. Entramos por donde duele más: gente en países donde el cliente, y Clara, no tienen operación local.

## Relación con lo que Clara ya tiene
- **Clara Global [F]:** gestión de gastos con USDC como infraestructura de liquidación. La empresa fondea en moneda local y la plataforma convierte y liquida. Es una sola fuente secundaria: confirmarla.
- **Bitso Business [F]:** tarjetas corporativas con stablecoins como colateral, con foco inicial en México.
- **Supuesto de trabajo [S]:** reutilizamos liquidación, tesorería y emisión.
- **Lo nuevo:** allá el dinero es de la empresa; aquí es de la persona. Eso añade KYC individual, retiros a bancos locales, reglas laborales y soporte a usuarios finales.

## Decisiones que tomo

| Decisión | Elijo | Por qué |
|---|---|---|
| Primer caso de uso | Pagos a contratistas | Ingreso recurrente que crea hábito de tarjeta. Sin entidad local, muchas de estas personas serán contratistas o estarán vía EOR [S], y eso evita buena parte del problema salarial |
| Segundo caso de uso | Reembolsos | Encajan con el producto de gastos de Clara [S] y normalmente no son salario [S] |
| Fuera de los 90 días | Salario en dólares, ahorro de empleados dentro de LATAM, usuario suelto | El caso pide que el ahorro no sea el punto de partida. El salario depende de cada país |
| Origen del piloto | Clientes que ya tienen USD y fondean en USD | Evita, de entrada, tratar la conversión en origen como operación cambiaria. Hipótesis para legal |
| Destino del piloto | Perú como hipótesis de trabajo | Es el corredor del demo. Cambia si la base de clientes muestra más personas en otro país o si el programa de tarjeta no lo cubre |
| Precio a la empresa | Fee por payout | Simple y no pide presupuesto anual. Se descarta SaaS en el piloto |
| Precio a partners | Rev share con mínimo mensual | Un fee fijo por cuenta puede quedar por debajo del costo (ver economía unitaria) |

**Por qué no BR ni MX como origen del primer piloto [F]:**
- **Brasil:** la Resolución BCB 521 trata estas operaciones como cambiarias. La 561, desde octubre de 2026, impide a los proveedores eFX usar stablecoins o cripto para liquidar con contrapartes en el exterior.
- **México:** la Circular 4/2019 limita a bancos y fintech autorizadas a operaciones internas con activos virtuales, sin ofrecerlos directamente a clientes.
- **Colombia:** no encontré una regla específica sobre pagos al exterior con stablecoins, y hay un proyecto de ley sin aprobar. Eso no equivale a estar permitido.

## Segmento 1: empresas clientes
**Quién:** clientes actuales en MX, BR y CO con contratistas o equipos en otros países.

**Cómo llegar:**
- Identificar candidatos con cuentas de clientes y encuesta de customer success: quién paga a personas fuera de MX, BR y CO. Clara puede no ver esos pagos en sus datos [S].
- Piloto con 2 o 3 clientes y 20 a 50 personas cada uno [S], con un champion en finanzas o people ops.
- Mensaje: "un solo pago, entrega en minutos, cero mensajes de dónde está mi pago".

**Quién paga:** la empresa, 0,75% por payout con mínimo de USD 1 [S], visible antes de enviar. El costo del on-ramp se traslada aparte.

**Qué se compara:** cuánto le cuesta hoy cada pago, cuánto tarda y cuántos tickets genera. **Hoy no tengo ese dato: se mide con cada cliente al arrancar el piloto.**

## Segmento 2: empleados y usuarios sueltos
**Quién:** quien recibe el dinero. El usuario suelto no entra en los 90 días; la primera excepción son las personas que dejan a su empleador y conservan la cuenta.

**Cómo llegar:** invitación del empleador, casi sin costo de adquisición. Después, referidos.

**Por qué no abrir aún al usuario suelto:** el caso exige KYC para todos, y una cuenta gratis sin fondeo del empleador cuesta KYC y tarjeta sin generar ingreso. Cuando se abra, fondea recargando en moneda local o recibiendo pagos desde EE. UU. con datos de cuenta propios. El prototipo lo simula; en producción requiere banco aliado y control del origen de los fondos.

**Cómo le hablamos:** "dólares digitales", con la nota "Los dólares digitales son activos virtuales respaldados 1:1, no moneda fiduciaria". Legal debe validar el texto y el respaldo en cada país.

**Quién paga:**
- **Gratis:** cuenta, tarjeta virtual y recibir dólares.
- **Spread FX:** 1% [S], explícito sobre la tasa real del mercado antes de confirmar, en retiros y en compras en moneda local. La empresa puede configurarlo entre 0,5% y 3%: la plataforma conserva un piso de 0,5% y el resto es markup de la empresa, que la persona ve.
- **Retiro:** uno gratis por pago recibido, luego USD 1,50 [S].
- **Comercio:** paga el interchange. La parte neta para el programa está por validar con el emisor.

**Principio:** si la persona siente que le cobran de más, se cae el segmento 1. Y si un pago fuera salario, habría que validar si puede pagar por acceder a su dinero. Por eso el retiro gratis va por pago recibido y la empresa puede patrocinar el costo [S].

## Segmento 3: partners
**Quién:** primero plataformas de HR y beneficios sin rieles de dinero propios. Los proveedores de nómina y EOR pueden ser partner o rival: Deel ya tiene wallet [F] y Ontop lanzó cuentas en USD [F].

**Cómo llegar:** API con sandbox y documentación, 1 o 2 partners medianos con un caso concreto y co-marketing. Mi experiencia integrando pagos pesa aquí. **Se trabaja después de probar el producto con clientes propios.**

**Quién paga:** el partner no paga por adelantado. Recibe 30% [S] de fee, spread e interchange de sus usuarios, con un mínimo mensual que cubra los costos fijos del programa.

**Condiciones:** primer nivel de soporte a cargo del partner, nuestro KYC obligatorio y límites acordados por programa.

## Economía unitaria (ejemplo, no pronóstico)
Por persona activa al mes, con 60% retirado y 40% gastado con tarjeta en comercios locales, spread de 1% (piso de plataforma 0,5%, markup de empresa 0,5%). **Tasas del prototipo; interchange neto y costos son placeholders [S] por validar con partners.**

| Concepto | Recibe USD 1.200 | Recibe USD 300 |
|---|---:|---:|
| Fee a la empresa (0,75%, mínimo USD 1) | 9,00 | 2,25 |
| Spread, piso de plataforma (0,5%) | 6,00 | 1,50 |
| Interchange neto (1% del 40%) | 4,80 | 1,20 |
| **Ingreso bruto de la plataforma** | **19,80** | **4,95** |
| Off-ramp (0,5% de lo retirado) | -3,60 | -0,90 |
| Transferencia local | -0,50 | -0,50 |
| Processor por tarjeta activa | -1,50 | -1,50 |
| Soporte y cumplimiento | -1,20 | -1,20 |
| **Margen antes de KYC, fraude y cashback** | **13,00** | **0,85** |
| Markup de la empresa, aparte (0,5%) | 6,00 | 1,50 |

**Lectura:**
- La persona paga 12,00 de spread con USD 1.200: la mitad es markup de su empresa. Decir "gratis para el empleado" sin esta aclaración sería engañoso.
- El costo total visible es de 21,00 sobre USD 1.200 (1,75%). Es el número a comparar con lo que cuesta hoy.
- Con montos bajos casi no queda margen, así que hace falta un monto mínimo o más retención de saldo.
- Un fee fijo de USD 0,5 a 1 por cuenta quedaría por debajo del placeholder de processor. Por eso va rev share con mínimo.
- Que la empresa gane sobre la conversión de su gente es un riesgo a validar con legal, sobre todo en pagos parecidos a salario.

## Cashback como palanca de producto
Cashback en compras con tarjeta para mover uso de "recibo y retiro" a "recibo y gasto". Se financia solo con interchange y se enciende cuando haya datos, no el día 0.

- **Diseño [S]:** 0,25% base; 0,50% para quien recibió un pago en los últimos 30 días; tope de USD 10 al mes y nunca más del 50% del interchange neto. Se acredita al contabilizar la compra y se revierte con reembolsos y contracargos. Excluye retiros, cargos tipo efectivo y categorías bloqueadas.
- **Costo en el ejemplo:** con USD 1.200 cuesta 1,20 a 2,40 al mes de los 4,80 de interchange; con USD 300, 0,30 a 0,60 de 1,20.
- **Condición previa:** interchange neto confirmado por escrito con el emisor.
- **Prueba:** desde el día 30, por cohortes y con línea base. Con 60 a 150 personas es una señal, no una prueba estadística.
- **Decisión a 60 días:** escalar si el interchange adicional paga el cashback; bajar la tasa si sube el uso pero no se paga; parar si no mueve el uso o aparece abuso.
- **Por validar:** tratamiento tributario y reglas de promociones en cada país.

## Cómo se alimentan los segmentos
1. La empresa invita y activamos personas casi sin costo de adquisición.
2. La persona usa la tarjeta y el ingreso baja el costo de servirla.
3. Al cambiar de empleo conserva la cuenta y puede pedirla en su siguiente empresa. El producto lo facilita con la cuenta portable y un botón de "recomendar a mi empresa" [S].
4. Los partners integran la función y traen usuarios y empresas.
5. Más volumen mejora las condiciones con partners y permite bajar precios a empresas [S].

Con 3 pilotos, esto no se puede medir en 90 días como canal. Solo se registran señales: recomendaciones por persona activa y empresas que llegan por ese camino.

## Competencia
| Alternativa | Qué se sabe [F] | Dónde gana | Dónde gana Clara [S] |
|---|---|---|---|
| Deel | Wallet para contratistas en más de 80 países; tarjeta anunciada "later this year" en página actualizada en agosto de 2026 | Ya está en el flujo de pago del contratista | Clientes que ya confían en Clara, sin cambiar de proveedor de gastos |
| Ontop | Cuentas en USD con BVNK para contratistas; su página de wallet menciona fees en retiros y uso de tarjeta | Foco en contratistas en LATAM | KYB hecho, riel de fondeo y operación de tarjetas propios |
| Transferencia bancaria | Lenta y costosa, según el propio caso | Ya existe y no pide cambios | Velocidad, seguimiento por pago y conciliación |

No encontré tarifas comparables de forma confiable, así que no afirmo que seamos más baratos: se valida en el piloto.

## Métricas a 90 días
**Día 0 = primer pago real del piloto.** Antes hay condiciones previas que no cuentan en los 90 días: visto bueno legal del corredor, programa de tarjeta y partner de stablecoin contratados. Todos los umbrales son supuestos.

| Métrica | Parar | Cambiar rumbo | Escalar |
|---|---|---|---|
| Empresas piloto con pago recurrente (de 3) | 0 | 1 | 2 o más |
| Activación: KYC aprobado y saldo recibido, a 14 días | menos de 40% | 40% a 65% | más de 65% |
| Rechazo de KYC, medido aparte del abandono | más de 25% | 10% a 25% | menos de 10% |
| Primera compra con tarjeta, a 30 días | menos de 30% | 30% a 50% | más de 50% |
| Aprobación de autorizaciones con saldo suficiente | menos de 85% | 85% a 95% | más de 95% |
| Entrega del pago hasta available, p50 / p95 | más de 24 h | hasta 24 h | menos de 15 min / menos de 2 h |
| Saldo gastado con tarjeta sobre saldo recibido | menos de 10% | 10% a 30% | más de 30% |
| Pagos en hold y falsos positivos | la revisión no da abasto | mejorable | SLA cumplido |
| Fraude y disputas sobre gasto | por encima del límite del programa | cerca del límite | dentro del límite |
| Tickets "dónde está mi pago" por 100 pagos, contra línea base | no bajan | bajan menos de 50% | bajan más de 70% |
| Margen por persona activa, con costos reales | negativo sin camino claro | cerca de cero | positivo |

**Señal, no decisión:** partners en sandbox y recomendaciones por persona activa. Según el orden de entrada, no bloquean ni aprueban el resultado de los 90 días.

**Reglas de decisión:**
- **Parar:** activación baja y margen negativo juntos, o un bloqueo regulatorio en el corredor.
- **Cambiar:** si activan pero no usan la tarjeta, el producto se vuelve más recepción y retiro, y se revisa el modelo. Si usan la tarjeta pero las empresas no repiten, se revisa el precio y el flujo de la empresa.
- **Escalar:** verde en empresas, activación y margen. Entonces se abre el segundo corredor y el primer partner.

## Supuestos laborales y regulatorios (a validar con legal)
1. **Salario en dólares:** no reemplazamos la nómina formal. Empieza con contratistas y reembolsos. Salario solo donde la ley lo permita y por elección documentada. En el prototipo queda bloqueado en Perú, Chile y Argentina; el detalle por país está en `gtm.pdf`.
2. **Clasificación:** contratar como contratista a quien en realidad es empleado es un riesgo del cliente. El producto no lo resuelve.
3. **Stablecoin como FX:** cada corredor necesita partner y autorizaciones claras, en origen y destino.
4. **Emisión:** hay que definir bajo qué programa se emite a alguien en un país sin operación local, y respetar las reglas de donde vive (límites, impuestos, reporte).
5. **KYC y AML:** todo usuario pasa KYC y monitoreo. Nadie recibe saldo disponible sin aprobarlo.
6. **Datos:** documentos y biometría con el proveedor. Los datos que debamos conservar como regulados van cifrados en un vault. PAN y CVV solo con el processor.
7. **Divulgación:** el saldo está respaldado por stablecoins y no es un depósito bancario. Los términos deben decirlo con claridad aunque la persona nunca vea cripto.
8. **Impuestos:** cada persona declara lo suyo. Damos estado de cuenta, no asesoría tributaria.

## Primeras cuatro semanas
1. Elegir el corredor con legal, cumplimiento y datos de clientes.
2. Definir los tipos de pago habilitados en ese corredor.
3. Confirmar con partners los costos reales y rehacer la economía unitaria.
4. Cerrar 2 o 3 clientes piloto y medir su línea base de costo, tiempo y tickets.

## Fuentes
Secundarias, consultadas el 31-oct-2026. Conviene confirmarlas antes de citarlas:
- [Clara Global, Portal Tela](https://www.portaltela.com/noticias/economia/2026/06/11/clara-anuncia-cartoes-corporativos-com-stablecoins-como-infraestrutura/)
- [Clara y Bitso Business](https://www.clara.com/resources/newsroom/clara-and-bitso-business-partner-to-launch-stablecoin-backed-corporate-cards-for-businesses-in-latin-america)
- [Brasil: resoluciones BCB 521 y 561, Ledger Insights](https://www.ledgerinsights.com/brazil-imposes-partial-ban-on-stablecoins-crypto-for-cross-border-payments-and-fx/)
- [México: Circular 4/2019, CryptoSlate](https://cryptoslate.com/crypto-laws/bank-of-mexico-circular-4-2019-virtual-assets/)
- [Colombia: vacío regulatorio, Bloomberg Línea](https://www.bloomberglinea.com/latinoamerica/colombia/el-vacio-regulatorio-que-enfrenta-el-mercado-cripto-en-colombia/)
- [Deel: stablecoin wallet](https://www.deel.com/blog/introducing-stablecoin-wallet/)
- [Ontop y BVNK, LatamList](https://latamlist.com/ontop-partners-with-bvnk/)
- [Ontop Wallet](https://es.getontop.com/wallet)
