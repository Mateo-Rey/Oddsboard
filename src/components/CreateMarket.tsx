import { useState } from "react";
import type { User } from "firebase/auth";
import { addDoc, collection, serverTimestamp, Timestamp } from "firebase/firestore";
import { db } from "../firebase";

export default function CreateMarket({ user, onDone }: { user: User; onDone: () => void }) {
  const [question, setQuestion] = useState("");
  const [outcomes, setOutcomes] = useState(["Yes", "No"]);
  const [closesAt, setClosesAt] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const clean = outcomes.map((o) => o.trim()).filter(Boolean);
    if (new Set(clean).size !== clean.length) return setError("Outcome names must be different.");
    if (clean.length < 2) return setError("Add at least two outcomes.");
    setBusy(true);
    setError("");
    try {
      await addDoc(collection(db, "markets"), {
        question: question.trim(),
        creatorId: user.uid,
        creatorName: user.displayName ?? user.email,
        outcomes: clean,
        pool: Object.fromEntries(clean.map((o) => [o, 0])),
        status: "open",
        resolvedOutcome: null,
        closesAt: closesAt ? Timestamp.fromDate(new Date(closesAt)) : null,
        createdAt: serverTimestamp(),
      });
      onDone();
    } catch (err: any) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <form className="panel form" onSubmit={submit}>
      <h2>New market</h2>
      <label>Question<input value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="Will it rain in Orlando this weekend?" required maxLength={160} /></label>
      <fieldset>
        <legend>Outcomes</legend>
        {outcomes.map((o, i) => (
          <div className="row" key={i}>
            <input value={o} onChange={(e) => setOutcomes(outcomes.map((x, j) => (j === i ? e.target.value : x)))} required />
            {outcomes.length > 2 && <button type="button" className="link" onClick={() => setOutcomes(outcomes.filter((_, j) => j !== i))}>Remove</button>}
          </div>
        ))}
        {outcomes.length < 8 && <button type="button" className="link" onClick={() => setOutcomes([...outcomes, ""])}>Add outcome</button>}
      </fieldset>
      <label>Betting closes (optional)<input type="datetime-local" value={closesAt} onChange={(e) => setClosesAt(e.target.value)} /></label>
      {error && <p className="error">{error}</p>}
      <button className="primary" disabled={busy}>Create market</button>
    </form>
  );
}
