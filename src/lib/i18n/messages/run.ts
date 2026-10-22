/** Everything the run area says: the stage titles of `progress` frames, the
 * formatters over them, and the journal lines both WebSocket clients write.
 *
 * Journal lines are stored as keys (not as formatted text) — the log outlives
 * a run, so a line written in Russian must be readable in English the moment
 * the switcher flips. */

export const ru = {
  run: {
    stage: {
      download: "Скачивание моделей",
      unarchive: "Распаковка архивов",
      read: "Чтение файлов",
      process: "Обработка изображений",
      write: "Запись результатов",
    },
    phase: {
      preprocess: "Предобработка",
      process: "Обработка",
    },
    preparing: "Подготовка…",
    done: "Готово",
    doneOutput: "Готово: {output}",
    stopped: "Остановлено",
    error: "Ошибка: {detail}",
    serverError: "Ошибка сервера: {detail}",
    unknown: "неизвестно",
    echoLost: "Соединение потеряно: нет ответа на echo",
    reconnecting: "Переподключение, попытка {attempt}…",
    dialTimeout: "Сервер не ответил на подключение",
    linkState: "Связь с раннером: {state}",
    reconnected: "Соединение восстановлено",
    recovered: "Прогон найден, продолжение с места обрыва",
    reattached: "Подключено к прогону, кадры идут",
    nothingToRecover: "На сервере нет активного прогона",
    reconnectFailed:
      "Связь не восстановилась за {time} · {url} — {state}. Прогон продолжается на сервере: когда связь вернётся, нажмите «Продолжить»",
    dialFailed: "Не удалось подключиться · {url} — {state}",
    linkLost: "Прогон недоступен: {state}. {hint}",
    badAddress: "Некорректный адрес: {detail}",
    badFrame: "Некорректный кадр (не MessagePack)",
    accepted: "Запуск принят сервером",
    cancelledEarly: "Отменено до подключения",
    noStopAck: "Сервер не подтвердил остановку",
    refused: "Запуск отменён: ошибок в конфиге — {count}",
    prepareFailed: "Не удалось подготовить ноду «{node}»: {detail}",
    ws: {
      timeout: "{method}: нет ответа от сервера",
      closed: "{method}: соединение закрыто",
      addressChanged: "{method}: адрес изменён",
      badAddress: "{method}: некорректный адрес",
      unknownMethod: "{method}: метод не объявлен",
      remote: "{method}: сервер отказал — {detail}",
      badRequest: "{method}: некорректный запрос — {detail}",
      badReply: "{method}: некорректный ответ — {detail}",
    },
    duration: {
      seconds: "{value} с",
      minutes: "{value} мин",
      minutesSeconds: "{minutes} мин {seconds} с",
      hours: "{value} ч",
      hoursMinutes: "{hours} ч {minutes} мин",
    },
    eta: "осталось ~{time}",
    elapsed: "прошло {time}",
    rate: {
      images: "{value} изобр./с",
      bytes: "{value} {unit}/с",
    },
    units: {
      bytes: "Б",
      kilobytes: "КБ",
      megabytes: "МБ",
      gigabytes: "ГБ",
      terabytes: "ТБ",
    },
  },

  link: {
    title: "Связь",
    check: "Проверить связь",
    checking: "Проверка…",
    busy: "Сейчас идёт прогон {run}",
    unchecked: "Связь ещё не проверялась",
    state: {
      online: "Раннер на связи",
      unknown: "Ссылка не найдена",
      expired: "Ссылка просрочена",
      closed: "Ссылка закрыта",
      gone: "Ссылка больше не действует",
      offline: "Раннер не на связи",
      unreachable: "Туннель оборвался",
      localDown: "Раннер не отвечает за туннелем",
      noNetwork: "Нет соединения с адресом",
      noAnswer: "Сервер не отвечает",
      notRunner: "Это не раннер",
      unverified: "Сервер отвечает, но ответ не прочитать",
      blocked: "Браузер блокирует адрес",
      badAddress: "Некорректный адрес",
    },
    hint: {
      online: "Адрес отвечает, раннер готов принять запуск.",
      unknown:
        "Такую ссылку здесь не публиковали. Проверьте адрес или запустите раннер заново: у быстрого туннеля при каждом запуске новый адрес.",
      expired:
        "Клиент туннеля пропал и не вернулся за время ожидания. Запустите раннер и туннель заново и обновите адрес.",
      closed:
        "Публикацию остановили на стороне раннера. Запустите туннель заново.",
      gone: "Ссылка просрочена или закрыта. Запустите туннель заново и обновите адрес.",
      offline:
        "Туннель на месте, но клиент отключился — он может вернуться. Подождите или проверьте процесс раннера и интернет на его машине.",
      unreachable:
        "Раннер подключён к туннелю, но соединение оборвалось на этом запросе. Обычно проходит само.",
      localDown:
        "Туннель жив, а сервис за ним не принимает соединения: раннер упал или слушает другой порт.",
      noNetwork:
        "Адрес не открывается: нет сети, неверное имя, сертификат или сервер выключен.",
      noAnswer:
        "Запрос ушёл, ответа нет. Раннер может быть занят или туннель завис; идущий прогон при этом продолжается.",
      notRunner:
        "Сервер отвечает, но без /health раннера: проверьте адрес или обновите раннер.",
      unverified:
        "Адрес открывается, но браузер не может прочитать ответ (нет CORS). Подключение по WebSocket всё равно может работать.",
      blocked:
        "Страница открыта по https, а раннер — по http. Нужен адрес wss:// (https-туннель).",
      badAddress: "Нужен адрес вида ws://хост:порт/run или wss://хост/run.",
    },
  },
};

