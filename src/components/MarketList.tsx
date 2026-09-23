import { useEffect, useState } from "react";
import type { User } from "firebase/auth";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { db } from "../firebase";
import type { Market } from "../types";
import MarketCard from "./MarketCard";

export default function MarketList({ user, balance }: { user: User; balance: number }) {
  const [markets, setMarkets] = useState<Market[]>([]);
  const [filter, setFilter] = useState<"open" | "resolved">("open");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, "markets"), orderBy("createdAt", "desc"));
    return onSnapshot(q, (snap) => {
      setMarkets(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Market, "id">) })));
      setLoading(false);
    });
  }, []);

  const shown = markets.filter((m) => (filter === "open" ? m.status !== "resolved" : m.status === "resolved"));

  return (
    <>
      <div className="seg">
        <button className={filter === "open" ? "on" : ""} onClick={() => setFilter("open")}>Open</button>
        <button className={filter === "resolved" ? "on" : ""} onClick={() => setFilter("resolved")}>Resolved</button>
      </div>
      {loading ? <p className="muted">Loading markets…</p> : shown.length === 0 ? (
        <p className="muted">{filter === "open" ? "No open markets yet. Create the first one from “New market”." : "Nothing has resolved yet."}</p>
      ) : (
        <div className="grid">{shown.map((m) => <MarketCard key={m.id} market={m} user={user} balance={balance} />)}</div>
      )}
    </>
  );
}
