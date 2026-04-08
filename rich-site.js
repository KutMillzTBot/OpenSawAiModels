const LOCK_CODE = "2007";
let voiceRecognition = null;
let voiceActive = false;
let voiceContinuous = false;
let voiceCtor = null;

function initLockscreen() {
  const screen = document.getElementById("lockscreen");
  const appRoot = document.getElementById("appRoot");
  if (!screen || !appRoot) return;

  const input = document.getElementById("lockPass");
  const btn = document.getElementById("unlockBtn");
  const err = document.getElementById("lockError");

  const attempt = () => {
    const val = (input && input.value ? input.value : "").trim();
    if (val === LOCK_CODE) {
      screen.classList.add("hidden");
      appRoot.classList.add("unlocked");
      appRoot.setAttribute("aria-hidden", "false");
      if (err) err.textContent = "";
      if (input) input.value = "";
      document.dispatchEvent(new CustomEvent("rich:unlocked"));
      return;
    }
    if (err) err.textContent = "Incorrect code. Try again.";
    if (input) {
      input.focus();
      input.select();
    }
  };

  if (btn) btn.addEventListener("click", attempt);
  if (input) {
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") attempt();
    });
    input.focus();
  }
}

function normalizeBase(host) {
  const cleaned = (host || "").trim();
  if (!cleaned) return "";
  if (cleaned.startsWith("http://") || cleaned.startsWith("https://")) return cleaned;
  return "http://" + cleaned;
}

function setVoiceStatus(message, isError) {
  const el = document.getElementById("voiceCmdStatus");
  if (!el) return;
  el.textContent = message;
  el.style.color = isError ? "var(--danger)" : "var(--muted)";
}

function updateVoiceButton() {
  const btn = document.getElementById("voiceCmdBtn");
  if (!btn) return;
  btn.textContent = voiceContinuous ? "Stop Voice" : "Voice Command";
}

function startVoice() {
  if (!voiceCtor || voiceActive) return;
  voiceRecognition = new voiceCtor();
  voiceRecognition.lang = navigator.language || "en-US";
  voiceRecognition.interimResults = false;
  voiceRecognition.maxAlternatives = 1;
  voiceRecognition.onresult = (event) => {
    const transcript = event.results[0][0].transcript || "";
    handleVoiceCommand(transcript);
  };
  voiceRecognition.onerror = () => {
    setVoiceStatus("Voice input failed. Click Voice Command to retry.", true);
  };
  voiceRecognition.onend = () => {
    voiceActive = false;
    if (voiceContinuous) {
      setTimeout(() => startVoice(), 350);
    } else {
      updateVoiceButton();
    }
  };
  voiceActive = true;
  updateVoiceButton();
  setVoiceStatus("Listening...", false);
  try {
    voiceRecognition.start();
  } catch (err) {
    voiceActive = false;
    voiceContinuous = false;
    updateVoiceButton();
    setVoiceStatus("Click Voice Command to enable the mic.", true);
  }
}

function stopVoice() {
  voiceContinuous = false;
  if (voiceRecognition) {
    voiceRecognition.stop();
  }
  voiceActive = false;
  updateVoiceButton();
  setVoiceStatus("Voice paused.", false);
}

async function runApprovedAction(action) {
  const host = normalizeBase(localStorage.getItem("richAdminHost") || "");
  const token = (localStorage.getItem("richActionToken") || "").trim();
  if (!host || !token) {
    setVoiceStatus("Need an action token from the admin panel first.", true);
    return false;
  }
  try {
    const resp = await fetch(`${host}/v1/admin/actions/run-approved`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Action-Token": token
      },
      body: JSON.stringify({ action })
    });
    if (!resp.ok) {
      const txt = await resp.text();
      throw new Error(txt || "Action failed");
    }
    const data = await resp.json();
    const ok = data?.status === "ok";
    setVoiceStatus(ok ? "Action complete." : "Action failed.", !ok);
    return ok;
  } catch (err) {
    setVoiceStatus(`Action error: ${err.message}`, true);
    return false;
  }
}

