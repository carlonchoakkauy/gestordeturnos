(function () {
  "use strict";

  var SPECS = ["Cardiología", "Clínica médica", "Dermatología", "Ginecología",
               "Neurología", "Oftalmología", "Pediatría", "Traumatología"];
  var KEY = "turnos-v1";
  var CKEY = "turnos-cfg-v1";

  // Horario del consultorio (editable desde la pantalla)
  var cfg = { open: "09:00", close: "17:00" };
  var turnos = [];

  var $ = function (id) { return document.getElementById(id); };

  // ---------- Almacenamiento ----------
  try {
    var c = JSON.parse(localStorage.getItem(CKEY) || "null");
    if (c && c.open && c.close) cfg = c;
  } catch (e) {}
  try {
    var t = JSON.parse(localStorage.getItem(KEY) || "[]");
    if (Array.isArray(t)) turnos = t;
  } catch (e) {}

  function persist() {
    try {
      localStorage.setItem(KEY, JSON.stringify(turnos));
      localStorage.setItem(CKEY, JSON.stringify(cfg));
    } catch (e) {}
  }

  // ---------- Utilidades de fecha y hora ----------
  function p2(n) { return (n < 10 ? "0" : "") + n; }

  function today() {
    var d = new Date();
    return d.getFullYear() + "-" + p2(d.getMonth() + 1) + "-" + p2(d.getDate());
  }
  function nowMin() {
    var d = new Date();
    return d.getHours() * 60 + d.getMinutes();
  }
  function toMin(s) {
    var a = s.split(":");
    return +a[0] * 60 + +a[1];
  }
  function fmt(m) { return p2(Math.floor(m / 60)) + ":" + p2(m % 60); }

  // Horarios cada 30 min; el último empieza 30 min antes del cierre
  function slots() {
    var r = [];
    for (var m = toMin(cfg.open); m + 30 <= toMin(cfg.close); m += 30) r.push(fmt(m));
    return r;
  }

  function longDate(s) {
    var a = s.split("-");
    return new Date(+a[0], +a[1] - 1, +a[2]).toLocaleDateString("es-AR", {
      weekday: "long", day: "numeric", month: "long", year: "numeric"
    });
  }

  // ¿Ya existe un turno en ese día y horario?
  function taken(date, time) {
    return turnos.some(function (x) { return x.date === date && x.time === time; });
  }

  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (ch) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch];
    });
  }

  function show(el, type, txt) { el.className = "msg " + type; el.textContent = txt; }
  function hide(el) { el.className = "msg"; el.textContent = ""; }

  // ---------- Render ----------
  function fillSpecs() {
    $("esp").innerHTML = '<option value="">Seleccionar especialidad</option>' +
      SPECS.map(function (s) { return "<option>" + s + "</option>"; }).join("");
  }

  function renderSlots(keep) {
    var d = $("dia").value;
    var sel = $("hora");
    var out = "";
    var free = 0;
    var isToday = d === today();

    slots().forEach(function (h) {
      if (isToday && toMin(h) <= nowMin()) return; // horarios que ya pasaron
      var tk = taken(d, h);
      if (!tk) free++;
      out += '<option value="' + h + '"' + (tk ? " disabled" : "") + ">" +
             h + (tk ? " – ocupado" : "") + "</option>";
    });

    sel.innerHTML = '<option value="">Elegir horario</option>' + out;

    if (keep && Array.prototype.some.call(sel.options, function (o) {
      return o.value === keep && !o.disabled;
    })) sel.value = keep;

    $("hint").textContent = d
      ? (free ? free + " horarios libres ese día." : "No quedan horarios libres ese día.")
      : "";
  }

  function renderSub() {
    $("sub").textContent = "Consultorio abierto de " + cfg.open + " a " + cfg.close +
      " · turnos de 30 minutos";
  }

  function renderList() {
    var tdy = today();
    var list = turnos
      .filter(function (x) { return x.date >= tdy; })
      .sort(function (a, b) { return (a.date + a.time).localeCompare(b.date + b.time); });

    if (!list.length) {
      $("lista").innerHTML = '<div class="empty">Todavía no hay turnos. Cargá el primero desde el formulario.</div>';
      return;
    }

    var html = "";
    var cur = "";
    var o = toMin(cfg.open);
    var cl = toMin(cfg.close);

    list.forEach(function (x) {
      if (x.date !== cur) {
        cur = x.date;
        html += '<div class="day">' + longDate(x.date) + "</div>";
      }
      var m = toMin(x.time);
      var outside = m < o || m + 30 > cl;
      html += '<div class="turno' + (outside ? " out" : "") + '">' +
        '<span class="t">' + x.time + "</span>" +
        '<div><div class="n">' + esc(x.name) + '</div><div class="s">' + esc(x.spec) + "</div>" +
        (outside ? '<div class="warn">Fuera del horario actual del consultorio</div>' : "") +
        "</div>" +
        '<button type="button" class="del" data-id="' + x.id + '">Eliminar</button></div>';
    });

    $("lista").innerHTML = html;
  }

  function refresh(keep) {
    renderSub();
    renderSlots(keep);
    renderList();
  }

  // ---------- Eventos ----------
  $("dia").addEventListener("change", function () {
    hide($("msg"));
    renderSlots($("hora").value);
  });

  // Guardar turno (con todas las validaciones)
  $("guardar").addEventListener("click", function () {
    var name = $("nombre").value.trim();
    var d = $("dia").value;
    var h = $("hora").value;
    var sp = $("esp").value;
    var m = $("msg");

    $("ticket").className = "ticket";

    if (!name) return show(m, "err", "Escribí el nombre del paciente.");
    if (!d) return show(m, "err", "Elegí un día.");
    if (d < today()) return show(m, "err", "No se pueden agendar turnos en fechas pasadas.");
    if (!h) return show(m, "err", "Elegí un horario.");
    if (slots().indexOf(h) < 0 || toMin(h) % 30 !== 0)
      return show(m, "err", "Ese horario no está dentro de la atención del consultorio.");
    if (d === today() && toMin(h) <= nowMin())
      return show(m, "err", "Ese horario ya pasó. Elegí uno posterior.");
    if (taken(d, h)) {
      renderSlots();
      return show(m, "err", "Horario ocupado: ya hay un turno el " + longDate(d) +
        " a las " + h + ". Elegí otro horario.");
    }
    if (!sp) return show(m, "err", "Elegí una especialidad.");

    turnos.push({
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      name: name, date: d, time: h, spec: sp
    });
    persist();

    show(m, "ok", "Turno cargado.");
    $("tk1").textContent = name;
    $("tk2").textContent = longDate(d) + " · " + h + " h";
    $("tk3").textContent = sp;
    $("ticket").className = "ticket show";

    $("nombre").value = "";
    $("esp").value = "";
    refresh("");
  });

  // Eliminar turno (se confirma con un segundo clic)
  $("lista").addEventListener("click", function (e) {
    var b = e.target.closest(".del");
    if (!b) return;

    if (!b.classList.contains("sure")) {
      b.classList.add("sure");
      b.textContent = "¿Eliminar?";
      setTimeout(function () {
        if (b.isConnected) { b.classList.remove("sure"); b.textContent = "Eliminar"; }
      }, 3000);
      return;
    }

    var id = b.getAttribute("data-id");
    turnos = turnos.filter(function (x) { return x.id !== id; });
    persist();
    hide($("msg"));
    $("ticket").className = "ticket";
    refresh($("hora").value);
  });

  // Guardar horario del consultorio
  $("saveCfg").addEventListener("click", function () {
    var o = $("open").value;
    var c = $("close").value;
    var m = $("cmsg");

    if (!o || !c) return show(m, "err", "Completá la hora de apertura y de cierre.");
    if (toMin(o) % 30 || toMin(c) % 30)
      return show(m, "err", "Usá horas en punto o y media (por ejemplo 09:00 o 09:30).");
    if (toMin(c) - toMin(o) < 30)
      return show(m, "err", "El consultorio debe estar abierto al menos 30 minutos.");

    cfg = { open: o, close: c };
    persist();

    var n = turnos.filter(function (x) {
      var mm = toMin(x.time);
      return x.date >= today() && (mm < toMin(o) || mm + 30 > toMin(c));
    }).length;

    show(m, "ok", "Horario guardado." +
      (n ? " Hay " + n + " turno(s) fuera del nuevo horario; revisalos en el panel." : ""));
    refresh($("hora").value);
  });

  // ---------- Inicio ----------
  fillSpecs();
  $("open").value = cfg.open;
  $("close").value = cfg.close;
  $("dia").min = today();   // calendario disponible desde hoy en adelante
  $("dia").value = today();
  refresh("");
})();