export const en: typeof ru = {
  run: {
    stage: {
      download: "Downloading models",
      unarchive: "Unpacking archives",
      read: "Reading files",
      process: "Processing images",
      write: "Writing results",
    },
    phase: {
      preprocess: "Preprocessing",
      process: "Processing",
    },
    preparing: "Preparing…",
    done: "Done",
    doneOutput: "Done: {output}",
    stopped: "Stopped",
    error: "Error: {detail}",
    serverError: "Server error: {detail}",
    unknown: "unknown",
    echoLost: "Connection lost: no reply to the echo",
    reconnecting: "Reconnecting, attempt {attempt}…",
    dialTimeout: "The server did not answer the connection attempt",
    linkState: "Link to the runner: {state}",
    reconnected: "Connection restored",
    recovered: "Run found, resuming where it dropped",
    reattached: "Attached to the run, frames are coming",
    nothingToRecover: "No active run on the server",
    reconnectFailed:
      "The link did not come back in {time} · {url} — {state}. The run continues on the server: press “Resume” when the link is back",
    dialFailed: "Could not connect · {url} — {state}",
    linkLost: "The run cannot be reached: {state}. {hint}",
    badAddress: "Invalid address: {detail}",
    badFrame: "Malformed frame (not MessagePack)",
    accepted: "The server accepted the run",
    cancelledEarly: "Cancelled before connecting",
    noStopAck: "The server did not confirm the stop",
    refused: "Run cancelled: errors in the config — {count}",
    prepareFailed: "Could not prepare node “{node}”: {detail}",
    ws: {
      timeout: "{method}: no answer from the server",
      closed: "{method}: connection closed",
      addressChanged: "{method}: address changed",
      badAddress: "{method}: malformed address",
      unknownMethod: "{method}: method is not declared",
      remote: "{method}: the server refused — {detail}",
      badRequest: "{method}: malformed request — {detail}",
      badReply: "{method}: malformed reply — {detail}",
    },
    duration: {
      seconds: "{value} s",
      minutes: "{value} min",
      minutesSeconds: "{minutes} min {seconds} s",
      hours: "{value} h",
      hoursMinutes: "{hours} h {minutes} min",
    },
    eta: "{time} left",
    elapsed: "{time} elapsed",
    rate: {
      images: "{value} img/s",
      bytes: "{value} {unit}/s",
    },
    units: {
      bytes: "B",
      kilobytes: "KB",
      megabytes: "MB",
      gigabytes: "GB",
      terabytes: "TB",
    },
  },

  link: {
    title: "Link",
    check: "Check the link",
    checking: "Checking…",
    busy: "A run is going: {run}",
    unchecked: "The link has not been checked yet",
    state: {
      online: "The runner is online",
      unknown: "Link not found",
      expired: "Link expired",
      closed: "Link closed",
      gone: "The link is no longer valid",
      offline: "The runner is offline",
      unreachable: "The tunnel dropped",
      localDown: "The runner does not answer behind the tunnel",
      noNetwork: "Cannot connect to the address",
      noAnswer: "The server does not answer",
      notRunner: "This is not a runner",
      unverified: "The server answers, but the answer cannot be read",
      blocked: "The browser blocks the address",
      badAddress: "Invalid address",
    },
    hint: {
      online: "The address answers and the runner can take a run.",
      unknown:
        "This link was never published here. Check the address or restart the runner: a quick tunnel gets a new address every time.",
      expired:
        "The tunnel client vanished and did not come back in time. Restart the runner and the tunnel and update the address.",
      closed:
        "Publishing was stopped on the runner's side. Start the tunnel again.",
      gone: "The link expired or was closed. Start the tunnel again and update the address.",
      offline:
        "The tunnel is there but its client disconnected — it may come back. Wait, or check the runner process and the internet on its machine.",
      unreachable:
        "The runner is connected to the tunnel, but the connection dropped on this request. It usually passes by itself.",
      localDown:
        "The tunnel is alive but the service behind it refuses connections: the runner crashed or listens on another port.",
      noNetwork:
        "The address does not open: no network, a wrong name, a certificate problem or the server is off.",
      noAnswer:
        "The request left and nothing came back. The runner may be busy or the tunnel stalled; a run in progress keeps going.",
      notRunner:
        "The server answers, but without the runner's /health: check the address or update the runner.",
      unverified:
        "The address opens, but the browser cannot read the answer (no CORS). A WebSocket connection may still work.",
      blocked:
        "The page is on https and the runner is on http. Use a wss:// address (an https tunnel).",
      badAddress: "Use an address like ws://host:port/run or wss://host/run.",
    },
  },
};
