import { useEffect, useRef, useState } from "react";
import type { User } from "firebase/auth";
import { collectionGroup, doc, getDoc, onSnapshot, query, runTransaction, where } from "firebase/firestore";
import { db } from "../firebase";
import type { Market, Position } from "../types";
import { fmt, payoutFor, pct, price } from "../lib";

// Mock credit packages — checkout skips card entry since there's no real payment processor.
const PACKAGES = [
  { credits: 500, price: 4.99 },
  { credits: 1200, price: 9.99 },
  { credits: 3000, price: 19.99 },
  { credits: 8000, price: 49.99 },
];

export default function Portfolio({ user, balance }: { user: User; balance: number }) {
  const [positions, setPositions] = useState<Position[]>([]);
  const [markets, setMarkets] = useState<Record<string, Market>>({});
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [selectedPkg, setSelectedPkg] = useState<(typeof PACKAGES)[number] | null>(null);
  const [purchasing, setPurchasing] = useState(false);
  const claiming = useRef(new Set<string>());

  async function confirmPurchase() {
    if (!selectedPkg) return;
    setPurchasing(true);
    setError("");
    try {
      const userRef = doc(db, "users", user.uid);
      await runTransaction(db, async (tx) => {
        const snap = await tx.get(userRef);
        if (!snap.exists()) throw new Error("User profile not found");
        tx.update(userRef, { balance: (snap.data().balance as number) + selectedPkg.credits });
      });
      setSuccess(`Added ${fmt(selectedPkg.credits)} credits to your balance.`);
      setSelectedPkg(null);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setPurchasing(false);
    }
  }

  // All of this user's positions, across markets
  useEffect(() => {
    const q = query(collectionGroup(db, "positions"), where("userId", "==", user.uid));
    return onSnapshot(q, (snap) => {
      setPositions(
        snap.docs
          .map((d) => ({ id: d.id, marketId: d.ref.parent.parent!.id, ...(d.data() as Omit<Position, "id" | "marketId">) }))
          .sort((a, b) => (b.timestamp?.toMillis() ?? Date.now()) - (a.timestamp?.toMillis() ?? Date.now()))
      );
    }, (e) => setError(e.message));
  }, [user.uid]);

  // Live-subscribe to each market the user holds a position in
  const ids = [...new Set(positions.map((p) => p.marketId))].sort().join(",");
  useEffect(() => {
    const unsubs = ids.split(",").filter(Boolean).map((id) =>
      onSnapshot(doc(db, "markets", id), (s) => {
        if (s.exists()) setMarkets((prev) => ({ ...prev, [id]: { id, ...(s.data() as Omit<Market, "id">) } }));
      })
    );
    return () => unsubs.forEach((u) => u());
  }, [ids]);

  // Auto-settle: pay out any unclaimed position on a resolved market
  useEffect(() => {
    positions.forEach((p) => {
      const m = markets[p.marketId];
      if (!m || m.status !== "resolved" || p.payoutClaimed || claiming.current.has(p.id)) return;
      claiming.current.add(p.id);
      runTransaction(db, async (tx) => {
        const posRef = doc(db, "markets", p.marketId, "positions", p.id);
        const userRef = doc(db, "users", user.uid);
        const [pSnap, mSnap, uSnap] = await Promise.all([tx.get(posRef), tx.get(doc(db, "markets", p.marketId)), tx.get(userRef)]);
        if (!pSnap.exists() || pSnap.data().payoutClaimed) return;
        const pos = pSnap.data() as Position;
        const payout = payoutFor(mSnap.data() as Market, pos.outcome, pos.amountWagered);
        tx.update(posRef, { payoutClaimed: true });
        if (payout > 0) tx.update(userRef, { balance: (uSnap.data()!.balance as number) + payout });
      }).catch((e) => { claiming.current.delete(p.id); setError(e.message); });
    });
  }, [positions, markets, user.uid]);

  const open = positions.filter((p) => markets[p.marketId]?.status !== "resolved");
  const settled = positions.filter((p) => markets[p.marketId]?.status === "resolved");
  const atStake = open.reduce((s, p) => s + p.amountWagered, 0);

  return (
    <div className="stack">
      <section className="stats">
        <div><span className="muted small">Balance</span><b>{fmt(balance)} cr</b></div>
        <div><span className="muted small">In open bets</span><b>{fmt(atStake)} cr</b></div>
        <div><span className="muted small">Open positions</span><b>{open.length}</b></div>
      </section>
      {error && <p className="error">{error}</p>}
      {success && <p className="ok">{success}</p>}

      <h2>Get credits</h2>
      <div className="grid">
        {PACKAGES.map((pkg) => (
          <div className="card" key={pkg.credits}>
            <div className="card-head">
              <h3>{fmt(pkg.credits)} cr</h3>
              <span className="badge">${pkg.price.toFixed(2)}</span>
            </div>
            <p className="muted small">One-time top-up of play-money credits.</p>
            <button className="primary" onClick={() => { setSuccess(""); setSelectedPkg(pkg); }}>Buy</button>
          </div>
        ))}
      </div>

      {selectedPkg && (
        <div className="overlay" onClick={() => !purchasing && setSelectedPkg(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Confirm purchase</h3>
            <p>{fmt(selectedPkg.credits)} credits for ${selectedPkg.price.toFixed(2)}</p>
            <p className="muted small">Mock checkout — no card details needed, this just tops up your play-money balance.</p>
            {error && <p className="error">{error}</p>}
            <div className="actions">
              <button className="ghost" disabled={purchasing} onClick={() => setSelectedPkg(null)}>Cancel</button>
              <button className="primary" disabled={purchasing} onClick={confirmPurchase}>
                {purchasing ? "Processing…" : "Confirm purchase"}
              </button>
            </div>
          </div>
        </div>
      )}

      <h2>Open positions</h2>
      {open.length === 0 ? <p className="muted">No open positions. Pick a market and place a bet.</p> : (
        <table>
          <thead><tr><th>Market</th><th>Backed</th><th>Wagered</th><th>Bought at</th><th>Now</th></tr></thead>
          <tbody>
            {open.map((p) => {
              const m = markets[p.marketId];
              return (
                <tr key={p.id}>
                  <td>{m?.question ?? "…"}</td><td>{p.outcome}</td><td>{fmt(p.amountWagered)}</td>
                  <td>{pct(p.priceAtPurchase)}</td><td>{m ? pct(price(m, p.outcome)) : "…"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      <h2>Settled</h2>
      {settled.length === 0 ? <p className="muted">Resolved markets will appear here.</p> : (
        <table>
          <thead><tr><th>Market</th><th>Backed</th><th>Wagered</th><th>Result</th><th>Payout</th></tr></thead>
          <tbody>
            {settled.map((p) => {
              const m = markets[p.marketId];
              const payout = m ? payoutFor(m, p.outcome, p.amountWagered) : 0;
              const won = payout > 0;
              return (
                <tr key={p.id}>
                  <td>{m?.question}</td><td>{p.outcome}</td><td>{fmt(p.amountWagered)}</td>
                  <td className={won ? "ok" : "error"}>{m?.resolvedOutcome === p.outcome ? "Won" : won ? "Refunded" : "Lost"}</td>
                  <td>{fmt(payout)}{!p.payoutClaimed && " (settling…)"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
