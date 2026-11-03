(() => {
  const cfg = window.QUIZ_CONFIG || {};
  const url = new URL(location.href);
  const page = document.body.dataset.page;
  const $ = id => document.getElementById(id);
  const params = url.searchParams;
  const roomId = params.get("room");
  const adminToken = params.get("token");
  const team = params.get("team") || (params.has("b") ? "b" : "a");
  let supabase, channel, currentRoom;

  function configReady() {
    return cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY &&
      !cfg.SUPABASE_URL.includes("COLE_AQUI") && !cfg.SUPABASE_ANON_KEY.includes("COLE_AQUI");
  }
  function initClient() {
    if (!configReady()) throw new Error("Configure a URL e a chave pública do Supabase no arquivo config.js.");
    supabase = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);
  }
  function randomToken() {
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, b => b.toString(16).padStart(2, "0")).join("");
  }
  function setText(id, value) {
    const el = $(id);
    if (el) el.textContent = value ?? "";
  }
  function teamLabel(t) {
    return t === "a" ? "EQUIPE AZUL" : t === "b" ? "EQUIPE VERMELHA" : "";
  }
  function showError(id, error) {
    if ($(id)) setText(id, error?.message || String(error));
  }

  async function loadRoom() {
    // Consulta somente colunas públicas; admin_token_hash nunca é enviado ao navegador.
    const { data, error } = await supabase.from("rooms")
      .select("id, title, question, status, winner, score_a, score_b, created_at, updated_at")
      .eq("id", roomId).single();
    if (error) throw error;
    currentRoom = data;
    renderRoom(data);
    return data;
  }

  function renderRoom(r) {
    if (!r) return;
    setText("event-title", r.title || "Quiz Arena");
    setText("room-id-label", r.id);
    setText("score-a", r.score_a);
    setText("score-b", r.score_b);
    setText("question-display", r.question || "Aguardando o administrador cadastrar a pergunta...");
    setText("round-status",
      r.status === "open" ? "DISPUTA LIBERADA" :
      r.status === "closed" ? "RODADA ENCERRADA" :
      "AGUARDANDO NOVA RODADA");

    const winner = r.winner ? teamLabel(r.winner) : "";
    setText("winner-display", winner ? `${winner} APERTOU PRIMEIRO!` : "");
    if ($("winner-banner")) {
      $("winner-banner").classList.toggle("winner-visible", !!winner);
      $("winner-banner").classList.toggle("red-winner", r.winner === "b");
      setText("winner-banner-team", winner);
      setText("winner-banner-message", winner ? "APERTOU PRIMEIRO!" : "");
    }

    if ($("question-input") && document.activeElement !== $("question-input")) {
      $("question-input").value = r.question || "";
    }
    if ($("connection-status")) setText("connection-status", "Conectado");
    if ($("team-connection")) setText("team-connection", "Conectado");

    if ($("buzzer")) {
      const won = r.winner === team;
      const lost = !!r.winner && r.winner !== team;
      $("buzzer").disabled = r.status !== "open" || !!r.winner;
      setText("team-instruction",
        r.status === "open" && !r.winner
          ? "VALENDO! Aperte o botão agora!"
          : "Aguarde o administrador liberar a disputa.");
      setText("team-result",
        won ? "VOCÊS APERTARAM PRIMEIRO!" :
        lost ? "A OUTRA EQUIPE APERTOU PRIMEIRO!" :
        r.status === "open" ? "DISPUTA LIBERADA" :
        "AGUARDANDO A PRÓXIMA RODADA");
    }
  }

  function subscribe() {
    if (channel) supabase.removeChannel(channel);
    channel = supabase.channel("room-" + roomId)
      .on("postgres_changes", {
        event: "*", schema: "public", table: "rooms", filter: "id=eq." + roomId
      }, payload => {
        if (payload.new) {
          currentRoom = payload.new;
          renderRoom(payload.new);
        }
      })
      .subscribe(status => {
        if (status === "SUBSCRIBED") {
          if ($("connection-status")) setText("connection-status", "Conectado");
          if ($("team-connection")) setText("team-connection", "Conectado");
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          if ($("connection-status")) setText("connection-status", "Reconectando...");
        }
      });
  }

  async function adminAction(action, extra = {}) {
    const { data, error } = await supabase.rpc("admin_action", {
      p_room_id: roomId,
      p_admin_token: adminToken,
      p_action: action,
      p_question: extra.question ?? null,
      p_team: extra.team ?? null,
      p_delta: extra.delta ?? 0
    });
    if (error) throw error;
    currentRoom = data;
    renderRoom(data);
  }

  async function screenPage() {
    if (!roomId || !adminToken) {
      $("create-panel").classList.remove("hidden");
      $("create-room").addEventListener("click", async () => {
        try {
          initClient();
          $("create-room").disabled = true;
          const token = randomToken();
          const title = $("room-title").value.trim() || "Quiz Arena";
          const { data, error } = await supabase.rpc("create_room", {
            p_title: title, p_admin_token: token
          });
          if (error) throw error;
          location.href = `tela.html?room=${encodeURIComponent(data)}&token=${encodeURIComponent(token)}`;
        } catch (e) {
          showError("create-error", e);
          $("create-room").disabled = false;
        }
      });
      return;
    }

    initClient();
    $("admin-panel").classList.remove("hidden");

    const teamA = new URL("equipe.html", location.href);
    teamA.searchParams.set("room", roomId);
    teamA.searchParams.set("team", "a");

    const teamB = new URL("equipe.html", location.href);
    teamB.searchParams.set("room", roomId);
    teamB.searchParams.set("team", "b");

    const admin = new URL("tela.html", location.href);
    admin.searchParams.set("room", roomId);
    admin.searchParams.set("token", adminToken);

    const scoreboard = new URL("placar.html", location.href);
    scoreboard.searchParams.set("room", roomId);

    $("link-a").value = teamA.href;
    $("link-b").value = teamB.href;
    if ($("link-admin")) $("link-admin").value = admin.href;
    $("link-screen").value = scoreboard.href;

    $("open-round").onclick = async () => {
      try { await adminAction("open", { question: $("question-input").value.trim() }); }
      catch (e) { alert(e.message); }
    };
    $("close-round").onclick = async () => {
      try { await adminAction("close"); }
      catch (e) { alert(e.message); }
    };
    $("reset-round").onclick = async () => {
      try { await adminAction("reset"); }
      catch (e) { alert(e.message); }
    };

    document.querySelectorAll(".score-btn").forEach(btn => {
      btn.onclick = async () => {
        try {
          await adminAction("score", {
            team: btn.dataset.team, delta: Number(btn.dataset.delta)
          });
        } catch (e) { alert(e.message); }
      };
    });

    document.querySelectorAll(".copy-btn").forEach(btn => {
      btn.onclick = async () => {
        const input = $(btn.dataset.copy);
        try {
          await navigator.clipboard.writeText(input.value);
          btn.textContent = "Copiado!";
          setTimeout(() => btn.textContent = "Copiar", 1300);
        } catch {
          input.select();
          document.execCommand("copy");
          btn.textContent = "Copiado!";
        }
      };
    });

    try {
      await loadRoom();
      subscribe();
    } catch (e) {
      $("admin-panel").innerHTML =
        `<div class="panel"><h2>Não foi possível abrir esta sala</h2><p class="muted">${e.message}</p></div>`;
    }
  }

  async function scoreboardPage() {
    try {
      initClient();
      if (!roomId) throw new Error("Link do telão inválido. Solicite um novo link ao administrador.");
      await loadRoom();
      subscribe();
    } catch (e) {
      setText("connection-status", "Desconectado");
      setText("question-display", "Não foi possível abrir esta sala.");
      setText("round-status", e.message);
    }
  }

  async function teamPage() {
    document.body.querySelector(".team-page").dataset.team = team;
    setText("team-name", teamLabel(team));

    $("buzzer").addEventListener("click", async () => {
      if (!currentRoom || currentRoom.status !== "open" || currentRoom.winner) return;
      $("buzzer").disabled = true;
      const { data, error } = await supabase.rpc("press_buzzer", {
        p_room_id: roomId, p_team: team
      });
      if (error) {
        setText("team-result", "ERRO AO REGISTRAR. TENTE NOVAMENTE.");
        $("buzzer").disabled = false;
        return;
      }
      currentRoom = data;
      renderRoom(data);
    });

    try {
      initClient();
      if (!roomId) throw new Error("Link da equipe inválido. Solicite um novo link ao administrador.");
      await loadRoom();
      subscribe();
    } catch (e) {
      setText("team-instruction", e.message);
      setText("team-result", "NÃO FOI POSSÍVEL CONECTAR");
    }
  }

  if (page === "screen") screenPage();
  if (page === "scoreboard") scoreboardPage();
  if (page === "team") teamPage();
})();
