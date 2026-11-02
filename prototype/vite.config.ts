import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { keccak256, toHex } from 'viem'

// Dev-only endpoints for the optional testnet proof. The key stays on the server (read from .env).
// If there is no funded wallet, /status says live:false and the UI uses mock hashes.
function chainApi(): Plugin {
  let queue: Promise<unknown> = Promise.resolve()
  return {
    name: 'chain-api',
    configureServer(server) {
      server.middlewares.use('/api/chain', (req, res) => {
        const send = (code: number, body: unknown) => { res.statusCode = code; res.setHeader('content-type', 'application/json'); res.end(JSON.stringify(body)) }
        const run = async () => {
          const chain = await import('./scripts/chain.mjs')
          const c = chain.clients()
          if (!c) return send(200, { live: false, reason: 'no wallet' })
          let balance = 0
          try { balance = await chain.usdcBalance(c.pub, c.account.address) } catch { return send(200, { live: false, reason: 'rpc unreachable', address: c.account.address }) }
          if (req.url === '/status' || req.url === '/') return send(200, { live: balance >= 0.05, address: c.account.address, balance })
          if (req.url === '/transfer' && req.method === 'POST') {
            // The dev server listens on the network, so only this machine may spend from the wallet.
            const ip = req.socket.remoteAddress ?? ''
            if (!['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(ip)) return send(403, { ok: false, error: 'local requests only' })
            let raw = ''
            for await (const part of req) raw += part
            const { kind = 'test', amount = 0.01 } = JSON.parse(raw || '{}')
            const amt = Math.min(1, Math.max(0.01, Number(amount) || 0.01))
            if (balance < amt + 0.01) return send(200, { ok: false, error: 'wallet is out of test funds' })
            // Destination: a stable address per purpose, derived from the public address. The key never enters this.
            const to = ('0x' + keccak256(toHex(`${c.account.address}:${String(kind).slice(0, 32)}`)).slice(26)) as `0x${string}`
            const job = queue.then(() => chain.sendUsdc(to, amt))
            queue = job.catch(() => undefined)
            try { return send(200, { ok: true, ...(await job), to }) } catch (e) { return send(200, { ok: false, error: String((e as Error).message).slice(0, 200) }) }
          }
          send(404, { error: 'not found' })
        }
        run().catch((e) => send(500, { error: String(e?.message ?? e).slice(0, 200) }))
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), chainApi()],
  server: { host: true, port: 5173, strictPort: true },
})