async function handleVoiceCommand(raw) {
  const text = (raw || "").toLowerCase();
  if (!text) return;
  setVoiceStatus(`Heard: "${raw}"`, false);

  if (text.includes("digit")) {
    window.location.href = "deriv_digit_analyzer_v3.html";
    return;
  }
  if (text.includes("mt5") || text.includes("mt five")) {
    window.location.href = "mt5.html";
    return;
  }
  if (text.includes("deriv")) {
    window.location.href = "deriv.html";
    return;
  }
  if (text.includes("hub") || text.includes("home")) {
    window.location.href = "index.html";
    return;
  }

  if (text.includes("start server")) return runApprovedAction("start_server");
  if (text.includes("stop server")) return runApprovedAction("stop_server");
  if (text.includes("start tunnel")) return runApprovedAction("start_tunnel");
  if (text.includes("stop all")) return runApprovedAction("stop_all");
  if (text.includes("start mt5") || text.includes("start mt five")) return runApprovedAction("start_mt5");
  if (text.includes("stop mt5") || text.includes("stop mt five")) return runApprovedAction("stop_mt5");
  if (text.includes("start backtest") || text.includes("start back testing")) return runApprovedAction("start_backtest");
  if (text.includes("stop backtest") || text.includes("stop back testing")) return runApprovedAction("stop_backtest");

  setVoiceStatus("Command not recognized.", true);
}

function bindVoiceCommands() {
  const btn = document.getElementById("voiceCmdBtn");
  if (!btn) return;
  voiceCtor = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!voiceCtor) {
    btn.disabled = true;
    setVoiceStatus("Voice not supported in this browser.", true);
    return;
  }

  btn.addEventListener("click", () => {
    if (voiceContinuous) {
      localStorage.setItem("richVoiceAuto", "false");
      stopVoice();
      return;
    }
    voiceContinuous = true;
    localStorage.setItem("richVoiceAuto", "true");
    startVoice();
  });

  voiceContinuous = localStorage.getItem("richVoiceAuto") === "true";
  updateVoiceButton();
  if (voiceContinuous) {
    document.addEventListener(
      "rich:unlocked",
      () => startVoice(),
      { once: true }
    );
  }
}

function bindAutomationToggles() {
  const autoMt5 = document.getElementById("autoStartMt5");
  const autoBacktest = document.getElementById("autoStartBacktest");
  if (!autoMt5 && !autoBacktest) return;

  if (autoMt5) {
    autoMt5.checked = localStorage.getItem("autoStartMt5") === "true";
    autoMt5.addEventListener("change", () => {
      localStorage.setItem("autoStartMt5", autoMt5.checked ? "true" : "false");
    });
  }
  if (autoBacktest) {
    autoBacktest.checked = localStorage.getItem("autoStartBacktest") === "true";
    autoBacktest.addEventListener("change", () => {
      localStorage.setItem("autoStartBacktest", autoBacktest.checked ? "true" : "false");
    });
  }

  document.addEventListener(
    "rich:unlocked",
    () => {
      if (autoMt5 && autoMt5.checked) runApprovedAction("start_mt5");
      if (autoBacktest && autoBacktest.checked) runApprovedAction("start_backtest");
    },
    { once: true }
  );
}

function bindNavActive() {
  const active = document.body.getAttribute("data-page") || "";
  document.querySelectorAll("nav a").forEach((link) => {
    if (link.dataset.page === active) link.classList.add("active");
  });
}

function bindMt5Launch() {
  const hostInput = document.getElementById("mt5HostInput");
  const flowInput = document.getElementById("flowHostInput");
  const dashBtn = document.getElementById("openMt5Btn");
  const flowBtn = document.getElementById("openFlowBtn");
  if (!hostInput || !dashBtn) return;

  const savedHost = localStorage.getItem("mt5Host") || "";
  const savedFlow = localStorage.getItem("flowHost") || "";
  hostInput.value = savedHost || "http://127.0.0.1:5001";
  if (flowInput) flowInput.value = savedFlow || "http://127.0.0.1:5055";

  hostInput.addEventListener("change", () => {
    localStorage.setItem("mt5Host", hostInput.value.trim());
  });
  if (flowInput) {
    flowInput.addEventListener("change", () => {
      localStorage.setItem("flowHost", flowInput.value.trim());
    });
  }

  dashBtn.addEventListener("click", () => {
    const base = hostInput.value.trim();
    if (!base) return;
    window.open(`${base.replace(/\/$/, "")}/dashboard`, "_blank");
  });

  if (flowBtn && flowInput) {
    flowBtn.addEventListener("click", () => {
      const base = flowInput.value.trim();
      if (!base) return;
      window.open(base.replace(/\/$/, ""), "_blank");
    });
  }
}

function bindDerivLaunch() {
  const btn = document.getElementById("openDerivBtn");
  if (!btn) return;
  btn.addEventListener("click", () => {
    window.location.href = "deriv_digit_analyzer_v3.html";
  });
}

document.addEventListener("DOMContentLoaded", () => {
  initLockscreen();
  bindNavActive();
  bindMt5Launch();
  bindDerivLaunch();
  bindVoiceCommands();
  bindAutomationToggles();
});
