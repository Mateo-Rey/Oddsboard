import { useEffect, useState } from "react";
import { onAuthStateChanged, signOut, type User } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import { auth, db } from "./firebase";
import type { UserDoc } from "./types";
import { fmt } from "./lib";
import AuthForm from "./components/AuthForm";
import MarketList from "./components/MarketList";
import CreateMarket from "./components/CreateMarket";
import Portfolio from "./components/Portfolio";

type Tab = "markets" | "create" | "portfolio";

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const [profile, setProfile] = useState<UserDoc | null>(null);
  const [tab, setTab] = useState<Tab>("markets");

  useEffect(() => onAuthStateChanged(auth, (u) => { setUser(u); setReady(true); }), []);

  useEffect(() => {
    if (!user) { setProfile(null); return; }
    return onSnapshot(doc(db, "users", user.uid), (s) => setProfile(s.exists() ? (s.data() as UserDoc) : null));
  }, [user]);

  if (!ready) return <div className="center muted">Loading…</div>;
  if (!user) return <AuthForm />;

  return (
    <div className="shell">
      <header className="top">
        <h1 className="brand">Oddsboard</h1>
        <nav>
          {(["markets", "create", "portfolio"] as Tab[]).map((t) => (
            <button key={t} className={tab === t ? "tab on" : "tab"} onClick={() => setTab(t)}>
              {t === "markets" ? "Markets" : t === "create" ? "New market" : "Portfolio"}
            </button>
          ))}
        </nav>
        <div className="me">
          <span className="balance" title="Play-money credits">{profile ? fmt(profile.balance) : "…"} cr</span>
          <span className="muted">{user.displayName || user.email}</span>
          <button className="link" onClick={() => signOut(auth)}>Log out</button>
        </div>
      </header>
      <main>
        {tab === "markets" && <MarketList user={user} balance={profile?.balance ?? 0} />}
        {tab === "create" && <CreateMarket user={user} onDone={() => setTab("markets")} />}
        {tab === "portfolio" && <Portfolio user={user} balance={profile?.balance ?? 0} />}
      </main>
    </div>
  );
}
