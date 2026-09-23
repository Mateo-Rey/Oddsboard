import { useState } from "react";
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile } from "firebase/auth";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { auth, db } from "../firebase";
import { STARTING_BALANCE } from "../lib";

export default function AuthForm() {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      if (mode === "register") {
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(cred.user, { displayName: name });
        await setDoc(doc(db, "users", cred.user.uid), {
          displayName: name || email.split("@")[0],
          balance: STARTING_BALANCE,
          createdAt: serverTimestamp(),
        });
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (err: any) {
      setError(err.message?.replace("Firebase: ", "") ?? "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth">
      <div className="auth-side">
        <h1 className="brand big">Oddsboard</h1>
        <p>Bet play-money credits on real questions. The crowd sets the odds.</p>
        <ul className="ticker">
          <li><b>62¢</b> Will it rain in Orlando this weekend?</li>
          <li><b>31¢</b> Will the office coffee machine survive Friday?</li>
          <li><b>88¢</b> Will the demo work on the first try?</li>
        </ul>
      </div>
      <form className="auth-form" onSubmit={submit}>
        <h2>{mode === "login" ? "Log in" : "Create your account"}</h2>
        {mode === "register" && (
          <label>Display name<input value={name} onChange={(e) => setName(e.target.value)} required /></label>
        )}
        <label>Email<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></label>
        <label>Password<input type="password" minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} required /></label>
        {error && <p className="error">{error}</p>}
        <button className="primary" disabled={busy}>{mode === "login" ? "Log in" : `Sign up and get ${STARTING_BALANCE.toLocaleString()} credits`}</button>
        <button type="button" className="link" onClick={() => setMode(mode === "login" ? "register" : "login")}>
          {mode === "login" ? "New here? Create an account" : "Have an account? Log in"}
        </button>
      </form>
    </div>
  );
}
