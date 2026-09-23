import { useState } from "react";
import type { User } from "firebase/auth";
import { collection, doc, runTransaction, serverTimestamp, updateDoc } from "firebase/firestore";
import { db } from "../firebase";
import type { Market } from "../types";
import { cents, fmt, pct, price, totalPool } from "../lib";

export default function MarketCard({ market: m, user, balance }: { market: Market; user: User; balance: number }) {
  const [pick, setPick] = useState(m.outcomes[0]);
  const [amount, setAmount] = useState("50");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const isCreator = m.creatorId === user.uid;
  const expired = !!m.closesAt && m.closesAt.toMillis() < Date.now();
  const canBet = m.status === "open" && !expired;
  const amt = Math.floor(Number(amount));
  const before = price(m, pick);
  const after = (() => {
    if (!amt || amt < 1) return before;
    const pool = { ...m.pool, [pick]: (m.pool[pick] ?? 0) + amt };
    return price({ pool, outcomes: m.outcomes }, pick);
  })();

  async function placeBet() {
    setMsg(null);
    if (!Number.isFinite(amt) || amt < 1) return setMsg({ ok: false, text: "Enter a whole number of credits (1 or more)." });
    setBusy(true);
    try {
      const marketRef = doc(db, "markets", m.id);
      const userRef = doc(db, "users", user.uid);
      const posRef = doc(collection(db, "markets", m.id, "positions"));
      await runTransaction(db, async (tx) => {
        const [mSnap, uSnap] = await Promise.all([tx.get(marketRef), tx.get(userRef)]);
        if (!mSnap.exists() || !uSnap.exists()) throw new Error("Market or account not found.");
        const cur = mSnap.data() as Market;
        if (cur.status !== "open") throw new Error("This market is no longer open.");
        if (cur.closesAt && cur.closesAt.toMillis() < Date.now()) throw new Error("Betting has closed.");
        const bal = uSnap.data().balance as number;
        if (amt > bal) throw new Error("Not enough credits.");
        const p = price(cur, pick);
        const pool = { ...cur.pool, [pick]: (cur.pool[pick] ?? 0) + amt };
        tx.update(userRef, { balance: bal - amt });
        tx.update(marketRef, { pool });
        tx.set(posRef, { userId: user.uid, outcome: pick, amountWagered: amt, priceAtPurchase: p, payoutClaimed: false, timestamp: serverTimestamp() });
        const hist = doc(collection(db, "markets", m.id, "priceHistory"));
        const total = totalPool(pool);
        m.outcomes.forEach((o, i) => {
          tx.set(i === 0 ? hist : doc(collection(db, "markets", m.id, "priceHistory")), { outcome: o, price: (pool[o] ?? 0) / total, timestamp: serverTimestamp() });
        });
      });
      setMsg({ ok: true, text: `Placed ${fmt(amt)} credits on ${pick}.` });
    } catch (e: any) {
      setMsg({ ok: false, text: e.message });
    } finally {
      setBusy(false);
    }
  }

  async function resolve(outcome: string) {
    if (!confirm(`Resolve this market as “${outcome}”? This can't be undone.`)) return;
    try {
      await updateDoc(doc(db, "markets", m.id), { status: "resolved", resolvedOutcome: outcome });
    } catch (e: any) {
      setMsg({ ok: false, text: e.message });
    }
  }

  async function closeBetting() {
    try { await updateDoc(doc(db, "markets", m.id), { status: "closed" }); }
    catch (e: any) { setMsg({ ok: false, text: e.message }); }
  }

  return (
    <article className="card">
      <div className="card-head">
        <h3>{m.question}</h3>
        <span className={`badge ${m.status}`}>{m.status === "open" && expired ? "closed" : m.status}</span>
      </div>
      <p className="muted small">
        By {m.creatorName ?? "anonymous"} · {fmt(totalPool(m.pool))} credits wagered
        {m.closesAt && ` · closes ${m.closesAt.toDate().toLocaleString()}`}
      </p>

      <div className="odds">
        {m.outcomes.map((o) => {
          const p = price(m, o);
          return (
            <button
              key={o}
              className={`odd ${pick === o && canBet ? "sel" : ""} ${m.resolvedOutcome === o ? "won" : ""}`}
              onClick={() => canBet && setPick(o)}
              disabled={!canBet}
              aria-pressed={pick === o}
            >
              <span className="bar" style={{ width: pct(p) }} />
              <span className="name">{o}{m.resolvedOutcome === o && " ✓"}</span>
              <span className="p">{cents(p)} <small>{pct(p)}</small></span>
            </button>
          );
        })}
      </div>

      {canBet && (
        <div className="bet">
          <label>Credits
            <input type="number" min={1} max={balance} value={amount} onChange={(e) => setAmount(e.target.value)} />
          </label>
          <button className="primary" disabled={busy} onClick={placeBet}>Bet on {pick}</button>
          <p className="muted small">Odds for {pick}: {pct(before)} → {pct(after)} after your bet</p>
        </div>
      )}
      {msg && <p className={msg.ok ? "ok" : "error"}>{msg.text}</p>}

      {isCreator && m.status !== "resolved" && (
        <details className="admin">
          <summary>Manage your market</summary>
          {m.status === "open" && <button className="link" onClick={closeBetting}>Close betting</button>}
          <p className="small muted">Pick the winning outcome:</p>
          <div className="row wrap">
            {m.outcomes.map((o) => <button key={o} className="ghost" onClick={() => resolve(o)}>{o} won</button>)}
          </div>
        </details>
      )}
    </article>
  );
}
