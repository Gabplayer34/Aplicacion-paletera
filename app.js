const FIREBASE_VERSION = "10.14.1";

let firebaseApi = null;
async function loadFirebase() {
  if (firebaseApi) return firebaseApi;
  const [{ initializeApp }, firestore] = await Promise.all([
    import(`https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-app.js`),
    import(`https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-firestore.js`),
  ]);
  firebaseApi = { initializeApp, ...firestore };
  return firebaseApi;
}

const DENOMINATIONS = [50, 20, 10, 5];
const LS_CONFIG = "palets_firebase_config";
const LS_ROOM = "palets_room_id";
const LS_NAME = "palets_user_name";

const eur = (n) =>
  (n || 0).toLocaleString("es-ES", { style: "currency", currency: "EUR" });

const $ = (id) => document.getElementById(id);

let db, roomRef, movementsRef;
let currentBills = { 50: 0, 20: 0, 10: 0, 5: 0 };
let currentOthers = 0;
let pendingMode = null; // "deposit" | "withdraw"

function getStoredConfig() {
  try {
    const raw = localStorage.getItem(LS_CONFIG);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function showSetupError(msg) {
  $("setupError").textContent = msg || "";
}

let fb = null; // resolved firebase API (doc, getDoc, setDoc, ...)

async function initApp() {
  const config = getStoredConfig();
  const roomId = localStorage.getItem(LS_ROOM);
  if (!config || !roomId) {
    $("setupScreen").classList.remove("hidden");
    $("appScreen").classList.add("hidden");
    return;
  }

  try {
    fb = await loadFirebase();
    const app = fb.initializeApp(config);
    db = fb.getFirestore(app);
  } catch (err) {
    $("setupScreen").classList.remove("hidden");
    $("appScreen").classList.add("hidden");
    showSetupError(
      "No se pudo conectar con Firebase. Comprueba tu conexión a internet e inténtalo de nuevo. (" +
        (err?.message || err) +
        ")"
    );
    return;
  }

  roomRef = fb.doc(db, "budgetRooms", roomId);
  movementsRef = fb.collection(db, "budgetRooms", roomId, "movements");

  $("setupScreen").classList.add("hidden");
  $("appScreen").classList.remove("hidden");

  ensureRoomExists().then(listenToRoom);
  listenToMovements();
}

async function ensureRoomExists() {
  const snap = await fb.getDoc(roomRef);
  if (!snap.exists()) {
    await fb.setDoc(roomRef, {
      bills: { 50: 0, 20: 0, 10: 0, 5: 0 },
      others: 0,
      updatedAt: fb.serverTimestamp(),
    });
  }
}

function listenToRoom() {
  fb.onSnapshot(
    roomRef,
    (snap) => {
      $("syncStatus").textContent = "Sincronizado ✔️";
      if (!snap.exists()) return;
      const data = snap.data();
      currentBills = { ...currentBills, ...(data.bills || {}) };
      currentOthers = data.others || 0;
      renderBalance();
    },
    (err) => {
      $("syncStatus").textContent = "Error de sincronización";
      console.error(err);
    }
  );
}

function listenToMovements() {
  const q = fb.query(movementsRef, fb.orderBy("createdAt", "desc"), fb.limit(50));
  fb.onSnapshot(q, (snap) => {
    const list = $("historyList");
    if (snap.empty) {
      list.innerHTML = '<p class="muted">Sin movimientos todavía.</p>';
      return;
    }
    list.innerHTML = "";
    snap.forEach((docSnap) => {
      const m = docSnap.data();
      const item = document.createElement("div");
      item.className = "history-item";
      const sign = m.type === "withdraw" ? "-" : "+";
      const cls = m.type === "withdraw" ? "negative" : "positive";
      const date = m.createdAt?.toDate ? m.createdAt.toDate() : new Date();
      const dateStr = date.toLocaleString("es-ES", {
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      });
      const billsSummary = DENOMINATIONS.filter((d) => m.bills?.[d])
        .map((d) => `${m.bills[d]}×${d}€`)
        .join(", ");
      const othersSummary = m.others ? `${eur(m.others)} sueltos` : "";
      const summary = [billsSummary, othersSummary].filter(Boolean).join(" · ");
      item.innerHTML = `
        <div class="history-left">
          <span class="history-note">${m.note ? escapeHtml(m.note) : (m.type === "withdraw" ? "Retirada" : "Ingreso")}</span>
          <span class="history-meta">${escapeHtml(m.author || "—")} · ${dateStr}${summary ? " · " + escapeHtml(summary) : ""}</span>
        </div>
        <div class="history-amount ${cls}">${sign}${eur(m.amount)}</div>
      `;
      list.appendChild(item);
    });
  });
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function renderBalance() {
  let total = currentOthers;
  DENOMINATIONS.forEach((d) => {
    const count = currentBills[d] || 0;
    const amount = count * d;
    $(`count-${d}`).textContent = eur(amount);
    total += amount;
  });
  $("totalAmount").textContent = eur(total);
  const othersRow = $("othersRow");
  if (currentOthers) {
    othersRow.classList.remove("hidden");
    $("othersAmount").textContent = eur(currentOthers);
  } else {
    othersRow.classList.add("hidden");
  }
}

// ---- Setup screen ----
$("startBtn").addEventListener("click", () => {
  const name = $("userName").value.trim();
  const room = $("roomId").value.trim();
  const configRaw = $("firebaseConfig").value.trim();
  const existingConfig = getStoredConfig();

  if (!name) return showSetupError("Escribe tu nombre.");
  if (!room) return showSetupError("Escribe un código de sala.");

  let config = existingConfig;
  if (configRaw) {
    try {
      config = JSON.parse(configRaw);
    } catch {
      return showSetupError("La configuración de Firebase no es un JSON válido.");
    }
  }
  if (!config || !config.apiKey || !config.projectId) {
    return showSetupError(
      "Falta la configuración de Firebase. Pégala en el campo de abajo (mira el README)."
    );
  }

  localStorage.setItem(LS_NAME, name);
  localStorage.setItem(LS_ROOM, room);
  localStorage.setItem(LS_CONFIG, JSON.stringify(config));
  initApp();
});

// ---- Movement modal ----
function openModal(mode) {
  pendingMode = mode;
  $("modalTitle").textContent = mode === "deposit" ? "Ingresar dinero" : "Retirar dinero";
  DENOMINATIONS.forEach((d) => ($(`in-${d}`).value = 0));
  $("in-others").value = 0;
  $("in-note").value = "";
  $("modalError").textContent = "";
  updateModalTotal();
  $("movementModal").classList.remove("hidden");
}

function closeModal() {
  $("movementModal").classList.add("hidden");
  pendingMode = null;
}

function readModalInputs() {
  const bills = {};
  DENOMINATIONS.forEach((d) => {
    const amount = Math.max(0, Number($(`in-${d}`).value) || 0);
    bills[d] = Math.round(amount / d);
  });
  const others = Math.max(0, Number($("in-others").value) || 0);
  return { bills, others };
}

function updateModalTotal() {
  const { bills, others } = readModalInputs();
  let total = others;
  DENOMINATIONS.forEach((d) => (total += bills[d] * d));
  $("modalTotal").textContent = eur(total);
  return total;
}

[...DENOMINATIONS, "others"].forEach((d) => {
  $(`in-${d}`).addEventListener("input", updateModalTotal);
});

$("depositBtn").addEventListener("click", () => openModal("deposit"));
$("withdrawBtn").addEventListener("click", () => openModal("withdraw"));
$("cancelMovement").addEventListener("click", closeModal);

$("confirmMovement").addEventListener("click", async () => {
  const { bills, others } = readModalInputs();
  const total = DENOMINATIONS.reduce((sum, d) => sum + bills[d] * d, 0) + others;
  const note = $("in-note").value.trim();
  const author = localStorage.getItem(LS_NAME) || "Alguien";

  if (total <= 0) {
    $("modalError").textContent = "Introduce al menos un billete o una cantidad.";
    return;
  }

  const sign = pendingMode === "withdraw" ? -1 : 1;
  $("confirmMovement").disabled = true;

  try {
    await fb.runTransaction(db, async (tx) => {
      const snap = await tx.get(roomRef);
      const data = snap.exists() ? snap.data() : { bills: { 50: 0, 20: 0, 10: 0, 5: 0 }, others: 0 };
      const newBills = { ...data.bills };
      let newOthers = data.others || 0;

      DENOMINATIONS.forEach((d) => {
        const current = newBills[d] || 0;
        const next = current + sign * bills[d];
        if (next < 0) {
          throw new Error(
            `No hay suficientes billetes de ${d}€ para retirar (tienes ${current}).`
          );
        }
        newBills[d] = next;
      });

      const nextOthers = newOthers + sign * others;
      if (nextOthers < 0) {
        throw new Error("No hay suficiente dinero en sueltos/otros para retirar.");
      }
      newOthers = nextOthers;

      tx.set(roomRef, { bills: newBills, others: newOthers, updatedAt: fb.serverTimestamp() }, { merge: true });
    });

    await fb.addDoc(movementsRef, {
      type: pendingMode,
      amount: total,
      bills,
      others,
      note,
      author,
      createdAt: fb.serverTimestamp(),
    });

    closeModal();
  } catch (err) {
    $("modalError").textContent = err.message || "No se pudo completar el movimiento.";
  } finally {
    $("confirmMovement").disabled = false;
  }
});

// ---- Settings modal ----
$("settingsBtn").addEventListener("click", () => {
  $("settingsName").value = localStorage.getItem(LS_NAME) || "";
  $("settingsRoom").value = localStorage.getItem(LS_ROOM) || "";
  $("settingsModal").classList.remove("hidden");
});
$("closeSettings").addEventListener("click", () => $("settingsModal").classList.add("hidden"));
$("saveSettings").addEventListener("click", () => {
  const name = $("settingsName").value.trim();
  if (name) localStorage.setItem(LS_NAME, name);
  $("settingsModal").classList.add("hidden");
});
$("forgetSetup").addEventListener("click", () => {
  if (confirm("Esto borrará la configuración guardada en este móvil (no borra los datos compartidos). ¿Continuar?")) {
    localStorage.removeItem(LS_CONFIG);
    localStorage.removeItem(LS_ROOM);
    localStorage.removeItem(LS_NAME);
    location.reload();
  }
});

// ---- PWA service worker ----
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  });
}

initApp();
